-- Seller stock is deducted when the seller confirms the order, not at checkout.
-- Additive: existing rows keep their state; the default stays 'reserved'.
ALTER TABLE `orderinventoryline` MODIFY `state` ENUM('reserved', 'released', 'consumed', 'awaiting_confirmation') NOT NULL DEFAULT 'reserved';
