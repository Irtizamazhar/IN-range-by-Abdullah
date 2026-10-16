# JORO marketplace UX implementation report

Date: 16 October 2026. Workspace: `C:\Users\hamid\Pictures\IN-range-by-Abdullah`.

## Focus bug: cause and correction

The onboarding form's effect depended on the entire `errors` object and called `focus()` on its first key. Every keystroke called `change()`, which created a new errors object and retained cleared keys with empty messages. Consequently, typing in a later control repeatedly focused the earliest touched field, even before a failed submission. This was an effect-driven focus change, not a component remount or unstable React key.

The effect now consumes a pending focus target only when explicit client/server validation reports errors. Ordinary edits clear field feedback without requesting focus. The first invalid input still receives focus following an attempted save. Existing keys, controlled values, submission locks, timeouts, validation, draft persistence and final submission behaviour are preserved.

The onboarding browser regression exercises continuous typing before and after validation, checks that the same DOM node remains focused, inserts text in the middle of a value, checks Tab order, and covers Business details, identity/CNIC, pickup, a separate return address, bank details and Review editing. Save Progress, Save & Continue, refresh persistence and failure handling remain covered at 360px and 1280px.

## Authentication spacing and phone input

Only authentication components/scoped styles changed: 8px label separation, 16px field spacing, comfortable Remember/Forgot layout, 44px Forgot/Google targets, clearer submit/OR/social separation and readable terms spacing. Existing colours, layout, branding, validation thresholds and Google OAuth handlers remain in place. Both customer/vendor sign-in and sign-up are covered; the legacy customer modal also reuses the mobile control.

`PakistanMobileInput` displays a non-editable +92 prefix and an editable national number such as `300-1234567`, capped at ten digits. It supports local/international paste, deleting around the dash, middle edits, numeric keyboards and digit-based caret restoration. Existing `03XX-XXXXXXX`, +92 and 0092 values are recognised without repeating the country code. Mobile validation still requires ten digits beginning with 3; the existing server normalizer remains authoritative. Friendly mobile error copy now matches the displayed format.

The component emits the existing local `03XX-XXXXXXX` state/API format, so no storage contract changes were needed. It is used by customer/vendor signup and all three onboarding mobile contacts: primary, pickup and return. Generic profile/address/checkout telephone inputs were not given mobile-only restrictions.

## City selectors

`PakistanCitySelect` is a reusable searchable combobox with keyboard navigation, active-descendant semantics, Escape/Tab handling, mobile touch selection and a clear no-match message. Custom and previously saved names remain valid strings. It supports controlled forms and default values in native FormData forms.

