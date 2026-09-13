-- Merge reconciliation: brings the migration sequence up to the FINAL merged
-- prisma/schema.prisma after the branch merge. This migration exists because:
--
--   1. 20260913030000_customer_stores_wants (origin/main history) will be
--      BASELINED, not executed, because it also creates a duplicate
--      `StoreFollow` table (already created by 20260913000000) and the
--      obsolete `WantPost` / origin-style `WantOffer` models that the merge
--      deliberately replaced. Its two still-valid tables (CustomerAddress,
--      SavedProduct) are reconstructed here verbatim so nothing is lost.
--   2. No migration in the history ever created the FINAL (Codex-style) Want
--      negotiation system (WantOffer referencing Want, OfferRevision,
--      OfferQuote), the Services feature (ServiceOffering,
--      ProductServiceAddon, OrderService, ServiceEvent, and the
--      VendorEarning.orderServiceId link), the Family Cart / Together feature
--      (ShoppingRoom and friends), StoreSlugAlias, VendorNotification's
--      eventKey/href columns, or WarrantyRecord.vendorProductId. All of these
--      are additive and required to reach the merged schema.prisma exactly.
--
-- Every definition below is copied field-for-field from the final
-- prisma/schema.prisma (types, nullability, defaults, relations, indexes,
-- unique constraints, and Prisma's documented default referential actions
-- where the schema left onDelete unspecified).

-- ============================================================
-- 1. From 20260913030000_customer_stores_wants (kept, valid part only)
-- ============================================================

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

-- ============================================================
-- 2. Final Want negotiation system (WantOffer / OfferRevision / OfferQuote)
--    `Want` and `WantInterest` already exist (20260913000000). No migration
--    ever created the matching WantOffer for them -- only the obsolete
--    origin-style one (in 030000, being baselined away).
-- ============================================================

CREATE TABLE `WantOffer` (
  `id` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'SUBMITTED',
  `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `WantOffer_wantId_vendorId_key`(`wantId`, `vendorId`),
  INDEX `WantOffer_vendorId_status_idx`(`vendorId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WantOffer_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `WantOffer_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OfferRevision` (
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
  UNIQUE INDEX `OfferRevision_offerId_revisionNumber_key`(`offerId`, `revisionNumber`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OfferRevision_offerId_fkey`
    FOREIGN KEY (`offerId`) REFERENCES `WantOffer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferRevision_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OfferQuote` (
  `id` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `wantId` VARCHAR(191) NOT NULL,
  `revisionId` VARCHAR(191) NOT NULL,
  `snapshot` JSON NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `orderId` VARCHAR(191) NULL,
  UNIQUE INDEX `OfferQuote_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `OfferQuote_wantId_key`(`wantId`),
  UNIQUE INDEX `OfferQuote_revisionId_key`(`revisionId`),
  UNIQUE INDEX `OfferQuote_orderId_key`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OfferQuote_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_wantId_fkey`
    FOREIGN KEY (`wantId`) REFERENCES `Want`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_revisionId_fkey`
    FOREIGN KEY (`revisionId`) REFERENCES `OfferRevision`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OfferQuote_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 3. Services feature (entirely missing from migration history)
-- ============================================================

CREATE TABLE `ServiceOffering` (
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
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `ServiceOffering_vendorId_active_idx`(`vendorId`, `active`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceOffering_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductServiceAddon` (
  `id` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  UNIQUE INDEX `ProductServiceAddon_productId_serviceId_key`(`productId`, `serviceId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProductServiceAddon_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProductServiceAddon_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `ServiceOffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrderService` (
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
  INDEX `OrderService_vendorId_status_idx`(`vendorId`, `status`),
  INDEX `OrderService_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderService_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderService_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderService_serviceId_fkey`
    FOREIGN KEY (`serviceId`) REFERENCES `ServiceOffering`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceEvent` (
  `id` VARCHAR(191) NOT NULL,
  `orderServiceId` VARCHAR(191) NOT NULL,
  `actor` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `note` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ServiceEvent_orderServiceId_createdAt_idx`(`orderServiceId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ServiceEvent_orderServiceId_fkey`
    FOREIGN KEY (`orderServiceId`) REFERENCES `OrderService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- VendorEarning already exists (base table) with reservedAmount/paidAmount
-- added by 20260913010000. The 1:1 link to OrderService (for service-booking
-- earnings) was never added by any migration.
ALTER TABLE `VendorEarning`
  ADD COLUMN `orderServiceId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `VendorEarning_orderServiceId_key` ON `VendorEarning`(`orderServiceId`);

ALTER TABLE `VendorEarning`
  ADD CONSTRAINT `VendorEarning_orderServiceId_fkey`
  FOREIGN KEY (`orderServiceId`) REFERENCES `OrderService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. Family Cart / Together feature (entirely missing from migration history)
-- ============================================================

CREATE TABLE `ShoppingRoom` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `archived` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomMember` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RoomMember_roomId_customerId_key`(`roomId`, `customerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomMember_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomMember_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomInvite` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revoked` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RoomInvite_tokenHash_key`(`tokenHash`),
  INDEX `RoomInvite_roomId_idx`(`roomId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomInvite_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomItem` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  `variant` VARCHAR(191) NOT NULL DEFAULT '',
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `priceAtAddition` DECIMAL(12, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RoomItem_roomId_idx`(`roomId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomItem_roomId_fkey`
    FOREIGN KEY (`roomId`) REFERENCES `ShoppingRoom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomItem_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `RoomItem_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomVote` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `RoomVote_memberId_itemId_key`(`memberId`, `itemId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomVote_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `RoomItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RoomVote_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RoomComment` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `memberId` VARCHAR(191) NOT NULL,
  `text` VARCHAR(2000) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RoomComment_itemId_idx`(`itemId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RoomComment_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `RoomItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RoomComment_memberId_fkey`
    FOREIGN KEY (`memberId`) REFERENCES `RoomMember`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 5. Store slug aliases (missing; keeps old /stores/<slug> links working
--    after a vendor renames their store slug)
-- ============================================================

CREATE TABLE `StoreSlugAlias` (
  `slug` VARCHAR(191) NOT NULL,
  `vendorId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`slug`),
  CONSTRAINT `StoreSlugAlias_vendorId_fkey`
    FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================
-- 6. VendorNotification.eventKey / .href (missing; used for idempotent,
--    clickable marketplace notifications -- see lib/marketplace-notifications.ts)
-- ============================================================

ALTER TABLE `VendorNotification`
  ADD COLUMN `eventKey` VARCHAR(191) NULL,
  ADD COLUMN `href` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `VendorNotification_eventKey_key` ON `VendorNotification`(`eventKey`);

-- ============================================================
-- 7. WarrantyRecord.vendorProductId (missing; links a warranty back to the
--    specific vendor-catalog listing it was sold from)
-- ============================================================

ALTER TABLE `WarrantyRecord`
  ADD COLUMN `vendorProductId` VARCHAR(191) NULL;

ALTER TABLE `WarrantyRecord`
  ADD CONSTRAINT `WarrantyRecord_vendorProductId_fkey`
  FOREIGN KEY (`vendorProductId`) REFERENCES `VendorProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
