ALTER TABLE `customerpasswordresettoken`
  ADD COLUMN `otpHash` VARCHAR(64) NULL,
  ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;
