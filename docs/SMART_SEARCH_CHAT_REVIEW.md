# Compact chat and smart search — local release review

12 November 2026, Asia/Karachi. **NO-GO for production; local implementation and regression checks passed.** No production connection, database modification, commit, push or deployment was performed. Existing environment files, secrets and uncommitted marketplace work were preserved.

## Repository state and scope

`git fetch origin` succeeded. Branch `main`, local HEAD and fetched `origin/main` all resolve to `3ab7640`; ahead/behind is 0/0. The previous incremental upgrade is uncommitted. No fast-forward, reset, discard, stash, merge or staging was needed or performed.

This follow-up changes only chat/search integration, related security checks, tests and documentation. Existing homepage sections, logo, header geometry, hero, categories, promotions, product cards and footer layout remain. Existing voice search and the complete search results page/filter flow remain available. Product results on the complete search page now also enforce the shared public-product visibility predicate; previously its regular-product query checked only `isActive` and could include an unapproved seller publication.

## Implemented

- Closed chat is a 48px dark-green circular icon with lime symbol, border/shadow, keyboard focus and reduced-motion-aware hover. It does not automatically open. Existing backend, authorization cookies, records and admin inbox are reused.
- Guest/customer messages, genuine admin replies, offline persistence and refresh recovery remain. A real unread-reply count excludes private notes; the badge clears after successful read acknowledgement. Read acknowledgements use the server response timestamp, cannot move backwards and no longer consume the message-send quota. Open polling remains 15 seconds while visible. Minimized existing conversations poll every 60 seconds while visible; guests without a conversation make one authorization check and do not keep polling when minimized.
- Safe-area offsets separate the icon from mobile navigation/WhatsApp. Chat is hidden on `/cart` and `/checkout` to protect purchase controls. Analytics preferences continue to close chat, and an open chat suppresses the consent panel without changing consent.
- Empty search focus immediately requests real suggested products/categories. No invented popularity, recent search history, ratings or AI output is supplied. Typed input debounces 250ms, aborts obsolete fetches and ignores aborted responses. Empty-query results are cached in the mounted component for 60 seconds; query results are not retained as search history.
- Suggestions display product thumbnail, genuine price, valid higher original price, category and canonical product slug URL; categories link to their canonical category route. Six products plus three categories maximum; the server selects bounded catalog fields rather than images/blobs or private seller data. Two Prisma reads per request.
- NFKC, whitespace/control-character normalization, partial name/category/description matching and existing case-insensitive database collation support useful keyword matching. No fuzzy spell-correction or fabricated synonym guesses are claimed.
- Existing bar styling stays; the dropdown is attached below it, scrollable and viewport-bounded. Arrow keys, Enter, Escape, outside-click, focus dismissal, clear, loading, errors, no matches, full results and default Browse all products are supported. Voice recognition and its result links were regression tested. Optional browser-storage failures no longer break voice initialization/language selection.

## API, schema and configuration

The existing `GET /api/search/suggestions?q=` endpoint now supports an empty query and returns bounded product/category DTOs including optional `image`, `price`, `originalPrice`. Input over 100 characters returns 400. The existing memory limiter allows 100 requests/minute/IP per Node process, returning 429 with `Retry-After`. Keys are hashed. Responses are no-store/noindex. Failures return a generic 503 without logging the raw query, SQL, database URL or driver exception. Prisma builds parameterized queries, and UI text is escaped by React.

**Rate-limit qualification:** this is process-local protection, matching the existing repository limiter. Verify Hostinger's trusted proxy overwrites address headers and configure an edge/shared limit for aggregate protection across workers. This has not been verified in production.

Existing `GET /api/live-chat` adds `unreadCount` and `readThrough`. Existing POST read acknowledgement accepts `through`, after the same-origin and conversation ownership checks, with a separate database-backed 60/minute access-owner limit. No duplicate messaging system, new endpoint, model, migration, dependency or required environment variable was introduced by this follow-up.

The prior upgrade's seven models and `20261111000000_incremental_marketplace_features` migration remain pending local work. Chat still requires its schema and `JORO_LIVE_CHAT=true`; its default-off gate was preserved. Search requires the already-existing persistent slug schema, as the current application already did. Neither flag nor credentials were enabled/changed in environment files.

## Actual validation

| Check | Result |
| --- | --- |
| `npm test` | **314/314 passed**, no skips |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed; existing image warnings remain |
| `JORO_DEPLOY_MIGRATIONS=false; npm run build` | Passed locally, no migration execution |
| `npm run test:incremental:db` | **9 groups passed**, including real Prisma search queries, seller approval exclusion, case/partial matching, canonical links, chat privacy/unread markers, newsletter and guest/registered checkout |
| `npm run test:checkout:db` | **11 groups passed**, including seller inventory policy, services, settlement, returns/refunds, saved addresses and browser UI |
| `node scripts/test-smart-search-browser.mjs` | Passed at **360, 390, 430, 768, 1440px**: default/typed suggestions, genuine fixture price/image, product/category selection, keyboard, Enter, clear, default browse action, debounce, stale response, network error, no results, outside click, voice, 48px icon, unread badge, refresh and minimize; no JS exceptions/overflow |
| Built-header read-only fixture checks | Suggestions successfully opened inside the actual header at all five widths, without overflow |
| `node scripts/test-catalog-slug-http.mjs` | Passed redirects 308, pages 200/404, canonicals, sitemap, robots and existing policy structured data; zero attempted DB writes |
| `node scripts/test-category-row-browser.mjs` | Passed at 390, 768, 1024, 1440, 1920px |
| `node scripts/test-vendor-onboarding-browser.mjs` | Passed at 360px/1280px, mocked onboarding APIs |
| Separate GA4-enabled build + `node scripts/test-analytics-browser.mjs` | Passed 390px/1440px: reject/accept/withdraw, cross-tab withdrawal, route exclusions, sanitization, one tag, storage/network failures; Google intercepted, no actual ingestion |
| `node scripts/db-migrations.mjs check` | 15 migrations match schema and manifest; disposable DB tests also replay all migrations and check drift |
| `git diff --check` / staged-file review | Passed; no staged files |

