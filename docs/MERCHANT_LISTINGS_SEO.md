# Verified merchant policy markup

The shared JORO organization now uses Google's supported `MerchantReturnPolicy` link-only option (`merchantReturnLink`) on the homepage and policy pages. All use the existing `https://joro.pk/#organization` identity. The published return policy remains unchanged. Seven days is the notification deadline, not a verified physical-return window. No `merchantReturnDays`, return category, refund time or unconditional refund promise is inferred.

`/shipping-policy` shows the persisted `Settings.codCharges` and `codAvailableCities` used by standard COD checkout. It uses a SELECT-only narrow query, never settings initialization, bank fields or fallback shipping charges. On missing settings or a read failure it makes no price/coverage claim. The page distinguishes separately agreed private quote shipping from standard catalog delivery. It is linked from the return policy and included in the sitemap.

No `shippingDetails` or `hasShippingService` is emitted: checkout restricts COD to configured cities, and Google's supported `DefinedRegion` cannot express Pakistani city-only coverage. A country-only PK destination would misrepresent availability. Do not interpret the website's nationwide delivery slogan as verified checkout availability. Shipping and global-identifier warnings can therefore remain.

Product/Offer/Breadcrumb generators, prices, stock, seller identity, descriptions and records are preserved. No ratings/reviews, brand or identifiers are invented. Product and vendor models have no verified dedicated brand/GTIN source; shop names and product titles are not brand verification. Vendor `storePolicies` is free text and is not interpreted as machine-readable product exceptions. Future verified exceptions belong on the specific Offer and must not overwrite shared organization terms.

Business confirmation is needed for physical return windows, return/refund timing and exceptions, handling/transit times, and any expanded shipping coverage. The return page's illustrative free-delivery threshold is not implemented in standard checkout and must not become shipping markup.

Validation: local regression tests check link-only return requirements, SELECT-only persisted shipping data, zero/missing/invalid fees, coverage omission, existing seller/offer data, and script escaping. The built-app HTTP regression checks rendered policy JSON-LD and shipping information with isolated read-only database fixtures. These are checks against Google's documentation, not a claim of passing Google's hosted Rich Results Test or clearing Search Console warnings before deployment.

Official references checked November 9, 2026:

- https://developers.google.com/search/docs/appearance/structured-data/return-policy (Organization policy, required option B: merchantReturnLink)
- https://developers.google.com/search/docs/appearance/structured-data/shipping-policy (DefinedRegion coverage limitations)
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (Offer-specific exceptions and genuine product identifiers)

After a separately authorized deployment, run Google's Rich Results Test and Search Console URL Inspection on a real product and the policy page, then request recrawling. This task does not deploy or change Merchant Center/Search Console settings.
