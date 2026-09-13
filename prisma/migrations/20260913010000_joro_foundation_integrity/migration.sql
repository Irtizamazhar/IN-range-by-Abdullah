-- Joro foundation: ownership, idempotency, inventory reservations, reset tokens,
-- auditable order events, and exact payout allocations. Additive only.

-- These two columns already exist on installations where the former runtime
-- OAuth compatibility shim ran. Keep the migration safe for both states.
SET @add_customer_image = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'image') = 0,
  'ALTER TABLE `Customer` ADD COLUMN `image` VARCHAR(2048) NULL',
  'SELECT 1'
);
PREPARE add_customer_image_stmt FROM @add_customer_image;
EXECUTE add_customer_image_stmt;
DEALLOCATE PREPARE add_customer_image_stmt;

SET @add_customer_provider = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Customer' AND COLUMN_NAME = 'provider') = 0,
  'ALTER TABLE `Customer` ADD COLUMN `provider` VARCHAR(32) NULL',
  'SELECT 1'
);
PREPARE add_customer_provider_stmt FROM @add_customer_provider;
EXECUTE add_customer_provider_stmt;
DEALLOCATE PREPARE add_customer_provider_stmt;

ALTER TABLE `Customer`
  ADD COLUMN `sessionVersion` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `PaymentProofStaging`
  ADD COLUMN `customerId` VARCHAR(191) NULL,
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE INDEX `PaymentProofStaging_customerId_idx`
  ON `PaymentProofStaging`(`customerId`);
CREATE INDEX `PaymentProofStaging_expiresAt_idx`
  ON `PaymentProofStaging`(`expiresAt`);
ALTER TABLE `PaymentProofStaging`
  ADD CONSTRAINT `PaymentProofStaging_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Order`
  ADD COLUMN `customerId` VARCHAR(191) NULL,
  ADD COLUMN `checkoutKey` VARCHAR(128) NULL,
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `cancelReason` TEXT NULL;

-- Preserve every legacy order by linking it to the already-matching account.
UPDATE `Order` AS o
JOIN `Customer` AS c ON LOWER(c.`email`) = LOWER(o.`customerEmail`)
SET o.`customerId` = c.`id`
WHERE o.`customerId` IS NULL;

CREATE UNIQUE INDEX `Order_checkoutKey_key` ON `Order`(`checkoutKey`);
CREATE INDEX `Order_customerId_createdAt_idx` ON `Order`(`customerId`, `createdAt`);
ALTER TABLE `Order`
  ADD CONSTRAINT `Order_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `OrderInventoryLine` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `orderItemId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `vendorProductId` VARCHAR(191) NULL,
  `vendorShopOrderId` VARCHAR(191) NULL,
  `quantity` INTEGER NOT NULL,
  `state` ENUM('reserved', 'released', 'consumed') NOT NULL DEFAULT 'reserved',
  `releasedAt` DATETIME(3) NULL,
  `releaseReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `OrderInventoryLine_orderItemId_key`(`orderItemId`),
  INDEX `OrderInventoryLine_orderId_state_idx`(`orderId`, `state`),
  INDEX `OrderInventoryLine_vendorShopOrderId_state_idx`(`vendorShopOrderId`, `state`),
  INDEX `OrderInventoryLine_vendorProductId_idx`(`vendorProductId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderInventoryLine_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderInventoryLine_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderInventoryLine_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OrderInventoryLine_vendorProductId_fkey`
    FOREIGN KEY (`vendorProductId`) REFERENCES `VendorProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OrderInventoryLine_vendorShopOrderId_fkey`
    FOREIGN KEY (`vendorShopOrderId`) REFERENCES `VendorShopOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill one reservation/audit row per historical order line. Delivered lines
-- are consumed and cancelled lines are already released by the legacy flow.
INSERT INTO `OrderInventoryLine` (
  `id`, `orderId`, `orderItemId`, `productId`, `vendorProductId`,
  `vendorShopOrderId`, `quantity`, `state`, `releasedAt`, `releaseReason`,
  `createdAt`, `updatedAt`
)
SELECT
  UUID(), oi.`orderId`, oi.`id`, oi.`productId`, vp.`id`, vso.`id`, oi.`quantity`,
  CASE
    WHEN vso.`status` = 'delivered' THEN 'consumed'
    WHEN vso.`status` = 'cancelled' THEN 'released'
    WHEN vso.`id` IS NOT NULL THEN 'reserved'
    WHEN o.`orderStatus` = 'delivered' THEN 'consumed'
    WHEN o.`orderStatus` = 'cancelled' THEN 'released'
    ELSE 'reserved'
  END,
  CASE
    WHEN vso.`status` = 'cancelled' OR (vso.`id` IS NULL AND o.`orderStatus` = 'cancelled')
      THEN o.`updatedAt`
    ELSE NULL
  END,
  CASE
    WHEN vso.`status` = 'cancelled' OR (vso.`id` IS NULL AND o.`orderStatus` = 'cancelled')
      THEN 'legacy_cancelled_before_inventory_ledger'
    ELSE NULL
  END,
  o.`createdAt`, o.`updatedAt`
