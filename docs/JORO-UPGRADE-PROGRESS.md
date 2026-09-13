# Joro upgrade delivery register

Last updated: 2026-09-13

This register maps all 60 backlog items in the supplied requirements plan to the current repository. `Implemented` means the enabled scope is connected to MySQL and protected server-side. `Partial` means useful production code exists but at least one acceptance criterion remains. `Blocked` means a named business/provider decision is required. `Deferred` means the later-release module stays disabled and has no live navigation claim.

## Delivery decisions

- The direct request to preserve the current theme overrides the PDF palette/rebrand proposal. Existing green/yellow/dark tokens, configuration names, order references and visible identity remain intact.
- Existing URLs and services were extended. New entry points are additive: `/account`, `/my-stuff`, `/invoice/[orderId]`, `/stores`, `/wants`, vendor demand/after-sales pages, and admin after-sales/team/customer pages.
- Checkout, cancellation, inventory, payout and refund state changes are server-validated and transaction-backed. Payment and fulfilment remain separate.
- Raast/card payment and accepted-Want checkout remain disabled until a real provider and business rules are selected. No simulated success is exposed.
- The return flow does not invent a time window. Delivered-item ownership and quantity are enforced now; policy-window/category exclusions await DEC03. Restocking is an explicit admin inspection choice.
- Invoice output is a printable owned-order document. A tax/legal issuer and private PDF lifecycle await DEC08, so it makes no unsupported tax claim.
- New KYC/appeal uploads are private local storage and served only through authorized routes. Production object-storage selection remains part of DEC10.

## 60-item backlog

