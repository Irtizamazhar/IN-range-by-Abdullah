-- Extend the existing outbox. Existing customer rows retain their delivery state.
ALTER TABLE `OrderConfirmationEmail` ADD COLUMN `recipientKey` VARCHAR(191) NOT NULL DEFAULT 'customer';
CREATE UNIQUE INDEX `OrderConfirmationEmail_orderId_recipientKey_key` ON `OrderConfirmationEmail`(`orderId`, `recipientKey`);
DROP INDEX `OrderConfirmationEmail_orderId_key` ON `OrderConfirmationEmail`;
