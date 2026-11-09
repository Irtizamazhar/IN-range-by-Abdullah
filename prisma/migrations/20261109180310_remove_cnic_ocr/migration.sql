/*
  Warnings:

  - You are about to drop the column `cnicCheckId` on the `vendor` table. All the data in the column will be lost.
  - You are about to drop the column `cnicCheckStatus` on the `vendor` table. All the data in the column will be lost.
  - You are about to drop the column `cnicCheckedAt` on the `vendor` table. All the data in the column will be lost.
  - You are about to drop the column `ocrConsentAt` on the `vendor` table. All the data in the column will be lost.
  - You are about to drop the `vendordocumentcheck` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `vendordocumentcheck` DROP FOREIGN KEY `vendordocumentcheck_documentId_fkey`;

-- DropForeignKey
ALTER TABLE `vendordocumentcheck` DROP FOREIGN KEY `vendordocumentcheck_vendorId_fkey`;

-- AlterTable
ALTER TABLE `vendor` DROP COLUMN `cnicCheckId`,
    DROP COLUMN `cnicCheckStatus`,
    DROP COLUMN `cnicCheckedAt`,
    DROP COLUMN `ocrConsentAt`;

-- DropTable
DROP TABLE `vendordocumentcheck`;
