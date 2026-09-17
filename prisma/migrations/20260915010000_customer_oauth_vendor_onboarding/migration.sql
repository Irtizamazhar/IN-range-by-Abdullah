-- Preserve all rows and existing vendor statuses. Only incomplete accounts use onboarding.
CREATE TABLE `CustomerOAuthAccount` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `providerAccountId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CustomerOAuthAccount_provider_providerAccountId_key` (`provider`, `providerAccountId`),
  INDEX `CustomerOAuthAccount_customerId_idx` (`customerId`),
  CONSTRAINT `CustomerOAuthAccount_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Vendor`
  MODIFY `status` ENUM('onboarding','pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  MODIFY `cnic` VARCHAR(191) NULL,
  ALTER COLUMN `shopName` SET DEFAULT '',
  ALTER COLUMN `phone` SET DEFAULT '',
  ALTER COLUMN `city` SET DEFAULT '',
  ALTER COLUMN `bankName` SET DEFAULT '',
  ALTER COLUMN `accountNumber` SET DEFAULT '',
  ALTER COLUMN `accountTitle` SET DEFAULT '',
  ALTER COLUMN `businessType` SET DEFAULT 'individual';
-- address remains required in SQL and is explicitly supplied as empty for new draft accounts.