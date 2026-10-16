-- Additive: admin-managed service commission price ranges.
-- Existing bookings keep their snapshotted commission on `orderservice`; nothing else changes.
CREATE TABLE `servicecommissionrange` (
  `id` VARCHAR(191) NOT NULL,
  `minAmount` DECIMAL(12, 2) NOT NULL,
  `maxAmount` DECIMAL(12, 2) NOT NULL,
  `commissionPercentage` DECIMAL(5, 2) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `servicecommissionrange_minAmount_maxAmount_key`(`minAmount`, `maxAmount`),
  INDEX `servicecommissionrange_isActive_minAmount_idx`(`isActive`, `minAmount`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- One-time editable defaults (the table is new, so this runs exactly once per database).
INSERT INTO `servicecommissionrange` (`id`, `minAmount`, `maxAmount`, `commissionPercentage`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
  ('scr_default_01', 500.00, 1000.00, 15.00, true, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_02', 1001.00, 2000.00, 12.00, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_03', 2001.00, 5000.00, 10.00, true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_04', 5001.00, 10000.00, 8.00, true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_05', 10001.00, 50000.00, 6.00, true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('scr_default_06', 50001.00, 100000.00, 5.00, true, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
