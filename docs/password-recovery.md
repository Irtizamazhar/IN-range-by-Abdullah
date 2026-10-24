# Customer password recovery

Implemented on 24 October 2026. Both `/login` and the existing customer account popup open the same recovery modal. Vendor recovery, Google authentication, signup, navigation, hamburger menu, checkout and order flows were not changed.

## Implementation

- The existing Remember me / Forgot password row moves upward by 10px on the login page and popup. Checkbox, input dimensions, sign-in and Google buttons retain their behavior.
- Four recovery screens: email, six-digit OTP, new password with confirmation, and confirmed success. The account background stays visible behind a dark overlay. The modal uses the existing typography, scoped CSS, green icons and password visibility component.
- Keyboard focus stays in the modal, background content becomes inert, Escape/Cancel restore trigger focus, and closing/Back are disabled during requests. OTP supports paste, numeric keyboards, autofill, automatic advance, arrow keys and backspace. Back after verification restarts email entry because verification consumes the code.
- `POST /api/customer/password-recovery` accepts `request`, `verify` and `reset` actions. Responses are not cached. The existing proxy-aware origin check is reused.
- Codes come from `crypto.randomInt`, expire after ten minutes, and use an HMAC verifier keyed by `NEXTAUTH_SECRET`, bound to the challenge and reset purpose. Only five verification attempts are allowed. Verification replaces the code with a five-minute, 256-bit reset authorization, stored as SHA-256 on the server and held only in client memory.
- Serializable transactions and conditional updates prevent concurrent verification/reset reuse. Passwords use existing bcrypt cost 12. Successful reset consumes other outstanding recovery records and increments the existing `sessionVersion` to revoke customer sessions.
- Password validation matches customer signup: at least six characters, maximum 72 characters and 72 UTF-8 bytes. Confirmation is checked in the client and API. The legacy reset endpoint now applies that same byte limit, rejects OTP-stage records and inactive accounts, and retains existing reset-link compatibility.
- Existing policy explicitly allows Google customers to create a website password through verified email recovery (`customer-oauth.ts` and the existing popup explain this). The flow preserves that policy; Google sign-in and account linking were not modified.

## Mail and configuration

Uses the existing `lib/mailer.ts` Nodemailer transport, environment variable aliases and `JORO <admin@joro.pk>` sender. Order templates and order delivery code are unchanged. The OTP template has branded table-based HTML, escaped code content and a plain-text alternative. No new provider or package was installed.

The recovery request checks transport availability for every valid email before account lookup, using the same transport's SMTP verification method. Missing configuration or transport outage returns a clear 503 response. A recipient-specific rejection invalidates that challenge and logs a generic operational error; its public acknowledgment stays identical to unknown accounts to avoid exposing account existence. The UI therefore says **if eligible**, rather than claiming delivery. SMTP acceptance itself never proves inbox delivery.

Existing local configuration contains database, mail and `NEXTAUTH_SECRET` settings. Only presence was inspected; no values were printed or changed. Public application origin configuration must continue matching the existing origin policy when deployed behind a proxy.

**No live mail was sent. SMTP connectivity, inbox delivery and a real database reset/login have not been verified.** An authorized test account and destination are required for that final end-to-end check.

## Database and operational requirements

The prepared migration `prisma/migrations/20261024000000_customer_reset_otp/migration.sql` adds only nullable `otpHash` and an `attempts` counter to `customerpasswordresettoken`. It has **not been applied** to any database. The Prisma client was regenerated locally and the schema validates. Apply the migration through the project's normal reviewed migration workflow against an approved database before using the feature.

Account resend cooldown (60 seconds) and five requests per hour are enforced using recent database records in a serializable transaction. Keep at least the last hour of recovery rows if adding retention cleanup. Request and verification IP throttling reuse the project's in-memory rate limiter; IP buckets are per process. A multi-instance deployment needs shared/edge IP throttling for a fleet-wide limit, and the proxy must overwrite client IP headers. Response shapes avoid account enumeration; synchronous SMTP processing does not promise identical response timing.

Legacy reset links remain supported. No production migration, deployment, environment edit, commit or push was performed.

## Verification

- TypeScript: `npx.cmd tsc --noEmit --incremental false` passed.
- Targeted Next ESLint passed for the modified TypeScript components, service, templates, transport, API routes and tests.
- Prisma validation passed; `git diff --check` passed.
- Twenty focused recovery, API, password-security and existing email tests passed using `tests/tsconfig.json` and the repository's Windows user-info fallback. Coverage includes expiry, incorrect codes, attempt lockout, resend cooldown/hourly limits, replacement, generic account responses, transport failure handling, invalid/expired authorization, concurrent reset replay, bcrypt comparison, session version increment, password byte limits, API confirmation validation, origin rejection, unavailable mail and existing email templates.
- `node scripts/test-password-recovery-browser.mjs` uses real login/popup/recovery components and CSS with fixture HTTP only. All screens pass at 320, 360, 375, 390, 414, 430, 768 and 1280px. Checks cover opening/Cancel/close, Escape, focus restoration/trap, paste, numeric entry, backspace, invalid code, confirmation mismatch, visibility toggle, pending reset, success, resend countdown, Back after verification and a short 320×400 viewport. No horizontal overflow or browser errors were observed. Provider/reset failure fixtures must not advance to success.
- Browser screenshots are generated under `.next/password-recovery-review/`. The fixture substitutes the logo/brand panel and session/navigation adapters; it does not verify a production login or mailbox.
- No full production build or whole-site test was run. Database migration/real MySQL transaction behavior, actual old/new password sign-in and inbox delivery require an approved test environment. No production customer was used.

The modal follows the reference closely. Existing login-page layout and branding remain; the reference's phone frames are not page UI. Privacy wording, password-policy help and delivery guidance add text beyond the illustration. Real device keyboard behavior still needs a device check.

## Changed files

- `components/auth/LoginExperience.tsx`
- `components/auth/AuthLayout.module.css`
- `components/auth/PasswordRecoveryModal.tsx` (new)
- `components/auth/PasswordRecoveryModal.module.css` (new)
- `components/user/AuthModal.tsx`
- `app/api/customer/password-recovery/route.ts` (new)
- `app/api/customer/reset-password/route.ts`
- `lib/password-recovery.ts` (new)
- `lib/customer-recovery-service.ts` (new)
- `lib/mailer.ts`
- `lib/joro-email-templates.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261024000000_customer_reset_otp/migration.sql` (new)
- `tests/password-recovery.test.ts` (new)
- `tests/password-recovery-api.test.ts` (new)
- `scripts/test-password-recovery-browser.mjs` (new)
- `docs/password-recovery.md` (new)