The list contains 571 city/town suggestions: [GeoNames cities1000](https://download.geonames.org/export/dump/) populated places with country code PK, existing application names and regional towns. Equivalent spellings are deduplicated, including a small explicit alias map. Attribution, CC BY 4.0 licensing, source limitations and refresh instructions are in `data/PAKISTAN-CITIES.md`. This is a broad suggestion list, not an exhaustive address registry. No runtime service or API key is required.

Applied to Want creation/editing, Want feed filtering, vendor business/pickup/return cities, checkout delivery/billing cities, account addresses and service search. Existing province suggestions remain available. Street addresses and service-specific coverage lists retain their existing controls and rules.

## Homepage changes

- Hero and mobile navigation Want CTAs now say **Request a Want**. The PostWantButton and its workflow are unchanged; the existing live smoke test expects the new wording.
- The actual homepage Join Request CTA is inside TrendingWantCard's link. It now has a rounded, lightly bordered surface, an arrow, comfortable padding, a 44px target and subtle hover/pressed feedback. It still navigates to the same Want; no nested button or new join/auth behaviour was introduced.
- Top Sellers alone now uses a light neutral background, white bordered cards, subtle shadows, improved spacing and brand-colour accents. Seller names, initials, ratings, order, data and destinations are unchanged. Ranking/query code was not edited.

## Saved Items audit and implementation

Existing infrastructure was reused:

- SavedProduct has a composite primary key `(customerId, productId)` and an index on productId.
- GET/POST `/api/customer/saved-products` and DELETE `/api/customer/saved-products/{productId}` resolve the authenticated customer server-side. Duplicate inserts use skipDuplicates; deletes include customerId.
- Homepage/listing hearts already use a shared React Query hook. The account already displays saved products, prices, unavailable states and empty states through ProductCard.

The missing product-details heart now uses the same hook. Shared state is published only after the API explicitly confirms success. Failed/malformed saves leave the previous state intact; success merges the latest cache so another product's update is retained. Existing per-action and cross-instance request locks prevent duplicate requests. Hearts stay disabled while the initial session/state loads. Invalid saved-ID responses cannot crash cards.

Account navigation and overview now consistently say **Saved Items**, and the profile dialog has a direct shortcut. The existing `/account/saved` alias remains. The empty state includes a browse link. Existing product cards already show unavailable products and retain the remove heart; this was preserved. Heart targets are at least 44px, including narrow product cards. Global navigation was not expanded.

Anonymous clicks still use the existing login flow with a return URL; they do not pretend to save or carry a new auto-save instruction through login. Refresh/later login re-fetch persistent server state. Cache keys include customerId, and the hook hides saved state immediately after logout or account changes.

Want LOVE icons are reactions, and store hearts are follows. Neither is an existing Want bookmark. They were not reinterpreted as product favourites, and no new Want bookmark feature or schema was added.

**No database migration is required for this work.** Prisma schema, existing API routes, authentication and customer/product records are unchanged.

## Verification and limits

- `npm run test:marketplace:ux`: 33 tests passed, including actual saved-product route code with isolated database/auth substitutes, owner isolation, idempotency, mobile formatting, city coverage, account policy and Want regressions.
- `npm run test:vendor-order`: 61 existing focused onboarding/order/phone/CNIC/auth/private-launch tests passed.
- `npm run test:vendor:browser`: passed at 360px and 1280px; actual onboarding form, controls and schema with mocked HTTP persistence. Focus, caret, Tab, all editable steps, Review editing, save locks, errors and reload persistence are covered.
- `npm run test:marketplace:browser`: passed at 360px and 1280px, with native touch enabled at 360px. Covers all four auth role/mode combinations, label/field/action spacing, Google action wiring, fixed phone paste/edit/caret/limit, city keyboard/touch/custom selection, real Want form submission, homepage Want/Join destinations, neutral Top Sellers, save/unsave failures, duplicate requests, shared card/detail state, refresh/session changes and the Saved Items unavailable/remove/empty states.
- TypeScript and focused lint passed. Production build passed, retaining existing Browserslist, jose/Edge and unrelated image warnings. `git diff --check` passed.
- Browser fixtures use the real UI and React Query but adapt navigation, session and branding wrappers and mock HTTP/database persistence. They make no real OAuth requests, send no mail and make no production writes.
- A read-only check still reports that the configured database does not exist. Therefore real database persistence and real logout/login integration could not be verified in this workspace. Restore/provision the intended database or have the operator correct its configuration before live verification. Environment files were left untouched.

No new environment variables, runtime dependencies, schema changes or migrations are introduced. Deploy through the normal reviewed build/release process and retain existing database configuration/tables. No commit, staging, push, deployment or migration execution was performed.

`app/globals.css`, Tailwind/global palette, logo/favicon assets, Google OAuth implementation, backend Want/payment/order/ranking logic, `.env`, `.env.local`, `er.email`, credentials and package-lock.json were not modified. The initial working tree was clean.

## Exact changed/new files

Modified:

- app/(user)/account/page.tsx
- app/(user)/checkout/page.tsx
- app/(user)/products/[id]/ProductDetailClient.tsx
- app/(user)/services/page.tsx
- app/(user)/wants/WantsFeed.tsx
- components/auth/AuthLayout.module.css
- components/auth/LoginExperience.tsx
- components/user/AccountNavigation.tsx
- components/user/AuthModal.tsx
- components/user/CustomerProfileModal.tsx
- components/user/HeroSection.tsx
- components/user/HomeMarketplace.tsx
- components/user/HomeProductCard.tsx
- components/user/Navbar.tsx
- components/user/ProductCard.module.css
- components/user/ProductCard.tsx
- components/user/TrendingWantCard.tsx
- components/user/WantForm.tsx
- components/vendor/VendorOnboardingForm.tsx
- lib/pakistan-phone.ts
- lib/pakistani-cities.ts
- lib/use-saved-products.ts
- package.json
- scripts/test-vendor-onboarding-browser.mjs
- scripts/test-wants-live-smoke.cjs

New:

- components/ui/PakistanCitySelect.tsx
- components/ui/PakistanMobileInput.tsx
- components/user/SaveProductButton.tsx
- data/PAKISTAN-CITIES.md
- data/pakistan-cities.json
- lib/pakistan-mobile-input.ts
- scripts/import-pakistan-cities.mjs
- scripts/test-marketplace-ux-browser.mjs
- tests/marketplace-ux.test.ts
- tests/saved-products-api.test.ts
- docs/marketplace-ux-improvements.md
