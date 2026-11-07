# GA4 visitor tracking: local implementation, release prerequisites

No ecommerce/revenue events. One direct tag, G-BKBH6NHEY4. No GTM or Measurement Protocol secret.

## Required owner actions BEFORE enabling production

1. GA4 Admin > Data collection and modification > Data streams > JORO.pk web stream > Enhanced measurement > gear > Page views > Show advanced settings: turn OFF **Page changes based on browser history events**. Save. `send_page_view:false` suppresses initial configuration views; it does not independently suppress history-based Enhanced Measurement.
2. For this page-view-only release, turn OFF the other Enhanced Measurement options (scrolls, outbound clicks, site search, video engagement, file downloads, form interactions). Review Google tag automatic event detection as well. Do not enable Ads/user-provided data, Google Signals or connected destination tags. Confirm the only destination is this GA4 stream. Do not install a second hPanel/GTM tag.
3. Approve privacy wording, identify the legal operator/contact and review relevant consent requirements for actual visitors. This document is not a legal compliance certification.
4. Only after those checks, set both public build variables `NEXT_PUBLIC_GA4_ENABLED=true` and `NEXT_PUBLIC_GA4_PRIVACY_APPROVED=true` and rebuild an approved release. Both default OFF. The approval flag must remain off until the owner approves the final policy and release checklist. Per the latest instruction, the approved policy and enabled analytics may be published together in one production release; that release must serve the notice at `/privacy-policy` when analytics becomes available. The consent interface links to that page and Google's privacy information. No environment file was edited by this implementation. The ID is public, not a credential.
5. Verify Tag Assistant/DebugView and decoded network payloads before releasing. Use a test stream or intercepted Google requests for local/staging tests, not fabricated traffic/revenue in production.

## Collection policy

Versioned localStorage choice lasts 180 days and is revalidated on load. With unavailable storage, the choice lasts only in memory for this tab. Accept/reject have equally accessible actions; a persistent preferences button permits withdrawal. No Google tag is requested before explicit acceptance on an eligible route. Essential sessions/cart are independent.

Allowed pages: home, products, categories, services, stores, gifts, new arrivals, about and FAQ; public detail route shapes for products/categories/services/stores. Other routes default to excluded. Unknown query keys exclude the visit. Approved query values and all fragments are discarded. Free-text search, Wants, personal areas, checkout, order tracking, auth and vendor/admin routes are excluded.

Detail URLs are intentionally aggregated to `/products/detail`, `/categories/detail`, `/services/detail`, `/stores/detail`. Raw IDs/slugs and vendor-written titles are never sent. Query-only changes do not create page views. This sacrifices product-level/UTM attribution to keep this initial implementation narrow. A raw path is held only in browser memory for visit deduplication, never transmitted.

Initialization uses sanitized static page titles/locations and an empty referrer, `send_page_view:false`, ad consent denied, Google Signals disabled and host-only GA cookies. Withdrawal/private routes set Google's per-property disable flag before further application events, then send Consent Mode `analytics_storage:denied` (all advertising consent remains denied); returning to an allowed page with valid consent or explicitly reaccepting restores analytics consent without reconfiguring the tag. Withdrawal removes only `_ga` and this stream's `_ga_BKBH6NHEY4` cookies. Already executing third-party code cannot be unloaded; in-flight requests cannot be recalled. Revocation prevents new application page-view calls; verify actual Google behavior in staging. Consent Mode alone does not obtain legal consent.

GA automatically manages session/engagement information once allowed; no custom ecommerce or personal fields are sent. Google necessarily receives connection metadata such as the browser's IP address on an opted-in request. Do not claim zero personal-data processing or complete anonymity.

## OWNER-REVIEW WORDING ONLY — not added to the public policy

“If you accept optional analytics, JORO.pk uses Google Analytics to understand visits to selected public pages. Analytics stays off until you accept. We send generalized page locations and static page titles, without account, checkout, contact or free-text search information. Google may process browser/device information, online identifiers and network information when analytics is enabled. You can reject analytics or withdraw your choice through Analytics preferences without losing shopping or sign-in functionality. Your preference is stored on your device for up to 180 days. Withdrawing stops future application tracking; it does not undo information already received by Google.”

Owner must confirm Google processing terms, international transfers, GA retention settings, sharing settings, legal basis, contact information, deletion/request procedures, and the final effective date. Keep the existing owner-review public policy unchanged until approved.

## Verification and rollback

Test acceptance/rejection/reopening/withdrawal, storage failure/corruption and cross-tab changes, delayed/failed tag load, private navigation, initial/rerender/back/forward/refresh counts, query/identifier sanitization and no duplicated installer. Check scripts/cookies/network before consent and after rejection. Exercise public pages, authentication and shopping without analytics consent. Compare cold-load transferred bytes and main-thread work with consent absent versus accepted; do not assert PageSpeed gains from a stubbed tag.

