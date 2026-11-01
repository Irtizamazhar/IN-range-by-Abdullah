-- Additive only. Apply after the separately prepared Services catalog migration.
-- Existing rows keep NULL and use the placeholder/fallback.
ALTER TABLE servicecatalog ADD COLUMN imageUrl VARCHAR(2048) NULL;
ALTER TABLE serviceoffering ADD COLUMN imageUrl VARCHAR(2048) NULL;
