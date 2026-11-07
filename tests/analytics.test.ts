import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { analyticsPage, ANALYTICS_CHOICE_KEY, CHOICE_LIFETIME, createAnalyticsController, GA4_ID, readAnalyticsChoice, serializeAnalyticsChoice } from "../lib/analytics-policy";

test("withdrawal disables the property before denying Consent Mode; reacceptance grants without reconfiguration", () => {
  const sequence: unknown[][] = [];
  const controller = createAnalyticsController((...args) => sequence.push(args), value => sequence.push(["disable", value]));
  controller.update("accepted", "/"); controller.loaded();
  const start = sequence.length;
  controller.update("rejected", "/");
  assert.deepEqual(sequence.slice(start), [["disable", true], ["consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]]);
  controller.update("rejected", "/products");
  controller.update("accepted", "/products");
  assert.equal(sequence.filter(a => a[0] === "config").length, 1);
  assert.equal(sequence.filter(a => a[0] === "consent" && (a[2] as { analytics_storage: string }).analytics_storage === "granted").length, 2);
  const beforePrivate = sequence.length; controller.update("accepted", "/checkout");
  assert.equal(sequence[beforePrivate][0], "disable");
  assert.equal((sequence.at(-1)![2] as { analytics_storage: string }).analytics_storage, "denied");
});

test("UI requires both explicit activation and privacy approval; approved-policy links are wired without publishing draft wording", () => {
  const require = createRequire(import.meta.url);
  function render(env: Record<string, string>) {
    const exports: { AnalyticsConsent?: () => unknown } = {};
    let state = 0;
    runInNewContext(ts.transpileModule(fs.readFileSync("components/analytics/AnalyticsConsent.tsx", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
      exports, process: { env }, require: (name: string) => {
        if (name === "react") return { useEffect() {}, useRef: () => ({ current: null }), useState: (value: unknown) => [state++ === 1 ? true : value, () => {}] };
        if (name === "next/navigation") return { usePathname: () => "/", useSearchParams: () => new URLSearchParams() };
        if (name.endsWith("analytics-policy")) return { analyticsPage };
        if (name.endsWith("analytics-client")) return {};
        return require(name);
      },
    });
    return exports.AnalyticsConsent!();
  }
  assert.equal(render({}), null);
  assert.equal(render({ NEXT_PUBLIC_GA4_ENABLED: "true" }), null);
  assert.equal(render({ NEXT_PUBLIC_GA4_PRIVACY_APPROVED: "true" }), null);
  const content = JSON.stringify(render({ NEXT_PUBLIC_GA4_ENABLED: "true", NEXT_PUBLIC_GA4_PRIVACY_APPROVED: "true" }));
  assert.ok(content.includes('"href":"/privacy-policy"'));
  assert.ok(content.includes('"href":"https://policies.google.com/privacy"'));
});

test("same-release public policy includes analytics disclosure while retaining owner-review status", () => {
  const policy = fs.readFileSync("app/(legal)/privacy-policy/page.tsx", "utf8");
  for (const text of ['id: "analytics"', 'id: "analytics-choice"', "Accept optional analytics", "Reject optional analytics", "Analytics preferences", "180-day", "Google Analytics", "policies.google.com/privacy", "Draft for owner review"]) assert.ok(policy.includes(text), text);
  assert.ok(policy.includes('href="/account/help"'), "existing verified support channel remains available");
  assert.ok(policy.includes('href="mailto:admin@joro.pk"'), "owner-selected public privacy contact needs no sign-in");
  assert.ok(policy.includes("subject to confirming that the mailbox is active and monitored"), "mailbox operation must not be claimed as verified");
});

test("only approved public routes are eligible; detail identifiers, query values and titles never enter payloads", () => {
  for (const path of ["/", "/products", "/categories", "/services", "/stores", "/gifts", "/new-arrivals", "/about", "/faq", "/products/public-id", "/categories/phones", "/services/ac-repair", "/stores/shop"]) assert.ok(analyticsPage(path), path);
  for (const path of ["/login", "/signup", "/account", "/vendor", "/admin", "/secret-control", "/checkout", "/cart", "/invoice/private", "/track-order", "/marketing/unsubscribe", "/api/image/a", "/wants/new", "/wants/private-id", "/products/a/edit", "//evil.test", "/products/a%2Fb", "/products/user@example.com"]) assert.equal(analyticsPage(path), null, path);
  for (const query of ["token=secret", "email=a@example.com", "phone=03001234567", "q=private+search", "callbackUrl=/account", "orderId=private"]) assert.equal(analyticsPage("/products", query), null);
  const page = analyticsPage("/products/03001234567", "utm_source=private-name&category=private-text")!;
  assert.equal(page.location, "https://joro.pk/products/detail");
  assert.ok(!JSON.stringify({ location: page.location, title: page.title }).includes("private"));
});

test("consent records fail closed, expire and persist only a versioned choice", () => {
  const now = 1000;
  for (const choice of ["accepted", "rejected"] as const) assert.equal(readAnalyticsChoice(serializeAnalyticsChoice(choice, now), now), choice);
  for (const value of [null, "broken", "true", '{"choice":"accepted"}', '{"version":1,"choice":"accepted","expires":"99999"}', serializeAnalyticsChoice("accepted", now)]) {
    assert.equal(readAnalyticsChoice(value, now + CHOICE_LIFETIME), "unknown");
  }
});

function fixture() {
  const commands: unknown[][] = [], disabled: boolean[] = [];
  return { commands, disabled, controller: createAnalyticsController((...args) => commands.push(args), value => disabled.push(value)) };
}
const views = (commands: unknown[][]) => commands.filter(args => args[0] === "event" && args[1] === "page_view");

test("no initialization/event without opt-in; withdrawal before script completion cannot send a queued visit", () => {
  const f = fixture(); f.controller.update("unknown", "/"); f.controller.loaded(); f.controller.update("rejected", "/products");
  assert.equal(f.commands.length, 0); assert.equal(f.disabled.at(-1), true);
  const pending = fixture(); pending.controller.update("accepted", "/"); pending.controller.update("rejected", "/"); pending.controller.loaded();
  assert.equal(pending.commands.length, 0);
});

test("one config, one view per navigation; rerenders/filter changes deduplicate, back/forward count", () => {
  const f = fixture(); f.controller.update("accepted", "/"); f.controller.loaded();
  f.controller.update("accepted", "/"); f.controller.loaded();
  f.controller.update("accepted", "/products", "page=1"); f.controller.update("accepted", "/products", "page=2");
  f.controller.update("accepted", "/");
  assert.equal(views(f.commands).length, 3);
  const configs = f.commands.filter(args => args[0] === "config");
  assert.equal(configs.length, 1); assert.equal(configs[0][1], GA4_ID);
  assert.equal((configs[0][2] as { send_page_view: boolean }).send_page_view, false);
  const refreshed = fixture(); refreshed.controller.update("accepted", "/"); refreshed.controller.loaded();
  assert.equal(views(refreshed.commands).length, 1);
});

test("private routes and withdrawal disable collection; reaccepting resumes safely", () => {
  const f = fixture(); f.controller.loaded(); f.controller.update("accepted", "/products/03001234567");
  assert.ok(!JSON.stringify(f.commands).includes("03001234567"));
  f.controller.update("accepted", "/checkout"); assert.equal(f.disabled.at(-1), true);
  f.controller.update("accepted", "/"); f.controller.update("rejected", "/");
  const count = f.commands.length; f.controller.update("rejected", "/products"); assert.equal(f.commands.length, count);
  f.controller.update("accepted", "/products"); assert.equal(views(f.commands).length, 3);
});

test("browser adapter loads exactly one asynchronous script after opt-in and handles errors/conflicts", () => {
  function adapter(conflict = false) {
    const scripts: { onload: () => void; onerror: () => void; async: boolean; referrerPolicy: string }[] = [];
    const browser: Record<string, unknown> = {};
    const exports: Record<string, (choice: string, path: string, search: string) => void> = {};
    runInNewContext(ts.transpileModule(fs.readFileSync("lib/analytics-client.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, window: browser, document: { querySelector: () => conflict ? {} : null, createElement: () => ({}), head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) } },
        require: () => ({ createAnalyticsController, GA4_ID }) });
    return { scripts, browser, update: exports.updateAnalytics };
  }
  const f = adapter(); f.update("unknown", "/", ""); f.update("rejected", "/", ""); assert.equal(f.scripts.length, 0);
  f.update("accepted", "/checkout", ""); assert.equal(f.scripts.length, 0);
  f.update("accepted", "/", ""); f.update("accepted", "/", ""); assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].async, true); assert.equal(f.scripts[0].referrerPolicy, "no-referrer");
  f.update("rejected", "/", ""); f.scripts[0].onload(); assert.equal(f.browser[`ga-disable-${GA4_ID}`], true);
  f.update("accepted", "/", ""); assert.equal(f.scripts.length, 1);
  const c = adapter(true); c.update("accepted", "/", ""); assert.equal(c.scripts.length, 0);
  const e = adapter(); e.update("accepted", "/", ""); e.scripts[0].onerror(); assert.equal(e.browser[`ga-disable-${GA4_ID}`], true);
  assert.equal(ANALYTICS_CHOICE_KEY, "joro:analytics-consent:v1");
});