FROM `OrderItem` AS oi
JOIN `Order` AS o ON o.`id` = oi.`orderId`
LEFT JOIN `VendorProduct` AS vp ON vp.`publishedProductId` = oi.`productId`
LEFT JOIN `VendorShopOrder` AS vso
  ON vso.`orderId` = oi.`orderId` AND vso.`vendorId` = vp.`vendorId`;

CREATE TABLE `OrderStatusEvent` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `actorType` VARCHAR(32) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `fromStatus` VARCHAR(32) NULL,
  `toStatus` VARCHAR(32) NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OrderStatusEvent_idempotencyKey_key`(`idempotencyKey`),
  INDEX `OrderStatusEvent_orderId_createdAt_idx`(`orderId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderStatusEvent_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerPasswordResetToken` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomerPasswordResetToken_tokenHash_key`(`tokenHash`),
  INDEX `CustomerPasswordResetToken_customerId_expiresAt_idx`(`customerId`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerPasswordResetToken_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VendorEarning`
  ADD COLUMN `reservedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE `VendorEarning`
SET `paidAmount` = `vendorAmount`
WHERE `status` = 'paid';

ALTER TABLE `VendorWithdrawal`
  ADD COLUMN `transferReference` VARCHAR(191) NULL,
  ADD COLUMN `openKey` VARCHAR(191) NULL;

UPDATE `VendorWithdrawal`
SET `openKey` = `vendorId`
WHERE `status` IN ('pending', 'approved');

CREATE UNIQUE INDEX `VendorWithdrawal_openKey_key`
  ON `VendorWithdrawal`(`openKey`);

CREATE TABLE `PayoutAllocation` (
  `id` VARCHAR(191) NOT NULL,
  `withdrawalId` VARCHAR(191) NOT NULL,
  `earningId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `status` ENUM('reserved', 'paid', 'released') NOT NULL DEFAULT 'reserved',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PayoutAllocation_withdrawalId_earningId_key`(`withdrawalId`, `earningId`),
  INDEX `PayoutAllocation_earningId_status_idx`(`earningId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PayoutAllocation_withdrawalId_fkey`
    FOREIGN KEY (`withdrawalId`) REFERENCES `VendorWithdrawal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PayoutAllocation_earningId_fkey`
    FOREIGN KEY (`earningId`) REFERENCES `VendorEarning`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VendorLedgerEntry` (
  `id` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `earningId` VARCHAR(191) NULL,
  `withdrawalId` VARCHAR(191) NULL,
  `type` VARCHAR(64) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VendorLedgerEntry_idempotencyKey_key`(`idempotencyKey`),
  INDEX `VendorLedgerEntry_vendorId_createdAt_idx`(`vendorId`, `createdAt`),
  INDEX `VendorLedgerEntry_withdrawalId_idx`(`withdrawalId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VendorLedgerEntry_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VendorLedgerEntry_earningId_fkey`
    FOREIGN KEY (`earningId`) REFERENCES `VendorEarning`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `VendorLedgerEntry_withdrawalId_fkey`
    FOREIGN KEY (`withdrawalId`) REFERENCES `VendorWithdrawal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `VendorLedgerEntry` (
  `id`, `vendorId`, `earningId`, `withdrawalId`, `type`, `amount`,
  `idempotencyKey`, `details`, `createdAt`
)
SELECT
  UUID(), e.`vendorId`, e.`id`, NULL, 'earning_credit', e.`vendorAmount`,
  CONCAT('earning:', e.`id`), JSON_OBJECT('source', 'foundation_backfill'), e.`createdAt`
FROM `VendorEarning` AS e;

INSERT INTO `VendorLedgerEntry` (
  `id`, `vendorId`, `earningId`, `withdrawalId`, `type`, `amount`,
  `idempotencyKey`, `details`, `createdAt`
)
SELECT
  UUID(), w.`vendorId`, NULL, w.`id`, 'legacy_payout', -w.`requestedAmount`,
  CONCAT('legacy-withdrawal:', w.`id`), JSON_OBJECT('source', 'foundation_backfill'),
  COALESCE(w.`processedAt`, w.`requestedAt`)
FROM `VendorWithdrawal` AS w
WHERE w.`status` = 'paid';
