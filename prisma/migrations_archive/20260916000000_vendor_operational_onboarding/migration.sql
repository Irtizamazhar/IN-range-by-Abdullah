-- Additive only: existing vendor rows and statuses are unchanged.
ALTER TABLE `Vendor`
  ADD COLUMN `onboardingData` JSON NULL,
  ADD COLUMN `onboardingSubmittedAt` DATETIME(3) NULL;
