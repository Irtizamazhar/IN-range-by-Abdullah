-- Additive after-sales workflow tables. Existing orders and financial records
-- are preserved; no defaults are backfilled into historical rows.

CREATE TABLE `ReturnRequest` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `reason` VARCHAR(120) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('requested', 'vendor_approved', 'vendor_rejected', 'return_in_transit', 'received', 'refund_pending', 'refunded', 'closed') NOT NULL DEFAULT 'requested',
    `customerTracking` VARCHAR(191) NULL,
    `vendorNote` TEXT NULL,
    `adminNote` TEXT NULL,
    `activeKey` VARCHAR(191) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ReturnRequest_activeKey_key`(`activeKey`),
    INDEX `ReturnRequest_customerId_requestedAt_idx`(`customerId`, `requestedAt`),
    INDEX `ReturnRequest_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `ReturnRequest_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Dispute` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `type` VARCHAR(80) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('open', 'under_review', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
    `resolution` TEXT NULL,
    `activeKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `resolvedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Dispute_activeKey_key`(`activeKey`),
    INDEX `Dispute_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `Dispute_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `Dispute_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Refund` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` VARCHAR(40) NOT NULL DEFAULT 'manual',
    `status` ENUM('pending', 'processed', 'rejected') NOT NULL DEFAULT 'pending',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `externalRef` VARCHAR(191) NULL,
    `adminNote` TEXT NULL,
    `processedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Refund_returnRequestId_key`(`returnRequestId`),
    UNIQUE INDEX `Refund_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Refund_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `Refund_orderId_status_idx`(`orderId`, `status`),
    INDEX `Refund_vendorId_status_idx`(`vendorId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ReturnRequest` ADD CONSTRAINT `ReturnRequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReturnRequest` ADD CONSTRAINT `ReturnRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ReturnRequest` ADD CONSTRAINT `ReturnRequest_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ReturnRequest` ADD CONSTRAINT `ReturnRequest_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Dispute` ADD CONSTRAINT `Dispute_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Dispute` ADD CONSTRAINT `Dispute_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Dispute` ADD CONSTRAINT `Dispute_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Dispute` ADD CONSTRAINT `Dispute_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Refund` ADD CONSTRAINT `Refund_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `ReturnRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Refund` ADD CONSTRAINT `Refund_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
