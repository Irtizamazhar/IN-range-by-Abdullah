-- Additive marketing preferences; existing accounts remain without opt-in.
ALTER TABLE `customer`
  ADD COLUMN `marketingEmailConsentAt` DATETIME(3) NULL,
  ADD COLUMN `marketingEmailUnsubscribedAt` DATETIME(3) NULL;

ALTER TABLE `vendor`
  ADD COLUMN `marketingEmailConsentAt` DATETIME(3) NULL,
  ADD COLUMN `marketingEmailUnsubscribedAt` DATETIME(3) NULL;

CREATE TABLE `emailcampaign` (
  `id` VARCHAR(191) NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `previewText` VARCHAR(240) NOT NULL DEFAULT '',
  `bodyHtml` TEXT NOT NULL,
  `audience` VARCHAR(16) NOT NULL DEFAULT 'CUSTOMERS',
  `recipientIds` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  `createdBy` VARCHAR(191) NOT NULL,
  `lastTestAt` DATETIME(3) NULL,
  `lastTestStatus` VARCHAR(16) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `emailcampaign_status_createdAt_idx` (`status`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
