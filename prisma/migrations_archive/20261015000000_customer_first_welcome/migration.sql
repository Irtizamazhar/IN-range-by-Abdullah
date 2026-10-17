-- Existing customers remain ineligible; only new customer registrations set welcomeEligibleAt.
ALTER TABLE `customer`
  ADD COLUMN `welcomeEligibleAt` DATETIME(3) NULL,
  ADD COLUMN `welcomeSeenAt` DATETIME(3) NULL;
