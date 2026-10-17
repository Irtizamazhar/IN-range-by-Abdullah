-- AlterTable
ALTER TABLE `Review` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `Vendor` ADD COLUMN `serviceCities` JSON NULL,
    ADD COLUMN `storeBanner` TEXT NULL,
    ADD COLUMN `storePolicies` TEXT NULL,
    ADD COLUMN `storeSlug` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `StoreFollow` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StoreFollow_vendorId_createdAt_idx`(`vendorId`, `createdAt`),
    UNIQUE INDEX `StoreFollow_customerId_vendorId_key`(`customerId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Want` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `budgetMin` DECIMAL(12, 2) NULL,
    `budgetMax` DECIMAL(12, 2) NULL,
    `budgetFlexible` BOOLEAN NOT NULL DEFAULT false,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `photo` TEXT NULL,
    `condition` VARCHAR(191) NULL,
    `needBy` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_MODERATION', 'OPEN', 'FULFILLED', 'CLOSED', 'EXPIRED', 'REJECTED') NOT NULL DEFAULT 'PENDING_MODERATION',
    `moderationReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Want_status_expiresAt_createdAt_idx`(`status`, `expiresAt`, `createdAt`),
    INDEX `Want_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `Want_category_city_idx`(`category`, `city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WantInterest` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WantInterest_wantId_createdAt_idx`(`wantId`, `createdAt`),
    UNIQUE INDEX `WantInterest_customerId_wantId_key`(`customerId`, `wantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorPromotion` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `subtitle` VARCHAR(300) NULL,
    `desktopImage` TEXT NULL,
    `mobileImage` TEXT NULL,
    `ctaText` VARCHAR(191) NOT NULL DEFAULT 'View Store',
    `placement` VARCHAR(191) NOT NULL DEFAULT 'HOMEPAGE',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `isSponsored` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VendorPromotion_status_placement_startAt_endAt_idx`(`status`, `placement`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketplaceAudit` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MarketplaceAudit_target_createdAt_idx`(`target`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Review_customerId_productId_key` ON `Review`(`customerId`, `productId`);

-- CreateIndex
CREATE UNIQUE INDEX `Vendor_storeSlug_key` ON `Vendor`(`storeSlug`);

-- AddForeignKey
ALTER TABLE `StoreFollow` ADD CONSTRAINT `StoreFollow_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoreFollow` ADD CONSTRAINT `StoreFollow_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Want` ADD CONSTRAINT `Want_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WantInterest` ADD CONSTRAINT `WantInterest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WantInterest` ADD CONSTRAINT `WantInterest_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorPromotion` ADD CONSTRAINT `VendorPromotion_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
