-- Drop manual "new arrival" flags; homepage uses Product.createdAt + 14-day window instead.
ALTER TABLE `Product` DROP COLUMN `isNewArrival`;
ALTER TABLE `VendorProduct` DROP COLUMN `isNewArrival`;
