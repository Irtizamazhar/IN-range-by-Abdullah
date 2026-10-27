# Live archived migration checksum investigation — 2026-10-27

## Historical investigation evidence (resolved)

The evidence below records the initial investigation before fetching upstream.
Its temporary missing-migration blocker was resolved by the reconciliation at the
end of this report. Current production migration history passes.

Read-only live identity verification and SELECT of migration name, checksum,
started_at, finished_at and rolled_back_at from `_prisma_migrations` identified
nine mismatching rows: eight successful migrations and one rolled-back attempt.
No customer data was queried. No production history or SQL was changed.

The first reported conflict is `20260913000000_joro_marketplace_foundation`.
Its actual Windows archive bytes hash to the live checksum. The validator instead
hashed the LF Git blob. Git `core.autocrlf=true` and `.gitattributes` only forces LF
for active migration SQL, leaving archived files subject to checkout conversion.
All eight successful conflicts are exactly reproducible by converting the
committed LF blob to CRLF. No other bytes need to change.

The rollback for `20260914000000_step8_top_vendors` is a separate issue. Original
SQL in Git commit `3fdd16fef210341b6acd0066356d9d7bcc402a93` has 1,032 LF bytes
and SHA-256 `8653dea15bb47348c2584b2722cda054eeaf5b6c9ea9b6387a6ae40784bf53ce`.
Its CRLF encoding hashes exactly to the live rolled-back attempt:
`48be3ddef269a1cb0907da222915e0dd4b43b6c9030c8f9c1589f18811db3c5f`.
The successful attempt matches the current archive's CRLF bytes instead.

Commit `f23bb0b8680a5b720c4e2db7a0164b94d5dc2262` (2026-09-24) records removal
of `ALTER TABLE review ADD COLUMN withdrawn BOOLEAN NOT NULL DEFAULT false;`
and its comment/blank line from the original migration. This is a real historical
SQL revision, not just a newline change. The live successful retry on September 17
already matches the revised SQL; Git records that revision later. The evidence
does not establish the operator's workflow or the reason for the rollback.
The validator incorrectly required both attempts to match the retry's SQL.

## Exact comparisons

All archive paths below are
`prisma/migrations_archive/<migration name>/migration.sql`.
All timestamps are UTC, as returned through Prisma.
For successful rows, the actual on-disk CRLF archive checksum equals the live
checksum. The committed LF checksum differs as shown.

| Migration name | Live checksum / actual file checksum | Committed LF file checksum | Status / recorded finished_at |
| --- | --- | --- | --- |
| `20260913000000_joro_marketplace_foundation` | `0d47c71235447c127eb09b3ba461061318c873b4c23afc7aa6632a26da423a8d` | `2e36f3f1ae21b958bbecd44efebde4f2de1fdef801f5f8023dc41cefbcf3522c` | Success / `2026-09-14T06:54:30.743Z` |
| `20260913090000_joro_merge_reconciliation` | `e9f86478261504409d16ed80cbcb37e7e54e1535e24268775168dd3517705ae6` | `d1da844e94442505f5ba10d3607efb9f11903c888333b5e25f9aeeca9c8913b6` | Success / `2026-09-14T06:54:57.384Z` |
| `20260914000000_step8_top_vendors` | `a7cfa9e76285e67a9a3fa44ec796138e71a743a3ba84221f482834f8f97f522c` | `52c7a2b3ce13613459a3a1836f044383d50f8e0bca9f50794c9f3f1bb37ddb43` | Success / `2026-09-17T07:39:02.173Z` |
| `20260915000000_step9_support_tickets` | `deb74c5a4dae4e3491d4cf26acbb99e9777aa449082a8c016da52e1b47e78615` | `1106f7b0271cdbec64de5760600775bbe5a41f9140ead111174355f033c09ceb` | Success / `2026-09-17T07:39:02.612Z` |
| `20260915010000_customer_oauth_vendor_onboarding` | `423b7b55176fe85fb24b5dd5bfbb5f1d8f750332f3e205e6b2246916fae4968c` | `830f3fe782ae24c9d2de7df6ba7902ccaa7f67454eeb222dff210e606499c8fe` | Success / `2026-09-17T07:39:03.080Z` |
| `20260916000000_vendor_operational_onboarding` | `74214f0decd73ca7c43516d41b0a73b4371ccbd412160260f542298fd6a7054e` | `ae668bb9ff6aacfd7c0ba7d394e51fa320de4d7ef043abfe5989672b51921ed6` | Success / `2026-09-17T07:39:03.172Z` |
| `20261009000000_want_request_type` | `1a6debc89f37ec51b745d30e0c8a115bc190a6ce38a5c1c4996caea24c6b8f7d` | `14f7e6054fb2f51444bdd667a1ed8b09408c1d309bcaa0abb0403f09a6e79238` | Success / `2026-10-12T05:31:13.783Z` |
| `20261009010000_service_listing_moderation` | `401504c0a08199990f091a181ff29085c5fd11765755a2910dcc21a645b7139e` | `57db2d30eb3dc3842edcb76d838d84545a1a167ca32215f4b11edd3f9eb32b73` | Success / `2026-10-12T05:31:13.973Z` |

