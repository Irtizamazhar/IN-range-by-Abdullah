import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { verifyTeamCredentials } from "../lib/private-launch/team-credentials";

import { decideGatedRequest } from "../lib/private-launch/gate-policy";
import {
  createPreviewSessionToken,
  isMaintenanceMode,
  isPreviewEmailAllowed,
  isPreviewGateConfigured,
  isValidPreviewPasswordHash,
  verifyPreviewSessionToken,
} from "../lib/private-launch/session";

const SECRET = "test-preview-secret-that-is-at-least-32-chars";
const HASH = "$2b$12$QPsnLPsXDmWop537RVbpc.sIfmyG/w2LATsj/za4UYi.DBm9i6k3u";
const env = (overrides: Record<string, string | undefined> = {}) =>
  ({
    MAINTENANCE_MODE: "true",
    PREVIEW_SESSION_SECRET: SECRET,
    PREVIEW_PASSWORD_HASH: HASH,
    PREVIEW_ALLOWED_EMAILS: " Team@JORO.pk , qa@joro.pk ",
    ...overrides,
  }) as unknown as NodeJS.ProcessEnv;

test("MAINTENANCE_MODE is on only for an explicit true", () => {
  assert.equal(isMaintenanceMode(env()), true);
  assert.equal(isMaintenanceMode(env({ MAINTENANCE_MODE: " TRUE " })), true);
  for (const value of [undefined, "", "false", "1", "yes", "on"]) {
    assert.equal(isMaintenanceMode(env({ MAINTENANCE_MODE: value })), false, String(value));
  }
});

test("allowlist is explicit and case-insensitive; empty means nobody", () => {
  assert.equal(isPreviewEmailAllowed("team@joro.pk", env()), true);
  assert.equal(isPreviewEmailAllowed("QA@joro.pk", env()), true);
  assert.equal(isPreviewEmailAllowed("customer@example.com", env()), false);
  assert.equal(isPreviewEmailAllowed("team@joro.pk", env({ PREVIEW_ALLOWED_EMAILS: "" })), false);
});

test("gate is unconfigured without a strong secret or allowlist", () => {
  assert.equal(isPreviewGateConfigured(env()), true);
  assert.equal(isPreviewGateConfigured(env({ PREVIEW_SESSION_SECRET: undefined })), false);
  assert.equal(isPreviewGateConfigured(env({ PREVIEW_SESSION_SECRET: "short" })), false);
  assert.equal(isPreviewGateConfigured(env({ PREVIEW_ALLOWED_EMAILS: " , " })), false);
  assert.equal(isPreviewGateConfigured(env({ PREVIEW_PASSWORD_HASH: undefined })), false);
  assert.equal(isPreviewGateConfigured(env({ PREVIEW_PASSWORD_HASH: "plain-text-password" })), false);
  assert.equal(isValidPreviewPasswordHash(HASH), true);
});

test("shared bcrypt preview password accepts only allowlisted emails", async () => {
  const password = "synthetic-preview-test-password";
  const hashed = await bcrypt.hash(password, 12);
  const config = env({ PREVIEW_PASSWORD_HASH: hashed });
  assert.equal(await verifyTeamCredentials(" TEAM@JORO.pk ", password, config), "team@joro.pk");
  assert.equal(await verifyTeamCredentials("team@joro.pk", "wrong-password", config), null);
  assert.equal(await verifyTeamCredentials("other@example.com", password, config), null);
  assert.equal(await verifyTeamCredentials("team@joro.pk", password, env({ PREVIEW_PASSWORD_HASH: undefined })), null);
});

test("preview session round-trips for an allowlisted member", async () => {
  const token = await createPreviewSessionToken("Team@JORO.pk", env());
  assert.equal(await verifyPreviewSessionToken(token, env()), "team@joro.pk");
});

