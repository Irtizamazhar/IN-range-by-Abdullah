# Private storage, vendor approval and payout security

Release notes and operating guide for branch `fix/validation-security-ocr-storage`.
Nothing in this document has been run against production. Every production step needs explicit approval.

## 1. What changed

| Area | Behaviour now |
| --- | --- |
| Validation | Shared rules in `lib/validation/` (`person-name.ts`, `bank.ts` are browser-safe; `schemas.ts` is the server zod layer), `lib/pakistan-cnic.ts`, `lib/product-pricing.ts`. Every API that stores these values validates on the server. |
| Product pricing | Sale price > 0; original price optional, > 0 and >= sale price. Enforced in vendor and admin product APIs (create and partial update) and in the forms. |
| CNIC | 13 digits, stored as `00000-0000000-0`; rejects all-same digits, `1234567890123`, zero serial and first digits other than 1–8. Drafts keep the CNIC in `onboardingData.draftCnic`; the unique `cnic` column is only written on final submission after a uniqueness check. |
| CNIC images | Front and back are required and stored privately. There is **no automatic OCR**: an admin compares the CNIC images with the entered CNIC number and name before approving. (An OCR prototype was built and removed; migration `20261109180310_remove_cnic_ocr` drops its unused table and columns.) |
| Approval | `lib/vendor-approval.ts` + `PATCH /api/admin/vendors/[id]`. Only `pending` sellers; complete data, valid CNIC, required documents present **and their files present**; the admin must confirm they compared the CNIC images with the entered details; review items (e.g. account title differs from the CNIC name) need a written override reason. Records `approvedAt`/`approvedBy`. Approval no longer marks email verified or lifts suspensions. |
| Bank / payouts | `lib/vendor-bank-security.ts`, `PATCH /api/vendor/bank`. Current password required; validated fields; after approval a change becomes `pending_review`, the seller is notified (in-app + email, masked) and admins see a "Bank changes" notification. Withdrawals use only the admin-verified snapshot. |
| Private files | `lib/private-storage.ts`. New files go to `PRIVATE_STORAGE_DIR`; reads fall back to the old `<release>/storage/private`. Same relative paths in the database. |
| Retired | `POST /api/vendor/register` returns 410. The unused `VendorRegisterWizard` component was removed. |

## 2. Environment variables (Hostinger Node.js application settings)

| Variable | Required | Value |
| --- | --- | --- |
| `PRIVATE_STORAGE_DIR` | Yes | Absolute directory **outside** the release and **separate** from `UPLOADS_DIR`. Suggested: `/home/u749284283/joro-private` (confirm the account path on Hostinger first). |

Never commit these values. No secret is printed by any script or endpoint.

## 3. Hostinger deployment (requires approval)

Pre-flight (read-only):
1. Back up the database (`npm run db:live:...` workflow in `docs/LIVE_DATABASE_SETUP.md`) **and** the current release's `storage/private/` folder.
2. On the server, find the old private files: the current release `storage/private/`, earlier release folders and Hostinger file backups.

Create the persistent folder (SSH, as the application user):
```bash
mkdir -p /home/u749284283/joro-private
chmod 700 /home/u749284283/joro-private
```
Confirm with Hostinger support that this path is outside the release directory and survives deployments for this plan. This could not be verified from the development machine.

Copy existing files without deleting or overwriting anything (dry run first, then `--apply`):
```bash
node scripts/private-storage.mjs copy --source <current-release>/storage/private --target /home/u749284283/joro-private
node scripts/private-storage.mjs copy --source <current-release>/storage/private --target /home/u749284283/joro-private --apply
# repeat for each earlier release folder / restored backup that still has files
```

Deploy:
1. Set `PRIVATE_STORAGE_DIR` (section 2).
2. Release with migrations enabled (`JORO_DEPLOY_MIGRATIONS=true`, see `docs/DATABASE_MIGRATIONS.md`). Two migrations run in order: `20261109125851_vendor_verification_security` (new nullable vendor columns for approval and bank verification, plus an OCR table) and `20261109180310_remove_cnic_ocr` (drops the OCR table and four OCR columns again; they are empty because OCR never ran). No existing row is changed.
3. Restart the Node application.

Post-deploy verification:
1. Admin with `vendors.manage`: `GET /api/admin/uploads/private-storage` → `{"configured":true,"usable":true,...}`.
2. List records whose files are missing (read-only DB query):
   `DATABASE_URL=... node scripts/private-storage.mjs audit --root /home/u749284283/joro-private --legacy <current-release>/storage/private`
