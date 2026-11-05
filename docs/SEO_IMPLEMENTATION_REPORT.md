# JORO.PK SEO implementation report

Reviewed 4–5 November 2026. Local baseline: `478a48017f5986c96959cd35b703c85812a45c1a`; working tree was initially clean. Changes remain uncommitted. No production deployment, database connection/write, migration, DNS/SSL change, private environment edit, image deletion or payment/order logic change was performed.

## Decision

### Authorized Git synchronization — 5 November 2026

After the original report, the owner explicitly requested pulling main and committing/pushing all reviewed source changes. GitHub main was fetched and local main fast-forwarded from `478a480` to `ca99eb1` (seven upstream commits). All local SEO work was retained in the safety stash `safety-seo-before-main-sync-2026-11-05` and reapplied. One storefront import conflict was resolved while preserving upstream storefront/banner and profile/hero changes. The new upstream `20261103000000_vendor_social_links` migration is existing main history; it was not created or run by this SEO release.

Merged-source regression rerun: 226/226 main tests, 83/83 vendor/onboarding/profile/order tests, and 11/11 SEO/admin security tests passed. Merged production build, Prisma Client generation, lint/type validation, scoped TypeScript checking and all 49 isolated production HTTP/browser checks passed before the authorized push; fixture database writes were zero. The Windows engine lock was released by temporarily stopping the verified local dev worker, and the local development launcher was restarted afterward. Initial sandbox/network/font-fetch failures were diagnosed; a temporary dependency diagnostic was automatically restored and is not part of the commit. No private environment files are included; no manual deployment, restart or migration is authorized by this Git-only operation. No repository GitHub Actions deployment workflow was found; external Hostinger automatic deployment settings cannot be verified from local Git. A configured Git webhook may deploy a push, so the production prerequisites below still apply.

Local SEO implementation is complete, with the validation limits below. **Production release remains HOLD pending owner approval, production schema/environment confirmation and a staging smoke test.** This report does not certify live indexing, Google rich-result eligibility, Core Web Vitals or a fully green end-to-end regression suite.

## Confirmed findings and fixes

### Critical discovery and indexing

- Public GET checks at `2026-11-04T18:51:02Z` found `/sitemap.xml` and `/robots.txt` returning 404. Both HTTPS hostnames returned 200; HTTP apex redirected to HTTPS apex and HTTP www to HTTPS www. HTTPS www did not consolidate to apex. HTTPS fetches succeeded for both names; this is not a full SSL configuration audit. Root path only was tested.
- The live homepage had the generic title `JORO.pk | Pakistan Marketplace`, with no canonical, meta robots or X-Robots-Tag found by the checker. The user's Search Console verification/index-request history is user-reported; it was not independently inspected.
- Implemented canonical host `https://joro.pk`, page metadata, public robots and a sitemap index. Child files contain up to 5,000 URLs each and use actual database identifiers and update timestamps. Static pages have no fabricated modification dates. Queries select only necessary columns and are bounded; count/page results cache for 60 seconds. Invalid child filenames return 404; unavailable database/maintenance returns 503 with no-store/Retry-After instead of a successful partial sitemap.
- Eligibility: active products with no vendor publication, or active vendor publication with an approved vendor; active/approved Services from approved vendors; approved stores; active categories with eligible products; OPEN, unexpired Wants belonging to active customers. No private offers, customer identities, hidden admin route or draft/pending records enter XML.
- Private/account/auth/cart/checkout and filtered/search URLs receive noindex. HTML remains crawlable so crawlers can observe noindex; robots blocks APIs with exceptions for public image delivery. Authentication still protects private content. Public pagination has self-canonicals; query filters are not in sitemaps.
- Maintenance gating remains functional and now marks the maintenance homepage noindex. Public XML handlers cannot bypass the gate. No application-level www redirect was added before hosting configuration review.

### Metadata, content and structured data

