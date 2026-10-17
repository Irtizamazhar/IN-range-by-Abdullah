-- AlterEnum: add `processing` between confirmed and packed for vendor shop orders.
ALTER TABLE `VendorShopOrder` MODIFY COLUMN `status` ENUM(
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
) NOT NULL;
