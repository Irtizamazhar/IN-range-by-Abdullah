PRE-STEP-10 STATUS: COMPLETE

Completed on main at baseline commit bed0e93. Existing uncommitted Steps 8/9 and other work was preserved. No branch, commit, push, deployment, reset, destructive Prisma command, or Step 10 work was performed.

Verification date: 16 September 2026.

| Requested result | Outcome |
| --- | --- |
| 1. Exact files changed | The complete task file list is below. Pre-existing changes outside this list were preserved. |
| 2. Prisma schema | Added Customer.oauthAccounts and CustomerOAuthAccount with id, customerId, provider, providerAccountId, createdAt, updatedAt, cascading Customer relation, unique(provider, providerAccountId), and customerId index. Added VendorAccountStatus.onboarding. Vendor.cnic is nullable and remains unique. Existing shopName, phone, city, bankName, accountNumber and accountTitle receive empty-string defaults; businessType defaults to individual. Address stays required and the basic signup endpoint explicitly supplies an empty draft value. Status still defaults to pending; the new basic signup explicitly chooses onboarding. |
| 3. Migration | 20260915010000_customer_oauth_vendor_onboarding. Inspected the schema diff and exact SQL, checked migration status, captured before/after Customer/Vendor row digests, then applied the new migration using prisma migrate deploy. No historical migration was rewritten. |
| 4. Preservation | Before/after Customer/Vendor counts and row digests matched. The local database had zero Customer and zero Vendor rows before migration, so preservation of nonempty statuses was additionally checked using isolated approved/pending/rejected/suspended fixtures. Existing statuses remained unchanged. |
| 5. OAuth identity | Both providers use the same canonical identity relation. Linked identities resolve their original active customer. New identities create Customer and identity atomically. Repeated/concurrent callbacks reuse one identity/customer. |
| 6. Google | Uses the canonical identity service, requires verified email for new identities, and issues only customer sessions. Enabled only with both credentials. |
| 7. Facebook | Fully code-configured through the existing NextAuth handler. Uses server-side Graph profile data and canonical identities. Missing provider email produces a safe fallback message. Enabled only with both credentials. |
| 8. Facebook environment | FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET. Safe empty placeholders were added to .env.example. |
| 9. Facebook callback | /api/auth/callback/facebook, under NEXTAUTH_URL. The test server's actual provider metadata confirms this route. Google uses /api/auth/callback/google. No application domain is hardcoded in social auth logic. |
| 10. Setup documentation | docs/SOCIAL_AUTH_SETUP.md. Covers provider consoles, environment variables, redirect URLs, restart/build, missing email and live acceptance checks. |
| 11. Same-email collision | A new unlinked provider identity cannot claim an existing email. It receives: “An account already exists with this email. Sign in using your existing method first.” No public linking flow or silent legacy backfill was added. |
| 12–13. Toggles | Customer/Vendor and Sign In/Sign Up each use real backend flows. Switching clears passwords/form state. Tabs support keyboard navigation. Social buttons are customer-only in both modes. |
| 14. One-view auth | Approved emerald/white split layout, existing logo and all eight supplied assets retained. Inputs are 48px. At 1024/1280/1440 × 768, all four forms fit without page scrolling or nested scrolling. Mobile signup may scroll naturally. Desktop/mobile screenshots were inspected. |
| 15. Basic vendor signup | Full name, email, password and confirmation in the UI; the server creates only a draft seller account. KYC/bank fields are deferred. |
| 16. Onboarding/KYC | Signed-in owners can save fields and documents and resume later. Existing owner/business/CNIC/bank/document requirements are validated on the server. Companies additionally need registration number and license. Submission moves onboarding to pending. Admin cannot approve an incomplete draft; approval of a submitted application uses the existing admin endpoint. |
| 17. Customer welcome | Authenticated customers see their name, Continue Shopping, My Account and Logout. |
| 18. Vendor welcome | Onboarding → Continue Seller Setup; pending → View Application Status; approved → dashboard. Existing rejected/suspended restrictions remain; suspended users retain the existing appeal flow. |
| 19. Sell on JORO | /sell resolves the actual vendor session: anonymous/customer-only → vendor signup; incomplete → setup; pending → status; approved → dashboard. |
| 20. Navbar | Wants → Together → Stores → Sell on JORO → Cart → Account. Account is last. Cart quantity comes from CartContext; a stored quantity of 3 and its removal were tested. Decorative fake badges were removed. |
| 21. Categories | Uses active, DB-backed categories from the existing categories API. Button opens a real dropdown; outside click, Escape, focus and keyboard activation work. Links use real category names. Current schema is flat, so no subcategories were invented. |
| 22. Category strip | 48px warm-white strip, subtle border, emerald text and lime hover. Mobile scrolling is inside the strip. Dropdown overlays the hero without clipping. |
| 23–24. Branding/footer | APNI MARKET • APNI CHOICE in navbar, auth and footer. Competing footer taglines and redundant four-tile trust strip removed. Useful links and payment information retained. |
| 25. Responsive/browser | 360, 390, 768, 1024, 1280 and 1440px tested across four auth modes; no horizontal overflow, nested auth scrollbars or browser runtime errors. Category keyboard/outside/link behavior and footer were checked at every width. |
| 26. OAuth tests | New/repeated/concurrent identity, original-customer mapping, inactive rejection, same-email collision, Google unverified email, Facebook missing email, provider configuration and customer-only JWTs pass. Browser tests cover conditional buttons, clean errors, password fallback, logout and vendor/admin isolation. |
| 27. Vendor tests | Basic signup/relogin, saved fields/documents after reload, incomplete submission rejection, pending restrictions, incomplete admin approval rejection, explicit admin approval and existing status preservation pass. Company document requirements pass. |
| 28. Prisma | All 21 migrations up to date; schema validate and client generate pass. |
| 29. Typecheck/tests/build | tsc --noEmit passes; npm test: 25/25; service regression: 9 groups; account E2E: 24 groups; auth/navigation browser regression: 15 groups; production build passes. Existing img optimization, Browserslist age and Prisma configuration deprecation warnings remain nonblocking. |
| 30. Remaining setup | Neither Google nor Facebook credentials exist locally. Real provider consent/token exchange has not been exercised against live provider accounts. Configure provider apps, credentials and redirect URIs, restart/redeploy, and perform the documented live login checks. No auth redesign is needed. |

