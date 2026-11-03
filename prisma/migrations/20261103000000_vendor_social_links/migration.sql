-- Additive only: optional public social profile links for vendor stores.
-- Existing rows keep NULL, which means "no links".
ALTER TABLE `vendor` ADD COLUMN `socialLinks` JSON NULL;
