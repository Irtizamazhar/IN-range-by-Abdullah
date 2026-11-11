-- Sellers can remove an order from their dashboard; the row is kept for customers, admins and payouts.
ALTER TABLE `vendorshoporder` ADD COLUMN `vendorDeletedAt` DATETIME(3) NULL;