| ID | Scope | Status | Current evidence / remaining work |
|---|---|---|---|
| F01 | Running baseline and reproducible setup | Partial | Node 22.13.1, npm 11.10.1, MySQL 8.0.43 and baseline checks recorded; clean Linux install and sanitized env template remain. |
| F02 | Order ownership and sensitive records | Partial | Immutable customer ownership protects lookup/cancel/proof; vendor/admin scope and private proof/KYC routes exist. Signed guest claiming is intentionally not enabled. |
| F03 | Stock, cancellation and transitions | Partial | Shared transactional reservation/cancel/consume services and forward-only states added; timed reservation worker and partial-master-total policy remain. |
| F04 | Auditable payout ledger | Implemented | Immutable entries, exact cent allocations, holds, partial residuals, idempotency and transfer references are active. Policy refinements await DEC02. |
| F05 | Catalog migration and private uploads | Partial | JSON catalogs imported to MySQL with legacy IDs; JSON writes disabled; KYC/appeals/payment proofs protected. Staging restore rehearsal remains. |
| D01 | Shared design tokens | Adapted | Current requested theme retained and normalized; PDF rebrand/palette is overridden by the direct request. |
| D02 | Responsive navigation/account entry | Partial | Shop, Wants, Stores, Account and My Stuff entries work; unreleased social destinations remain hidden. Formal viewport audit remains. |
| D03 | Homepage hierarchy | Partial | Wants and stores now use real moderated/database data with honest empty states; later social sections remain disabled. |
| D04 | Product/search/category discovery | Partial | Existing filters/sort/paging are retained and database-backed; search-gap Want prefill and full state-persistence audit remain. |
| D05 | Product detail/trust/social entry | Partial | Real stock, reviews, seller data, save/follow and optional warranty display exist; service/room actions remain disabled. |
| C01 | Seller-grouped cart/basket offers | Partial | Seller slices and server totals exist; promotions are disabled pending DEC04. |
| C02 | Reliable checkout/confirmation | Partial | Login ownership, idempotency, server pricing, inventory reservations, COD pending state and seller deliveries are implemented; payment retry UX remains. |
| C03 | Account/saved/history | Partial | Persistent addresses, saved products, follows, Wants and owned order history are implemented; signed guest order claims remain disabled. |
| C04 | Password recovery | Implemented | Customer/vendor hashed one-time tokens, expiry, throttling and session revocation are implemented; delivery requires SMTP setup. |
| C05 | Notifications/support | Partial | Scoped customer/vendor inboxes and idempotent offer/return/refund/dispute events exist; preferences, delivery retries and versioned policy content remain. |
| S01 | Public store directory | Partial | Approved-only real store directory with search/filter/sort exists; canonical slugs and pagination remain. |
| S02 | Public mini-stores/trust cards | Partial | Public seller catalog and safe aggregate metrics exist; policies, banners and slug redirects remain. |
| S03 | Store following/preferences | Partial | Idempotent account-scoped follow/unfollow and follower totals exist; opt-in announcement preferences remain. |
| S04 | Store editor/downloadable QR | Blocked | Existing store settings remain; QR host/purpose and offline rules await DEC07. |
| S05 | Evidence-based trust | Partial | Only approved vendors are public and metrics come from records; versioned windows/eligibility and correction workflow await DEC09. |
| W01 | Wants/Find It For Me | Partial | Validated customer requests and moderation state persist; drafts, images, owner edits and policy-driven expiry remain. |
| W02 | Wants feed/detail | Partial | Moderated public feed/detail, filters, offer counts and owner-only offer visibility exist; paging/interest counts remain. |
| W03 | Demand participation | Deferred | No misleading participation UI is enabled. |
| W04 | Vendor demand/offers | Partial | Approved vendors can see opportunities and create/update their own offers; quote versioning, expiry and richer terms remain. |
| W05 | Offer-to-checkout | Blocked | Endpoint/UI fail closed with a clear message until immutable quote, provider and refund policies are approved (DEC01/03/05). |
| T01 | Shop Together rooms | Deferred | R2 module disabled. |
| T02 | Collections/creator profiles | Deferred | R2 module disabled. |
| T03 | Discover/clips/live commerce | Deferred | R2 module disabled. |
| T04 | Friend Deals/group pricing | Blocked | Disabled pending DEC04. |
| T05 | Social safety/visibility | Deferred | Activates with R2 social modules. |
| P01 | Provider-neutral payments | Partial | Payment/fulfilment separation, proof state and provider-neutral manual refunds exist; gateway transaction/webhook adapter remains. |
| P02 | Raast integration | Blocked | Disabled pending DEC01 provider/merchant credentials. |
| P03 | Hosted/tokenized cards | Blocked | Raw card collection is not enabled; awaits DEC01 hosted provider. |
| P04 | Payment/COD/settlement reconciliation | Partial | COD collection and seller payout states are separate with ledger references; reconciliation queue/export remains. |
| P05 | Partial/full refunds | Partial | Item/quantity limits, pending versus processed states, manual transfer evidence, idempotency, vendor debit and restock choice are implemented; provider callback and shipping allocation await policy. |
| O01 | My Stuff purchase hub | Partial | Owned delivered items, seller state, invoice/warranty/return/dispute actions exist; unified pending/cancelled search views remain. |
| O02 | Invoices/warranties | Partial | Owned printable invoices reconcile stored totals/refunds; optional listing warranty records start at delivery and shrink/void on refund. Legal issuer/PDF terms await DEC08. |
| O03 | Item-level returns | Partial | Owned delivered-line quantity checks, seller/admin decisions, return tracking, receipt, refund queue and explicit restock are implemented; evidence/policy snapshots await DEC03. |
| O04 | Disputes/case timeline | Partial | Customer-owned cases, involved-seller visibility and permissioned admin resolution exist with order audit events; messages/evidence/SLA/appeals remain. |
| O05 | Service add-ons/history | Blocked | Disabled pending DEC08 provider, pricing, coverage and cancellation policy. |
| V01 | Vendor onboarding/account states | Partial | Existing approval/reject/suspend/appeal flow retained, KYC made private and approved-only publishing enforced; resumable wizard polish remains. |
| V02 | Vendor dashboard/navigation | Partial | Orders, products, demand, returns/disputes, earnings, withdrawals and status are task-organized; follower/wholesale/QR modules stay gated. |
| V03 | Vendor catalog/inventory | Partial | Ownership, validated CRUD, publication sync, stock and optional warranty exist; stock audit/bulk import-export remain. |
| V04 | Seller fulfilment | Partial | Seller-scoped slices, legal transitions, tracking, cancellation and customer synchronization exist; labels/slots await integrations. |
| V05 | Money center/statements | Partial | Exact available/reserved/paid balances, refund adjustments and withdrawals exist; downloadable statements and DEC02 timing/holds remain. |
| N01 | Vendor wholesale marketplace | Blocked | R3 disabled pending DEC06. |
| N02 | Dead-stock clearance | Deferred | Depends on N01. |
| N03 | Stock swaps | Blocked | Depends on N01 and DEC06. |
| N04 | Vendor Mesh/Stock Bridge | Blocked | R3 disabled pending DEC06. |
| N05 | Physical purchase/pickup points | Blocked | R3 disabled pending DEC07. |
| A01 | Admin access/control/audit | Partial | Database staff roles, server permissions, team UI, customer/vendor controls and audit store exist; broader audit search/detail and UI role-based link filtering remain. |
| A02 | Catalog/homepage management | Partial | Products/categories/new-arrivals/reviews/settings use MySQL and permissioned writes; scheduling/preview/rollback history remain. |
| A03 | Demand/content/trust moderation | Partial | Wants/reviews/vendor queues and audit events exist; assignment, reports, appeals and bulk actions remain. |
| A04 | Finance/commission operations | Partial | Finance permission boundary, exact payout allocation and evidence-backed manual refund/payout completion exist; effective dates/separation/export remain. |
| A05 | Analytics/network oversight | Deferred | Existing dashboard totals retained; formal metric definitions and network analytics await DEC09. |
| R01 | Migrations/tests/regression | Partial | Eight additive versioned migrations plus focused access/state/money tests exist; MySQL fixture/race CI and empty/populated upgrade matrix remain. |
| R02 | Security/monitoring | Partial | Ownership controls, private media, throttled reset, validation and fail-closed states added; distributed limits/alerting/dependency triage remain. |
| R03 | Accessibility/responsive/performance | Partial | Larger readable typography, labeled actions, responsive grids/tables and empty/error states implemented; browser/device tooling was unavailable for formal visual/Lighthouse evidence. |
| R04 | Staging/production/rollback | Partial | Setup and migration steps are documented below and a pre-upgrade SQL backup exists; Linux build, object storage, restore rehearsal and monitored jobs remain. |
| R05 | Acceptance/handover | Pending | Cannot complete until enabled partial stories are accepted and external decisions are assigned. |