The existing credential backend authenticates by email, so the form honestly labels that field “Email”; phone sign-in was not invented. Legacy email-only Google accounts are not automatically linked: users can use their existing password or verified password reset. A future authenticated provider-linking feature is outside this task.

Tests use only a local database, loopback mail configuration, temporary production servers, and unique fixtures. Fixtures, their KYC files and test-created audit entries are removed after each run. Provider-console credentials were never added to the repository.

Re-run:
```powershell
npx.cmd prisma migrate status
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run test:auth:services
npm.cmd run build
npm.cmd run test:account:e2e
npm.cmd run test:auth:e2e
```

Run generate/build while the temporary Next servers are stopped to avoid Prisma DLL locks on Windows.

Exact task files (including this report):
```text
.env.example
app/(user)/page.tsx
app/admin/vendors/page.tsx
app/api/admin/vendors/[id]/route.ts
app/api/admin/vendors/route.ts
app/api/customer/register/route.ts
app/api/vendor/login/route.ts
app/api/vendor/me/route.ts
app/api/vendor/onboarding/route.ts
app/api/vendor/signup/route.ts
app/globals.css
app/login/page.tsx
app/sell/page.tsx
app/vendor/dashboard/layout.tsx
app/vendor/login/page.tsx
app/vendor/onboarding/page.tsx
app/vendor/register/page.tsx
app/vendor/status/page.tsx
components/auth/AuthBrandPanel.tsx
components/auth/LoginExperience.tsx
components/ui/PasswordToggleInput.tsx
components/user/CategoryNavigation.tsx
components/user/Footer.tsx
components/user/MarketplaceNav.tsx
components/user/Navbar.tsx
components/user/UserRouteShell.tsx
components/vendor/VendorLoginAppeal.tsx
components/vendor/VendorOnboardingForm.tsx
context/CustomerAuthContext.tsx
docs/SOCIAL_AUTH_SETUP.md
lib/auth-provider-config.ts
lib/customer-auth-options.ts
lib/customer-oauth.ts
lib/vendor-auth-server.ts
lib/vendor-entry.ts
lib/vendor-onboarding.ts
package.json
prisma/schema.prisma
prisma/migrations/20260915010000_customer_oauth_vendor_onboarding/migration.sql
scripts/test-auth-page.ts
scripts/test-prestep10-services.ts
docs/PRE_STEP_10_COMPLETION.md
```
