-- Move the legacy JSON catalog onto database-backed models without deleting
-- source files or historical records. Data is imported by the versioned
-- scripts/migrate-json-catalog.ts step.

ALTER TABLE `Product`
  ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `legacyNewArrivalId` INTEGER NULL,
  ADD COLUMN `categoryRecordId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Product_legacyNewArrivalId_key`
  ON `Product`(`legacyNewArrivalId`);
CREATE INDEX `Product_categoryRecordId_idx`
  ON `Product`(`categoryRecordId`);

CREATE TABLE `Category` (
  `id` VARCHAR(191) NOT NULL,
  `legacyId` INTEGER NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `image` TEXT NOT NULL,
  `showOnHome` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Category_legacyId_key`(`legacyId`),
  UNIQUE INDEX `Category_name_key`(`name`),
  UNIQUE INDEX `Category_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Product`
  ADD CONSTRAINT `Product_categoryRecordId_fkey`
  FOREIGN KEY (`categoryRecordId`) REFERENCES `Category`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