All database writes in tests were confined to newly created, prefix-checked disposable loopback databases, then removed. No real email, payment, refund transfer, courier call or production order was made. Local broad regression checks do not prove every real customer/admin/vendor flow or external integration works in production.

## Screenshots and visual comparison

Before screenshots were captured from the prior local build before editing. After captures use the same GA4-enabled test configuration, chat enabled and read-only catalog fixtures. At all five widths, the hero bounds are exactly unchanged, original headings remain in order and there is no horizontal page overflow. Visual header/hero comparisons confirm preservation; the intentional closed-widget shape is the visible difference. No Lighthouse improvement is claimed.

| Width | Before | After | Actual header suggestions |
| --- | --- | --- | --- |
| 360 | [Before](../.release-prep/incremental-smart-before-360.png) | [After](../.release-prep/incremental-smart-after-360.png) | [Dropdown](../.release-prep/incremental-smart-header-360.png) |
| 390 | [Before](../.release-prep/incremental-smart-before-390.png) | [After](../.release-prep/incremental-smart-after-390.png) | [Dropdown](../.release-prep/incremental-smart-header-390.png) |
| 430 | [Before](../.release-prep/incremental-smart-before-430.png) | [After](../.release-prep/incremental-smart-after-430.png) | [Dropdown](../.release-prep/incremental-smart-header-430.png) |
| 768 | [Before](../.release-prep/incremental-smart-before-768.png) | [After](../.release-prep/incremental-smart-after-768.png) | [Dropdown](../.release-prep/incremental-smart-header-768.png) |
| 1440 | [Before](../.release-prep/incremental-smart-before-1440.png) | [After](../.release-prep/incremental-smart-after-1440.png) | [Dropdown](../.release-prep/incremental-smart-header-1440.png) |

These screenshots/logs are ignored local artifacts, not release assets. Products in them are explicitly test fixtures, not live catalog evidence.

## Exact files changed by this follow-up

1. `components/SearchBar.tsx`
2. `components/user/LiveChat.tsx`
3. `components/user/UserRouteShell.tsx`
4. `lib/search-suggestions.ts` — new
5. `lib/public-search.ts`
6. `app/api/search/suggestions/route.ts`
7. `app/api/live-chat/route.ts`
8. `tests/incremental-features.test.ts`
9. `scripts/test-incremental-features-db.ts`
10. `scripts/test-smart-search-browser.mjs` — new
11. `docs/SMART_SEARCH_CHAT_REVIEW.md` — new
12. `docs/INCREMENTAL_MARKETPLACE_UPGRADE.md` — follow-up report link

Other working-tree files belong to the preserved prior upgrade; see its [inventory](INCREMENTAL_MARKETPLACE_CHANGED_FILES.md). Temporary screenshot harnesses and logs are ignored. Separate verification builds' generated tsconfig edits were restored to their pre-build contents.

## Deployment audit and remaining blockers

**NO-GO for production.** Local code is prepared for review; no production-readiness claim is made.

- No new hosting service is needed: ordinary Next.js route handlers, Prisma/MySQL reads and polling remain compatible with the existing Node-hosted design. Existing `next.config.mjs` worker limits and image allowlist were retained. No WebSockets, new cron dependency or browser-only server import was added.
- Existing migration opt-in workflow remains: build defaults to no migrations, and guarded migration/preflight remains mandatory. The prior uncommitted schema migration still requires approved production identity/history checks, recent restorable backup, restored-staging rehearsal and schema-first deployment. Do not push main into Hostinger auto-deploy before those gates.
- Actual Hostinger environment values, proxy headers, worker count, active artifact/rollback and live search/chat deployment are **unverified**. No new environment variable is required for this follow-up, but a successful local build does not verify production secrets, authentication/OAuth configuration or database readiness.
- Prior newsletter SMTP/privacy/retention and guest-checkout rollout gates remain. No real production checkout/payment/refund/GA4 ingestion or mailbox delivery was tested. Keep the new feature flags off until separately approved.
- The IndexNow key file, SEO settings, sitemap generators, login/payment/order business rules and production profiles were not edited. The staged area is empty. Production profile and secret files were never staged or printed.

Next action: review this report and the exact diffs locally. Resolve the existing migration/backup/Hostinger gates before separately approving any commit, push, production schema change or deployment.
