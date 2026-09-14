# Step 7 — Family Cart audit and verification

**STEP 7 STATUS: COMPLETE**

Verified on 2026-09-14.

## Initial audit

| Area | Initial status | Finding |
| --- | --- | --- |
| Canonical models | COMPLETE | ShoppingRoom, RoomMember, RoomInvite, RoomItem and RoomComment already exist. No new models needed. |
| Create room | COMPLETE | Authenticated creation creates the owner membership and opens the room. |
| Invite/join | PARTIAL | Secure hashed random tokens, expiry/revocation and unique membership exist; automatic continuation after sign-in was missing. |
| Shared products | PARTIAL | Real products and current prices exist; images, canonical store links, duplicate prevention and removal were missing. |
| Multiple comments | PARTIAL | Each post already creates a separate row, but the UI only loaded 30 comments and lacked timestamps and editing/deletion. |
| Comment ownership actions | MISSING | No edit/delete endpoints or controls. |
| Personal cart | PARTIAL | Server revalidation exists, but room UX used selected-item bulk actions and browser storage was not customer-scoped. |
| Privacy/authorization | PARTIAL | Membership gates and narrow customer-name selects exist; cart isolation needed improvement. |
| Account Together | PARTIAL | Existing alias reuses Together page, but counts, created/joined labels, owner invite copying and the account navigation entry were missing. |
| Simplified UX | BROKEN | Voting was exposed despite the requested simplified scope. |
| Focused verification | MISSING | No dedicated Family Cart E2E suite. |

## Implementation

- Reused all five canonical models; retained legacy RoomVote data/model without exposing voting in the room UI or accepting vote actions.
- Secure 32-byte random invites remain hash-only in the database, expire after seven days, and validate server-side. Sign-in retains the invite page and joining continues automatically.
- Active members share real product/variant pairs. Serializable transactions prevent concurrent duplicate inserts; conflicts return a retryable error.
- Shared cards display current images, prices, variants, vendor/store slug links and availability. Owner can remove a product. Removing it cascades its existing room comments/votes through the existing schema.
- Each comment submission creates a separate RoomComment. All comments are returned in chronological order. Text is sanitized, trimmed and limited to 2,000 characters. Only its author may edit/delete a comment, including when another member is the room owner. Existing schema has createdAt but no updatedAt; no migration was introduced just to add it.
- Add to My Cart revalidates the real product, variant, requested combined quantity, price, product/publication stock, active publication and approved vendor. It uses the existing CartContext and preserves unrelated cart lines. Existing same-variant quantity is included in server stock validation.
- CartContext uses customer-specific browser storage and claims guest contents once at sign-in. Customer carts remain local to that browser, consistent with the existing architecture; no shared or server-side cart system was added.
- Account Together reuses its existing page alias and shows created/joined rooms, active-member counts, product counts, Open Room and owner Copy Invite Link, with a real empty state.

## Files changed for Step 7

- `lib/family-cart-service.ts`
- `app/api/together/route.ts`
- `app/api/together/[id]/route.ts`
- `app/(user)/together/page.tsx`
- `app/(user)/together/[id]/page.tsx`
- `app/(user)/join/[token]/page.tsx`
- `context/CartContext.tsx`
- `components/user/AccountNavigation.tsx`
- `scripts/test-family-cart.ts`
- `package.json` (only adds `test:together:e2e` alongside existing user edits)
- `docs/STEP-7-FAMILY-CART.md`

## Database and Git safety

No schema changes or migrations, reset, db push, or destructive schema commands. Tests create isolated local fixture IDs and delete only those fixtures in finally cleanup. Existing Step 6 work is preserved. Work stays on main; no push, branch change, reset, or Step 8 work.

## Verification

| Check | Final result |
| --- | --- |
| Prisma validation | PASS; `.env.local` loaded for the CLI. |
| Prisma client generation | PASS; no schema changes. |
| `npx.cmd tsc --noEmit` | PASS. |
| `npm.cmd test` | PASS, 25 tests. |
| `npm.cmd run test:together:e2e` | PASS, 15 grouped DB/API/browser scenarios. |
| `npm.cmd run build` | PASS, production build completed. |
| Room and Account Together widths | PASS at 360, 390, 768, 1024 and 1440; no horizontal overflow. |
| Browser errors | None recorded in the final successful room/account/product/store/cart run. |
| Fixture cleanup | PASS; temporary rooms, memberships, invites, comments, products, publication, vendor, customers, address, saved product and order removed. |

The focused suite verifies:

1. Room creation and server-selected owner, ignoring forged owner IDs.
2. Secure hashed invite generation, joining and duplicate membership prevention.
3. Nonmember access rejection, owner-only invites and invalid/expired/revoked tokens.
4. Real products/variants and sequential/concurrent duplicate sharing prevention.
5. Multiple independent comments, own edits/deletes, author-only restrictions (including against the room owner), blank/oversized/unsafe text handling.
6. Current price, product/publication stock, valid quantity/variant, active product and eligible vendor on cart actions.
7. Private room response fields, direct cross-customer address/order/saved-product access, canonical store slug and account counts.
8. Browser-only create room, copy invite, first join, share real product, post two comments and add to the joining customer's cart.
9. Browser cart preservation and cumulative same-variant quantity.
10. Browser multiple comments and own edit/delete controls.
11. Room/account responsive layouts and active Family Cart navigation at all five requested widths.
12. Working product and canonical store links.
13. Same-browser customer switching isolates cart views while retaining the previous customer's stored contents.
14. Anonymous invitation opens sign-in without revealing room contents; authenticated invitation navigation joins automatically.
15. Owner-only shared product removal.

Screenshots are saved under `coverage/family-cart/` (Git-ignored). Mobile and desktop room captures and the mobile account capture were visually reviewed. A browser test timing race was fixed by waiting for authenticated room loading before Create room; the final suite passes.

Nonblocking build notices remain for raw image optimization, outdated Browserslist data and the existing Prisma package configuration deprecation. No Step 7 functional work remains.

## Limits retained from the existing architecture

Personal carts persist in this browser, now under separate customer keys; they are not synchronized across devices. Room comments have a created timestamp; the existing model does not support an updated timestamp. Legacy voting models/data remain intact but voting is absent from this feature's UI and accepted room actions.
