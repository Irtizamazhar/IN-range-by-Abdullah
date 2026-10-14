import assert from "node:assert/strict";
import test from "node:test";
import { loadingMessageForRoute, loadingNeedsOpaqueBackground } from "../lib/loading-route-message";

test("loading copy follows real destination routes", () => {
  const cases: Record<string, string> = {
    "/": "Preparing your marketplace...",
    "/products": "Loading products...",
    "/products/abc": "Loading product details...",
    "/products?category=Electronics": "Exploring categories...",
    "/services": "Exploring services...",
    "/services/abc": "Loading service details...",
    "/gifts": "Finding gifts...",
    "/joro-connect": "Opening Wants...",
    "/wants": "Loading requests...",
    "/account?tab=wants": "Loading your requests...",
    "/joined-requests": "Loading joined requests...",
    "/account/offers": "Preparing your offers...",
    "/stores": "Exploring stores...",
    "/stores/shop": "Opening store...",
    "/cart": "Loading your cart...",
    "/checkout": "Preparing checkout...",
    "/login?role=customer": "Preparing your account...",
    "/login?role=vendor": "Preparing your account...",
    "/account/orders": "Loading your orders...",
    "/vendor/dashboard": "Opening seller dashboard...",
    "/sell": "Opening seller dashboard...",
    "/vendor/dashboard/products": "Loading your products...",
    "/vendor/dashboard/services": "Loading your services...",
    "/vendor/dashboard/offers": "Loading seller offers...",
    "/admin/dashboard": "Loading dashboard...",
    "/admin/vendors": "Loading management tools...",
  };
  for (const [route, expected] of Object.entries(cases)) assert.equal(loadingMessageForRoute(route), expected, route);
});

test("protected destinations use an opaque background", () => {
  for (const route of ["/account", "/account/offers", "/checkout", "/vendor/dashboard", "/admin/dashboard"]) assert.equal(loadingNeedsOpaqueBackground(route), true, route);
  for (const route of ["/", "/products", "/login", "/admin/login"]) assert.equal(loadingNeedsOpaqueBackground(route), false, route);
});