test("preview session is rejected when tampered, re-keyed, revoked or missing", async () => {
  const token = await createPreviewSessionToken("team@joro.pk", env());
  assert.equal(await verifyPreviewSessionToken(undefined, env()), null);
  assert.equal(await verifyPreviewSessionToken(`${token}x`, env()), null);
  assert.equal(
    await verifyPreviewSessionToken(token, env({ PREVIEW_SESSION_SECRET: `${SECRET}-rotated` })),
    null,
  );
  assert.equal(await verifyPreviewSessionToken(token, env({ PREVIEW_ALLOWED_EMAILS: "qa@joro.pk" })), null);
  assert.equal(await verifyPreviewSessionToken(token, env({ PREVIEW_SESSION_SECRET: undefined })), null);
  assert.equal(await verifyPreviewSessionToken(token, env({ PREVIEW_PASSWORD_HASH: HASH.replace("Q", "R") })), null);
});

test("tokens of another type or expired tokens are rejected", async () => {
  const key = new TextEncoder().encode(`${SECRET}:${HASH}`);
  const otherType = await new SignJWT({ typ: "customer" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("team@joro.pk")
    .setExpirationTime("1h")
    .sign(key);
  assert.equal(await verifyPreviewSessionToken(otherType, env()), null);

  const expired = await new SignJWT({ typ: "joro-preview" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("team@joro.pk")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(key);
  assert.equal(await verifyPreviewSessionToken(expired, env()), null);
});

test("gated visitors get the Coming Soon page for page navigations", () => {
  for (const pathname of ["/products/abc", "/admin", "/admin/login", "/vendor/dashboard", "/checkout", "/login", "/public-home"]) {
    assert.equal(decideGatedRequest({ pathname, method: "GET" }), "gate", pathname);
  }
  assert.equal(decideGatedRequest({ pathname: "/private-launch", method: "GET" }), "gate");
});

test("public informational homepage and legal pages allow only read-only requests", () => {
  assert.equal(decideGatedRequest({ pathname: "/", method: "GET" }), "home");
  assert.equal(decideGatedRequest({ pathname: "/", method: "HEAD" }), "home");
  assert.equal(decideGatedRequest({ pathname: "/privacy-policy", method: "GET" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/privacy-policy", method: "HEAD" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/privacy-policy", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/terms-and-conditions", method: "GET" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/terms-and-conditions", method: "HEAD" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/terms-and-conditions", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/", method: "GET", isServerAction: true }), "block");
});

test("gated visitors cannot reach APIs, server actions or mutations", () => {
  assert.equal(decideGatedRequest({ pathname: "/api/products", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/admin/products", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/callback/credentials", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/providers", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/image/abc", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/upload.png", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/checkout", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/", method: "POST", isServerAction: true }), "block");
  assert.equal(decideGatedRequest({ pathname: "/", method: "GET", isServerAction: true }), "block");
});

test("gated visitors cannot start or complete Google sign-in", () => {
  // Team members carry a preview session and bypass this policy in middleware;
  // public visitors must not be able to create customer accounts while gated.
  assert.equal(decideGatedRequest({ pathname: "/api/auth/signin/google", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/callback/google", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/callback/google", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/csrf", method: "GET" }), "block");
});

test("only the team login endpoints and session probe are public APIs", () => {
  assert.equal(decideGatedRequest({ pathname: "/api/preview-access/login", method: "POST" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/api/preview-access/login", method: "GET" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/preview-access/logout", method: "POST" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/api/preview-access/session", method: "GET" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/api/preview-access/session", method: "POST" }), "block");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/session", method: "GET" }), "allow");
  assert.equal(decideGatedRequest({ pathname: "/api/auth/session", method: "POST" }), "block");
});

test("static assets stay reachable but cannot smuggle dynamic routes", () => {
  for (const pathname of [
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/icon.png",
    "/icon.svg",
    "/favicon.ico",
    "/logo.png",
    "/uploads/promotions/banner.jpg",
    "/videos/hero.mp4",
  ]) {
    assert.equal(decideGatedRequest({ pathname, method: "GET" }), "allow", pathname);
  }
  assert.equal(decideGatedRequest({ pathname: "/stores/my-shop.png", method: "GET" }), "gate");
  assert.equal(decideGatedRequest({ pathname: "/products/x.css", method: "GET" }), "gate");
  assert.equal(decideGatedRequest({ pathname: "/uploads/x.png", method: "POST" }), "block");
});
