-- AlterTable
ALTER TABLE `Product` ADD COLUMN `isBestSeller` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Product_isActive_isBestSeller_idx` ON `Product`(`isActive`, `isBestSeller`);
