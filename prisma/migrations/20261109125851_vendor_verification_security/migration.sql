-- AlterTable
ALTER TABLE `vendor` ADD COLUMN `approvedAt` DATETIME(3) NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL,
    ADD COLUMN `bankChangeRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `bankVerificationStatus` ENUM('verified', 'pending_review') NULL,
    ADD COLUMN `bankVerifiedAt` DATETIME(3) NULL,
    ADD COLUMN `bankVerifiedBy` VARCHAR(191) NULL,
    ADD COLUMN `cnicCheckId` VARCHAR(191) NULL,
    ADD COLUMN `cnicCheckStatus` ENUM('MATCHED', 'CNIC_MISMATCH', 'NAME_MISMATCH', 'UNREADABLE', 'NOT_A_CNIC', 'SERVICE_ERROR', 'MANUAL_REVIEW_REQUIRED') NULL,
    ADD COLUMN `cnicCheckedAt` DATETIME(3) NULL,
    ADD COLUMN `ocrConsentAt` DATETIME(3) NULL,
    ADD COLUMN `verifiedAccountNumber` VARCHAR(64) NULL,
    ADD COLUMN `verifiedAccountTitle` VARCHAR(200) NULL,
    ADD COLUMN `verifiedBankName` VARCHAR(120) NULL,
    ADD COLUMN `verifiedIban` VARCHAR(34) NULL;

-- CreateTable
CREATE TABLE `vendordocumentcheck` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `imageSha256` CHAR(64) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `readStatus` ENUM('READ', 'UNREADABLE', 'NOT_A_CNIC', 'SERVICE_ERROR') NOT NULL,
    `extractedEnc` TEXT NULL,
    `cnicLast4` VARCHAR(4) NULL,
    `confidence` DOUBLE NULL,
    `errorCode` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendordocumentcheck_documentId_key`(`documentId`),
    INDEX `vendordocumentcheck_vendorId_createdAt_idx`(`vendorId`, `createdAt`),
    INDEX `vendordocumentcheck_imageSha256_idx`(`imageSha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendordocumentcheck` ADD CONSTRAINT `vendordocumentcheck_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendordocumentcheck` ADD CONSTRAINT `vendordocumentcheck_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `vendordocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
