-- AlterTable
ALTER TABLE `vendorpromotion` ADD COLUMN `ctaHref` TEXT NULL,
    MODIFY `placement` VARCHAR(191) NOT NULL DEFAULT 'HOMEPAGE_SPOTLIGHT',
    MODIFY `endAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `TopVendor` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `label` VARCHAR(60) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TopVendor_vendorId_key`(`vendorId`),
    INDEX `TopVendor_enabled_priority_idx`(`enabled`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TopVendor` ADD CONSTRAINT `TopVendor_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

