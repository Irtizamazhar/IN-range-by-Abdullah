# Homepage categories and Live Chat — final local review

13 November 2026, Asia/Karachi. Continued the interrupted work without resetting or discarding the category fixes or earlier successful checks. No commit, push, deployment, production environment change or production database operation was performed.

## Completed

**Categories:** removed the five-item CSS restriction and 20% item widths. Wide desktops use an evenly spaced grid of up to ten categories; fewer categories remain compact and centred. At 1024–1439px and on mobile, the row scrolls horizontally instead of squeezing labels. Circular images, two-line names, fallbacks, JORO colours, subtle desktop animation and reduced-motion support remain. Images use contain sizing to avoid cropping. View All Categories remains unchanged.

The read-only query prioritizes active `showOnHome` categories in configured order, then supplements with other active categories containing publicly eligible products. It returns at most ten distinct records and does not change admin settings. The same public-product predicate protects the category landing pages.

**Chat:** removed the `WhatsAppFloat` import and rendering from the public shell. Other WhatsApp contact buttons/links and contact configuration are untouched. Live Chat is now the only floating chat launcher when enabled. Its 48px button uses the old WhatsApp offsets: right 12px, bottom `76px + safe-area` on mobile, bottom 24px at desktop/tablet widths of at least 768px. Cart, checkout and standalone tracking exclusions remain.

The existing panel now has an emerald/white header, Chat with JORO branding, separate accessible minimize/close controls, lightweight CSS opening animation, visitor/support bubbles, timestamps, welcome/empty/loading/error states and reconnect action. It keeps the real API, secure cookie ownership, existing message records and admin inbox. No duplicate chat backend or fabricated agent availability was added.

Enter sends; Shift+Enter creates a new line; IME composition is respected. Send disables for empty/pending messages. A synchronous in-flight guard stops rapid duplicate submissions; existing idempotency keys are retained for retries. Failed drafts remain available. Messages follow the latest reply when already at the bottom, but incoming replies do not pull a customer away from older history. Close/minimize preserve the conversation.

VisualViewport resize/scroll measurements fit the panel above an on-screen keyboard, keep its composer reachable and restore normal positioning afterwards. Guest form/history scroll inside the panel. Existing analytics-consent coordination remains: opening chat suppresses the consent panel without granting consent, and reopening preferences closes chat. Closed-launcher positioning leaves room beside the compact consent notice and above mobile navigation.

## Root causes and verified data

- The prior CSS hid item six onward and distributed five items across the whole row. The earlier query required `showOnHome`, preventing an eligible fallback selection.
- The local `.env` does not enable `JORO_LIVE_CHAT`. The renderer and API intentionally default off. Positioning was not the reason for the missing local icon. Production flag value, schema and deployed revision have not been inspected in this task.
- A read-only inspection of the explicitly checked loopback `joro_local` database found **0 active categories and 0 publicly eligible categories**. No data was seeded into that database. Production category counts remain unknown.
- Populated fixtures verify ten eligible category links; the default fixture verifies preferred-category ordering plus an eligible fallback. Fixture names/images in screenshots are test data, not production catalog claims. No live category, product, price or inventory record was edited.

## Verification results

| Check | Actual result |
| --- | --- |
| `npm test` | **315/315 passed**, no skips |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed; existing image warnings remain |
| `JORO_DEPLOY_MIGRATIONS=false` standard production build | **Passed without the temporary font helper** |
| `npm run test:incremental:db` | **9 groups passed**: real disposable-database guest/customer/admin messaging, privacy, persistence, unread markers, newsletter and guest/registered checkout |
| `node scripts/test-category-row-browser.mjs` | Passed 390/768/1024/1440/1920px: ten rendered entries; all ten visible in a single grid row at 1440/1920; scrollable smaller rows; compact four-item case; fallbacks and reduced motion |
| `node scripts/test-smart-search-browser.mjs` | Passed **320/375/390/430/768/1440px**: one 48px launcher at the former WhatsApp offsets, no floating WhatsApp, panel bounds, minimize/close/refresh, unread badge, Enter/Shift+Enter, duplicate guard, retry key reuse, errors/reconnect and simulated keyboard resize; no unhandled JS errors or page overflow. Search regression checks retained. Long history additionally checks scroll preservation for incoming replies and return to latest on own send. |
| Actual built homepage with write-blocking fixtures | Passed **320/375/390/430/1024/1440px**, ten unique category links returning HTTP 200, correct row layout, image-error fallback, one launcher, no floating WhatsApp and working panel controls |
| Built homepage with flag off | Passed: Live Chat hidden and floating WhatsApp absent |
| `node scripts/test-catalog-slug-http.mjs` | Passed redirects, public 200/404 routes, canonicals, sitemap, robots and existing structured-data checks; zero attempted DB writes |
| `node scripts/db-migrations.mjs check` | 15 migrations match the unchanged schema/manifest |
| `git diff --check` / staging review | Passed; nothing staged |

