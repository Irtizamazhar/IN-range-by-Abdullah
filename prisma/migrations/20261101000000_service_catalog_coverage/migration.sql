-- Forward-only: preserve legacy listings, all bookings and all financial snapshots.
CREATE TABLE `servicecatalog` (
 `id` VARCHAR(191) NOT NULL, `name` VARCHAR(160) NOT NULL,
 `category` VARCHAR(100) NOT NULL, `description` TEXT NOT NULL,
 `defaultPrice` DECIMAL(12,2) NOT NULL, `priceType` VARCHAR(20) NOT NULL DEFAULT 'STARTING_FROM',
 `active` BOOLEAN NOT NULL DEFAULT true, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `servicecatalog_category_name_key` (`category`,`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `serviceoffering`
 MODIFY `moderationStatus` VARCHAR(24) NOT NULL DEFAULT 'PENDING_APPROVAL',
 ADD COLUMN `catalogId` VARCHAR(191) NULL,
 ADD COLUMN `priceType` VARCHAR(20) NOT NULL DEFAULT 'STARTING_FROM',
 ADD COLUMN `coverage` JSON NULL,
 ADD COLUMN `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 ADD COLUMN `reviewedAt` DATETIME(3) NULL,
 ADD COLUMN `reviewedBy` VARCHAR(191) NULL,
 ADD COLUMN `createdByAdmin` VARCHAR(191) NULL,
 ADD UNIQUE INDEX `serviceoffering_vendorId_catalogId_key` (`vendorId`,`catalogId`),
 ADD INDEX `serviceoffering_moderationStatus_submittedAt_idx` (`moderationStatus`,`submittedAt`),
 ADD CONSTRAINT `serviceoffering_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `servicecatalog`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
-- Initialize the new historical submission timestamp without changing published terms.
UPDATE `serviceoffering` SET `submittedAt` = `createdAt`;
CREATE TABLE `servicelocationrequest` (
 `id` VARCHAR(191) NOT NULL, `vendorId` VARCHAR(191) NOT NULL,
 `city` VARCHAR(200) NOT NULL, `area` VARCHAR(200) NOT NULL, `details` VARCHAR(1000) NOT NULL,
 `status` VARCHAR(20) NOT NULL DEFAULT 'OPEN', `reviewNote` VARCHAR(1000) NULL, `reviewedBy` VARCHAR(191) NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`), INDEX `servicelocationrequest_status_createdAt_idx` (`status`,`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