Build with migrations disabled. An isolated local verification build may use `JORO_NEXT_DIST_DIR=node_modules/.cache/joro-ga4-build`; Next may add its generated types path to tsconfig automatically—restore only that build-generated change after verification. The local browser test intercepts Google requests; it does not validate GA server ingestion.

Emergency disable: unset/set `NEXT_PUBLIC_GA4_ENABLED=false` or `NEXT_PUBLIC_GA4_PRIVACY_APPROVED=false`, rebuild and release only with approval. For a full rollback revert the root-layout mount and remove only the new analytics component/helpers/tests. Do not alter sessions, orders, images or database records. Already received Analytics data requires a separate owner-controlled GA retention/deletion process.


## Detailed policy insertion draft - OWNER REVIEW ONLY, DO NOT PUBLISH YET

**Optional analytics and cookies.** If activated after owner approval, JORO.pk will offer optional Google Analytics website-usage and page-view tracking. The tag is not loaded until you accept analytics on an eligible public page. Rejecting optional analytics does not prevent sign-in, shopping, cart use or checkout. Essential website cookies are separate.

**Information measured.** The implementation sends generalized public-page locations and static page titles. Detail pages are grouped together without sending their raw identifiers or slugs. It discards query values and fragments and does not intentionally send free-text searches, names, emails, phone numbers, delivery addresses, passwords, CNICs, account information or private order/payment details. Once opted in, Google may process browser/device information, online identifiers and connection metadata, including the IP address used to connect. This is not a promise of anonymity. No ecommerce or purchase events are implemented.

**Third-party service.** Google Analytics is provided by Google. See https://policies.google.com/privacy and https://policies.google.com/technologies/partner-sites. Owner must confirm the applicable contracting entity, processing terms, transfer information, data-sharing settings and actual processing locations before publication.

**Your choice.** Choose Accept optional analytics or Reject optional analytics. Reopen Analytics preferences to change your choice. Withdrawal first disables this GA4 property, sends denied analytics consent to an already-loaded tag, and attempts to remove this stream's analytics cookies. It stops new application page-view events; it cannot recall requests already sent or delete data already held by Google. Real Google withdrawal behavior still requires staging verification.

**Retention.** The browser stores the preference for up to 180 days and checks expiry when reading it on load or a cross-tab storage change. With unavailable storage, the choice is held only for the current tab. This preference duration is not the GA reporting-data retention period. The code does not override Google's default analytics-cookie expiration; actual cookie settings and lifetimes must be confirmed in the stream and a real browser. [OWNER TO CONFIRM: GA event/user-data retention setting, whether retention resets on new activity, aggregated-report retention, backup/export retention, and applicable deletion/request procedures.] Do not promise that all data expires after 180 days.

**Owner confirmation required.** [Legal operator name]; [registered/contact address where applicable]; [admin@joro.pk selected by owner; confirm active and monitored before publication]; [applicable legal basis and visitor jurisdictions]; [Google processing/sharing settings]; [rights/request process]; [effective date]. These are review placeholders, not approved public text. No company identity, contact or legal compliance claim has been invented.

## One-release activation checklist (prepared only; no authorization to deploy)

**Atomic release preparation:** the owner now explicitly permits publishing the approved disclosure and activating consent-based analytics in ONE release. This supersedes the earlier publication-before-build sequencing requirement. The owner has now approved publication subject to removal of unverified claims and placeholders. The local public page has been updated accordingly; no draft notices, invented operator identity, address or retention period are included. Approval to commit, push or deploy has not been given. Include the approved policy and analytics implementation in the SAME source commit/build; ensure no stale CDN copy of the policy is served when activating.

After that prerequisite and release approval:

1. Record the live deployed SHA, rollback target and Hostinger's connected repository/branch. Reconcile the candidate with that exact production base. Review a scoped staged diff: analytics files and approved policy work only; no environment files, secrets, migrations or unrelated changes.
2. Confirm the actual GA4 stream has Page views ON, browser-history page changes OFF, and the other six Enhanced Measurement options OFF. These settings are owner-reported, not verified through an account connection. Confirm no duplicate hPanel/GTM installer or additional tag destination.
3. In the EXISTING Hostinger Node.js application's environment-variable settings, make the following values available to its production BUILD, not only to the running process:

   ```text
   NEXT_PUBLIC_GA4_ENABLED=true
   NEXT_PUBLIC_GA4_PRIVACY_APPROVED=true
   JORO_DEPLOY_MIGRATIONS=false
   ```

   Only set the privacy flag after final wording/release approval, with the approved disclosure included in that same release. Preserve every existing credential, URL and storage variable. The ID G-BKBH6NHEY4 is already in source; no API secret or environment-file upload is needed. Leave `JORO_NEXT_DIST_DIR` unset in production unless the existing production setup deliberately uses it. That variable is used locally for isolated builds.