For the additional `step8_top_vendors` rollback row:

- Live checksum: `48be3ddef269a1cb0907da222915e0dd4b43b6c9030c8f9c1589f18811db3c5f`.
- Actual current archive checksum: `a7cfa9e76285e67a9a3fa44ec796138e71a743a3ba84221f482834f8f97f522c`.
- Current committed archive checksum: `52c7a2b3ce13613459a3a1836f044383d50f8e0bca9f50794c9f3f1bb37ddb43`.
- Expected authentic original CRLF checksum: exactly the live checksum above.
- started_at: `2026-09-17T07:34:37.832Z`.
- rolled_back_at: `2026-09-17T07:37:35.027Z`; finished_at: NULL.
- Successful retry started_at: `2026-09-17T07:39:01.829Z`.

There is no separately documented expected checksum for archived migrations in
`prisma/migration-manifest.json`, `DATABASE_MIGRATIONS.md` or
`LIVE_DATABASE_SETUP.md`. At the initial investigation the manifest listed five
active migrations; the reconciled manifest now lists six.
The expected historical checksums here are established from exact Git SQL bytes
and their two line-ending encodings, compared to live records, not invented
documentation values.

## Git history evidence

`git log --all --follow` and `git show <commit>:<path>` were inspected for every
conflicting file, following its move from `prisma/migrations` to the archive.
Archive commit `dda301b0311959bbab807854c06e34050b9f74d3` on 2026-10-17 retains
the same SQL bytes as these earlier versions:

| Migration | Original/relevant commit |
| --- | --- |
| marketplace_foundation | `96f2c3b1ac01abfe42aaadc1b308375c3a31931a` |
| joro_merge_reconciliation | `edaa02bdc926cfad198ab5e2eb763bd1c77ba723` |
| step8_top_vendors rollback SQL | `3fdd16fef210341b6acd0066356d9d7bcc402a93` |
| step8_top_vendors retry SQL | `f23bb0b8680a5b720c4e2db7a0164b94d5dc2262` |
| step9_support_tickets, customer_oauth_vendor_onboarding, vendor_operational_onboarding | `3fdd16fef210341b6acd0066356d9d7bcc402a93` |
| want_request_type, service_listing_moderation | `da19334229d2333f3b26d5ab846d9cf5d506aed4` |

## Correction and safety

Only historical checksum selection/comparison changed in
`scripts/lib/live-db-safety.mjs`: compare exact LF/CRLF hashes of archived SQL,
and retrieve the pinned original Git SQL only for the documented rollback.
Do not restore the older SQL over the archive: that would replace the successful
retry's authentic SQL. Neither migration tree, schema nor manifest was edited.
Missing original Git objects remain blocking; a shallow clone must supply that
history before archived validation can succeed.

Regression coverage in `tests/db-live-safety.test.mjs` accepts both historical
newline encodings, rejects switched rollback/success hashes, missing original SQL,
arbitrary hashes and whitespace changes, and retains exact active checksums,
rollback chronology, baseline and complete-history checks.

The initial read-only query found all five active migrations successfully applied,
including `20261025000000_standalone_quote_service_booking`, with no pending active
migrations from this checkout.

## Historical verification and temporary blocker (resolved)

