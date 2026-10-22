-- CreateTable
CREATE TABLE `pickupvisit` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `pickupAddress` TEXT NOT NULL,
    `pickupCity` VARCHAR(120) NOT NULL,
    `contactName` VARCHAR(200) NOT NULL,
    `contactPhone` VARCHAR(30) NOT NULL,
    `courierName` VARCHAR(200) NULL,
    `agentName` VARCHAR(200) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `status` ENUM('ready', 'scheduled', 'assigned', 'collected', 'failed', 'handed_over', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `failedReason` TEXT NULL,
    `collectedAt` DATETIME(3) NULL,
    `handoverAt` DATETIME(3) NULL,
    `handoverReference` VARCHAR(191) NULL,
    `history` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `pickupvisit_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `pickupvisit_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pickuprequest` (
    `id` VARCHAR(191) NOT NULL,
    `pickupReference` VARCHAR(32) NOT NULL,
    `shopOrderId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `visitId` VARCHAR(191) NULL,
    `pickupAddress` TEXT NOT NULL,
    `pickupCity` VARCHAR(120) NOT NULL,
    `contactName` VARCHAR(200) NOT NULL,
    `contactPhone` VARCHAR(30) NOT NULL,
    `parcelCount` INTEGER NOT NULL DEFAULT 1,
    `weightKg` DECIMAL(8, 2) NULL,
    `preferredWindow` VARCHAR(255) NULL,
    `instructions` TEXT NULL,
    `packedConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('ready', 'scheduled', 'assigned', 'collected', 'failed', 'handed_over', 'cancelled') NOT NULL DEFAULT 'ready',
    `readyAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `collectedAt` DATETIME(3) NULL,
    `handoverAt` DATETIME(3) NULL,
    `handoverReference` VARCHAR(191) NULL,
    `trackingNumber` VARCHAR(255) NULL,
    `failedReason` TEXT NULL,
    `history` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pickuprequest_pickupReference_key`(`pickupReference`),
    UNIQUE INDEX `pickuprequest_shopOrderId_key`(`shopOrderId`),
    INDEX `pickuprequest_vendorId_status_readyAt_idx`(`vendorId`, `status`, `readyAt`),
    INDEX `pickuprequest_visitId_idx`(`visitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pickupvisit` ADD CONSTRAINT `pickupvisit_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pickuprequest` ADD CONSTRAINT `pickuprequest_shopOrderId_fkey` FOREIGN KEY (`shopOrderId`) REFERENCES `vendorshoporder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pickuprequest` ADD CONSTRAINT `pickuprequest_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pickuprequest` ADD CONSTRAINT `pickuprequest_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `pickupvisit`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
