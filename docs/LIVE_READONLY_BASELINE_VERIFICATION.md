# Read-only production baseline verification — 2026-11-08

Production read-only access: **verified**. No migration/backfill, commit, push or deployment was performed. No secret values or connection strings were printed.

## Working-tree guard and clean baseline

The existing guard in repositoryState(root, true) correctly rejects these pending files in the original workspace:

- prisma/schema.prisma: adds Product.slug.
- prisma/migration-manifest.json: records the new schema fingerprint and slug migration.
- prisma/migrations/20261108000000_product_readable_slug/migration.sql: new, untracked additive migration.

They were not discarded, overwritten, staged or committed. The current main branch and original working directory remain unchanged. SHA-256 fingerprints verified that all **61 pre-existing pending files** retained exactly the same contents. Their fingerprints are retained locally at .release-prep/live-readonly-preservation.json.

A separate detached worktree was created at `.release-prep/live-readonly-1358fde`, pinned to commit `1358fde96e77e39c2ef05cff6026edae6381b2e7`. Its working tree is clean. The existing committed-payload guard verified its schema, manifest, lock file, all nine active migration files, archived migration SQL and original rollback history source. No guard was weakened or disabled.

`scripts/check-live-baseline.mjs` is a separate SELECT-only entry point. It validates that worktree's exact revision, shared Git repository, cleanliness and committed payload. It reads the existing protected profile from the ORIGINAL workspace and verifies the ORIGINAL managed SSH process/listener. Secrets and tunnel state were not copied into the worktree. The three explicitly allowed Cloudinary fields remain unrelated application configuration and do not enter the connection URL.

The script has no migrate/backfill/deploy action. Unsupported arguments are rejected. The original production deployment path and its committed-payload requirement remain unchanged. The audit does not claim that the uncommitted slug migration has become deployable.

## Verified production evidence

The authorized managed tunnel passed ownership/listener validation on this attempt; the earlier SSH authentication blocker was not present.

- Verification timestamp: 2026-11-08T17:11:04.665Z.
- Production database identity: u749284283_inrange, matched against the approved profile, authenticated database user and remote MySQL port internally. User credentials were not printed.
- Provider: MariaDB Server.
- Version: **11.8.9-MariaDB-log**.
- Products: **13 total, 13 active, 13 public** under the existing public-product/vendor approval policy.
- Categories: **64 total, 64 active**. This is not the homepage-eligible category count; emptiness/eligibility was not inferred from active status.
- History validation: baseline, active checksums, documented archived history, allowed rollback/retry and migration sequence passed the existing validator.
- Successful applied history entries: **33**, including archived history and all nine active baseline migrations.
- Pending against the committed nine-migration baseline: **none**.
- product.slug column: **absent**.
- Product slug index: **absent**.

The local ten-migration proposal separately passed its manifest check. Comparing its names with the verified applied history identifies **20261108000000_product_readable_slug** as the additional pending LOCAL proposal. The clean audit baseline itself contains nine migrations and does not include this uncommitted addition. “No pending migrations against the baseline” must not be interpreted as “slug migration completed.”

The full sanitized result is retained locally at `.release-prep/live-readonly-production-report.json`. The protected profile's hash was checked before/after; its contents are unchanged. This audit used only SELECT operations and disconnected its database client afterward. It left the existing authorized managed tunnel intact.

These results are production evidence, distinct from the empty joro_local database and the earlier twelve-product disposable staging rehearsal. No schema-drift or production backup/restore check was performed by this narrower connection audit. Do not treat checksum validation as a full schema-drift check.

## Validation

- `node scripts/check-live-baseline.mjs --offline`: clean committed baseline passed.
- `node --test tests/live-baseline-audit.test.mjs`: **3/3 passed**, covering SELECT-only behavior/no credential output, dirty-worktree refusal before credential access, and tunnel refusal before connection/query execution.
- Actual read-only production run: passed identity, history, version, aggregate count and slug metadata checks.
- Original local ten-migration manifest check: passed.
- Original pending-file fingerprints: **61/61 unchanged**.
- Separate worktree: clean; no staged changes were created in the original repository.

## Next safe terminal command

From the original workspace, repeat the read-only verification with:

```powershell
node scripts/check-live-baseline.mjs
```

For offline baseline verification only:

```powershell
node scripts/check-live-baseline.mjs --offline
```

If the existing tunnel later expires, run `npm.cmd run db:live:tunnel` from the original workspace in the owner's terminal, complete native authentication using existing authorized access, then rerun the SELECT-only auditor. It refuses stale/unverified tunnel processes and never accepts an unknown host key automatically.

Read-only connection access is now unblocked. Production writes/deployment remain outside this task: the slug column is absent, backfill has not run, and backup/restoration, drift, MariaDB-specific staging compatibility, locking impact and release/rollback gates still require separate verification and authorization. No such operations are authorized by the audit command.
