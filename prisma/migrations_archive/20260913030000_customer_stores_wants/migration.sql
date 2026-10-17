CREATE TABLE `CustomerAddress` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `label` VARCHAR(60) NOT NULL DEFAULT 'Home',
  `recipientName` VARCHAR(200) NOT NULL,
  `phone` VARCHAR(40) NOT NULL,
  `address` TEXT NOT NULL,
  `city` VARCHAR(120) NOT NULL,
  `postalCode` VARCHAR(30) NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CustomerAddress_customerId_isDefault_idx`(`customerId`, `isDefault`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerAddress_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SavedProduct` (
  `customerId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SavedProduct_productId_idx`(`productId`),
  PRIMARY KEY (`customerId`, `productId`),
  CONSTRAINT `SavedProduct_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SavedProduct_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StoreFollow` (
  `customerId` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StoreFollow_vendorId_idx`(`vendorId`),
  PRIMARY KEY (`customerId`, `vendorId`),
  CONSTRAINT `StoreFollow_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StoreFollow_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WantPost` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `city` VARCHAR(120) NOT NULL,
  `budgetMin` DECIMAL(12, 2) NULL,
  `budgetMax` DECIMAL(12, 2) NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `condition` VARCHAR(60) NULL,
  `status` ENUM('pending','open','fulfilled','closed','rejected') NOT NULL DEFAULT 'pending',
  `moderationNote` TEXT NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `WantPost_status_createdAt_idx`(`status`, `createdAt`),
  INDEX `WantPost_customerId_createdAt_idx`(`customerId`, `createdAt`),
  INDEX `WantPost_category_city_idx`(`category`, `city`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WantPost_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WantOffer` (
  `id` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `message` TEXT NOT NULL,
  `estimatedDays` INTEGER NULL,
  `status` ENUM('pending','accepted','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `WantOffer_wantId_vendorId_key`(`wantId`, `vendorId`),
  INDEX `WantOffer_vendorId_status_idx`(`vendorId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WantOffer_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `WantPost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WantOffer_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
