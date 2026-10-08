# Wants feed, posting popup, and loading controls

The navbar's Wants link opens `/wants`. Posting buttons open the shared `PostWantProvider` dialog without leaving the current page. The legacy `/wants/new` route still uses the same form.

## Feed behavior

- `/api/wants/feed` uses keyset pagination, ten items per request by default, with a maximum of twenty. Each query reads only its page plus one lookahead record.
- Public feeds require an approved (`OPEN`), unexpired post from an active customer. My Wants uses the authenticated customer ID and includes pending posts.
- All, Nearby, and My Wants tabs and city/category filters are URL-backed. Nearby requires an explicitly selected city.
- The client cancels obsolete filter requests, prevents overlapping requests, deduplicates IDs, and retains existing posts when loading another page fails.
- Detail links save the loaded pages and scroll position. Return restores that snapshot and continues from its cursor. My Wants caches are scoped to the customer account.

## Posting behavior

The native dialog traps focus, locks background scrolling, restores trigger focus, and confirms before discarding changes. Optional details stay mounted when collapsed. The existing schema, upload endpoint, submission API, moderation process, privacy notice, and default 30-day expiry remain in use.

Save locks synchronously and remains busy through upload and submission. Failed requests retain the fields and selected file. A successful upload is reused if only submission needs retrying. Successful submission displays the review confirmation in the dialog; View My Wants opens the private feed.

## Verification

Run from the repository root:

```text
node scripts/test-loading-units.cjs
node scripts/test-loading-controls.cjs
node scripts/test-wants-feed-units.cjs
node scripts/test-wants-feed-browser.cjs
node scripts/test-post-want-modal.cjs
node scripts/test-wants-live-smoke.cjs
node node_modules/next/dist/bin/next build
```

Browser suites use headless Edge by default; `PLAYWRIGHT_BROWSER_PATH` can select another Chromium executable. Fixture suites intercept all API requests and test both successful and failed operations without database mutations. The live smoke test expects the app at `http://127.0.0.1:3000` (`TEST_BASE_URL` overrides it), uses a signed-out browser, and performs only read operations. Screenshot artifacts are written under the ignored `coverage` directory.

When another development server is running, set `JORO_NEXT_DIST_DIR=build/verification` for both `next build` and `next start`, and start the preview on a separate port. This keeps verification artifacts out of the development server's `.next` directory. Default builds and development still use `.next`.

Shared `LoadingButton`, `LoadingForm`, and `LoadingLink` controls preserve dimensions, announce loading accessibly, prevent duplicate requests, and track each action independently. Navigation waits for both the Next transition and destination page loading. Instant UI controls keep ordinary buttons.