`node --test tests/db-live-safety.test.mjs`: **13 passed, 0 failed**.
`git diff --check`: passed.

Both requested commands were executed against the existing verified managed tunnel:
`npm run db:live:check` and `npm run db:live:status`. Both passed the archived
checksum/rollback checks with the correction, then correctly stopped with
`Live migration history contains an unknown/conflicting migration.`
At that stage, production history did **not** pass overall. The later reconciliation
below resolved this blocker; this paragraph is historical evidence, not current status.

A subsequent read-only history query identified the additional applied record:

- Migration: `20261025010000_want_photos`.
- Live checksum: `f437f7ba0b9b83e3ec097e81a29d90df2a5fcd79cb4d5bfb5bf1a44330e6affa`.
- started_at: `2026-10-25T17:48:06.116Z`.
- finished_at: `2026-10-25T17:48:06.122Z`; rolled_back_at: NULL.
- Archive/active file checksum: unavailable; neither file exists in this checkout.
- Expected documented checksum: unavailable; no matching manifest/document entry.
- Total live migration rows: 31 (25 archived attempts, five known active rows,
  one unknown applied row).

`git log --all` for both possible migration paths returned no history. Repository
text search found no occurrence before writing this report. `git ls-tree` confirms
the five known active migrations; the checkout is not shallow. All available local
and remote-tracking refs were searched, but no remote fetch was performed.
This proves the authentic file is unavailable in the inspected repository state,
not that it never existed in another deployed revision or artifact.

The initial investigation stopped here as requested. At that point, review needed
to obtain the authentic deployed
`20261025010000_want_photos/migration.sql` and its source revision/artifact, verify
its exact bytes against the live checksum, then reconcile the repository through
review. Do not fabricate SQL or change the live record. No full pending-migration
clearance is possible until that history is established, although every active
migration currently present in this checkout is applied with its exact checksum.

The wrapper confirmed `.env` and `.env.live.local` bytes and last-write timestamps
were unchanged across both commands. Its existing protection step reasserted the
private file's Windows ACL. No environment content was edited. No migration SQL,
schema, manifest, production records, commits, pushes or deployments were changed.

## Reconciliation and final verified conclusion (2026-10-27)

`git fetch origin` found the authentic
`prisma/migrations/20261025010000_want_photos/migration.sql` in upstream Git history.
It was introduced by commit `327a601cb20a8a5239e238849a2a8f3092052134`.
The local checkout and its stale remote-tracking reference had been at `73e7a04`,
four commits behind fetched `origin/main`. This explains the missing file; it was
not a production checksum inconsistency.

The exact Git file includes `-- AlterTable`, the statement
``ALTER TABLE `want` ADD COLUMN `photos` JSON NULL;``,
and LF line endings. Its SHA-256 is:

`f437f7ba0b9b83e3ec097e81a29d90df2a5fcd79cb4d5bfb5bf1a44330e6affa`.

The original commit, fetched main, reconciled local file and live migration record
all matched this checksum exactly. Read-only history queries confirmed successful
application at `2026-10-25T17:48:06.122Z`, with no rollback.

After checking that upstream paths did not overlap local work, the repository was
fast-forwarded from `73e7a04` to `c16fba3` (full revision
`c16fba33a22ef46f0c163da956385f60e483143e`). The matching schema and manifest were
reconciled with the authentic migration and accompanying upstream files. All ten
existing modified/untracked files, including the validator fixes, tests and
documentation, were preserved byte-for-byte during the fast-forward.

The historical LF/CRLF differences were resolved in validator comparison logic;
the rolled-back SQL was verified against authentic pinned Git history. No migration
SQL or production checksum was rewritten to suppress a conflict.

Both `npm run db:live:check` and `npm run db:live:status` subsequently passed:

- **24 successful archived migrations**, plus **one documented historical rollback**.
- **All six active migrations applied**, including `0_baseline` and `want_photos`.
- **Zero pending migrations**; all 31 recorded attempts accounted for.

`npm run db:check` passed and the full automated suite passed **206 tests**.
Production migration history now passes. The earlier missing-migration blocker is
resolved. No production records/history were changed and no migration, new commit,
push or deployment was performed. Successful local tunnel checks do not independently
verify Hostinger deployment settings or release readiness.
