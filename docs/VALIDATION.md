# Validation and deployment

Run `npm run build` to generate Prisma Client, compile the production app,
check TypeScript and lint, and generate static pages. Stop this project's
development server first if Windows reports a locked Prisma engine DLL.

Run `node scripts/check-vendor-schema.cjs` for a read-only check that the
configured database has the vendor suspension fields.

The suspension feature requires the columns in
`prisma/migrations/20260911000000_vendor_suspension_fields/migration.sql`.
Apply this through the database's existing migration process before deploying.
If the database was previously updated using `prisma db push`, check whether
the columns already exist and reconcile migration history before applying it.
Do not blindly replay migrations on an existing database.

For HTTP smoke checks, start the production server with
`node node_modules/next/dist/bin/next start -p 3100`, then run `node scripts/smoke-test.mjs`.
These check public pages and unauthenticated API access without creating orders
or changing database records. Authenticated purchases, payouts, email delivery,
and vendor approval still need end-to-end checks with test accounts.

Vendor appeals now require the short-lived appeal cookie issued after a
suspended vendor supplies the correct login credentials. Expired sessions
must sign in again before submitting an appeal or uploading proof.
