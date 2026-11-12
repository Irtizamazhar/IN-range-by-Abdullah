# Incremental marketplace upgrade — local review

Follow-up: [compact chat, smart search and latest local validation](SMART_SEARCH_CHAT_REVIEW.md). The results below record the original incremental upgrade before that follow-up.

Prepared 12 November 2026. No production database connection, production write, Git commit, push or deployment was performed for this upgrade. Environment files and existing secret values were preserved. All new campaign/product examples used by tests are confined to fixtures and disposable databases.

## Features and design preservation

- Original header, logo, hero, fonts, colours, footer content, original sections and their order remain. Additional promotion slots sit after the hero, after categories, after All Products and after the main content. Only enabled, currently scheduled, administratively created campaigns render; no invented live offers are seeded.
- Promotions support text, protected image upload, validated internal catalog destination, visibility, ordering and UTC start/end dates. Administration requires `homepage.manage`; changes are audited. Existing vendor-sponsored promotions remain separate.
- A featured-product spotlight uses a real eligible, in-stock `isFeatured` product, its current price/images and a discount only when the persisted original price makes it valid. Existing discovery sections and product cards remain.
- Homepage categories require active, homepage-enabled, public-product eligibility. Desktop shows the first five in configured order; mobile/tablet retain one swipeable snap row. Motion respects reduced-motion settings. The existing drawer keeps its focus trap, Escape, scroll lock and close-on-navigation, adds expandable category navigation and canonical category links, and can display the compact newsletter signup.
- Compact analytics consent preserves the existing controller, storage, rejection, withdrawal and GA4 gates. Preferences reopen from the footer. Opening chat temporarily hides the consent panel without granting consent; reopening preferences closes chat.

## Chat, newsletter and checkout

Chat reuses `SupportTicket` and `SupportMessage`. A random guest credential is stored in an HTTP-only, production-Secure, SameSite cookie; only its SHA-256 hash is persisted. Registered access also checks account ownership. Public queries explicitly exclude internal notes and private token hashes. Writes require same-origin requests, bounded fields, durable rate limits and idempotency receipts. React renders message text without HTML injection.

Customer polling runs every 15 seconds while the panel is open and the page visible. Admin polling runs while the inbox is visible. Availability is an explicit authorized staff heartbeat expiring after 90 seconds, rather than a fabricated online label. Offline messages persist. Admin inbox supports replies, unread conversation indicators, search/status filters, private notes and close/resolve/reopen. Existing Support ticket detail retains the authorized assignment UI; the new chat API also checks assignee permissions. No WebSocket service or unsupported persistent Hostinger connection is assumed.

Newsletter uses the existing mailer and customer marketing preference fields. Signed-in customers explicitly click Subscribe using their account email, without retyping it. The current schema does not prove email verification, so **all subscriptions require double opt-in**. Guest email matches never silently bind a customer account. Confirmation expires after 24 hours and is single-use; token hashes are persisted. Email links place credentials in fragments and require an explicit button/POST, so GET requests by mail scanners do not subscribe or unsubscribe. Admin subscriber views require `customers.manage`. No campaign mail sender was added, and no real email was sent during verification.

Guest checkout extends the existing order transaction, rather than adding a separate ordering engine or fake customer. It keeps server pricing, COD coverage, delivery/handling fees, stock policy, seller slices, order history, notifications and duplicate prevention. Public coupons can use nullable customer redemption ownership; account-limited coupons and accepted private quotes require sign-in. Optional guest email is used only for the existing eligible confirmation mail job. Saved account addresses remain an authenticated feature. Guest tracking requires a private cookie proof, expires after 30 days, and is noindex; guessing an order ID is insufficient. Guests must retain the same browser for this tracking access.

## Schema and release flags

Prepared migration: `prisma/migrations/20261111000000_incremental_marketplace_features/migration.sql`.

New models: `HomepagePromotion`, `LiveChatAccess`, `LiveChatReceipt`, `LiveChatPresence`, `NewsletterSubscription`, `GuestOrderAccess`, `PublicFeatureRate`. Chat and guest access use existing ticket/message/order foreign keys. `CouponRedemption.customerId` and its customer relation become nullable for genuine guest redemptions. Existing products, categories, prices, stock, IDs and order records are not rewritten. There is no product-slug backfill in this migration.

SQL was generated from the committed schema with Prisma, then all **15 migrations** replayed in a new disposable local database and compared against the schema. The repository manifest was updated with its verified workflow. No existing application database was reset or migrated.

New server flags default to false:

```text
JORO_HOMEPAGE_PROMOTIONS
JORO_LIVE_CHAT
JORO_NEWSLETTER
JORO_GUEST_CHECKOUT
```

Leave them off until compatible schema, configuration and operational approval exist. They do not enable or disable GA4.

## Verification performed

| Check | Actual result |
| --- | --- |
| `npm test` | 312/312 passed, zero skipped |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed; existing image warnings remain |
| `JORO_DEPLOY_MIGRATIONS=false` local production build | Passed; migration execution disabled |
| Repository full migration replay + manifest validation | Passed, 15 migrations |
| `npm run test:incremental:db` | 8 groups passed against a newly created disposable local DB, including real browser UI and real handlers |
| `npm run test:checkout:db` | 11 groups passed: registered checkout, seller stock policy, services, settlement, returns/refunds, saved addresses and browser UI |
| `node scripts/test-category-row-browser.mjs` | Passed at 390, 768, 1024, 1440, 1920px; one row, no overflow/overlap, five desktop categories |
| `node scripts/test-catalog-slug-http.mjs` | Passed HTTP 308/200/404, canonical URLs, sitemap, robots, structured-data policy checks; zero attempted DB writes |
| `node scripts/test-vendor-onboarding-browser.mjs` | Passed 360px and 1280px with mocked APIs |
| Separate GA4-enabled local build + `node scripts/test-analytics-browser.mjs` | Passed at 390px/1440px; reject/accept/withdraw, cross-tab withdrawal, route privacy, one script, no hydration errors, storage/network failure handling |

