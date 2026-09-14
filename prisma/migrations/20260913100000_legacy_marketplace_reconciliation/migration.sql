-- Reconcile databases that already applied
-- 20260913030000_customer_stores_wants before the merged marketplace schema.
-- Legacy WantPost and WantOffer data is copied forward and retained in archive
-- tables. This migration intentionally performs no database reset or data drop.

-- Review fields required by the merged review model.
ALTER TABLE `Review`
  ADD COLUMN `updatedAt` DATETIME(3) NULL,
  ADD COLUMN `withdrawn` BOOLEAN NOT NULL DEFAULT false;

UPDATE `Review` SET `updatedAt` = `createdAt` WHERE `updatedAt` IS NULL;

ALTER TABLE `Review`
  MODIFY `updatedAt` DATETIME(3) NOT NULL;

CREATE UNIQUE INDEX `Review_customerId_productId_key`
  ON `Review`(`customerId`, `productId`);

-- Public store profile fields.
ALTER TABLE `Vendor`
  ADD COLUMN `serviceCities` JSON NULL,
  ADD COLUMN `storeBanner` TEXT NULL,
  ADD COLUMN `storePolicies` TEXT NULL,
  ADD COLUMN `storeSlug` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Vendor_storeSlug_key` ON `Vendor`(`storeSlug`);

-- Convert the legacy composite StoreFollow key to the merged model while
-- retaining every existing follow record.
ALTER TABLE `StoreFollow` ADD COLUMN `id` VARCHAR(191) NULL FIRST;

UPDATE `StoreFollow`
SET `id` = CONCAT(
  'legacy_follow_',
  LEFT(SHA2(CONCAT(`customerId`, ':', `vendorId`), 256), 40)
)
WHERE `id` IS NULL;

CREATE UNIQUE INDEX `StoreFollow_customerId_vendorId_key`
  ON `StoreFollow`(`customerId`, `vendorId`);
CREATE INDEX `StoreFollow_vendorId_createdAt_idx`
  ON `StoreFollow`(`vendorId`, `createdAt`);

ALTER TABLE `StoreFollow`
  DROP PRIMARY KEY,
  MODIFY `id` VARCHAR(191) NOT NULL,
  ADD PRIMARY KEY (`id`);

DROP INDEX `StoreFollow_vendorId_idx` ON `StoreFollow`;

-- Final moderated Wants model.
CREATE TABLE `Want` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `budgetMin` DECIMAL(12, 2) NULL,
  `budgetMax` DECIMAL(12, 2) NULL,
  `budgetFlexible` BOOLEAN NOT NULL DEFAULT false,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `description` TEXT NULL,
  `photo` TEXT NULL,
  `condition` VARCHAR(191) NULL,
  `needBy` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_MODERATION', 'OPEN', 'FULFILLED', 'CLOSED', 'EXPIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING_MODERATION',
  `moderationReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Want_status_expiresAt_createdAt_idx`(`status`, `expiresAt`, `createdAt`),
  INDEX `Want_customerId_createdAt_idx`(`customerId`, `createdAt`),
  INDEX `Want_category_city_idx`(`category`, `city`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Want_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Want` (
  `id`, `customerId`, `title`, `category`, `city`, `budgetMin`,
  `budgetMax`, `budgetFlexible`, `quantity`, `description`, `photo`,
  `condition`, `needBy`, `expiresAt`, `status`, `moderationReason`,
  `createdAt`, `updatedAt`
)
SELECT
  `id`,
  `customerId`,
  LEFT(`title`, 160),
  `category`,
  `city`,
  `budgetMin`,
  `budgetMax`,
  false,
  `quantity`,
  `description`,
  NULL,
  `condition`,
  NULL,
  COALESCE(`expiresAt`, '9999-12-31 23:59:59.999'),
  CASE `status`
    WHEN 'pending' THEN 'PENDING_MODERATION'
    WHEN 'open' THEN 'OPEN'
    WHEN 'fulfilled' THEN 'FULFILLED'
    WHEN 'closed' THEN 'CLOSED'
    WHEN 'rejected' THEN 'REJECTED'
    ELSE 'PENDING_MODERATION'
  END,
  `moderationNote`,
  `createdAt`,
  `updatedAt`
