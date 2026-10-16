# Hostinger schema recovery: welcome and marketing columns

## Local findings

The current Prisma schema already declares all five columns reported missing in production. The migration files are present and nonempty. No existing migration or schema file should be rewritten: changing an applied migration would break Prisma checksum history without repairing the production database.

| Production error | Existing migration |
| --- | --- |
| `customer.welcomeEligibleAt`, `customer.welcomeSeenAt` | `20261015000000_customer_first_welcome` |
| `customer.marketingEmailConsentAt` | `20261015010000_email_campaign_drafts` |
| `vendor.marketingEmailConsentAt`, `vendor.marketingEmailUnsubscribedAt` | `20261015010000_email_campaign_drafts` |

The marketing migration also adds `customer.marketingEmailUnsubscribedAt` and creates `emailcampaign`. All four marketing columns and the two welcome columns are nullable, so existing account values remain untouched. The existing `20260915010000_customer_oauth_vendor_onboarding` migration creates `CustomerOAuthAccount`; `20260916000000_vendor_operational_onboarding` adds the nullable `Vendor.onboardingData` and `onboardingSubmittedAt` columns. The current application version also needs `20261015020000_order_confirmation_outbox` before new order writes.

Prisma can select all scalar columns when resolving a Google-linked customer or updating a vendor. Thus a missing marketing column can fail Google login or onboarding even when that feature does not explicitly read marketing preferences. The production log's missing-column errors show schema drift. They do not establish whether each migration is pending, partially applied, marked applied against a different schema, or whether the app is using the intended database.

## Production procedure for the operator — not executed here

Use the deployed application directory containing these exact migration files and its intended production `DATABASE_URL`. Do not paste the URL into shell history or share command output containing secrets. Take a verified full database backup and a backup of `storage/private/` first. Hold application writes during the migration window.

Run these commands in order on Hostinger:

```bash
cd /path/to/joro
npx prisma migrate status
```

Review **every** pending or failed migration, including earlier merge/reconciliation migrations. The repository contains historical migration branches; `docs/SETUP-AND-ROLLBACK.md` describes their one-time reconciliation. Do not use its `migrate resolve` commands solely because they are documented. If status reports a failed migration, or the migration history does not match the actual tables, stop before `migrate deploy` and reconcile that environment from a backup and read-only schema inspection. MySQL DDL can be partly applied before a migration fails, and rerunning the same SQL can then fail on duplicate columns.

When status shows only expected pending migrations and the backup is verified, apply the repository migrations:

```bash
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
npm run build
```

Then restart the Hostinger Node application using its existing process manager. Do not use `prisma db push`, `prisma migrate reset`, `prisma migrate dev`, seed scripts, or an ad hoc `ALTER TABLE` on production.

After deployment, inspect the production schema read only with a database administrator's MySQL session:

```sql
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND ((TABLE_NAME = 'customer' AND COLUMN_NAME IN
        ('welcomeEligibleAt', 'welcomeSeenAt', 'marketingEmailConsentAt', 'marketingEmailUnsubscribedAt'))
    OR (TABLE_NAME = 'vendor' AND COLUMN_NAME IN
        ('marketingEmailConsentAt', 'marketingEmailUnsubscribedAt', 'onboardingData', 'onboardingSubmittedAt')))
ORDER BY TABLE_NAME, COLUMN_NAME;
```

If Prisma reports either October 15 migration as applied while a listed column is absent, stop. `migrate deploy` will not recreate an already recorded migration. Inspect `_prisma_migrations`, the current database selected by `DATABASE_URL`, and the actual schema before planning a separate reviewed repair. Do not mark a migration applied merely to clear an error.

Finally, smoke-test Google login with an existing linked account, vendor Save Progress and Save & Continue with a test vendor, admin customers, marketing preferences, and an order in staging or with approved production test accounts. Check server logs and browser responses. This local review did not access the production database and cannot certify its state.

## Migration history caution

All 29 migration directories contain SQL. Earlier migrations include a deliberate `isNewArrival` column removal, a status conversion from `processing` to `packed`, unique indexes and data backfills, and two alternate marketplace reconciliation paths. They are not a safe blind replay against an unknown legacy schema. Preserve their committed contents and inspect the production migration history before applying any pending migration. The two October 15 migrations responsible for the reported columns are additive; if one has already partially executed, use a separately reviewed recovery plan rather than editing its committed SQL.
