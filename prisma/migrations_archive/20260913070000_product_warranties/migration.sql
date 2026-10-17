ALTER TABLE `Product` ADD COLUMN `warrantyMonths` INTEGER NULL;
ALTER TABLE `VendorProduct` ADD COLUMN `warrantyMonths` INTEGER NULL;

CREATE TABLE `WarrantyRecord` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `productName` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `voidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WarrantyRecord_orderItemId_key`(`orderItemId`),
    INDEX `WarrantyRecord_customerId_expiresAt_idx`(`customerId`, `expiresAt`),
    INDEX `WarrantyRecord_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `WarrantyRecord_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WarrantyRecord` ADD CONSTRAINT `WarrantyRecord_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WarrantyRecord` ADD CONSTRAINT `WarrantyRecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WarrantyRecord` ADD CONSTRAINT `WarrantyRecord_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WarrantyRecord` ADD CONSTRAINT `WarrantyRecord_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `WarrantyRecord` ADD CONSTRAINT `WarrantyRecord_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
