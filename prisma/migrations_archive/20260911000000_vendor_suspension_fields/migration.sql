ALTER TABLE `Vendor`
    ADD COLUMN `suspendedAt` DATETIME(3) NULL,
    ADD COLUMN `suspensionReason` TEXT NULL,
    ADD COLUMN `suspendedBy` VARCHAR(191) NULL,
    ADD COLUMN `suspensionUntil` DATETIME(3) NULL,
    ADD COLUMN `suspensionCount` INTEGER NOT NULL DEFAULT 0;
