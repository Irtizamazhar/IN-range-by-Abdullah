-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL AUTO_INCREMENT,
    `actorType` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `category` VARCHAR(60) NOT NULL,
    `subject` VARCHAR(200) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `relatedResourceType` VARCHAR(40) NULL,
    `relatedResourceId` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SupportTicket_sequence_key`(`sequence`),
    INDEX `SupportTicket_actorType_customerId_status_idx`(`actorType`, `customerId`, `status`),
    INDEX `SupportTicket_actorType_vendorId_status_idx`(`actorType`, `vendorId`, `status`),
    INDEX `SupportTicket_status_priority_lastActivityAt_idx`(`status`, `priority`, `lastActivityAt`),
    INDEX `SupportTicket_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportMessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `senderType` VARCHAR(20) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `attachmentUrl` TEXT NULL,
    `isInternalNote` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupportMessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportMessage` ADD CONSTRAINT `SupportMessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