- Homepage title: `JORO.PK | Online Shopping, Services & Wants in Pakistan`. Unique route metadata and sharing data cover public listings, details, real categories, Services, stores, Wants, About, FAQ and return policy. Existing visible designs and meaningful headings remain in place.
- Products publish factual Product/Offer JSON-LD: actual PKR price, stock-based availability, real images and actual seller when available. No ratings, review totals, brand, policy, delivery promises or SKU are invented. Product/Service/store/Want/category details receive real breadcrumbs; Services use Service and provider data; stores and homepage use Organization; homepage also uses WebSite. JSON-LD is escaped against script injection.
- Wants now server-provide public title/summary and public metadata. Private requests remain owner-only and receive generic noindex metadata, without private titles in public HTML. Legacy new-arrival detail URLs remain functional and canonicalize to the corresponding eligible product.
- Privacy and terms are existing owner-review drafts with noindex; they remain excluded from sitemaps. `/sell` is an authenticated redirect, not an indexable content page. MyHome/Deals are existing placeholders and receive noindex. No fictional city landing pages, testimonials, contacts or legal policies were created.
- Public GET rendering no longer creates a default settings row or backfills a store slug. Existing settings write operations are retained for their original authorized workflows. Canonical store aliases use permanent redirects without changing records.

### Crawlable products and performance

- Product listing now includes the first 18 real eligible products, counts and filters in initial server HTML. Existing filters, sorting, infinite loading, cart and wishlist remain. Visible Previous/Next anchors support crawling; default sorting is omitted from unfiltered pagination URLs. New category URLs use actual active category slugs and existing product cards; category links use those slugs when known.
- Existing Next Image, explicit sizing, hero priority and swap font are retained. No unrelated visual redesign or dependency upgrade was made. The build reports shared initial JS about 88.2 kB and homepage initial JS about 196 kB; these are bundle figures, not field CWV or a before/after performance claim.

## Validation actually executed

| Check | Result | Scope/limitations |
|---|---|---|
| Existing `npm test` | PASS, 226/226 | Includes checkout/order/payment calculation, migration safety, private launch, catalog and upload-origin regressions; fixture/unit coverage, not live purchases |
| SEO tests | PASS, 6/6 | Canonicals, robots/filter policy, JSON-LD escaping and factual offers, bounded sitemap queries, splitting and database-failure handling |
| Services image regressions | PASS, 4/4 | Image hierarchy, actual cards/detail rendering, authentication/ownership, safe uploads; existing test JSX config used |
| Admin path/security tests | PASS, 5/5 | Existing auth gate, retired admin URL rejection and hidden path handling; new public route names reserved against collisions |
| Production HTTP/browser fixtures | PASS, 49 checks | Isolated optimized Next build; all 35 sitemap fixture targets HTTP 200/canonical; XML parse; pagination; public/private eligibility; Product/Offer; noindex; maintenance; 390px/1440px hydration and overflow; zero attempted DB writes |
| Seller onboarding browser suite | PASS | Existing local fixtures at 360px/1280px: form validation, upload, edit/resume, payout and submit states; no real vendor account created |
| Marketplace UX browser suite | FAIL | Stops at unchanged Top Sellers background assertion, script line 157: expected gray `rgb(250,250,250)`, actual transparent base over gradient. HEAD component already has gradient classes; component/styles/test unchanged. Earlier login/control/Want steps ran, later steps were not reached. Unrelated styling/tests were not altered to hide this failure |
| TypeScript current source + fresh build route types | PASS | `node scripts/check-seo-types.mjs` |
| Plain default tsc | FAIL, existing stale development artifacts | Old `.next/types` references removed bestseller routes. Dev artifacts were preserved. Isolated typecheck includes current source and freshly generated Next route types instead |
| Lint | PASS with existing warnings | Existing img warnings in Together, vendor promotions, store and QR components; no lint errors |
| Optimized build / Prisma Client generation | PASS | `node scripts/build-seo-check.mjs`; migrations disabled, unusable local DB URL, isolated dist output. Root tsconfig restored afterward. Existing Browserslist/Prisma configuration warnings remain |
| Diff whitespace check | PASS | No schema, dependency, private env or production data edits |
| Google Rich Results Test / Search Console submission | NOT TESTED | No deployment/submission authorization; local valid JSON is not Google's rich-result certification |
| Field CWV, real INP, Lighthouse/PSI score | NOT TESTED | No fabricated scores or improvements; use real field data after deployment |
| Live login, OAuth, real checkout/payment, production catalog/image sweep | NOT TESTED | Existing automated regressions passed where listed; no real production transactions performed |
| Live new robots/sitemap and current production schema | NOT TESTED | Source has not been deployed; fixtures are explicitly not production database verification |

