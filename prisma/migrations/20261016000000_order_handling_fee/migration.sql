-- Additive: customer-facing handling fee per order. Existing orders keep 0.
ALTER TABLE `order`
  ADD COLUMN `handlingFee` DECIMAL(12, 2) NOT NULL DEFAULT 0;
