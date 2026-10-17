-- Baseline: the complete JORO schema, generated from prisma/schema.prisma with
--   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- It replaces the earlier migration history (kept in prisma/migrations_archive/),
-- which could not be replayed on an empty database: the original tables were
-- created with `prisma db push` and never had a migration.
--
-- Existing databases (production) must NOT execute this file. They are marked as
-- already applied with `prisma migrate resolve --applied 0_baseline`
-- only after their schema is verified to match prisma/schema.prisma exactly.

-- CreateTable
CREATE TABLE `customer` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `welcomeEligibleAt` DATETIME(3) NULL,
    `welcomeSeenAt` DATETIME(3) NULL,
    `marketingEmailConsentAt` DATETIME(3) NULL,
    `marketingEmailUnsubscribedAt` DATETIME(3) NULL,
    `image` VARCHAR(2048) NULL,
    `provider` VARCHAR(32) NULL,
    `sessionVersion` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `adminNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_email_key`(`email`),
    INDEX `customer_isActive_createdAt_idx`(`isActive`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `originalPrice` DECIMAL(12, 2) NULL,
    `discountPercent` INTEGER NOT NULL DEFAULT 0,
    `category` VARCHAR(191) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `warrantyMonths` INTEGER NULL,
    `variants` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isBestSeller` BOOLEAN NOT NULL DEFAULT false,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `legacyNewArrivalId` INTEGER NULL,
    `categoryRecordId` VARCHAR(191) NULL,
    `listingImageUrls` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_legacyNewArrivalId_key`(`legacyNewArrivalId`),
    INDEX `product_isActive_isBestSeller_idx`(`isActive`, `isBestSeller`),
    INDEX `product_categoryRecordId_idx`(`categoryRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `category` (
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

    UNIQUE INDEX `category_legacyId_key`(`legacyId`),
    UNIQUE INDEX `category_name_key`(`name`),
    UNIQUE INDEX `category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NOT NULL,
    `imageUrl` VARCHAR(2048) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `withdrawn` BOOLEAN NOT NULL DEFAULT false,
    `customerId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `review_productId_idx`(`productId`),
    INDEX `review_approved_createdAt_idx`(`approved`, `createdAt`),
    UNIQUE INDEX `review_customerId_productId_key`(`customerId`, `productId`),
    UNIQUE INDEX `review_orderId_productId_key`(`orderId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `newarrivalreview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NOT NULL,
    `imageUrl` VARCHAR(2048) NULL,
    `newArrivalId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved` BOOLEAN NOT NULL DEFAULT false,

    INDEX `newarrivalreview_newArrivalId_idx`(`newArrivalId`),
    INDEX `newarrivalreview_approved_createdAt_idx`(`approved`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productimage` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `data` MEDIUMBLOB NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paymentproofstaging` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `data` MEDIUMBLOB NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `paymentproofstaging_customerId_idx`(`customerId`),
    INDEX `paymentproofstaging_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerAddress` TEXT NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `handlingFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `paymentRejectedReason` TEXT NULL,
    `paymentScreenshot` TEXT NULL,
    `paymentProofData` MEDIUMBLOB NULL,
    `paymentProofMime` VARCHAR(191) NULL,
    `bankAccount` VARCHAR(191) NULL,
    `orderStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `customerId` VARCHAR(191) NULL,
    `checkoutKey` VARCHAR(128) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelReason` TEXT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `trackingNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `order_checkoutKey_key`(`checkoutKey`),
    INDEX `order_customerId_createdAt_idx`(`customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderConfirmationEmail` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `recipientKey` VARCHAR(191) NOT NULL DEFAULT 'customer',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OrderConfirmationEmail_status_availableAt_idx`(`status`, `availableAt`),
    UNIQUE INDEX `OrderConfirmationEmail_orderId_recipientKey_key`(`orderId`, `recipientKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orderitem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `image` VARCHAR(191) NOT NULL DEFAULT '',
    `variant` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orderinventoryline` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `vendorProductId` VARCHAR(191) NULL,
    `vendorShopOrderId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `state` ENUM('reserved', 'released', 'consumed') NOT NULL DEFAULT 'reserved',
    `releasedAt` DATETIME(3) NULL,
    `releaseReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orderinventoryline_orderItemId_key`(`orderItemId`),
    INDEX `orderinventoryline_orderId_state_idx`(`orderId`, `state`),
    INDEX `orderinventoryline_vendorShopOrderId_state_idx`(`vendorShopOrderId`, `state`),
    INDEX `orderinventoryline_vendorProductId_idx`(`vendorProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orderstatusevent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(32) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `eventType` VARCHAR(64) NOT NULL,
    `fromStatus` VARCHAR(32) NULL,
    `toStatus` VARCHAR(32) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `orderstatusevent_idempotencyKey_key`(`idempotencyKey`),
    INDEX `orderstatusevent_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customerpasswordresettoken` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customerpasswordresettoken_tokenHash_key`(`tokenHash`),
    INDEX `customerpasswordresettoken_customerId_expiresAt_idx`(`customerId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customernotification` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(500) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customernotification_idempotencyKey_key`(`idempotencyKey`),
    INDEX `customernotification_customerId_isRead_createdAt_idx`(`customerId`, `isRead`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customeraddress` (
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

    INDEX `customeraddress_customerId_isDefault_idx`(`customerId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `savedproduct` (
    `customerId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `savedproduct_productId_idx`(`productId`),
    PRIMARY KEY (`customerId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storefollow` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `storefollow_vendorId_createdAt_idx`(`vendorId`, `createdAt`),
    UNIQUE INDEX `storefollow_customerId_vendorId_key`(`customerId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `returnrequest` (
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

    UNIQUE INDEX `returnrequest_activeKey_key`(`activeKey`),
    INDEX `returnrequest_customerId_requestedAt_idx`(`customerId`, `requestedAt`),
    INDEX `returnrequest_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `returnrequest_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispute` (
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

    UNIQUE INDEX `dispute_activeKey_key`(`activeKey`),
    INDEX `dispute_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `dispute_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `dispute_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refund` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `returnRequestId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `couponPlatformReversal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `method` VARCHAR(40) NOT NULL DEFAULT 'manual',
    `status` ENUM('pending', 'processed', 'rejected') NOT NULL DEFAULT 'pending',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `externalRef` VARCHAR(191) NULL,
    `adminNote` TEXT NULL,
    `processedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refund_returnRequestId_key`(`returnRequestId`),
    UNIQUE INDEX `refund_idempotencyKey_key`(`idempotencyKey`),
    INDEX `refund_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `refund_orderId_status_idx`(`orderId`, `status`),
    INDEX `refund_vendorId_status_idx`(`vendorId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `warrantyrecord` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `productName` VARCHAR(255) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `voidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `vendorProductId` VARCHAR(191) NULL,

    UNIQUE INDEX `warrantyrecord_orderItemId_key`(`orderItemId`),
    INDEX `warrantyrecord_customerId_expiresAt_idx`(`customerId`, `expiresAt`),
    INDEX `warrantyrecord_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `warrantyrecord_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adminuser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(40) NOT NULL DEFAULT 'operations',
    `permissions` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `adminuser_email_key`(`email`),
    INDEX `adminuser_isActive_role_idx`(`isActive`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adminauditlog` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entityType` VARCHAR(80) NULL,
    `entityId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `adminauditlog_adminId_createdAt_idx`(`adminId`, `createdAt`),
    INDEX `adminauditlog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `adminauditlog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL,
    `shopName` VARCHAR(191) NOT NULL DEFAULT 'In Range By Abdullah',
    `whatsappNumber` VARCHAR(191) NOT NULL DEFAULT '923001234567',
    `codCharges` DECIMAL(12, 2) NOT NULL DEFAULT 150,
    `codAvailableCities` JSON NOT NULL,
    `bankMeezanTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `bankMeezanNumber` VARCHAR(191) NOT NULL DEFAULT '',
    `bankHblTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `bankHblNumber` VARCHAR(191) NOT NULL DEFAULT '',
    `bankEasypaisa` VARCHAR(191) NOT NULL DEFAULT '',
    `bankJazzcash` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor` (
    `id` VARCHAR(191) NOT NULL,
    `shopName` VARCHAR(191) NOT NULL DEFAULT '',
    `ownerName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `marketingEmailConsentAt` DATETIME(3) NULL,
    `marketingEmailUnsubscribedAt` DATETIME(3) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `cnic` VARCHAR(191) NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(191) NOT NULL DEFAULT '',
    `businessType` ENUM('individual', 'company') NOT NULL DEFAULT 'individual',
    `businessRegNo` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NOT NULL DEFAULT '',
    `accountNumber` VARCHAR(191) NOT NULL DEFAULT '',
    `accountTitle` VARCHAR(191) NOT NULL DEFAULT '',
    `iban` VARCHAR(34) NULL,
    `status` ENUM('onboarding', 'pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
    `rejectionReason` TEXT NULL,
    `profileImage` TEXT NULL,
    `shopLogo` TEXT NULL,
    `specialCommissionRate` DECIMAL(5, 2) NULL,
    `suspendedAt` DATETIME(3) NULL,
    `suspensionReason` TEXT NULL,
    `suspendedBy` VARCHAR(191) NULL,
    `suspensionUntil` DATETIME(3) NULL,
    `suspensionCount` INTEGER NOT NULL DEFAULT 0,
    `totalSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `loginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `emailVerifyToken` VARCHAR(255) NULL,
    `passwordResetToken` VARCHAR(255) NULL,
    `passwordResetExpires` DATETIME(3) NULL,
    `primaryCategory` VARCHAR(191) NOT NULL DEFAULT 'Other',
    `shopDescription` TEXT NULL,
    `onboardingData` JSON NULL,
    `onboardingSubmittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `storeSlug` VARCHAR(191) NULL,
    `storeBanner` TEXT NULL,
    `storePolicies` TEXT NULL,
    `serviceCities` JSON NULL,

    UNIQUE INDEX `vendor_email_key`(`email`),
    UNIQUE INDEX `vendor_cnic_key`(`cnic`),
    UNIQUE INDEX `vendor_storeSlug_key`(`storeSlug`),
    INDEX `vendor_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendordocument` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('cnic_front', 'cnic_back', 'license') NOT NULL,
    `fileUrl` TEXT NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendordocument_vendorId_idx`(`vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorproduct` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `originalPrice` DECIMAL(12, 2) NULL,
    `category` VARCHAR(191) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `warrantyMonths` INTEGER NULL,
    `images` JSON NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `publishedProductId` VARCHAR(191) NULL,
    `totalSold` INTEGER NOT NULL DEFAULT 0,
    `viewsCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendorproduct_publishedProductId_key`(`publishedProductId`),
    INDEX `vendorproduct_vendorId_idx`(`vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendororder` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `vendorShopOrderId` VARCHAR(191) NULL,
    `vendorProductId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `saleAmount` DECIMAL(12, 2) NOT NULL,
    `commissionRate` DECIMAL(5, 2) NOT NULL,
    `commissionAmount` DECIMAL(12, 2) NOT NULL,
    `vendorAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `trackingNumber` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendororder_vendorId_idx`(`vendorId`),
    INDEX `vendororder_orderId_idx`(`orderId`),
    INDEX `vendororder_vendorShopOrderId_idx`(`vendorShopOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorshoporder` (
    `id` VARCHAR(191) NOT NULL,
    `shopOrderNumber` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerAddress` TEXT NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `items` JSON NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `commissionAmount` DECIMAL(12, 2) NOT NULL,
    `netAmount` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` VARCHAR(191) NOT NULL,
    `paymentStatus` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    `statusHistory` JSON NOT NULL,
    `cancelReason` TEXT NULL,
    `trackingNumber` VARCHAR(255) NULL,
    `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendorshoporder_shopOrderNumber_key`(`shopOrderNumber`),
    INDEX `vendorshoporder_vendorId_idx`(`vendorId`),
    INDEX `vendorshoporder_orderId_idx`(`orderId`),
    INDEX `vendorshoporder_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `vendorshoporder_placedAt_idx`(`placedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commissionsetting` (
    `id` VARCHAR(191) NOT NULL,
    `categoryName` VARCHAR(191) NOT NULL,
    `commissionPercentage` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `commissionsetting_categoryName_key`(`categoryName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servicecommissionrange` (
    `id` VARCHAR(191) NOT NULL,
    `minAmount` DECIMAL(12, 2) NOT NULL,
    `maxAmount` DECIMAL(12, 2) NOT NULL,
    `commissionPercentage` DECIMAL(5, 2) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `servicecommissionrange_isActive_minAmount_idx`(`isActive`, `minAmount`),
    UNIQUE INDEX `servicecommissionrange_minAmount_maxAmount_key`(`minAmount`, `maxAmount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorearning` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `vendorShopOrderId` VARCHAR(191) NULL,
    `orderServiceId` VARCHAR(191) NULL,
    `saleAmount` DECIMAL(12, 2) NOT NULL,
    `commissionRate` DECIMAL(5, 2) NOT NULL,
    `commissionAmount` DECIMAL(12, 2) NOT NULL,
    `vendorAmount` DECIMAL(12, 2) NOT NULL,
    `reservedAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('pending', 'cleared', 'paid') NOT NULL DEFAULT 'pending',
    `holdReleaseDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendorearning_vendorShopOrderId_key`(`vendorShopOrderId`),
    UNIQUE INDEX `vendorearning_orderServiceId_key`(`orderServiceId`),
    INDEX `vendorearning_vendorId_idx`(`vendorId`),
    INDEX `vendorearning_orderId_idx`(`orderId`),
    INDEX `vendorearning_vendorShopOrderId_idx`(`vendorShopOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorwithdrawal` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `requestedAmount` DECIMAL(12, 2) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `accountTitle` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `status` ENUM('pending', 'approved', 'paid', 'rejected') NOT NULL DEFAULT 'pending',
    `rejectionReason` TEXT NULL,
    `adminNote` TEXT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `transferReference` VARCHAR(191) NULL,
    `openKey` VARCHAR(191) NULL,

    UNIQUE INDEX `vendorwithdrawal_openKey_key`(`openKey`),
    INDEX `vendorwithdrawal_vendorId_idx`(`vendorId`),
    INDEX `vendorwithdrawal_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payoutallocation` (
    `id` VARCHAR(191) NOT NULL,
    `withdrawalId` VARCHAR(191) NOT NULL,
    `earningId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('reserved', 'paid', 'released') NOT NULL DEFAULT 'reserved',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payoutallocation_earningId_status_idx`(`earningId`, `status`),
    UNIQUE INDEX `payoutallocation_withdrawalId_earningId_key`(`withdrawalId`, `earningId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorledgerentry` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `earningId` VARCHAR(191) NULL,
    `withdrawalId` VARCHAR(191) NULL,
    `type` VARCHAR(64) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendorledgerentry_idempotencyKey_key`(`idempotencyKey`),
    INDEX `vendorledgerentry_vendorId_createdAt_idx`(`vendorId`, `createdAt`),
    INDEX `vendorledgerentry_withdrawalId_idx`(`withdrawalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorreview` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `rating` INTEGER NOT NULL,
    `comment` TEXT NOT NULL,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendorreview_vendorId_idx`(`vendorId`),
    INDEX `vendorreview_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorcoupon` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `couponCode` VARCHAR(191) NOT NULL,
    `codeKey` VARCHAR(32) NULL,
    `discountType` ENUM('percent', 'fixed') NOT NULL,
    `discountValue` DECIMAL(12, 2) NOT NULL,
    `minOrderAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `maxDiscount` DECIMAL(12, 2) NULL,
    `startDate` DATETIME(3) NULL,
    `productIds` JSON NULL,
    `categories` JSON NULL,
    `collectionIds` JSON NULL,
    `selectedVendorIds` JSON NULL,
    `customerIds` JSON NULL,
    `perCustomerLimit` INTEGER NULL,
    `ownerType` VARCHAR(16) NOT NULL DEFAULT 'VENDOR',
    `fundingType` VARCHAR(24) NOT NULL DEFAULT 'VENDOR_FUNDED',
    `budget` DECIMAL(12, 2) NULL,
    `spent` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `approvals` JSON NULL,
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `maxUses` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `expiryDate` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive', 'paused', 'expired') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendorcoupon_codeKey_key`(`codeKey`),
    INDEX `vendorcoupon_vendorId_idx`(`vendorId`),
    INDEX `vendorcoupon_couponCode_status_idx`(`couponCode`, `status`),
    UNIQUE INDEX `vendorcoupon_vendorId_couponCode_key`(`vendorId`, `couponCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `couponredemption` (
    `id` VARCHAR(191) NOT NULL,
    `couponId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL,
    `platformFunded` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(24) NOT NULL DEFAULT 'redeemed',
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `restoredAt` DATETIME(3) NULL,

    UNIQUE INDEX `couponredemption_orderId_key`(`orderId`),
    INDEX `couponredemption_couponId_status_idx`(`couponId`, `status`),
    INDEX `couponredemption_customerId_couponId_status_idx`(`customerId`, `couponId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `couponcollection` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `productIds` JSON NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `couponcollection_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendornotification` (
    `id` VARCHAR(191) NOT NULL,
    `eventKey` VARCHAR(191) NULL,
    `href` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vendornotification_eventKey_key`(`eventKey`),
    INDEX `vendornotification_vendorId_idx`(`vendorId`),
    INDEX `vendornotification_vendorId_isRead_idx`(`vendorId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorsession` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `isRevoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `vendorsession_tokenHash_key`(`tokenHash`),
    INDEX `vendorsession_vendorId_idx`(`vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorauditlog` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` TEXT NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `vendorauditlog_vendorId_idx`(`vendorId`),
    INDEX `vendorauditlog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `want` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `requestType` VARCHAR(16) NOT NULL DEFAULT 'PRODUCT',
    `occasion` VARCHAR(100) NULL,
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

    INDEX `want_status_expiresAt_createdAt_idx`(`status`, `expiresAt`, `createdAt`),
    INDEX `want_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `want_category_city_idx`(`category`, `city`),
    INDEX `want_requestType_status_expiresAt_idx`(`requestType`, `status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wantinterest` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wantinterest_wantId_createdAt_idx`(`wantId`, `createdAt`),
    UNIQUE INDEX `wantinterest_customerId_wantId_key`(`customerId`, `wantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wantoffer` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `wantoffer_vendorId_status_idx`(`vendorId`, `status`),
    UNIQUE INDEX `wantoffer_wantId_vendorId_key`(`wantId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offerrevision` (
    `id` VARCHAR(191) NOT NULL,
    `offerId` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL,
    `initiator` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `shipping` DECIMAL(12, 2) NOT NULL,
    `delivery` VARCHAR(300) NOT NULL,
    `condition` VARCHAR(100) NOT NULL,
    `warranty` VARCHAR(1000) NOT NULL,
    `message` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `offerrevision_offerId_revisionNumber_key`(`offerId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offerquote` (
    `id` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `revisionId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `orderId` VARCHAR(191) NULL,

    UNIQUE INDEX `offerquote_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `offerquote_wantId_key`(`wantId`),
    UNIQUE INDEX `offerquote_revisionId_key`(`revisionId`),
    UNIQUE INDEX `offerquote_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendorpromotion` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `subtitle` VARCHAR(300) NULL,
    `desktopImage` TEXT NULL,
    `mobileImage` TEXT NULL,
    `ctaText` VARCHAR(191) NOT NULL DEFAULT 'View Store',
    `ctaHref` TEXT NULL,
    `placement` VARCHAR(191) NOT NULL DEFAULT 'HOMEPAGE_SPOTLIGHT',
    `priority` INTEGER NOT NULL DEFAULT 0,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `isSponsored` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `vendorpromotion_status_placement_startAt_endAt_idx`(`status`, `placement`, `startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `topvendor` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `label` VARCHAR(60) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `topvendor_vendorId_key`(`vendorId`),
    INDEX `topvendor_enabled_priority_idx`(`enabled`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marketplaceaudit` (
    `id` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `marketplaceaudit_target_createdAt_idx`(`target`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shoppingroom` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roommember` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roommember_roomId_customerId_key`(`roomId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roominvite` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roominvite_tokenHash_key`(`tokenHash`),
    INDEX `roominvite_roomId_idx`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roomitem` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `variant` VARCHAR(191) NOT NULL DEFAULT '',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `priceAtAddition` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `roomitem_roomId_idx`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roomvote` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `roomvote_memberId_itemId_key`(`memberId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roomcomment` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `roomcomment_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `serviceoffering` (
    `id` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `cities` JSON NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `leadDays` INTEGER NOT NULL,
    `warranty` VARCHAR(1000) NOT NULL,
    `cancellationTerms` TEXT NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `moderationStatus` VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
    `moderationReason` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `serviceoffering_vendorId_active_idx`(`vendorId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `productserviceaddon` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `productserviceaddon_productId_serviceId_key`(`productId`, `serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orderservice` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `commissionRate` DECIMAL(5, 2) NOT NULL,
    `commissionAmount` DECIMAL(12, 2) NOT NULL,
    `vendorPayable` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `scheduledAt` DATETIME(3) NULL,
    `refundStatus` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `orderservice_vendorId_status_idx`(`vendorId`, `status`),
    INDEX `orderservice_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `serviceevent` (
    `id` VARCHAR(191) NOT NULL,
    `orderServiceId` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `note` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `serviceevent_orderServiceId_createdAt_idx`(`orderServiceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storeslugalias` (
    `slug` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supportticket` (
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

    UNIQUE INDEX `supportticket_sequence_key`(`sequence`),
    INDEX `supportticket_actorType_customerId_status_idx`(`actorType`, `customerId`, `status`),
    INDEX `supportticket_actorType_vendorId_status_idx`(`actorType`, `vendorId`, `status`),
    INDEX `supportticket_status_priority_lastActivityAt_idx`(`status`, `priority`, `lastActivityAt`),
    INDEX `supportticket_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supportmessage` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `senderType` VARCHAR(20) NOT NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `attachmentUrl` TEXT NULL,
    `isInternalNote` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supportmessage_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customeroauthaccount` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(32) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customeroauthaccount_customerId_idx`(`customerId`),
    UNIQUE INDEX `customeroauthaccount_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

    INDEX `emailcampaign_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wantreaction` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `type` ENUM('LIKE', 'LOVE', 'SUPPORT', 'WOW', 'FIRE') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `wantreaction_wantId_type_idx`(`wantId`, `type`),
    INDEX `wantreaction_customerId_idx`(`customerId`),
    INDEX `wantreaction_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `wantreaction_wantId_customerId_key`(`wantId`, `customerId`),
    UNIQUE INDEX `wantreaction_wantId_vendorId_key`(`wantId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wantreport` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `reason` VARCHAR(40) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wantreport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `wantreport_customerId_idx`(`customerId`),
    INDEX `wantreport_vendorId_idx`(`vendorId`),
    UNIQUE INDEX `wantreport_wantId_customerId_key`(`wantId`, `customerId`),
    UNIQUE INDEX `wantreport_wantId_vendorId_key`(`wantId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_categoryRecordId_fkey` FOREIGN KEY (`categoryRecordId`) REFERENCES `category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `review_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `review` ADD CONSTRAINT `review_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productimage` ADD CONSTRAINT `productimage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paymentproofstaging` ADD CONSTRAINT `paymentproofstaging_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderConfirmationEmail` ADD CONSTRAINT `OrderConfirmationEmail_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderinventoryline` ADD CONSTRAINT `orderinventoryline_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderinventoryline` ADD CONSTRAINT `orderinventoryline_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `orderitem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderinventoryline` ADD CONSTRAINT `orderinventoryline_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderinventoryline` ADD CONSTRAINT `orderinventoryline_vendorProductId_fkey` FOREIGN KEY (`vendorProductId`) REFERENCES `vendorproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderinventoryline` ADD CONSTRAINT `orderinventoryline_vendorShopOrderId_fkey` FOREIGN KEY (`vendorShopOrderId`) REFERENCES `vendorshoporder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderstatusevent` ADD CONSTRAINT `orderstatusevent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customerpasswordresettoken` ADD CONSTRAINT `customerpasswordresettoken_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customernotification` ADD CONSTRAINT `customernotification_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customeraddress` ADD CONSTRAINT `customeraddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `savedproduct` ADD CONSTRAINT `savedproduct_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `savedproduct` ADD CONSTRAINT `savedproduct_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storefollow` ADD CONSTRAINT `storefollow_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storefollow` ADD CONSTRAINT `storefollow_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returnrequest` ADD CONSTRAINT `returnrequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returnrequest` ADD CONSTRAINT `returnrequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returnrequest` ADD CONSTRAINT `returnrequest_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `orderitem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `returnrequest` ADD CONSTRAINT `returnrequest_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispute` ADD CONSTRAINT `dispute_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispute` ADD CONSTRAINT `dispute_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispute` ADD CONSTRAINT `dispute_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `returnrequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispute` ADD CONSTRAINT `dispute_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_returnRequestId_fkey` FOREIGN KEY (`returnRequestId`) REFERENCES `returnrequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refund` ADD CONSTRAINT `refund_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `orderitem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `warrantyrecord` ADD CONSTRAINT `warrantyrecord_vendorProductId_fkey` FOREIGN KEY (`vendorProductId`) REFERENCES `vendorproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adminauditlog` ADD CONSTRAINT `adminauditlog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `adminuser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendordocument` ADD CONSTRAINT `vendordocument_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorproduct` ADD CONSTRAINT `vendorproduct_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorproduct` ADD CONSTRAINT `vendorproduct_publishedProductId_fkey` FOREIGN KEY (`publishedProductId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendororder` ADD CONSTRAINT `vendororder_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendororder` ADD CONSTRAINT `vendororder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendororder` ADD CONSTRAINT `vendororder_vendorShopOrderId_fkey` FOREIGN KEY (`vendorShopOrderId`) REFERENCES `vendorshoporder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendororder` ADD CONSTRAINT `vendororder_vendorProductId_fkey` FOREIGN KEY (`vendorProductId`) REFERENCES `vendorproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorshoporder` ADD CONSTRAINT `vendorshoporder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorshoporder` ADD CONSTRAINT `vendorshoporder_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorshoporder` ADD CONSTRAINT `vendorshoporder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorearning` ADD CONSTRAINT `vendorearning_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorearning` ADD CONSTRAINT `vendorearning_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorearning` ADD CONSTRAINT `vendorearning_vendorShopOrderId_fkey` FOREIGN KEY (`vendorShopOrderId`) REFERENCES `vendorshoporder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorearning` ADD CONSTRAINT `vendorearning_orderServiceId_fkey` FOREIGN KEY (`orderServiceId`) REFERENCES `orderservice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorwithdrawal` ADD CONSTRAINT `vendorwithdrawal_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payoutallocation` ADD CONSTRAINT `payoutallocation_withdrawalId_fkey` FOREIGN KEY (`withdrawalId`) REFERENCES `vendorwithdrawal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payoutallocation` ADD CONSTRAINT `payoutallocation_earningId_fkey` FOREIGN KEY (`earningId`) REFERENCES `vendorearning`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorledgerentry` ADD CONSTRAINT `vendorledgerentry_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorledgerentry` ADD CONSTRAINT `vendorledgerentry_earningId_fkey` FOREIGN KEY (`earningId`) REFERENCES `vendorearning`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorledgerentry` ADD CONSTRAINT `vendorledgerentry_withdrawalId_fkey` FOREIGN KEY (`withdrawalId`) REFERENCES `vendorwithdrawal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorreview` ADD CONSTRAINT `vendorreview_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorreview` ADD CONSTRAINT `vendorreview_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorreview` ADD CONSTRAINT `vendorreview_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorcoupon` ADD CONSTRAINT `vendorcoupon_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `couponredemption` ADD CONSTRAINT `couponredemption_couponId_fkey` FOREIGN KEY (`couponId`) REFERENCES `vendorcoupon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `couponredemption` ADD CONSTRAINT `couponredemption_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `couponredemption` ADD CONSTRAINT `couponredemption_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendornotification` ADD CONSTRAINT `vendornotification_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorsession` ADD CONSTRAINT `vendorsession_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorauditlog` ADD CONSTRAINT `vendorauditlog_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `want` ADD CONSTRAINT `want_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantinterest` ADD CONSTRAINT `wantinterest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantinterest` ADD CONSTRAINT `wantinterest_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantoffer` ADD CONSTRAINT `wantoffer_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantoffer` ADD CONSTRAINT `wantoffer_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerrevision` ADD CONSTRAINT `offerrevision_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `wantoffer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerrevision` ADD CONSTRAINT `offerrevision_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerquote` ADD CONSTRAINT `offerquote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerquote` ADD CONSTRAINT `offerquote_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerquote` ADD CONSTRAINT `offerquote_revisionId_fkey` FOREIGN KEY (`revisionId`) REFERENCES `offerrevision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `offerquote` ADD CONSTRAINT `offerquote_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendorpromotion` ADD CONSTRAINT `vendorpromotion_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `topvendor` ADD CONSTRAINT `topvendor_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roommember` ADD CONSTRAINT `roommember_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `shoppingroom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roommember` ADD CONSTRAINT `roommember_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roominvite` ADD CONSTRAINT `roominvite_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `shoppingroom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomitem` ADD CONSTRAINT `roomitem_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `shoppingroom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomitem` ADD CONSTRAINT `roomitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomitem` ADD CONSTRAINT `roomitem_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `roommember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomvote` ADD CONSTRAINT `roomvote_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `roomitem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomvote` ADD CONSTRAINT `roomvote_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `roommember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomcomment` ADD CONSTRAINT `roomcomment_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `roomitem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roomcomment` ADD CONSTRAINT `roomcomment_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `roommember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `serviceoffering` ADD CONSTRAINT `serviceoffering_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productserviceaddon` ADD CONSTRAINT `productserviceaddon_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productserviceaddon` ADD CONSTRAINT `productserviceaddon_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `serviceoffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderservice` ADD CONSTRAINT `orderservice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderservice` ADD CONSTRAINT `orderservice_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderservice` ADD CONSTRAINT `orderservice_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `serviceoffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `serviceevent` ADD CONSTRAINT `serviceevent_orderServiceId_fkey` FOREIGN KEY (`orderServiceId`) REFERENCES `orderservice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storeslugalias` ADD CONSTRAINT `storeslugalias_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supportticket` ADD CONSTRAINT `supportticket_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supportticket` ADD CONSTRAINT `supportticket_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supportticket` ADD CONSTRAINT `supportticket_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `adminuser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supportmessage` ADD CONSTRAINT `supportmessage_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `supportticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customeroauthaccount` ADD CONSTRAINT `customeroauthaccount_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreaction` ADD CONSTRAINT `wantreaction_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Default service commission ranges (from 20261017000000_service_commission_ranges).
INSERT INTO `servicecommissionrange` (`id`, `minAmount`, `maxAmount`, `commissionPercentage`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
  ('scr_default_01', 500.00, 1000.00, 15.00, true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_02', 1001.00, 2000.00, 12.00, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_03', 2001.00, 5000.00, 10.00, true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_04', 5001.00, 10000.00, 8.00, true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_05', 10001.00, 50000.00, 6.00, true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_06', 50001.00, 100000.00, 5.00, true, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