The existing root Suspense boundary can stream an HTTP 200 shell before `notFound()` resolves. Next then emits a noindex directive and the not-found screen. HTTP checks verified missing/private records reveal no private content and have noindex, but **do not claim universal HTTP 404**. Addressing this globally would change the existing loading architecture and needs a separate review if strict status behavior is required.

Reproduce local checks (PowerShell; no migrations):

```powershell
npm test
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/seo.test.ts tests/admin-path.test.ts
$env:TSX_TSCONFIG_PATH='tests/tsconfig.json'
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/service-images.test.ts
npm run lint
node scripts/build-seo-check.mjs
node scripts/check-seo-types.mjs
node scripts/test-seo-http.mjs
node scripts/test-vendor-onboarding-browser.mjs
node scripts/test-marketplace-ux-browser.mjs
```

The repository's existing userInfo fallback is necessary under this Windows sandbox; invoking tsx without it can fail before tests with uv_os_get_passwd/ENOMEM. Browser scripts initially hit sandbox directory permissions; authorized retries outside the sandbox produced the results above. Build verification temporarily adjusts only generated-type includes and restores tsconfig; avoid independently editing tsconfig during that command.

## Remaining release actions and risks

1. Review the complete diff and the known marketplace browser assertion failure. No production-ready/full-regression claim is made while these limits remain.
2. Confirm current Hostinger application revision, runtime variables and read-only production schema compatibility with the current local baseline. This SEO change adds **no Prisma migration**, but it does not authorize deploying unrelated previous schema changes against an older production database. Keep `JORO_DEPLOY_MIGRATIONS=false`; do not run migrate deploy/db push/reset.
3. Confirm `MAINTENANCE_MODE=false` in the actual production Node environment if the site is meant to be public. Only the local flag was checked. Preserve private admin/auth secrets, storage configuration and all current credentials; no new SEO secret is required.
4. Inspect Hostinger www/apex SSL/CDN routing. Configure exactly one permanent 301/308 from HTTPS www to HTTPS apex, preserving path/query, only after approval and successful certificate/path checks. Retain HTTP-to-HTTPS consolidation and avoid redirect chains/loops. App canonical tags do not substitute for this host redirect.
5. Rehearse in staging with a compatible read-only/test database: every eligible entity type and category, noindex/private pages, missing IDs, a legacy alias, filtered/paged catalogs, image previews, login, seller onboarding, cart and checkout without charging a customer. Audit real duplicate product/store names and missing images/descriptions; do not invent replacements.
6. After explicit commit/push/deployment approval, use the reviewed normal Hostinger build command with migrations disabled. Do not use `build:deploy --migrate`. Preserve persistent uploads and existing environment variables. This report does not itself authorize a release.
7. After release, run `node scripts/check-seo-live.mjs` and inspect GET headers/body for `/`, `/robots.txt`, `/sitemap.xml` and every child map. Confirm all four domain variants and non-root paths, canonical host, proper XML content type, public metadata, no private route disclosure and no accidental public noindex. Walk real sitemap entries (sample each type initially; complete crawl off-peak) before submitting to Google. Cached sitemap snapshots can lag approvals/deletions by roughly 60 seconds; actual detail authorization is not cached globally.
8. Keep privacy/terms drafts noindex until owner review; verify actual return/delivery/contact claims against operational policy. No standalone Contact/delivery page is invented in this work.

## Search Console and analytics checklist (owner action after approved release)

- In the existing verified property, submit `https://joro.pk/sitemap.xml` once the live GET succeeds; inspect child-map fetch status. Do not resubmit an old 404 and assume success.
- URL Inspection: homepage, a real category, in-stock and out-of-stock products, an approved Service, approved store and public Want. Inspect Live Test, rendered HTML, user/Google-selected canonical, indexing permission and discovered sitemap. Request indexing for representative updated pages; requests do not guarantee indexing or timing.
- Test real deployed product URLs in Google's Rich Results Test. Resolve factual required-field issues without fabricated ratings/shipping/returns. Breadcrumb/Service JSON-LD helps describe content but does not guarantee a rich result.
- Review Page Indexing: accidental noindex, crawled/discovered-not-indexed, duplicates, canonical conflicts, expired Wants, missing pages and server errors. Private URLs should stay excluded. Investigate the streamed not-found limitation separately from valid indexable pages.
- Review HTTPS, sitemap errors and mobile/desktop Core Web Vitals. Good field thresholds are LCP <=2.5s, INP <=200ms, CLS <=0.1 at the 75th percentile; lab snapshots cannot establish those field results.
- No GA4 property/measurement ID was supplied or invented and no analytics script was added. If desired, provide the real property ID and review consent/privacy before implementing analytics. Track factual view_item/add_to_cart/begin_checkout/purchase events without changing payment behavior or double-counting purchase events.
- Baseline real GSC clicks, impressions, CTR, position, indexed eligible URLs and non-brand query/page segments. Compare weekly/28-day periods and note seasonality; use actual conversions where available. Never promise ranking/traffic or immediate indexing.

