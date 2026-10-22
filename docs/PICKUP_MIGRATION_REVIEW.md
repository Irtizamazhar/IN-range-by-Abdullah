# Pickup migration deployment review

Local migration: `prisma/migrations/20261022000000_pickup_management/migration.sql`. It creates lowercase `pickupvisit` and `pickuprequest` tables with indexes and foreign keys to lowercase `vendor` and `vendorshoporder`. It does not alter or backfill existing orders, payouts, or payments. `Order.handlingFee` remains as a historical customer fee snapshot; new orders write zero while the configured Delivery Charges amount is unchanged.

## Production prerequisites

1. Verify the actual MariaDB schema, table name case, foreign key parents, migration history, and whether either pickup table already exists. Production was previously reported missing `wantreport` and the `20261018000000_add_want_report` migration history row. Resolve that committed migration in order before attempting this one. Do not mark a migration applied before its SQL succeeds.
2. Back up the database and test restore, then rehearse `prisma migrate deploy` against a production-like copy with the same `lower_case_table_names` setting. Confirm migration checksums and no drift. Deployment must include generated Prisma Client and the new APIs together.
3. Schedule a maintenance window. Existing packed orders have no pickup row; vendors can request pickup from their detail page after deployment. For an unavailable vendor, an admin with `orders.manage` can record a legacy recovery request from the seller-order detail only after verifying the parcel, pickup address/contact, reason and evidence. The request still goes through scheduling, accountable collection and referenced handover. Direct admin packed-to-shipped remains blocked.
4. A collected parcel cannot enter ordinary pre-shipment cancellation or inventory release. Direct the customer to support for the applicable return, dispute or refund review. Admin tracking corrections synchronize the seller bundle, seller lines and pickup record in one transaction with an audit entry.
5. Handover writes an in-app notification and a shipment email job inside the shipping transaction. The existing order-confirmation worker retries definite SMTP failures and holds ambiguous outcomes for operator reconciliation. Monitor pending, failed and uncertain `shipped:` jobs.

## Local rehearsal status

The static manifest check passes, but `npm run db:check:full` currently fails with a Prisma schema-engine error on the available local MySQL server. That server is not production-like MariaDB with `lower_case_table_names=0`. Migration readiness remains **UNVERIFIED** until both committed migrations replay successfully on a disposable case-sensitive MariaDB copy and the live schema/history prerequisites have been inspected read-only.

## Recovery

If deployment fails before the migration is applied, keep the old app running and inspect `_prisma_migrations` and actual tables before retrying. MySQL DDL may commit partial statements, so do not blindly rerun or mark success. If the migration succeeds but the new app must be rolled back, restore the previous app only after checking that its old direct shipping path is acceptable for operations; retain the additive pickup tables and records for a later forward fix. Do not drop tables or rewrite historical orders as a routine rollback. A database restore is the last resort and needs a reconciliation plan for orders created since backup.
