export const GA4_ID = "G-BKBH6NHEY4";
export const ANALYTICS_CHOICE_KEY = "joro:analytics-consent:v1";
export type AnalyticsChoice = "accepted" | "rejected" | "unknown";
export const CHOICE_LIFETIME = 180 * 24 * 60 * 60 * 1000;

/** Static titles and route templates deliberately exclude user/vendor-written text and IDs. */
export function analyticsPage(path: string, search = "") {
  const allowedQuery = new Set(["page", "sort", "category", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]);
  if (Array.from(new URLSearchParams(search).keys()).some(key => !allowedQuery.has(key))) return null;
  const pages: Record<string, string> = {
    "/": "Home", "/products": "Products", "/categories": "Categories", "/services": "Services",
    "/stores": "Stores", "/gifts": "Gifts", "/new-arrivals": "New arrivals", "/about": "About", "/faq": "FAQ",
  };
  if (Object.hasOwn(pages, path)) return { location: `https://joro.pk${path}`, title: `${pages[path]} | JORO.pk`, key: path };
  const detail = /^\/(products|categories|services|stores)\/([A-Za-z0-9_-]{1,200})$/.exec(path);
  if (!detail) return null;
  return { location: `https://joro.pk/${detail[1]}/detail`, title: `${pages[`/${detail[1]}`]} detail | JORO.pk`, key: path };
}

export function readAnalyticsChoice(value: string | null, now = Date.now()): AnalyticsChoice {
  try {
    const record = JSON.parse(value || "null");
    if (record?.version === 1 && typeof record.expires === "number" && record.expires > now && record.expires <= now + CHOICE_LIFETIME
      && ["accepted", "rejected"].includes(record.choice)) return record.choice;
  } catch { /* Corrupt or inaccessible storage never grants consent. */ }
  return "unknown";
}

export function serializeAnalyticsChoice(choice: Exclude<AnalyticsChoice, "unknown">, now = Date.now()) {
  return JSON.stringify({ version: 1, choice, expires: now + CHOICE_LIFETIME });
}

type Command = (...args: unknown[]) => void;
export function createAnalyticsController(command: Command, disable: (value: boolean) => void) {
  let ready = false, configured = false, lastKey: string | null = null;
  let page: ReturnType<typeof analyticsPage> = null;
  let accepted = false;
  let granted = false;
  const consent = (analytics_storage: "granted" | "denied") => ({ analytics_storage, ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  function flush() {
    if (!accepted || !page) {
      // Stop this property FIRST, before notifying the already-loaded Google tag.
      disable(true);
      if (granted) { command("consent", "update", consent("denied")); granted = false; }
      lastKey = null;
      return;
    }
    if (!ready) return;
    disable(false);
    if (lastKey === page.key && granted) return;
    command("set", { page_location: page.location, page_title: page.title, page_referrer: "" });
    if (!granted) { command("consent", "update", consent("granted")); granted = true; }
    if (!configured) {
      command("js", new Date());
      command("config", GA4_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
        cookie_domain: "none", cookie_flags: "SameSite=Lax;Secure", page_location: page.location, page_title: page.title, page_referrer: "" });
      configured = true;
    }
    command("event", "page_view", { send_to: GA4_ID, page_location: page.location, page_title: page.title, page_referrer: "" });
    lastKey = page.key;
  }
  return {
    update(choice: AnalyticsChoice, path: string, search = "") {
      accepted = choice === "accepted"; page = analyticsPage(path, search); flush();
      return accepted && Boolean(page);
    },
    loaded() { ready = true; flush(); },
  };
}