FROM `WantPost`;

CREATE TABLE `WantInterest` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `WantInterest_wantId_createdAt_idx`(`wantId`, `createdAt`),
  UNIQUE INDEX `WantInterest_customerId_wantId_key`(`customerId`, `wantId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WantInterest_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WantInterest_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve the old offer table, then create the revision-based negotiation
-- model expected by the pulled application.
ALTER TABLE `WantOffer`
  DROP FOREIGN KEY `WantOffer_wantId_fkey`,
  DROP FOREIGN KEY `WantOffer_vendorId_fkey`;

RENAME TABLE `WantOffer` TO `WantOfferLegacy20260914`;

CREATE TABLE `WantOffer` (
  `id` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `WantOffer_wantId_vendorId_key`(`wantId`, `vendorId`),
  INDEX `WantOffer_vendorId_status_idx`(`vendorId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WantOffer_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `WantOffer_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `WantOffer` (
  `id`, `wantId`, `vendorId`, `status`, `version`, `createdAt`, `updatedAt`
)
SELECT
  `id`,
  `wantId`,
  `vendorId`,
  CASE `status`
    WHEN 'accepted' THEN 'ACCEPTED'
    WHEN 'rejected' THEN 'DECLINED'
    WHEN 'withdrawn' THEN 'WITHDRAWN'
    ELSE 'SUBMITTED'
  END,
  1,
  `createdAt`,
  `updatedAt`
FROM `WantOfferLegacy20260914`;

CREATE TABLE `OfferRevision` (
  `id` VARCHAR(191) NOT NULL,
  `offerId` VARCHAR(191) NOT NULL,
  `revisionNumber` INTEGER NOT NULL,
  `initiator` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `shipping` DECIMAL(12, 2) NOT NULL,
  `delivery` VARCHAR(300) NOT NULL,
  `condition` VARCHAR(100) NOT NULL,
  `warranty` VARCHAR(1000) NOT NULL,
  `message` TEXT NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `OfferRevision_offerId_revisionNumber_key`(`offerId`, `revisionNumber`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OfferRevision_offerId_fkey`
    FOREIGN KEY (`offerId`) REFERENCES `WantOffer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferRevision_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `OfferRevision` (
  `id`, `offerId`, `revisionNumber`, `initiator`, `productId`, `price`,
  `quantity`, `shipping`, `delivery`, `condition`, `warranty`, `message`,
  `expiresAt`, `createdAt`
)
SELECT
  CONCAT('legacy_revision_', legacy.`id`),
  legacy.`id`,
  1,
  'VENDOR',
  NULL,
  legacy.`amount`,
  want.`quantity`,
  0,
  CASE
    WHEN legacy.`estimatedDays` IS NULL THEN 'Delivery timing not specified (legacy offer)'
    ELSE CONCAT('Estimated ', legacy.`estimatedDays`, ' day(s)')
  END,
  COALESCE(NULLIF(want.`condition`, ''), 'Not specified (legacy offer)'),
  'Not specified (legacy offer)',
  legacy.`message`,
  want.`expiresAt`,
  legacy.`createdAt`
FROM `WantOfferLegacy20260914` legacy
INNER JOIN `Want` want ON want.`id` = legacy.`wantId`;

CREATE TABLE `OfferQuote` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `revisionId` VARCHAR(191) NOT NULL,
  `snapshot` JSON NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `orderId` VARCHAR(191) NULL,
  UNIQUE INDEX `OfferQuote_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `OfferQuote_wantId_key`(`wantId`),
  UNIQUE INDEX `OfferQuote_revisionId_key`(`revisionId`),
  UNIQUE INDEX `OfferQuote_orderId_key`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OfferQuote_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_revisionId_fkey`
    FOREIGN KEY (`revisionId`) REFERENCES `OfferRevision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VendorPromotion` (
  `id` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `subtitle` VARCHAR(300) NULL,
  `desktopImage` TEXT NULL,
  `mobileImage` TEXT NULL,
  `ctaText` VARCHAR(191) NOT NULL DEFAULT 'View Store',
  `placement` VARCHAR(191) NOT NULL DEFAULT 'HOMEPAGE',
  `priority` INTEGER NOT NULL DEFAULT 0,
  `startAt` DATETIME(3) NOT NULL,
  `endAt` DATETIME(3) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  `isSponsored` BOOLEAN NOT NULL DEFAULT false,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `VendorPromotion_status_placement_startAt_endAt_idx`(`status`, `placement`, `startAt`, `endAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VendorPromotion_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MarketplaceAudit` (
  `id` VARCHAR(191) NOT NULL,
  `actor` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `target` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MarketplaceAudit_target_createdAt_idx`(`target`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Product-linked services and their independent fulfilment lifecycle.
CREATE TABLE `ServiceOffering` (
  `id` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `description` TEXT NOT NULL,
  `type` VARCHAR(100) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `cities` JSON NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `leadDays` INTEGER NOT NULL,
  `warranty` VARCHAR(1000) NOT NULL,
  `cancellationTerms` TEXT NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ServiceOffering_vendorId_active_idx`(`vendorId`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceOffering_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductServiceAddon` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `ProductServiceAddon_productId_serviceId_key`(`productId`, `serviceId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProductServiceAddon_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProductServiceAddon_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `ServiceOffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderService` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `snapshot` JSON NOT NULL,
  `quantity` INTEGER NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `commissionRate` DECIMAL(5, 2) NOT NULL,
  `commissionAmount` DECIMAL(12, 2) NOT NULL,
  `vendorPayable` DECIMAL(12, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `scheduledAt` DATETIME(3) NULL,
  `refundStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `OrderService_vendorId_status_idx`(`vendorId`, `status`),
  INDEX `OrderService_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderService_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderService_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderService_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `ServiceOffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceEvent` (
  `id` VARCHAR(191) NOT NULL,
  `orderServiceId` VARCHAR(191) NOT NULL,
  `actor` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `note` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ServiceEvent_orderServiceId_createdAt_idx`(`orderServiceId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceEvent_orderServiceId_fkey`
    FOREIGN KEY (`orderServiceId`) REFERENCES `OrderService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VendorEarning` ADD COLUMN `orderServiceId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `VendorEarning_orderServiceId_key`
  ON `VendorEarning`(`orderServiceId`);
ALTER TABLE `VendorEarning`
  ADD CONSTRAINT `VendorEarning_orderServiceId_fkey`
  FOREIGN KEY (`orderServiceId`) REFERENCES `OrderService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Authenticated Shop Together rooms.
CREATE TABLE `ShoppingRoom` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `archived` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomMember` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RoomMember_roomId_customerId_key`(`roomId`, `customerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomMember_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomMember_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomInvite` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revoked` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RoomInvite_tokenHash_key`(`tokenHash`),
  INDEX `RoomInvite_roomId_idx`(`roomId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomInvite_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomItem` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  `variant` VARCHAR(191) NOT NULL DEFAULT '',
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `priceAtAddition` DECIMAL(12, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RoomItem_roomId_idx`(`roomId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomItem_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomItem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomItem_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomVote` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `RoomVote_memberId_itemId_key`(`memberId`, `itemId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomVote_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `RoomItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RoomVote_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomComment` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  `text` VARCHAR(2000) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RoomComment_itemId_idx`(`itemId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomComment_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `RoomItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RoomComment_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StoreSlugAlias` (
  `slug` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`slug`),
  CONSTRAINT `StoreSlugAlias_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VendorNotification`
  ADD COLUMN `eventKey` VARCHAR(191) NULL,
  ADD COLUMN `href` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `VendorNotification_eventKey_key`
  ON `VendorNotification`(`eventKey`);

ALTER TABLE `WarrantyRecord` ADD COLUMN `vendorProductId` VARCHAR(191) NULL;
ALTER TABLE `WarrantyRecord`
  ADD CONSTRAINT `WarrantyRecord_vendorProductId_fkey`
  FOREIGN KEY (`vendorProductId`) REFERENCES `VendorProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
