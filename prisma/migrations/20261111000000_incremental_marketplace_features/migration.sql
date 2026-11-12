-- AlterTable
ALTER TABLE `couponredemption` MODIFY `customerId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `homepagepromotion` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `subtitle` VARCHAR(300) NOT NULL DEFAULT '',
    `image` TEXT NULL,
    `href` VARCHAR(500) NOT NULL,
    `placement` VARCHAR(24) NOT NULL DEFAULT 'BANNER',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `position` INTEGER NOT NULL DEFAULT 0,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `homepagepromotion_enabled_placement_position_idx`(`enabled`, `placement`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livechataccess` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `visitorReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `adminReadAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `livechataccess_tokenHash_key`(`tokenHash`),
    UNIQUE INDEX `livechataccess_ticketId_key`(`ticketId`),
    INDEX `livechataccess_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livechatreceipt` (
    `key` CHAR(64) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `livechatreceipt_messageId_key`(`messageId`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `livechatpresence` (
    `adminId` VARCHAR(191) NOT NULL,
    `available` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`adminId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `newslettersubscription` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    `customerId` VARCHAR(191) NULL,
    `confirmationHash` CHAR(64) NULL,
    `confirmationExpiresAt` DATETIME(3) NULL,
    `unsubscribeHash` CHAR(64) NOT NULL,
    `consentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmedAt` DATETIME(3) NULL,
    `unsubscribedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `newslettersubscription_email_key`(`email`),
    UNIQUE INDEX `newslettersubscription_confirmationHash_key`(`confirmationHash`),
    UNIQUE INDEX `newslettersubscription_unsubscribeHash_key`(`unsubscribeHash`),
    INDEX `newslettersubscription_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guestorderaccess` (
    `orderId` VARCHAR(191) NOT NULL,
    `ownerHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `guestorderaccess_ownerHash_expiresAt_idx`(`ownerHash`, `expiresAt`),
    PRIMARY KEY (`orderId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publicfeaturerate` (
    `key` CHAR(64) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `publicfeaturerate_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `livechataccess` ADD CONSTRAINT `livechataccess_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `supportticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `livechatreceipt` ADD CONSTRAINT `livechatreceipt_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `supportmessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guestorderaccess` ADD CONSTRAINT `guestorderaccess_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

