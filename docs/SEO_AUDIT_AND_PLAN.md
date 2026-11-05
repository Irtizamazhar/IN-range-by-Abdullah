# JORO.PK SEO audit and staged implementation plan

Audit started 4 November 2026 against local HEAD `478a480`. The initial working tree was clean. No database schema/data, production configuration, DNS, SSL, commits, pushes or deployment are authorized for this task.

Confirmed from source:

1. No sitemap/robots implementation exists. Public pages mostly inherit the same root title/description; root metadataBase, sharing metadata and most canonicals are absent. Priority: critical discovery/metadata.
2. `/products` renders empty client state until fetching its API. It uses infinite loading without crawlable pagination. Category links are query filters, with no indexable category route. Priority: server-provided real content and pagination while retaining filters/cart behavior.
3. Product detail is server-rendered but lacks metadata/structured data; its broad catch converts database errors into 404. Public catalog queries primarily check isActive, so vendor publication/approval must additionally govern SEO eligibility and direct detail access. Priority: shared eligibility for indexable detail and sitemap, no private leakage.
4. Services already check active/approved listing and approved provider, but lack dynamic metadata and structured data. Store pages check approved providers and canonical slug redirects, but lazily write a missing slug during GET. SEO readers must be read-only; public rendering should not mutate records.
5. Wants detail is entirely client-rendered; nonexistent/private IDs can initially return HTTP 200. Public metadata must never include owner/private offers. Pending and private views must retain their existing authorization.
6. Admin layout has noindex and authentication remains mandatory. Other private utility/account/auth pages lack consistent noindex headers. Maintenance rewrites affect public homepage behavior; historical noindex cannot be diagnosed from code alone or by assuming live env values.
7. Root/live website must be described as an operating marketplace. Protected maintenance screens are retained; their SEO wording/directives must not advertise a public launch date or leak into the live homepage.
8. Hero/product images already use Next Image, explicit containers, priority on key images and a swap font. No measured field CWV or real analytics/GSC API access is available. Do not invent a performance score or remove features for one.
9. Real About, FAQ, return, privacy, terms and seller application routes exist. There is no verified standalone Contact/delivery route; use existing actual support information and recommend policy review without inventing legal terms, addresses or guarantees.

Plan:

1. Add shared canonical/metadata/JSON-LD policies, route-specific private/query robots handling, and public robots/sitemap routes with maintenance-aware behavior. Generate bounded, split, cached sitemap pages from actual eligible database rows; return an explicit error on database failure, never partial success.
2. Add entity metadata/breadcrumb/product/service/store structured data from the same records used in visible content, preserve meaningful H1s, and reject missing/ineligible detail records. Keep all auth checks and business operations intact.
3. Server-provide initial product/filter data and crawlable page links; add real active category routes/links. Preserve interactive filters, sorting, load-more, cart, wishlist and checkout semantics.
4. Validate policies, XML, eligibility, failed-DB behavior, metadata, XSS-safe JSON-LD and existing regression flows. Build and check actual local production HTTP with isolated fixtures/no production DB. Report live host/redirect and CWV limits separately.

Live observations are collected read-only by `scripts/check-seo-live.mjs`. Final results, exact modified files, PASS/FAIL/NOT TESTED, hosting actions and Search Console checklist will be recorded in `docs/SEO_IMPLEMENTATION_REPORT.md`.
