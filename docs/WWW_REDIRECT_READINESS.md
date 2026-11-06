# WWW canonical redirect — local candidate and release checklist

Prepared 6 November 2026. Primary domain: `https://joro.pk`. No hosting/DNS/environment/database changes, migrations, commit, push or deployment were performed.

## Decision and root cause

Both hostnames serve the application and the repository had no hostname-consolidation redirect. The previously observed internal request URL is not evidence of the raw Host header: these are different inputs in Next.js.

Prefer a Hostinger edge/platform redirect **only if** the actual Node.js application's supported controls can implement the exact behavior below. The general hPanel Redirects documentation does not establish that this specific Node app exposes the controls or preserves paths, queries and non-GET methods. This has not been verified through hPanel or server configuration.

Next.js 14 supports an exact-host redirect, so a minimal local fallback candidate is implemented in `next.config.mjs`:

```text
Host: www.joro.pk
any path/query -> 308 https://joro.pk/<same path>?<same query>
```

Destination is a fixed HTTPS public origin. The host expression escapes dots and matches only www.joro.pk (Next normalizes host case and removes a port). Apex, internal, preview and localhost hosts do not match. There is no forwarded-host fallback, request-derived destination, protocol toggle or new environment setting. Existing upload rewrites and middleware/authentication remain unchanged. The redirect runs before middleware and applies to API/mutating requests too; HTTP 308 preserves the method/body under the HTTP redirect protocol, but does not guarantee a particular client follows it or forwards credentials across origins.

## Mandatory proxy verification — production release remains pending

The installed Next matcher reads `req.headers.host`; it does not use X-Forwarded-Host for `has: [{ type: 'host' }]`. Local tests exercise that actual matcher and the compiled Next server.

Before releasing the candidate, verify through existing Hostinger request diagnostics/logs or support, without exposing cookies, authorization headers or secrets:

1. A www request reaches the Node app with raw Host `www.joro.pk`.
2. An apex request reaches it with raw Host `joro.pk`, never www.
3. If Host is replaced with an internal hostname, this rule safely does not match and cannot fix the live issue; use a verified platform rule instead. Do not start trusting arbitrary forwarded headers to compensate.
4. If the proxy rewrites **both** hosts to www, publishing this rule could loop on apex; stop until proxy routing is clarified.
5. Keep valid HTTPS routing/certificates for both public hostnames. No DNS/SSL changes are part of this task.

The live Host/forwarded-header contract cannot be determined from an external HTTP response alone. No production diagnostic endpoint was added. Local success does not establish Hostinger pass-through behavior.

## Hostinger dashboard procedure — conditional, after approval

Official navigation is **Websites → Manage site → Dashboard → search “Redirects” in the sidebar**. Open the existing JORO Node application, not a new website.

If the tool is available, inspect existing rules first. The required rule is:

| Setting/behavior | Required value |
|---|---|
| Source hostname | Exactly `www.joro.pk`; never the root `joro.pk` domain |
| Source paths | All paths, including `/` |
| Destination | `https://joro.pk` plus the original path |
| Query | Preserve original values, repeated parameters and encoding |
| Status | Permanent; method-preserving 308 for this all-request policy |
| Apex behavior | No match, no self-redirect |

The general guide describes a source dropdown, optional path, URL/IP destination type and destination field, followed by Create. It does **not** document sufficient wildcard/query/method controls for this Node app. Do not invent wildcard syntax or assume selecting a domain automatically includes only www. If these exact semantics cannot be confirmed in the actual UI, do not click Create; ask Hostinger support whether an edge rule is supported for this Node application. Do not replace/remove/reconnect the website, add DNS records, disable protection, or assume .htaccess is processed.

If Hostinger confirms a reliable platform rule, prefer that and omit this app-level fallback from the approved release. Otherwise use the app candidate only after raw Host verification. Choose one implementation to own canonicalization.

## Authentication, commerce and API compatibility gates

- **Google OAuth:** inspect the configured public application origin and provider redirect URI without changing credentials. New sign-in flows should start and finish on apex. An in-flight www OAuth flow may have www-only state/PKCE cookies; redirecting its callback to apex can fail validation. Local URL-preservation tests do not certify real OAuth.
- **Sessions/cookies:** existing customer/admin cookies have Secure/SameSite settings and no Domain attribute, so are host-scoped. Existing www sessions are not automatically available on apex. Users may need to sign in again. No cookie scope, token, CSRF or session-security changes were made. Do not claim seamless session migration.
- **Checkout/payments:** apex routes and business logic are unchanged. Verify cart persistence (including host-scoped browser storage), sign-in callback URLs and a staging checkout. An active www cart/session may not transfer automatically. Do not test with live charges or create test production orders.
- **APIs/webhooks:** www requests receive 308 before handlers; apex requests retain normal handling. Some webhook clients do not follow redirects; cross-origin browser fetches may change credential forwarding or preflight behavior. Inventory integrations and their configured callback hosts before release. Do not assume a method-preserving status alone proves compatibility. Do not replay real payment webhooks to test.
- **Private/admin/vendor paths:** hostname normalization does not authenticate a visitor. Apex requests still encounter the original middleware and server authorization. Do not disclose the private admin prefix in checks or public reports.

