-- Revert `processing` on shop orders (align with Prisma enum without processing).
UPDATE `VendorShopOrder` SET `status` = 'packed' WHERE `status` = 'processing';

ALTER TABLE `VendorShopOrder` MODIFY COLUMN `status` ENUM(
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
) NOT NULL;
