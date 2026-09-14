# Setup, migration and rollback

## Local requirements

- Node.js 22.x (validated with 22.13.1)
- npm 11.x (validated with 11.10.1)
- MySQL 8.x (validated with 8.0.43)
- Existing database name remains `inrange`

Install and validate:

```powershell
npm ci
npx prisma generate
node -r dotenv/config ./node_modules/prisma/build/index.js migrate deploy dotenv_config_path=.env.local
npm test
npm run lint
npx tsc --noEmit
npm run build
```

### Existing database after the marketplace merge

Databases that already applied `20260913030000_customer_stores_wants`
contain the legacy `WantPost`/`WantOffer` shape. Back up the database and run
the read-only preflight first. If it reports that legacy shape and lists the
two pulled merge migrations as pending, reconcile their history before deploy:

```powershell
$env:DOTENV_CONFIG_PATH='.env.local'
npx tsx scripts/joro-preflight.ts
node -r dotenv/config ./node_modules/prisma/build/index.js migrate resolve --applied 20260913000000_joro_marketplace_foundation dotenv_config_path=.env.local
node -r dotenv/config ./node_modules/prisma/build/index.js migrate resolve --applied 20260913090000_joro_merge_reconciliation dotenv_config_path=.env.local
node -r dotenv/config ./node_modules/prisma/build/index.js migrate deploy dotenv_config_path=.env.local
```

The follow-up reconciliation migration copies legacy Wants and offers into the
new revision-based model and keeps the legacy source tables as rollback
archives. Do not use the two `migrate resolve` commands on an environment where
those migrations were actually executed; inspect that environment separately.

## Configuration names

Keep secrets in `.env.local` or the deployment secret manager. Do not commit real values.

Required core configuration:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH` (preferred) or `ADMIN_PASSWORD`
- `VENDOR_JWT_SECRET`
- `NEXT_PUBLIC_APP_URL`

Email recovery/notifications require either the shared SMTP names or the compatible email aliases already supported by the code:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- or `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

Optional integrations:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `VENDOR_REQUIRE_EMAIL_VERIFICATION`, `VENDOR_JWT_EXPIRES_IN`, `WHATSAPP_NUMBER`, `LOG_LEVEL`

No Raast/card provider variables are defined because no provider was selected. Keep those payment methods disabled until signed provider requirements exist.

## Data and media

- Prisma migrations are additive under `prisma/migrations`; never use a reset against an existing environment.
- Run `npm run db:migrate-json-catalog` once after migrations. It is idempotent and preserves legacy `na-*` links.
- New vendor KYC and appeal files live under `storage/private` locally and are ignored by Git. Back up this directory with the database until production object storage is selected.
- Product/review media remains public by design; payment proofs remain in protected database records.

## Rollback

Application rollback should deploy the previous code while leaving additive tables/columns and immutable ledger/audit rows intact. Do not reverse financial migrations by dropping tables. If a data recovery is required, stop writes, preserve current database/media first, and restore into a separate database for verification before switching traffic.

The pre-upgrade local SQL backup created during this work is:

`C:\Users\MRLAPT~1\AppData\Local\Temp\inrange-pre-joro-2026-09-12T19-12-31-642Z.sql`

This temporary path is useful for local recovery only; copy it to managed backup storage before relying on it operationally.
