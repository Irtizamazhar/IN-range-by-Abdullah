# Customer social login

The existing NextAuth handler is `app/api/auth/[...nextauth]/route.ts`. Both providers use CustomerOAuthAccount, keyed by (provider, providerAccountId). They never create vendor/admin accounts or permissions.

Set NEXTAUTH_URL to the public application origin, keep NEXTAUTH_SECRET configured, and use HTTPS in production. No domain is hardcoded in the social auth implementation.

## Google
1. Create a Google OAuth web application in the provider console.
2. Set its authorized origin to your application origin.
3. Add the exact redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`.
4. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the deployment environment.
5. Restart/rebuild and test Customer Sign In and Sign Up.

## Facebook
1. Create a Meta developer app and configure Facebook Login for your website.
2. Obtain its App ID and App Secret.
3. Configure the website URL/app domains and valid OAuth redirect URI: `<NEXTAUTH_URL>/api/auth/callback/facebook`.
4. Set FACEBOOK_CLIENT_ID (App ID) and FACEBOOK_CLIENT_SECRET (App Secret).
5. Configure app mode/test roles and required public access for email/public_profile in Meta before public launch.
6. Restart/rebuild the application.
7. Test Customer login, cancellation, missing email and repeated login.

A provider is registered and its buttons rendered only when BOTH of its credentials are nonempty. Missing configuration does not affect password login. Vendor modes have no social login.

Google requires email_verified=true for a new identity. Facebook uses the email returned by the server-side Graph profile request; some Facebook accounts do not return an email. Those accounts receive a clean message to use password registration. No email supplied by the browser is accepted as provider proof.

An already-linked identity resolves its original active customer, even if the provider email changes. A new identity with an existing customer's email is refused with "An account already exists with this email. Sign in using your existing method first." There is no automatic linking or public linking endpoint. Legacy email-only Google customers are not silently backfilled; they can use their existing password or the verified password-reset flow. Authenticated provider linking can be added as a separate future feature.

Provider secrets/tokens are not stored in CustomerOAuthAccount or sent to the UI. Customer sessions use the existing customer cookie and sessionVersion revocation checks.

## Verification after configuring credentials
Use provider test accounts to complete each real consent/callback flow twice, confirm a single Customer and identity, then sign out. Verify an unlinked existing-email collision cannot sign in, and a customer cannot access vendor/admin pages. The local regression suite exercises the canonical callback service with server-profile fixtures; it does not substitute for live provider-console validation.

References: [NextAuth Google provider](https://next-auth.js.org/providers/google), [NextAuth Facebook provider](https://next-auth.js.org/providers/facebook).
