-- Ensure `wantreport` exists exactly as defined by the WantReport model.
--
-- Production lacks this table, but 0_baseline (which is marked as applied there,
-- not executed) creates it. This migration is therefore idempotent:
--   * existing production database: creates the table, indexes and foreign keys;
--   * fresh database (0_baseline already ran): changes nothing.
-- If a `wantreport` table exists whose columns differ from the schema, the
-- migration stops with an "Unknown column 'wantreport_existing_table_does_not_match_prisma_schema'"
-- error instead of continuing. Only `wantreport` is touched; no table is dropped or renamed.
-- Name checks use BINARY because production table names are case-sensitive.

CREATE TABLE IF NOT EXISTS `wantreport` (
    `id` VARCHAR(191) NOT NULL,
    `wantId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `reason` VARCHAR(40) NOT NULL,
    `details` VARCHAR(1000) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Guard: an existing table must have exactly the expected columns, types and nullability.
SET @wantreport_matching_columns = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
    AND CONCAT(COLUMN_NAME, ' ', LOWER(COLUMN_TYPE), ' ', IS_NULLABLE) IN (
      'id varchar(191) NO',
      'wantId varchar(191) NO',
      'customerId varchar(191) YES',
      'vendorId varchar(191) YES',
      'reason varchar(40) NO',
      'details varchar(1000) YES',
      'status varchar(16) NO',
      'reviewedBy varchar(191) YES',
      'reviewedAt datetime(3) YES',
      'createdAt datetime(3) NO'
    )
);
SET @wantreport_total_columns = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
);
SET @wantreport_sql = IF(
  @wantreport_matching_columns = 10 AND @wantreport_total_columns = 10,
  'DO 0',
  'SELECT `wantreport_existing_table_does_not_match_prisma_schema` FROM `wantreport`'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

-- Unique indexes (created before the foreign keys so those can use them).
SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY INDEX_NAME = 'wantreport_wantId_customerId_key') = 0,
  'CREATE UNIQUE INDEX `wantreport_wantId_customerId_key` ON `wantreport`(`wantId`, `customerId`)',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY INDEX_NAME = 'wantreport_wantId_vendorId_key') = 0,
  'CREATE UNIQUE INDEX `wantreport_wantId_vendorId_key` ON `wantreport`(`wantId`, `vendorId`)',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

-- Ordinary indexes.
SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY INDEX_NAME = 'wantreport_status_createdAt_idx') = 0,
  'CREATE INDEX `wantreport_status_createdAt_idx` ON `wantreport`(`status`, `createdAt`)',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY INDEX_NAME = 'wantreport_customerId_idx') = 0,
  'CREATE INDEX `wantreport_customerId_idx` ON `wantreport`(`customerId`)',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY INDEX_NAME = 'wantreport_vendorId_idx') = 0,
  'CREATE INDEX `wantreport_vendorId_idx` ON `wantreport`(`vendorId`)',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

-- Foreign keys (the referenced tables are lowercase in production).
SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY CONSTRAINT_NAME = 'wantreport_wantId_fkey') = 0,
  'ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_wantId_fkey` FOREIGN KEY (`wantId`) REFERENCES `want`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY CONSTRAINT_NAME = 'wantreport_customerId_fkey') = 0,
  'ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;

SET @wantreport_sql = IF(
  (SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = DATABASE() AND BINARY TABLE_NAME = 'wantreport'
     AND BINARY CONSTRAINT_NAME = 'wantreport_vendorId_fkey') = 0,
  'ALTER TABLE `wantreport` ADD CONSTRAINT `wantreport_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0'
);
PREPARE wantreport_stmt FROM @wantreport_sql;
EXECUTE wantreport_stmt;
DEALLOCATE PREPARE wantreport_stmt;
