# JORO live database from Windows

Project: `C:\Users\hamid\Pictures\IN-range-by-Abdullah`.

## One private configuration file

`.env.live.local` is created automatically by `npm run db:live:setup`.
The previous fixed profile is upgraded without changing its target or discarding a
saved password. Existing valid files/passwords are left intact. `.env` and
`.env.local` are never created, deleted or changed by live commands.

On initial setup, replace only this placeholder in `.env.live.local` if present
(the verified private profile already loads real credentials):

```dotenv
JORO_LIVE_DB_PASSWORD="ADD_MYSQL_PASSWORD_HERE"
```

Keep quotes around passwords containing `#`, whitespace or other special characters.
Standard dotenv quoting applies; use single quotes if a literal double quote appears
in the password. Values are parsed locally without shell interpolation. The script
URL-encodes credentials internally; no manual MySQL URL is required. Passwords must
occupy one physical line. No password or complete URL is printed.

The password is **plaintext on disk**. This is less secure than encrypted credential
storage. Git ignore rules and NTFS access controls do not encrypt the file or protect
it from software running as your Windows user. Keep it out of shared folders, Git,
uploads and logs. The requested workflow has no DPAPI dependency, encrypted-secret
setup or repeated MySQL password prompt. Any previous encrypted private artifact is
unused and is not automatically deleted.

On Windows the wrapper attempts to set the file owner and sole FullControl access
rule to the current user's SID, with inheritance disabled. It reports a warning if
this fails. Review permissions before entering a real password if a warning appears.
The sandbox identity may be unable to read a correctly protected file; use your normal
Windows terminal. Links are rejected. Setup verifies the repository root and ensures
the private profile/state paths are ignored and untracked.

## Fixed settings

```dotenv
JORO_LIVE_DB_HOST=127.0.0.1
JORO_LIVE_DB_PORT=3307
JORO_LIVE_DB_NAME=u749284283_inrange
JORO_LIVE_DB_USER=u749284283_inrange
JORO_LIVE_DB_PASSWORD="ADD_MYSQL_PASSWORD_HERE"
JORO_LIVE_SSH_HOST=145.79.26.151
JORO_LIVE_SSH_PORT=65002
JORO_LIVE_SSH_USER=u749284283
JORO_LIVE_SSH_REMOTE_DB_HOST=127.0.0.1
JORO_LIVE_SSH_REMOTE_DB_PORT=3306
JORO_LIVE_EXPECTED_DATABASE=u749284283_inrange
JORO_LIVE_AUTO_MIGRATE=false
```

Missing/duplicate/unexpected settings or changed target/security values stop the
command. Empty or placeholder passwords stop before SSH startup with:
`Please configure JORO_LIVE_DB_PASSWORD in .env.live.local.`
`JORO_LIVE_AUTO_MIGRATE` must remain `false`; only explicitly approved deploy applies SQL.

`.gitignore` includes `.env.live.local`, `.env.live.*`, `!.env.live.example` and
`/.joro-live/`. No real secret is placed in a tracked example file.

## Commands

| Purpose | Command |
| --- | --- |
| Create/upgrade private environment; no password prompt or connection | `npm run db:live:setup` |
| Connect and verify identity/history; read-only | `npm run db:live:connect` |
| Repeat read-only verification | `npm run db:live:check` |
| Verify applied history and list pending migrations; read-only | `npm run db:live:status` |
| Offline target/committed manifest validation; no connection | `npm run db:live:validate` |
| Tunnel only | `npm run db:live:tunnel` |
| Close only the verified managed SSH tunnel | `npm run db:live:disconnect` |
| Future backup-confirmed, explicitly approved migration deployment | `npm run db:live:deploy` |
| Offline safety regression tests | `npm run test:db:live` |

Use `npm.cmd` if PowerShell blocks `npm.ps1`. Live Node code explicitly reads only
`.env.live.local`; inherited `DATABASE_URL` and local `.env` cannot replace its target.
The password stays inside Node memory. Prisma receives the explicit datasource URL;
deployment/preflight child processes receive it through their environment, never
arguments. Console diagnostics use fixed messages and failure stages rather than
raw driver exceptions.

## SSH

The independent tunnel is `127.0.0.1:3307` to remote `127.0.0.1:3306` through
`u749284283@145.79.26.151:65002`. The tooling verifies PID, start time, parent process,
session token, command and listening socket before reusing/stopping a tunnel.
It never reuses Beekeeper's or another process's listener or kills an unrelated PID.

OpenSSH uses existing default/agent keys. If a previously created project-specific
`.joro-live/id_ed25519` exists it is selected explicitly. No new key or remote key
registration is performed automatically. Without a trusted registered key, a native
masked SSH password prompt is normal. The MySQL password is never used for SSH.