3. Use a disposable test seller: upload a synthetic CNIC image, confirm the file exists under `PRIVATE_STORAGE_DIR/vendor-docs/<vendorId>/`, open it from the admin vendor page, and confirm another seller account gets 404.
4. Redeploy the same build, then open the same document again (deployment-survival test).
5. Confirm `/api/admin/uploads/storage` (public images) is unchanged.

Files that are already gone cannot be recreated by code. For each record listed by the audit, restore the file from a Hostinger backup into the same relative path, or ask the seller to upload it again (the admin panel shows "missing from storage", and approval is blocked until it is replaced).

Rollback: redeploy the previous build. The migration is additive, so the previous code runs against the new schema. Files written to `PRIVATE_STORAGE_DIR` stay there; the previous code would not see them, so copy them back into the release `storage/private/` with the same script (`--source /home/u749284283/joro-private --target <release>/storage/private --apply`) before rolling back.

## 4. Behaviour changes to communicate

- Admin approval now requires opening **Details & documents**, comparing the CNIC images with the entered CNIC number and name, and ticking the review confirmation; review items need an override reason.
- Rejected sellers must resubmit; suspended sellers are reinstated from the suspension page.
- Approval no longer verifies email. With `VENDOR_REQUIRE_EMAIL_VERIFICATION=true`, sellers must confirm their email.
- Sellers need their current password to change bank details; approved sellers' changes wait for admin verification before payouts use them.
- Saved phone numbers are normalised to `03XX-XXXXXXX`; checkout, addresses and profile accept Pakistani mobiles only.

## 5. Database integrity constraints (prepared, not applied)

Prisma cannot express MySQL `CHECK` constraints, and adding one fails if any existing row violates it. Run the read-only inspection first on production:

```sql
SELECT COUNT(*) AS non_positive_price FROM product WHERE price <= 0;
SELECT COUNT(*) AS original_below_sale FROM product WHERE originalPrice IS NOT NULL AND originalPrice < price;
SELECT COUNT(*) AS negative_stock FROM product WHERE stock < 0;
SELECT COUNT(*) AS bad_vendor_products FROM vendorproduct WHERE price <= 0 OR stock < 0 OR (originalPrice IS NOT NULL AND originalPrice < price);
SELECT COUNT(*) AS bad_cnic_format FROM vendor WHERE cnic IS NOT NULL AND cnic NOT REGEXP '^[1-8][0-9]{4}-[0-9]{7}-[0-9]$';
```

Safe cleanup, only after review and a backup (no deletions):
```sql
UPDATE product SET originalPrice = NULL, discountPercent = 0 WHERE originalPrice IS NOT NULL AND originalPrice < price;
UPDATE vendorproduct SET originalPrice = NULL WHERE originalPrice IS NOT NULL AND originalPrice < price;
```
Non-positive prices, negative stock and invalid CNICs need a per-record decision.

Constraints to add as a new migration once every count is zero:
```sql
ALTER TABLE `product`
  ADD CONSTRAINT `product_price_positive` CHECK (`price` > 0),
  ADD CONSTRAINT `product_stock_nonnegative` CHECK (`stock` >= 0),
  ADD CONSTRAINT `product_original_ge_price` CHECK (`originalPrice` IS NULL OR `originalPrice` >= `price`);
ALTER TABLE `vendorproduct`
  ADD CONSTRAINT `vendorproduct_price_positive` CHECK (`price` > 0),
  ADD CONSTRAINT `vendorproduct_stock_nonnegative` CHECK (`stock` >= 0),
  ADD CONSTRAINT `vendorproduct_original_ge_price` CHECK (`originalPrice` IS NULL OR `originalPrice` >= `price`);
```
Reverse: `ALTER TABLE ... DROP CHECK <name>`. CNIC uniqueness (`vendor.cnic @unique`) already exists; bank verification status is a MySQL enum.

## 6. Limitations

- CNIC details are checked by staff against the uploaded images; there is no automatic reading of the card and no NADRA verification, so the review cannot prove a card is genuine.
- Pakistani bank account numbers vary by bank; only digits and length (6–24) and IBAN checksums are validated. Title vs CNIC name is flagged for admins, not blocked.
- Registration rate limits key on the first `X-Forwarded-For` value; whether that can be spoofed depends on Hostinger's proxy (verify live).
