# JORO email rollout

## Current scope

The customer and vendor registration APIs send one welcome message after a new account is created. Existing customers and sellers are not backfilled. Password reset and seller verification reuse their existing one-time tokens with JORO-branded HTML and plain-text email. Seller approval/rejection sends a status message on the first transition. Sending returns success only when the SMTP provider accepts the recipient; SMTP acceptance is not a guarantee of inbox delivery. Ambiguous SMTP failures are not retried automatically because that could duplicate mail.

Admin Marketing → Email Campaigns supports saved drafts, a restricted formatting editor, preview, recipient search, consent visibility, history, and rate-limited test email to the signed-in admin. **There is no bulk-send endpoint.** All existing customers and vendors have null marketing consent after migration, so none is eligible for promotional delivery. Signed-in customers and vendors can set their own promotional email preference at `/marketing/preferences`; a signed unsubscribe link can revoke it. Before enabling bulk sending in a later release, verify a suitable bulk provider and its domain authentication, build a durable delivery queue with unique per-recipient keys and backoff, and review legal consent requirements. Test emails do not subscribe or email selected recipients.

## Hostinger environment

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE` (`true` for implicit TLS on 465, normally `false` for STARTTLS on 587). The existing `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, and `SMTP_PASS` aliases remain supported. Configure the Hostinger mailbox so it is authorized to send as **JORO <admin@joro.pk>**; the sender is fixed in code. `EMAIL_FROM`/`SMTP_FROM` are not used for customer-facing mail. Keep all passwords in server-only environment variables. Set `NEXT_PUBLIC_APP_URL=https://joro.pk` and `NEXTAUTH_URL=https://joro.pk` so email links and the logo use the correct origin. `NEXTAUTH_SECRET` signs unsubscribe tokens and must remain stable.

SMTP connections and responses have bounded timeouts so a slow mail server does not indefinitely hold signup or password-reset requests. Failed acceptance is reported as a delivery failure; it is not retried automatically.

The existing internal admin notification address setting is `ADMIN_EMAIL`. If internal notifications should go to a separate mailbox, optionally set `ADMIN_NOTIFICATION_EMAIL`; otherwise `ADMIN_EMAIL` remains the fallback. Do not put a personal notification address in public frontend variables.

## Database and release order

Back up MySQL. Review the additive migrations `20261015000000_customer_first_welcome` and `20261015010000_email_campaign_drafts`, then apply through the project's normal `npx prisma migrate deploy` step **before** releasing application code. Run `npx prisma migrate status`, `npx prisma validate`, `npx prisma generate`, and `npm.cmd run build`, then restart the Hostinger application. Do not use `prisma db push` or `prisma migrate reset`. These migrations preserve all existing accounts and orders; marketing consent defaults to null.

No database migration or live SMTP test was run during implementation. Verify a new customer signup and seller signup using a test mailbox, reset/verification links, first status-transition emails, and admin test email after configuration. Verify unsubscribe with a signed test link without exposing the token in logs.
