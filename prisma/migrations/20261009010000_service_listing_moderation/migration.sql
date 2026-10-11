ALTER TABLE `ServiceOffering` ADD COLUMN `moderationStatus` VARCHAR(16) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE `ServiceOffering` ADD COLUMN `moderationReason` VARCHAR(1000) NULL;