## External decisions still required

| Decision | Needed from owner | Modules held back |
|---|---|---|
| DEC01 | Raast/card provider, merchant account, callbacks, refunds and settlement owner | P02, P03, W05 final payment |
| DEC02 | Commission precedence/effective dates, holds, payout limits and approval separation | V05, A04 refinements |
| DEC03 | Return windows/exclusions, shipping allocation, inspection, dispute SLA/appeals | O03, O04, P05 refinements |
| DEC04 | Offer stacking and group-deal commitment/refund rules | C01 promotions, T04 |
| DEC05 | Wants expiry, offer limits and moderation policy | W01-W05 refinements |
| DEC06 | Wholesale/swap/bridge commercial and fulfilment rules | N01-N04 |
| DEC07 | QR host, offline evidence/consent and pickup/return capacity | S04, N05 |
| DEC08 | Invoice issuer/numbering, warranty terms and service-provider rules | O02 PDF/legal details, O05 |
| DEC09 | Trust/GMV/conversion/refund metric definitions and windows | S05, A05 |
| DEC10 | Production runtime, media provider, jobs, rollout and performance profile | F01/F05, R02-R05 |

## Safe implementation order from here

1. Configure email and complete CI/MySQL fixture coverage for the enabled foundation.
2. Decide DEC01/02/03/05/08, then finish payment reconciliation, policy snapshots, accepted-offer checkout and after-sales evidence.
3. Finish store slugs/QR and customer notifications; run responsive/accessibility/restore acceptance before production.
4. Start R2 social/services only after R1 acceptance. Start R3 vendor network only after DEC06/07.
