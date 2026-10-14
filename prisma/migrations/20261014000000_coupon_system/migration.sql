-- Extend the existing vendorcoupon table; existing rows retain vendor ownership.
ALTER TABLE `vendorcoupon`
  MODIFY `vendorId` VARCHAR(191) NULL,
  MODIFY `status` ENUM('active','inactive','paused','expired') NOT NULL DEFAULT 'active',
  ADD COLUMN `maxDiscount` DECIMAL(12,2) NULL,
  ADD COLUMN `codeKey` VARCHAR(32) NULL,
  ADD COLUMN `startDate` DATETIME(3) NULL,
  ADD COLUMN `productIds` JSON NULL,
  ADD COLUMN `categories` JSON NULL,
  ADD COLUMN `collectionIds` JSON NULL,
  ADD COLUMN `selectedVendorIds` JSON NULL,
  ADD COLUMN `customerIds` JSON NULL,
  ADD COLUMN `perCustomerLimit` INTEGER NULL,
  ADD COLUMN `ownerType` VARCHAR(16) NOT NULL DEFAULT 'VENDOR',
  ADD COLUMN `fundingType` VARCHAR(24) NOT NULL DEFAULT 'VENDOR_FUNDED',
  ADD COLUMN `budget` DECIMAL(12,2) NULL,
  ADD COLUMN `spent` DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN `approvals` JSON NULL,
  ADD COLUMN `approvedBy` VARCHAR(191) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `vendorcoupon` ADD INDEX `vendorcoupon_couponCode_status_idx` (`couponCode`, `status`);
ALTER TABLE `vendorcoupon` ADD UNIQUE INDEX `vendorcoupon_codeKey_key` (`codeKey`);

CREATE TABLE `couponredemption` (
  `id` VARCHAR(191) NOT NULL,
  `couponId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `snapshot` JSON NOT NULL,
  `discount` DECIMAL(12,2) NOT NULL,
  `platformFunded` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status` VARCHAR(24) NOT NULL DEFAULT 'redeemed',
  `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `restoredAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `couponredemption_orderId_key` (`orderId`),
  INDEX `couponredemption_couponId_status_idx` (`couponId`, `status`),
  INDEX `couponredemption_customerId_couponId_status_idx` (`customerId`, `couponId`, `status`),
  CONSTRAINT `couponredemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `vendorcoupon` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `couponredemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `couponredemption_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `couponcollection` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `productIds` JSON NOT NULL,
  `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `couponcollection_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refund` ADD COLUMN `couponPlatformReversal` DECIMAL(12,2) NOT NULL DEFAULT 0;
