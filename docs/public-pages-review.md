# JORO public pages review

## Implementation

The fixed promotional strip is reduced from 40px to 32px, including its spacer and navigation offset. The nine rotating labels (Market Deals, Fast Orders, Support Local, Verified Sellers, Secure Payments, Trending Wants, Easy Returns, Nationwide Delivery, Grow Together) are replaced with four factual discovery messages: Find products & services, Request a Want, Connect with sellers, Explore opportunities. Narrow screens show Discover JORO and Request a Want. Unsupported delivery, verification and payment claims are removed from this strip.

The hero secondary line is exactly “Na Mile? Request a Want”. The main animated headline and existing Request a Want action are preserved.

`/about` includes Our Story, Why JORO, Mission, Vision, What You Can Do, Meet the Founders, Built Around Real Needs, Grow with JORO, Build the Future with JORO and Be Part of the JORO Journey. The original `/logo.png` and “Jo Chahiye, Yahin Mile!” appear unchanged. “JORO means bringing things together” is presented as the brand's guiding idea. Hamid Khan and Irtiza each have the exact role “Co-Founder & Owner, JORO”, equal cards and no invented biographies or photographs. Future ambitions are distinguished from current features; there are no invented performance figures or investment promises.

The owner supplied `admin@joro.pk` for business/investor enquiries. SMTP authentication for that account succeeded without sending mail. The partnership CTA uses `mailto:admin@joro.pk`. This checks account access, not incoming delivery or recipient response. General support links to the existing Support Centre; sending a ticket requires a customer account.

## Footer audit

| Item | Destination / behavior |
| --- | --- |
| Shop Products / Shop | `/products` |
| Services | `/services` |
| Gifts | `/gifts` |
| Wants | `/wants` |
| Request a Want | Existing shared PostWantButton dialog action, including bottom shortcut |
| Trending Wants | `/wants/trending`, existing redirect |
| Connect | `/joro-connect`, existing redirect to Wants |
| Stores | `/stores` |
| Become a Seller | `/sell`, existing role-aware entry |
| Grow | Disabled Coming Soon; no invented route |
| About Us | `/about` |
| Track Order | `/track-order` |
| Return Policy | `/return-policy` |
| Help & FAQ | `/faq` |
| Contact & Support | `/account/help` |
| Terms & Conditions | `/terms-and-conditions`, source-pending notice and labelled legacy content |
| Privacy Policy | Disabled Coming Soon; approved policy required |
| Cart | `/cart` |
| Social icons | Existing unconfigured channels remain unavailable |
| WhatsApp | Existing configured number only; known placeholder remains suppressed |

Footer entries now use unique stable IDs, resolving duplicate Wants keys. Mobile accordions, colors, branding, focus indicators and existing social treatment are retained. Available footer routes are checked against implemented page/route files; Connect's existing redirect is retained.

## Legal content pending

No `02_JORO_Terms_and_Conditions.docx` was found in the project or supplied attachments. Version 1.0, dated 13 October 2026, has **not** been integrated. The terms page prominently identifies this and labels the existing wording as legacy content awaiting review. It does not invent replacement terms. The owner must supply the original approved DOCX and confirm registered business name, registered address and official support details for the legal document. An approved Privacy Policy source is also required. These legal pages are not ready for final legal approval.

## Validation

- Marketplace UX regressions: 33 passed.
- Vendor/order regressions: 61 passed.
- Public-page browser fixture: 320, 360, 375, 768 and 1280px passed, including overflow checks, founders, original logo rendering, Request a Want action, partnership mailto, footer destinations, 32px strip/navigation offset and browser history.
- The browser fixture renders real components with navigation/session/image adapters; it does not submit production tickets, orders, onboarding or email, and is not an end-to-end production service check.
- Production build passed with TypeScript and lint validation. Existing unrelated image/Browserslist/Prisma configuration warnings remain.
- `git diff --check` passed.
- No secrets, database content/schema, global colors, authentication or business APIs were changed. No commit, push or deployment was performed.

## Exact review / commit file list

- `app/(user)/about/page.tsx`
- `app/(user)/about/page.module.css`
- `app/(user)/terms-and-conditions/page.tsx`
- `components/user/AnnouncementBar.tsx`
- `components/user/AnnouncementBar.module.css`
- `components/user/HeroSection.tsx`
- `components/user/Footer.tsx`
- `components/user/Footer.module.css`
- `lib/footer-navigation.ts`
- `scripts/test-public-pages-browser.mjs`
- `docs/public-pages-review.md`

These implementation files are ready for review; official Terms integration and Privacy publication remain pending the approved sources above.
