import { createAnalyticsController, GA4_ID, type AnalyticsChoice } from "./analytics-policy";

type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; "ga-disable-G-BKBH6NHEY4"?: boolean };
let runtime: ReturnType<typeof createRuntime> | undefined;

function createRuntime() {
  const browser = window as AnalyticsWindow;
  let started = false, failed = false;
  const command = (...args: unknown[]) => { try { browser.gtag?.(...args); } catch { /* Analytics cannot interrupt the site. */ } };
  const controller = createAnalyticsController(command, value => { browser[`ga-disable-${GA4_ID}`] = value; });
  browser[`ga-disable-${GA4_ID}`] = true;
  return {
    update(choice: AnalyticsChoice, path: string, search: string) {
      const allowed = controller.update(choice, path, search);
      if (!allowed || started || failed) return;
      // Fail closed if another installer appears; never append a second Google tag.
      if (browser.gtag || browser.dataLayer || document.querySelector('script[src*="googletagmanager.com"],script[src*="google-analytics.com"]')) { failed = true; return; }
      started = true;
      browser.dataLayer = [];
      // Google's command queue uses an Arguments object, rather than a data-layer event array.
      // eslint-disable-next-line prefer-rest-params
      browser.gtag = function () { browser.dataLayer!.push(arguments); };
      command("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      const script = document.createElement("script");
      script.id = "joro-ga4"; script.async = true; script.referrerPolicy = "no-referrer";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
      script.onload = () => controller.loaded();
      script.onerror = () => { failed = true; browser[`ga-disable-${GA4_ID}`] = true; };
      document.head.appendChild(script);
    },
  };
}

export function updateAnalytics(choice: AnalyticsChoice, path: string, search: string) {
  try { (runtime ??= createRuntime()).update(choice, path, search); } catch { /* Storage/network/script failures are optional. */ }
}

/** Remove this stream's identifiers only; never touch login, cart or other essential cookies. */
export function clearAnalyticsCookies() {
  try {
    for (const name of ["_ga", "_ga_BKBH6NHEY4"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      if (location.hostname === "joro.pk" || location.hostname === "www.joro.pk") {
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=joro.pk; SameSite=Lax`;
      }
    }
  } catch { /* Cookie restrictions must not affect essential functionality. */ }
}
