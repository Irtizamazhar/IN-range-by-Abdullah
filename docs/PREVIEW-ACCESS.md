# JORO preview access

## Generate the password hash

From the project directory, run `npm run preview:hash` in an interactive terminal. Enter a new password of at least 12 characters, then confirm it. The input stays hidden. Copy the resulting `PREVIEW_PASSWORD_HASH=...` line to a secure location for Hostinger configuration. The generator does not save the password or the hash to the repository.

## Configure Hostinger

Set these server-side environment variables for the deployed Next.js application in Hostinger, then restart or redeploy the application so the running process receives them:

```text
MAINTENANCE_MODE=true
PREVIEW_ALLOWED_EMAILS=team1@joro.pk,team2@joro.pk
PREVIEW_PASSWORD_HASH=<bcrypt hash printed by npm run preview:hash>
PREVIEW_SESSION_SECRET=<independent random secret of at least 32 characters>
```

Use the actual authorized addresses. Separate addresses with commas. Paste the full bcrypt hash, including its `$2b$12$` prefix, as one value; do not put it in `NEXT_PUBLIC_` variables or source code. Generate the session secret separately, for example with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` in a trusted terminal. Keep both values private. Serve the site over HTTPS so production preview cookies use the `Secure` and `__Host-` protections.

Visitors see Coming Soon while maintenance mode is true. Team members select **Team Access**, enter an allowed email and the shared preview password, and then see the website. **Exit Preview** removes the preview cookie. Sessions expire after three days; rotating the password hash or session secret, or removing an email from the allowlist, revokes access. Preview access only passes the Coming Soon gate; admin, vendor, and customer areas still require their usual sign-in.

Set `MAINTENANCE_MODE=false` and restart or redeploy to restore public access. The other preview variables may remain set for a future private launch, but keep them server-side.
