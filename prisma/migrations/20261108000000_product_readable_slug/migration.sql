ALTER TABLE product ADD COLUMN slug VARCHAR(191) NULL;
CREATE UNIQUE INDEX product_slug_key ON product(slug);