4. Retain the existing compatible Node version, package manager, root/output settings and start command. Build command: `npm run build`. Existing start script: `npm run start` (`next start`). Never select `build:deploy` or add `--migrate`. Confirm migration-disabled logging.
5. Verify whether saving Hostinger settings triggers a deployment in this account before doing so. If necessary use a supported deployment pause/control; do not assume a toggle exists or change the connected branch blindly. Treat a push to the connected branch as a production-deployment action. Make all settings and the reviewed source SHA ready before the one approved trigger.
6. After explicit approval, publish only the scoped reviewed commit to the connected branch and let Hostinger build/deploy it once. Do not also trigger a redundant manual deployment. Record the successful SHA/build ID. A successful build alone is not proof that both public flags reached the build; inspect the deployed consent UI and opted-in behavior.
7. With a fresh browser, verify no GA script/cookies before consent, rejection across reload, privacy links, one tag after acceptance, one sanitized view per eligible navigation, back/forward/refresh, private-route suppression, withdrawal and essential-cookie preservation. Confirm decoded requests and Tag Assistant/DebugView with the actual Google tag. Do not manufacture transactions; there are no purchase events.
8. Smoke-test public SEO/redirects/images, login and cart/checkout without consent. Do not place real orders or change payment records merely to test analytics.
9. If activation fails, set either flag false and rebuild/redeploy the reviewed SHA, or restore the recorded known-good release with an approved Hostinger mechanism. Public flags are bundled at build time; changing runtime variables or restarting an old bundle alone cannot disable already-built tracking. Existing open tabs may retain the old code until reload.

Hostinger account settings, production build environment and live source SHA still require account-side verification. No production values have been changed or certified by this checklist.


## Release record (preparation, not deployment)

- Local base: `2771c160e9d257b04d83bae787567f55e0a9d515` (logo/category optimization).
- Current production SHA / successful Hostinger release ID: **NOT VERIFIED; owner requested to provide from Deployments**. Never use the local base as a claimed production rollback SHA.
- Candidate release SHA: not created; no commit/push/deploy authorized.
- Rollback target: record the actual successful production release before the approved push. Rebuild that exact source with both GA flags false, or restore it through Hostinger with verified disabled build flags. Confirm the UI/tag is off on a fresh load. A git revert/push itself triggers another production deployment and needs approval.
- Final policy wording: `docs/PRIVACY_POLICY_OWNER_REVIEW.md`, extracted from the actual local page. Remove draft notices only after owner approval; no invented operator identity, privacy contact or retention period.


## Scoped candidate manifest

- `app/layout.tsx`
- `app/(legal)/privacy-policy/page.tsx`
- `components/analytics/AnalyticsConsent.tsx`
- `lib/analytics-client.ts`
- `lib/analytics-policy.ts`
- `tests/analytics.test.ts`
- `scripts/test-analytics-browser.mjs`
- `docs/GA4_TRACKING_REVIEW.md`
- `docs/PRIVACY_POLICY_OWNER_REVIEW.md`

Do not stage `.env*`, local build artifacts, unrelated source, or Prisma changes. The policy wording is owner-approved and applied locally; no deployment has occurred.


## Owner contact clarification

The owner selected `admin@joro.pk` as the public privacy contact, conditional on the mailbox being active and monitored. This condition has not been independently verified; no email was sent or mailbox accessed. JORO.pk is the website/brand name, not a verified registered-company identity. Legal operator name and business address remain pending owner confirmation. The public-page candidate now links directly to this email and preserves signed-in support as an alternative. Final disclosure approval and mailbox-operation confirmation remain prerequisites; analytics flags and production settings remain unchanged.


## Latest approval and local application

Owner approved publication with unverified claims and unresolved placeholders removed. The public page now contains the approved customer-facing wording and admin@joro.pk as the privacy contact. Existing Google Sign-In, marketplace, order, sharing, security and support disclosures are preserved; draft/audit-facing notices and unverified bank-transfer/card-storage descriptions were removed. No company registration, operator identity, business address, specific GA retention period or effective date is invented. The public policy retains its existing canonical and robots settings.

Earlier owner-review drafts and prerequisites above are historical preparation notes; this approval supersedes the wording-review hold. Production flags remain unchanged. Mailbox monitoring, actual GA retention/settings, real-tag withdrawal behavior and the current Hostinger production SHA remain operational checks, not claims made by the policy. Do not equate policy approval with a deployment or legal compliance certification.
