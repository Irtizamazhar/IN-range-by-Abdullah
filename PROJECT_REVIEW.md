# JORO.pk project review

Reviewed on 24 September 2026 against the local development app and working tree.

## Scope and checks

- Inspected the application structure, storefront shell, header/footer, authentication entry points, checkout, tracking, FAQ, and selected domain services.
- Browser smoke review at 1440px desktop and 375px mobile: home, products, Wants, stores, Together, cart, checkout, tracking, FAQ, return policy, terms, customer login, seller entry/login, admin login, account, and protected dashboard entry points. Also opened one actual product detail page.
- TypeScript: `tsc --noEmit --incremental false` passed.
- ESLint: no errors; six existing `next/image` optimization warnings.
- All 36 tests passed across the five files in `tests/`. The default `npm test` command includes only four of these files; this review explicitly included `marketplace-domain.test.ts`.
- No horizontal document overflow was detected in the checked storefront views. Customer account content was gated when signed out; admin/vendor dashboard entry points redirected toward login.
- This is a broad review, not exhaustive coverage of every route. Authenticated admin/vendor operations, actual purchases, payments, email delivery, and production deployment/build were not exercised. No production-readiness or full security certification is implied.
- No application code was changed during this review.

## Findings, in priority order

### 1. Mobile WhatsApp button covers the Profile navigation target

**Impact:** Visitors can accidentally open WhatsApp when trying to access their account.

At 375px, the WhatsApp circle overlaps the Profile link by approximately 55 × 46px. Both are fixed at the bottom with the same stacking level, and WhatsApp is rendered later.

Sources: `components/user/WhatsAppButton.tsx:57`, `components/user/MarketplaceNav.tsx:7`, `components/user/UserRouteShell.tsx`.

Suggested correction: position the floating button above the mobile navigation, including the safe-area inset; check the scroll-to-top control at the same time.

### 2. A packed order without vendor splits can show the wrong tracking progress

**Impact:** The tracking page can show only Pending as completed while the order status is `packed`.

`resolveCustomerOrderTrackStatus("packed", [])` returns `packed`. The tracking page's local steps contain `packing` instead, and its local `stepIndex()` falls back to zero for unknown values. The shared `customerTrackStepIndex()` already handles this alias, but the page does not use it.

Sources: `lib/order-track-status.ts:60`, `lib/serialize.ts:125`, `app/(user)/track-order/page.tsx:23`, `app/(user)/track-order/page.tsx:194`.

Suggested correction: consistently normalize `packed`/`packing` for both completed steps and the highlighted current step. Add a regression test for an order without vendor splits.

### 3. FAQ instructions do not match checkout and cancellation behavior

- The FAQ tells customers to select Bank Transfer and upload payment proof, while the current checkout only offers COD.
- The FAQ says cancellation stops at packing, while the cancellation policy includes eligible unpaid `packed` orders.
- The review answer reads like implementation guidance (“allow reviews only after delivery”) rather than instructions for customers.

Sources: `app/(user)/faq/page.tsx:16`, `app/(user)/faq/page.tsx:24`, `app/(user)/faq/page.tsx:32`, `app/(user)/checkout/page.tsx:14`, `lib/customer-account-policy.ts:12`.

Suggested correction: rewrite the help text around the actual customer flows and implemented cancellation conditions.

### 4. Footer Trending Wants link opens the general Wants page

Both Wants and Trending Wants currently use `/wants`, even though `/wants/trending` exists.

Sources: `components/user/Footer.tsx:127`, `app/(user)/wants/trending/page.tsx`.

Suggested correction: point the Trending Wants item to its dedicated page.

### 5. Discount rounding can display “-100%” for a nonzero price

Observed in the local catalog: a product with a positive selling price receives a `-100%` badge because a very large original price makes `Math.round()` round the calculated percentage up to 100.

Sources: `lib/product-discount.ts:6`, `components/user/ProductCard.tsx:95`.

Suggested correction: validate catalog prices and avoid presenting a positive-price item as 100% off. Apply the same rule to the shared calculation and card fallback.

### 6. Page metadata and FAQ accessibility need cleanup

- The login tab title renders `Sign In | JORO.pk | JORO.pk`: the page title includes the brand and the root title template appends it again.
- Reviewed storefront pages reuse the generic site title rather than page-specific titles.
- FAQ toggle buttons lack `aria-expanded` and an explicit association with their answer panels.

Sources: `app/login/page.tsx:5`, `app/layout.tsx:23`, `app/(user)/faq/page.tsx:54`.

## Additional observations

- The local catalog contains visibly provisional product/category names and unrealistic price comparisons; review the actual launch catalog separately.
- Customer/vendor authentication screens still use the English tagline, whereas the storefront header/footer now use Urdu. This is a branding consistency choice, not a functional failure.
- Social profile URLs remain intentionally empty; their buttons are disabled until official URLs are configured in `lib/social-links.ts`.
- The README is still the starter Next.js document and does not explain project-specific database, authentication, or deployment setup.
- ESLint image warnings are in Together detail, Want detail, admin vendor promotions (two), vendor store, and `StoreQr`.

Suggested order of work: mobile navigation overlap, order tracking status normalization, FAQ/link corrections, discount handling, then metadata/accessibility and content polish.