If any important integration still depends on www, or host-scoped customer state must transfer seamlessly, release is blocked until an explicitly reviewed compatibility plan exists. No authentication, storage, callback or payment policy was relaxed to make the redirect tests pass.

## Local validation

Automated coverage is in `tests/www-redirect.test.mjs` and the compiled-server checks in `scripts/test-seo-http.mjs`. It covers host lookalikes, hostile forwarded headers, apex/local/internal non-matches, root/product/query URLs, login/OAuth URL preservation, www API methods, apex session/API behavior, vendor auth gates and the existing upload rewrite. HTTP fixtures use a dummy database target and reject database writes; no production request follows an OAuth/payment redirect.

Final local results:

| Check | Result |
|---|---|
| New WWW rule tests | PASS, 6/6 |
| Focused redirect/admin/origin/checkout-safety regressions | PASS, 18/18 |
| Existing npm test suite | PASS, 226/226 |
| Isolated compiled-server HTTP/browser checks | PASS, 75 check groups; zero database writes |
| Current-source and fresh generated-route TypeScript | PASS |
| Prisma Client generation / optimized production build | PASS; migrations disabled |
| Build lint | PASS with existing img, Browserslist and Edge/jose warnings |
| Hostinger raw Host contract / platform redirect support | NOT VERIFIED |
| Real OAuth / existing www sessions or carts / provider webhook compatibility | NOT TESTED |

Hostname HTTP checks use Node's raw HTTP client because the installed Node fetch ignores an overridden Host header. JSON mutation probes have explicit Content-Length and target only a nonexistent local fixture API; no real order/payment handler is invoked. Initial test-transport/framing issues were corrected before the final successful run. The first sandboxed build could not download the existing Google Font; the approved network-enabled IPv4 retry passed without changing application fonts or environment files.

Commands:

```powershell
node --test tests/www-redirect.test.mjs
node --require ./scripts/test-userinfo-fallback.cjs --import tsx --test tests/public-wants-redirects.test.ts tests/admin-path.test.ts tests/customer-registration-origin.test.ts tests/checkout-release-safety.test.ts
$env:NODE_OPTIONS='--dns-result-order=ipv4first --no-network-family-autoselection'
node scripts/build-seo-check.mjs
node scripts/check-seo-types.mjs
node scripts/test-seo-http.mjs
```

The build helper disables migrations, uses an unusable local database URL, isolates output and restores tsconfig after Next generates route types. IPv4 is a process-local networking workaround, not a production environment edit. Local tests are not certification of real OAuth, existing www cookies/carts, payment provider behavior or Hostinger routing.

## Live verification — after an approved release only

Read-only PowerShell/curl commands (inspect status and Location; do not add credentials):

```powershell
curl.exe -sS -I 'https://www.joro.pk/'
curl.exe -sS -I 'https://joro.pk/'
curl.exe -sS -I 'https://www.joro.pk/products/cmvxgtkaj000e51dnot6ijacc?utm_source=redirect-check&x=a%26b'
curl.exe -sS -I 'https://www.joro.pk/login?role=customer&callbackUrl=%2Fcheckout'
curl.exe -sS -I 'https://www.joro.pk/api/auth/session'
curl.exe -sS -I 'https://joro.pk/api/auth/session'
curl.exe -sS -I 'http://www.joro.pk/products/cmvxgtkaj000e51dnot6ijacc?utm_source=redirect-check'
curl.exe -sS -L --max-redirs 4 -o NUL -w 'HTTP %{http_code} URL %{url_effective} redirects %{num_redirects}\n' 'https://www.joro.pk/?utm_source=redirect-check'
```

Require www HTTPS 308 to the matching apex HTTPS URL, apex without a www bounce, preserved paths/query and no internal origins. Hostinger may first redirect HTTP www to HTTPS www, producing an additional hop; verify the full chain rather than assume a single hop. Review sitemap/canonicals, upload URLs and real Google rendering afterward. Complete approved staging login/OAuth/checkout/integration tests before real release acceptance.

## Rollback

Before approval, record the deployed revision and the existing redirect settings without secrets. Release this change separately from unrelated features/schema changes.

- App implementation: remove only the new `redirects()` rule or restore the known-compatible prior build through the approved deployment workflow. No database rollback/migration is required. Preserve persistent uploads and current environment values.
- Platform implementation: remove only the exact www rule created for this change. Hostinger's documented path is the same Redirects screen → List of Redirects → delete that specific rule. Preserve pre-existing HTTPS rules and DNS.
- HTTP 308 can be cached by browsers/intermediaries; removing the server rule cannot instantly retract cached responses. Recheck in a fresh client and review relevant CDN caches through approved controls. Never add an apex-to-www reverse redirect as a rollback shortcut: that can create loops for cached clients.

## Sources

- https://nextjs.org/docs/14/pages/api-reference/next-config-js/redirects
- https://www.hostinger.com/support/1583406-how-to-set-up-a-redirect-in-hostinger/
- https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/
