-- CreateTable
CREATE TABLE `wantreaction` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `type` ENUM('LIKE', 'LOVE', 'SUPPORT', 'WOW', 'FIRE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `wantreaction_wantId_type_idx`(`wantId`, `type`),
    INDEX `wantreaction_customerId_idx`(`customerId`),
    INDEX `wantreaction_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `wantreaction_wantId_customerId_key`(`wantId`, `customerId`),
    UNIQUE INDEX `wantreaction_wantId_vendorId_key`(`wantId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wantreport` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `reason` VARCHAR(40) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wantreport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `wantreport_customerId_idx`(`customerId`),
    INDEX `wantreport_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `wantreport_wantId_customerId_key`(`wantId`, `customerId`),
    UNIQUE INDEX `wantreport_wantId_vendorId_key`(`wantId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