Database tests intercepted email and external integrations; they did not send mail, take payments, transfer refunds or call couriers. Analytics tests intercepted Google requests; actual GA4 ingestion was not tested. Browser fixtures are not the live catalog. These checks are broad regressions, not a claim that every real production integration or every possible workflow was exercised.

Test-harness adjustments preserve actual behaviour: seller stock is deducted at confirmation, not initial checkout; service fixtures require approved moderation; shipping fixtures include the already-committed built-in COD cities; category tests include emitted CSS-module styles. None of those business rules were changed by this upgrade.

## Screenshots and comparison

Screenshots were captured **before editing**, then again from the final production build using the same read-only catalog fixture, 390px and 1440px viewports. Enabled-feature captures use explicitly marked test campaigns, never copied mockup products or live database writes.

- [Before mobile](../.release-prep/incremental-before-390.png) / [after with additions](../.release-prep/incremental-after-enabled-390.png)
- [Before desktop](../.release-prep/incremental-before-1440.png) / [after with additions](../.release-prep/incremental-after-enabled-1440.png)
- Default-off captures: [mobile](../.release-prep/incremental-after-390.png), [desktop](../.release-prep/incremental-after-1440.png).

Visual review of both header/hero pairs confirmed the same appearance and dimensions. Original headings remain in order; enabled additions introduce new sections. There is no horizontal page overflow. Hero bounds stayed exactly `(12,212,366,519.796875)` at 390px and `(24,214,1392,408)` at 1440px. Added content necessarily moves subsequent sections down. Screenshots/logs are ignored local review artifacts and are not part of a release. No new Lighthouse score or live performance improvement is claimed.

## Remaining release prerequisites and limitations

1. Production schema/backup/restore verification and migration execution remain separate approvals. This feature migration has not been run against production. Do not push to an auto-deploy branch first.
2. Verify the actual hosting proxy overwrites trusted client-IP headers before enabling public rate-limited endpoints. Rates persist across workers but depend on trustworthy address headers. Configure request-body limits at the proxy as well as application field limits.
3. Confirm newsletter sender/domain delivery and public HTTPS origin in a controlled staging test. Review consent wording, retention, privacy disclosure and support staffing with the business. Real SMTP delivery is unverified.
4. Operationally schedule expiry-row cleanup/retention for rate windows and private access data. Expiry is enforced on access, but rows are not automatically deleted. Do not delete financial/order records as a cleanup shortcut.
5. Current views are bounded: public chat latest 100 messages, admin latest 200 messages, inbox latest 100 conversations, newsletter latest 200 filtered subscribers. Older messages remain stored; pagination/export is not supplied. Unread counts describe the displayed inbox, not all historical messages.
6. Existing account marketing-preference controls and the new subscriber record are separate stores: confirmation/unsubscribe through the new flow synchronizes account consent; no marketing send pipeline should treat the new list as permission to override an account opt-out. Reconcile both preferences before any future campaign sender is enabled.
7. Guest tracking expires after 30 days and cannot be recovered by email/name matching. Support must use its existing identity-verification process for later inquiries. No guest self-service account merge, returns or payment-rule changes were introduced.
8. Production checkout, real payment/refund/courier integration, production mailbox delivery, Hostinger workload and live layout remain unverified for this change. Do not claim production readiness from local tests.

## Safe staged rollout — review only, not executed

1. Review the exact changed-file inventory and migration; confirm no secrets, unrelated files or fixture data enter release. Obtain separate approval before commit/push or production writes.
2. Establish the verified production profile with existing guarded workflow; review every pending migration. Create a fresh complete backup and restore it into an isolated compatible database. Verify identity, counts, relationships and existing migration checksums there. Rehearse this migration and feature tests on that restored staging copy.
3. Record a usable rollback application artifact. Keep the four new flags false. Apply only reviewed schema changes using the guarded repository workflow before code that queries new tables is deployed. Never use `migrate dev/reset`, bypass manifest checks, or blindly apply unrelated pending migrations.
4. Deploy compatible code only after database readiness and separate Git/deployment approval. Check original homepage, product/category URLs, login, admin/vendor permissions, account checkout, orders and analytics first.
5. Enable promotions, then chat/newsletter individually after their configuration/privacy/staffing gates. Create only real approved campaigns. Monitor polling, API errors and delivery.
6. Enable guest checkout last after staging confirms COD, fees, public/account coupons, seller confirmation stock, replay protection, private tracking and notification jobs against representative catalog data.
7. If an issue occurs, disable the affected feature flag and redeploy a **guest-capable** known-good artifact. Retain the additive schema and all orders/messages/subscriptions. Once guest coupon rows exist, an older Prisma client expecting non-null redemption ownership may be incompatible: do not roll back to such an artifact. Turning guest checkout off also suspends its private tracking/mail paths; support must assist existing guests during recovery. Never automatically drop the new tables, make customer IDs non-null, or restore an old backup over new orders.

**Verdict: ready for local review; NO-GO for production until the listed release gates are independently satisfied.**

See [exact changed-file inventory](INCREMENTAL_MARKETPLACE_CHANGED_FILES.md).
