ALTER TABLE `Want` ADD COLUMN `requestType` VARCHAR(16) NOT NULL DEFAULT 'PRODUCT';
ALTER TABLE `Want` ADD COLUMN `occasion` VARCHAR(100) NULL;
CREATE INDEX `Want_requestType_status_expiresAt_idx` ON `Want`(`requestType`, `status`, `expiresAt`);
