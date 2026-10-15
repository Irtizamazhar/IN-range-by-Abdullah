# Customer signup welcome migration

`prisma/migrations/20261015000000_customer_first_welcome/migration.sql` adds two nullable customer timestamps. It does not alter existing rows, phone data, passwords, or vendor/admin tables. Existing customers have `welcomeEligibleAt = NULL` and do not receive the first-login popup. New customer registrations set eligibility; dismissal records `welcomeSeenAt` for that authenticated customer.

Before releasing application code on Hostinger, back up the production database, then use the repository's established `npx prisma migrate deploy` workflow. Run `npx prisma migrate status` and `npx prisma validate` afterward, then build/restart the application. Do not use `prisma db push`, `migrate reset`, or a destructive schema sync. The new welcome API and registration create require the columns to exist first.

No new environment variables are required. Customer phone numbers remain optional and non-unique. Phone sign-in must stay disabled until SMS ownership verification and a collision-safe uniqueness plan exist. Customer email/password sign-in remains the only credentials sign-in method.
