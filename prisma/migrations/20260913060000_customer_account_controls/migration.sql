ALTER TABLE `Customer`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `adminNote` TEXT NULL;

CREATE INDEX `Customer_isActive_createdAt_idx` ON `Customer`(`isActive`, `createdAt`);
