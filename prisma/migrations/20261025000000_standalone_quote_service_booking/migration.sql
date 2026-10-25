-- Reuse real service bookings for accepted service requirements without inventing catalog records.
ALTER TABLE `orderservice`
  MODIFY `serviceId` VARCHAR(191) NULL,
  MODIFY `productId` VARCHAR(191) NULL;