`StrictHostKeyChecking=ask` remains enabled. Verify the first-use fingerprint against
Hostinger's SSH Access panel before accepting it; changed keys are never accepted
automatically. The known-host file stays in `.joro-live/known_hosts`. Keep the dedicated
SSH terminal open. For passwordless SSH, register only your public key in Hostinger
Websites > Dashboard > SSH Access > Add SSH key, and use your configured ssh-agent for
a passphrase-protected key. [Hostinger SSH-key instructions](https://www.hostinger.com/support/5634532-how-to-generate-ssh-keys-and-add-them-to-hostinger-dashboard/).

## Migration protection

Read `DATABASE_MIGRATIONS.md`. The original live validator incorrectly compared all
history only against the active manifest, rejecting documented pre-baseline rows.
The corrected validator accepts only the 24 explicitly allowlisted recorded archived
migrations through `20261009010000_service_listing_moderation`, with exact committed
SQL checksums (LF or CRLF encoding of the same archived SQL) and a valid
checksum-matching `0_baseline`. Active migration checksums remain byte-exact.
The rolled-back `step8_top_vendors` attempt is checked against its original SQL
from pinned Git commit `3fdd16fef210341b6acd0066356d9d7bcc402a93`, not the
successful retry's SQL. Missing original Git history blocks validation.
See [checksum investigation](LIVE_ARCHIVED_CHECKSUM_INVESTIGATION_2026-10-27.md)
for live checksums, original bytes and Git evidence.

If archived rows exist, all 24 successful historical runs and the documented extra
rolled-back `20260914000000_step8_top_vendors` attempt must be present. Timestamps must
be valid, precede the baseline and place the rollback before its successful retry.
The eight later archive files documented as manually applied are not accepted as
history records. Databases created from the active baseline without archived rows
are supported separately. Failed/unfinished attempts, unknown names, conflicts,
duplicate successes, missing baseline and active-history gaps remain blocking.

Every check validates unchanged committed schema/manifest/migrations and actual MySQL
database, authenticated user and remote port before reading table/history metadata.
No customer/order rows are read. No command repairs, deletes, resolves or rewrites
`_prisma_migrations`. Read-only commands never invoke a migrating Prisma command.

Deploy loads the same private file, validates history, runs the existing read-only
deployment preflight, displays pending names and committed SQL, verifies a nonempty
backup/hash, and requires both backup-readiness attestation and the exact identified
`APPLY ...` approval phrase in an interactive terminal. It rechecks commit, manifest,
backup and pending names, freezes the committed payload, runs only `prisma migrate
deploy` to apply migrations, then checks `prisma migrate status` and history again.
No `migrate dev`, `db push`, reset or automatic repair is allowed on production.
Merely connecting/starting the website never authorizes migration deployment.

## Local development and Hostinger

Local `.env` currently selects `127.0.0.1:3306/joro_local`. The development startup
guard reads Next's normal development environment and refuses an inherited production
target before starting the same Next dev server. It never reads `.env.live.local`.
`npm run db:migrate`, `db:check` and `db:generate` retain their existing behavior.
No local database write is performed by setup or its isolated tests.

Hostinger must use its own production environment variables; this laptop's live file
must not be uploaded. Build remains `npm run build`, start remains `npm start`, and
the existing `JORO_DEPLOY_MIGRATIONS` workflow is preserved. Do not enable remote
migrations without confirmed backup, schema compatibility and release sequencing.
Do not release application code that requires a still-pending schema migration.

This work has no authenticated Hostinger dashboard access, so the actual GitHub
repository/branch and auto-deploy setting are unverified. Check hPanel's connected
repository, selected `main` branch, auto-deploy toggle and production variables before
release. No remote settings were changed. Hostinger supports automatic GitHub builds,
but that does not prove this site's toggle is enabled. [Hostinger deployment documentation](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/),
[production environment variables](https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/).

## Verification evidence

Tests use fake passwords and isolated delegates for profile loading, preservation,
placeholder blocking, encoding, wrong-target rejection, SELECT-only checks,
archived/unknown/conflicting history, backup checks, ignore rules, local startup and
Windows process ownership. TypeScript, targeted lint, PowerShell syntax and whitespace
checks are also run. This is not live database validation.

A successful actual live inspection writes non-secret `.joro-live/last-check.json`.
Failures may write only sanitized stage/message metadata in `last-failure.json`.
These are historical receipts, never reusable authorization. Connection success must
be claimed only for a fresh successful inspection. A placeholder password blocks
connection; the successful checks below used configured private credentials.

No live migration, production write, commit, push or deployment was performed.

### Verified local tooling and SSH-tunnel access (2026-10-27)

- Full suite: **206 passed, 0 failed**, including 13 live-tool safety tests.
- `npm run db:check`: passed; six active migrations match the schema and manifest.
- `git diff --check`: passed; the Windows LF/CRLF notice is informational.
- Private live credentials successfully load without printing secrets or database URLs.
- The local managed SSH tunnel successfully authenticated to the expected production
  database. `db:live:check` and `db:live:status` both passed read-only verification.
- Archived migration history validation passed: 24 successful archived migrations
  and one documented historical rollback, including authentic rollback SQL checks.
- All six active migrations, including `0_baseline` and
  `20261025010000_want_photos`, are applied. **Zero pending production migrations.**
- The checkout was fast-forwarded from `73e7a04` to `c16fba3`, matching fetched
  `origin/main`, while preserving all existing local changes.
- `.env.live.local` and private tunnel state are Git-ignored and untracked.
  Environment contents and modification times were unchanged by reconciliation
  and both live checks; the wrapper reasserted the private file's Windows ACL.

These results establish local SSH-tunnel access and migration-history consistency.
They do not establish Hostinger deployment readiness: hPanel's connected revision,
branch, auto-deploy settings, runtime environment and release/backup readiness have
not been independently verified. No deployment or production write was performed.