## Legitimate keyword/content opportunities

- Homepage: online shopping in Pakistan; Pakistan products and services marketplace; marketplace requests/Wants. Use terms naturally and only where the actual site supports the claim.
- Categories: actual category name + online/in Pakistan, grounded in stocked listings. Products: actual name/model/category, real price and availability, and seller where useful to disambiguate duplicate names.
- Services: actual service name/type + an actually supported city from the validated listing, not generated city permutations. Stores: actual business name and real description/location. Wants: the customer's public title/category/city without private details.
- Improve owner-authored About/support content, verified product specifications/photos, service scope/cancellation details and approved operational policies. Link actual categories, products and sellers in useful navigation. Avoid keyword stuffing, doorway city pages, copied manufacturer text where original detail is available, fabricated testimonials and paid ranking claims.

## Primary guidance consulted

- [Next.js 14 Metadata](https://nextjs.org/docs/14/app/building-your-application/optimizing/metadata) and [sitemap conventions](https://nextjs.org/docs/14/app/api-reference/file-conventions/metadata/sitemap).
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [canonical consolidation](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading), and [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet).
- [PageSpeed Insights lab and field data](https://developers.google.com/speed/docs/insights/v5/about) and [Search Console Core Web Vitals](https://support.google.com/webmasters/answer/9205520).

## Exact changed-file manifest

Generated from the final local source diff and untracked SEO files below. No hidden admin value or private configuration is included.

<!-- MANIFEST -->

- `app/(user)/about/page.tsx`
- `app/(user)/categories/[slug]/page.tsx`
- `app/(user)/categories/page.tsx`
- `app/(user)/deals/page.tsx`
- `app/(user)/faq/layout.tsx`
- `app/(user)/gifts/page.tsx`
- `app/(user)/layout.tsx`
- `app/(user)/myhome/page.tsx`
- `app/(user)/new-arrivals/[id]/NewArrivalDetailClient.tsx`
- `app/(user)/new-arrivals/[id]/page.tsx`
- `app/(user)/page.tsx`
- `app/(user)/products/ProductsClient.tsx`
- `app/(user)/products/[id]/ProductDetailClient.tsx`
- `app/(user)/products/[id]/page.tsx`
- `app/(user)/products/page.tsx`
- `app/(user)/return-policy/page.tsx`
- `app/(user)/reviews/page.tsx`
- `app/(user)/services/[id]/page.tsx`
- `app/(user)/services/page.tsx`
- `app/(user)/stores/[slug]/page.tsx`
- `app/(user)/stores/page.tsx`
- `app/(user)/wants/[id]/WantDetailClient.tsx`
- `app/(user)/wants/[id]/page.tsx`
- `app/(user)/wants/page.tsx`
- `app/api/products/route.ts`
- `app/api/settings/route.ts`
- `app/layout.tsx`
- `app/private-launch/page.tsx`
- `app/public-home/page.tsx`
- `app/robots.txt/route.ts`
- `app/sitemap.xml/route.ts`
- `app/sitemaps/[file]/route.ts`
- `components/seo/JsonLd.tsx`
- `components/user/CategoryAutoScroll.tsx`
- `docs/SEO_AUDIT_AND_PLAN.md`
- `docs/SEO_IMPLEMENTATION_REPORT.md`
- `lib/admin-path.ts`
- `lib/seo-cache.ts`
- `lib/seo-catalog.ts`
- `lib/seo-data.ts`
- `lib/seo-policy.ts`
- `lib/seo-sitemap.ts`
- `lib/seo.ts`
- `lib/settings-db.ts`
- `middleware.ts`
- `scripts/build-seo-check.mjs`
- `scripts/check-seo-live.mjs`
- `scripts/check-seo-types.mjs`
- `scripts/fixtures/seo-prisma.cjs`
- `scripts/test-seo-http.mjs`
- `tests/seo.test.ts`
