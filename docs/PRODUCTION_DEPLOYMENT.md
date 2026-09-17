# Production deployment

This is the actual deployment process for this project (JORO.pk / In Range). It assumes a
Linux server (this app has no Windows-only runtime dependency — see "Linux/server
portability" below) and a MySQL database, and complements `docs/SETUP-AND-ROLLBACK.md`
(local setup, migration history quirks, rollback) and `docs/SOCIAL_AUTH_SETUP.md`
(Google/Facebook provider console setup).

Do not run any step below against production without first taking a database backup
(see "Backups" at the end of this document).

## 1. Server prerequisites

- Linux server (any distro with systemd is fine)
- Node.js 22.x LTS
- npm 11.x
- MySQL 8.x, reachable from the app server
- A reverse proxy that terminates TLS (Nginx or Caddy — examples below use Nginx)
- A process manager to keep the Node process running and restart it on crash/reboot
  (examples below use PM2; systemd is an equally valid alternative)

## 2. Clone and install

```bash
git clone <repo-url> joro
cd joro
npm ci
```

`npm ci` (not `npm install`) so the exact locked dependency versions are used.

## 3. Configure environment

Copy `.env.example` to `.env` and fill in real values. Keep `.env` out of version control
(it already is, via `.gitignore`) and out of shell history — prefer your host's secret
manager or a restricted-permission file.

Required core variables (see `.env.example` for the full annotated list):

- `DATABASE_URL` — MySQL connection string for the production database
- `NEXTAUTH_SECRET` — long random string, generated once and kept stable (rotating it
  invalidates all active sessions)
- `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` — the real `https://` production domain. Every
  canonical link, QR code URL and outgoing email link is derived from these — there is no
  separate place to update when the domain changes.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (preferred over plaintext `ADMIN_PASSWORD`) — the
  bootstrap super-admin account
- `VENDOR_JWT_SECRET` — a different long random string from `NEXTAUTH_SECRET`

Optional, enable when the corresponding feature is needed in production:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `FACEBOOK_CLIENT_ID` /
  `FACEBOOK_CLIENT_SECRET` — customer social sign-in (see `docs/SOCIAL_AUTH_SETUP.md` for
  the provider-console steps and exact callback URLs; both are customer-only and simply
  don't render if their pair of credentials is absent)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` (or the `EMAIL_*`
  aliases) — transactional email (password resets, vendor verification, approval
  notices). **EXTERNAL-CONFIG-REQUIRED**: until these are set, the app degrades honestly
  (it reports email failures rather than pretending delivery succeeded) but no mail is
  sent.
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — admin
  product image hosting
- `WHATSAPP_NUMBER`, `VENDOR_REQUIRE_EMAIL_VERIFICATION`, `VENDOR_JWT_EXPIRES_IN`,
  `LOG_LEVEL` — optional behaviour toggles, see `.env.example`

Never set `ALLOW_LOCAL_TEST_SEED` or the `LOCAL_TEST_*_PASSWORD` variables in production —
they exist only for `scripts/seed-local-test-users.ts`, which refuses to run against a
non-local database anyway.

## 4. Database migration

Back up the database first (see "Backups"), then:

```bash
npx prisma migrate deploy
```

`migrate deploy` only applies migrations already committed to `prisma/migrations` — it
never generates new ones and never resets data. If this environment previously applied
the legacy pre-merge schema, read `docs/SETUP-AND-ROLLBACK.md` first; it documents the
one-time `migrate resolve` reconciliation some older databases need before `migrate
deploy` will proceed cleanly.

Verify before continuing:

```bash
npx prisma migrate status
npx prisma validate
```

## 5. Build

```bash
npx prisma generate
npm run build
```

(`npm run build` already runs `prisma generate` first — the explicit call above is only
needed if you generate the client separately from the build step, e.g. in a multi-stage
Docker build.)

## 6. Start

```bash
npm start
```

This runs `next start` on port 3000 by default. Run it under a process manager rather than
directly in a terminal:

**PM2**

```bash
npm i -g pm2
pm2 start npm --name joro -- start
pm2 save
pm2 startup   # prints the systemd command to enable PM2 on boot; run what it prints
```

**systemd** (alternative to PM2): create `/etc/systemd/system/joro.service` running
`npm start` from the project directory as a non-root user, with `Restart=on-failure` and
`EnvironmentFile=` pointing at the production `.env`, then `systemctl enable --now joro`.

## 7. Reverse proxy + HTTPS

Put Nginx (or Caddy) in front of the Node process to terminate TLS and forward to
`localhost:3000`. Minimal Nginx example:

```nginx
server {
    listen 443 ssl http2;
    server_name your-production-domain.pk;

    ssl_certificate     /etc/letsencrypt/live/your-production-domain.pk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-production-domain.pk/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name your-production-domain.pk;
    return 301 https://$host$request_uri;
}
```

Use Let's Encrypt (`certbot`) or your host's managed certificate for the TLS files. The
app's own security headers (`next.config.mjs`) already send HSTS when `NODE_ENV=production`,
so once TLS is in place at the proxy, browsers will keep enforcing it.

## 8. DNS

Point the production domain's `A`/`AAAA` record at the server, and set `NEXTAUTH_URL` /
`NEXT_PUBLIC_APP_URL` to match exactly (including `https://`) before starting the app —
OAuth callback URLs, canonical links, QR codes and email links are all derived from these.

## 9. Post-deploy smoke tests

After the first deploy (and after every subsequent one), check by hand:

- Homepage loads, categories dropdown works, search works
- Customer register/login, vendor login, admin login all work
- A test checkout (Cash on Delivery) completes end-to-end
- `/api/auth/providers` reflects the social providers you actually configured (and only
  those)
- Store QR page renders a real `https://` URL (not `localhost` or an HTTP link)
- No browser console errors on the homepage, an account page, and a vendor dashboard page

For a fuller automated pass, the project's own Playwright-based scripts in `scripts/`
(`test-auth-page.ts`, `test-customer-account.ts`, etc.) can be pointed at a staging
deployment, though they were written to run against a local database — do not run them
against production data.

## Backups

- **Database**: before every migration, and on a recurring schedule in production, take a
  full `mysqldump` of the `inrange` database:
  `mysqldump -u <user> -p inrange > inrange-$(date +%Y%m%dT%H%M%S).sql`. Store it somewhere
  other than the app server (object storage, a managed backup service, or at minimum a
  different disk).
- **Retention**: keep enough history to recover from a bad deploy noticed days later — daily
  backups for at least 14 days, plus at least one pre-migration snapshot kept until the next
  migration is confirmed healthy, is a reasonable minimum; tighten or loosen based on your
  actual write volume and compliance needs.
- **Private uploads**: `storage/private/` (vendor KYC documents, support ticket
  attachments) is local disk, gitignored, and holds data with no other copy — back it up
  alongside the database, on the same schedule. It is not covered by any database dump.
- **Restore**: stop the app, restore the database dump into a fresh database first (never
  directly overwrite the live one blind), restore `storage/private/` from its backup,
  point a staging `DATABASE_URL` at the restored database and verify the app behaves
  correctly, then switch production traffic over.

No credentials are included in this document or should ever be committed to the repository.

## Manual / external checklist (not code bugs — these require action outside this repo)

- **MANUAL-PRODUCTION-CHECK**: real production domain purchased and DNS pointed at the
  server
- **MANUAL-PRODUCTION-CHECK**: HTTPS certificate issued and auto-renewing
- **EXTERNAL-CONFIG-REQUIRED**: Google OAuth production app + redirect URI added in the
  Google console (`docs/SOCIAL_AUTH_SETUP.md`)
- **EXTERNAL-CONFIG-REQUIRED**: Facebook Login production app + redirect URI added in the
  Facebook console (`docs/SOCIAL_AUTH_SETUP.md`)
- **EXTERNAL-CONFIG-REQUIRED**: production SMTP credentials (transactional email is
  otherwise silently unavailable, though the app never claims a failed send succeeded)
- **EXTERNAL-CONFIG-REQUIRED**: production Cloudinary account, if admin product image
  hosting is used
- **MANUAL-PRODUCTION-CHECK**: reverse proxy configured and running (Nginx/Caddy example
  above)
- **MANUAL-PRODUCTION-CHECK**: scheduled database + `storage/private/` backups actually
  running, not just documented
- **MANUAL-PRODUCTION-CHECK**: a real device scans a live Store QR code end-to-end against
  the production domain
