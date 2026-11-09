# Local homepage performance review — 9 November 2026

No production database writes, deployment, commit or push. All original images and functional content are retained. Analytics consent and GA4 code/settings, authentication, checkout, prices and inventory are unchanged.

## Measurement and limits

The actual live mobile LCP element was `.joro-v4-hero`, displaying `/branding/hero/joro-premium-hero-bg.png`. The initial public browser trace identified this before any edits; the image completed shortly before its render. A later live request returned an infrastructure 403, so repeated live auditing was not reliable and no attempt was made to bypass it. Live timings from this connection are not directly comparable to the owner's PageSpeed run (91 performance, 3.3 s LCP).

Repeatable comparisons used Lighthouse 13.6.0, installed only under ignored `.release-prep/perf-tools`, the same Edge executable, the same localhost production build server and SELECT-only catalog fixtures. Two cold browser runs per form factor per version used Lighthouse's default mobile simulated throttling and fixed desktop settings. No authentication/analytics behavior was disabled by these changes; the fixture environment does not replicate production's complete catalog, hosting/CDN or consent configuration.

| Metric | Before | After |
| --- | --- | --- |
| Mobile performance | 71–74 | 71–76 |
| Mobile simulated LCP | 15.9–16.3 s | 7.5–7.6 s |
| Desktop performance | 85–86 | 98–99 |
| Desktop simulated LCP | 2.56–2.78 s | 1.04–1.14 s |
| Accessibility, both form factors | 94 | 100 |
| Best practices | 96 | 96 |
| SEO | 100 | 100 |

The mobile performance score did not improve consistently; the 2.5 s mobile LCP target is not achieved. These are local lab results, not new live PageSpeed scores. The live server's observed asset transfer differed substantially from the original file served locally, so local savings must not be extrapolated directly to production.

Baseline trace breakdown (mobile run 1, observed rather than simulated): TTFB 44 ms, image load delay 15 ms, image transfer 38 ms, render delay 536 ms. After run 2: TTFB 50 ms, image load delay 45 ms, image transfer 11 ms, render delay 502 ms. Simulated LCP additionally models mobile network/CPU costs; it is not the sum of these unthrottled trace numbers. Rendering delay and shared resources remain work items.

## Changes

- Render the same hero artwork through Next Image, with a shared responsive source, static content hash, high priority and an early shell preload. Remove the duplicate original CSS-image URL. Preserve desktop/mobile crop and gradient overlays. Local mobile background transfer: approximately 1,698 KB to 13 KB; desktop optimized background approximately 54 KB. Original PNG remains untouched.
- Size the foreground hero illustration for its actual mobile/desktop column. The measured mobile variant changed from 750 to 640 pixels (about 65 KB to 53 KB transferred).
- Darken confirmed low-contrast empty-state/review text while retaining the brand palette.
- Use the announcement's visible headline as its accessible name and separate its action description. Give the labelled joiner group a valid role. Keep the existing celebration and keyboard behavior.
- Increase mobile hero CTA minimum height from 42 to 44 pixels. Lighthouse's local target-size audit already passed; the owner's specific live failing targets were not reproduced.
- Animate the announcement texture with translation rather than background-position painting; preserve the artwork and continuous movement.
- Update the preload streaming regression test for responsive image selection and deduplication. Repair the public browser harness's stale legal route-group, footer, announcement and terms-heading expectations, and add its missing Next Link adapter; application routes and legal content are unchanged.

## Findings retained deliberately

| Finding | Evidence / disposition |
| --- | --- |
| Image delivery | Largest local offender was the raw hero background. Fixed its delivery; residual product/category illustration sizing remains catalog-dependent. |
| Legacy JS, about 11 KB | Audit identifies Next's shared compatibility/polyfill chunk (Array.at/flat/flatMap and Object helpers). No browser support downgrade or framework monkey patch. |
| Render blocking / dependency tree | Next-generated global and route stylesheets, plus the local font. No external Google Fonts stylesheet at runtime. Required styles were not asynchronously hidden or removed. |
| Unused CSS, about 40 KB | Shared Tailwind/global and route component styles. A single fixture route cannot establish they are unused across responsive states and other flows; no broad purge/refactor. |
| Unused JS, about 36 KB locally | Shared framework/client code. User's 76 KB live finding was not reproduced exactly. Required navigation, search, session and consent remain. |
| Forced reflow | Trace includes framework/shared chunks and unattributed layout; no proven application hot loop isolated. No speculative layout change. |
| Main thread / long tasks | Script evaluation and style/layout remain; measured main-thread work varies across runs. No arbitrary delay of functional content. |
| Non-composited animation | Fixed continuously repainted texture. SVG stroke-dashoffset drawing, brand gradient shimmer and overlapping character animation remain to preserve the experience. |
| Console | Anonymous vendor-session probe receives the existing `/api/vendor/me` 401. No homepage JavaScript exception found. API authentication semantics remain intact. A live root 403 was infrastructure/network-related, not established as an application exception. |
| Agent/experimental accessibility | Fixed real prohibited ARIA and label/name issues. No elements hidden to game an experimental audit. |

## Verification

268 tests passed; the two focused streaming/preload tests passed. TypeScript, ESLint (existing image warnings), production build with `JORO_DEPLOY_MIGRATIONS=false`, and built-app HTTP 308/200/404/SEO checks passed. Route smoke tests cover homepage, product, category listing/detail, customer login, vendor login and anonymous vendor redirect at 390/1440 widths without overflow or JS exceptions; retired `/admin` stays 404. Admin authorization is covered by the existing unit suite; no authenticated production admin/customer/vendor actions were performed. Mocked vendor onboarding passed at 360/1280 widths. Mobile before/after screenshots were inspected for preservation of composition, source artwork and gradients.

Full Lighthouse JSON, timing probes, screenshots and logs are retained privately under ignored `.release-prep/lighthouse-*`, `local-*-probe.*` and `perf-*`. Re-run public PageSpeed and authenticated operational smoke checks after a separately authorized deployment; production improvements are not yet verified.

## Changed files for review

- `app/globals.css`
- `components/user/HeroSection.tsx`
- `components/user/HeroSection.module.css`
- `components/user/HomeHeroPreload.tsx`
- `lib/hero-image.ts`
- `components/user/AnnouncementBar.tsx`
- `components/user/AnnouncementBar.module.css`
- `components/user/HomeProductCard.tsx`
- `components/user/NewArrivalsSection.tsx`
- `components/user/TrendingWantCard.tsx`
- `tests/home-hero-preload.test.ts`
- `scripts/test-public-pages-browser.mjs`
- `docs/PERFORMANCE_REVIEW_2026-11-09.md`