Database tests created and removed only a new disposable loopback database. Existing application databases were not migrated or reset. Mail, payment/refund transfers and external integrations were intercepted. Keyboard tests simulate VisualViewport changes; physical iOS/Android keyboards and production load remain unverified.

### Build interruptions, accurately distinguished

Before the interruption, Google Fonts requests timed out in Node. A build using an ignored, local-only curl font transport passed, followed by a **standard build without that helper**. During continuation, parallel DB tests briefly locked Prisma's Windows DLL; the standard build was rerun after those tests released it and passed. The final build used the ordinary build script, unchanged fonts and validation, with migrations explicitly disabled. Temporary transport/screenshot helpers remain in ignored `.release-prep` files and are not release changes.

## Screenshots and comparison

- [Before mobile homepage](../.release-prep/incremental-category-chat-before-390.png) / [final mobile homepage](../.release-prep/incremental-premium-chat-after-390.png)
- [Before desktop homepage](../.release-prep/incremental-category-chat-before-1440.png) / [final desktop homepage](../.release-prep/incremental-premium-chat-after-1440.png)
- [Ten-category desktop row](../.release-prep/category-chat-row-1440.png)
- [320px welcome panel](../.release-prep/premium-chat-built-open-320.png) / [375px](../.release-prep/premium-chat-built-open-375.png) / [390px](../.release-prep/premium-chat-built-open-390.png) / [430px](../.release-prep/premium-chat-built-open-430.png)
- [Desktop panel](../.release-prep/premium-chat-built-open-1440.png)
- [Mobile message bubbles](../.release-prep/premium-chat-built-messages-390.png) / [desktop messages](../.release-prep/premium-chat-built-messages-1440.png), using explicitly labelled visual fixtures. Real guest/admin delivery was tested separately against disposable MySQL.
- [Simulated keyboard at 320px](../.release-prep/premium-chat-keyboard-320.png)

The same original headings/order and exact hero bounds were verified at 360/390/430/768/1440px. Visual review confirms the preserved header/hero and the intentionally changed category row/launcher/panel. More categories can change the category section's height and move later content slightly. No unrelated section was restyled. These screenshots are ignored local review artifacts, not release assets or live-catalog evidence. No Lighthouse improvement is claimed.

## Exact changed files

Includes the preserved category changes from before interruption:

1. `components/user/CategoryAutoScroll.module.css`
2. `components/user/CategoryAutoScroll.tsx`
3. `components/user/LiveChat.tsx`
4. `components/user/LiveChat.module.css` — new
5. `components/user/UserRouteShell.tsx`
6. `lib/seo-data.ts`
7. `scripts/fixtures/seo-prisma.cjs`
8. `scripts/test-category-row-browser.mjs`
9. `scripts/test-smart-search-browser.mjs`
10. `tests/home-category-navigation.test.ts`
11. `docs/CATEGORY_CHAT_FIX_REVIEW.md` — new

No schema, migration, API/authentication, checkout/order, product, price, promotion, SEO settings, analytics-controller, environment or secret file was changed. WhatsApp contact components remain available elsewhere; only their floating public-shell instance was removed.

## Remaining deployment blockers and manual Hostinger setting

**Local changes are ready for review. Production remains NO-GO pending verification.** This work does not introduce a new migration, but the existing chat schema dependency must be verified in the actual production database before enabling the feature. Production migration history, required chat tables, backup/rollback readiness, current deployed artifact and runtime environment remain unverified here.

After those checks and separate deployment approval:

1. Verify the existing `20261111000000_incremental_marketplace_features` migration is successfully applied, required chat tables are present, and the compatible application release is deployed. Use the established guarded workflow; do not bypass its clean-commit, identity or backup checks. Do not blindly apply other pending migrations.
2. In Hostinger's application environment settings, set the key/value exactly:

   ```text
   JORO_LIVE_CHAT=true
   ```

3. Save/apply the environment and restart/redeploy the Node application through Hostinger's supported controls so the running process receives it. This is a runtime server flag; a source rebuild is not inherently required, but Hostinger may apply environment changes through a redeployment. The current hPanel controls and artifact are not verified here. No Git push is needed merely to explain or prepare this setting, and none was performed.
4. Verify one launcher, no floating WhatsApp, real guest/customer/admin messages, privacy and existing shopping flows. Leave the feature off if its dependencies are unverified or unavailable. Other newsletter/promotion/guest-checkout flags are unchanged.

No production setting was enabled. No production migration or backfill was executed. Do not infer live readiness from fixture screenshots or local tests.
