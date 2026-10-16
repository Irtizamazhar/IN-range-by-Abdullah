import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { vendorRegistrationSameOrigin } from "../lib/vendor-registration-origin";
import { PasswordStrength } from "../components/auth/PasswordStrength";
import { isMailConfigured, JORO_SENDER } from "../lib/mailer";
import { customerWelcomeEmail, vendorApprovalEmail, campaignEmail, customerPasswordResetEmail } from "../lib/joro-email-templates";
import { emailCampaignInput } from "../lib/email-campaign-schema";
import { createMarketingUnsubscribeToken, verifyMarketingUnsubscribeToken } from "../lib/marketing-unsubscribe";

test("vendor signup accepts production and proxy origins but rejects missing or forged origins", () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL };
  Object.assign(process.env, { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://joro.pk" });
  try {
    const request = (url: string, headers: Record<string, string>) => new Request(url, { method: "POST", headers });
    assert.doesNotThrow(() => vendorRegistrationSameOrigin(request("https://joro.pk/api/vendor/signup", { origin: "https://joro.pk", host: "joro.pk" })));
    assert.doesNotThrow(() => vendorRegistrationSameOrigin(request("http://127.0.0.1:3000/api/vendor/signup", { origin: "https://joro.pk", host: "127.0.0.1:3000", "x-forwarded-host": "joro.pk", "x-forwarded-proto": "https" })));
    assert.throws(() => vendorRegistrationSameOrigin(request("https://joro.pk/api/vendor/signup", { host: "joro.pk" })));
    assert.throws(() => vendorRegistrationSameOrigin(request("https://joro.pk/api/vendor/signup", { origin: "https://evil.example", host: "joro.pk" })));
    assert.throws(() => vendorRegistrationSameOrigin(request("http://127.0.0.1:3000/api/vendor/signup", { origin: "https://joro.pk", host: "127.0.0.1:3000", "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" })));
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else Object.assign(process.env, { [key]: value }); }
  }
});

test("vendor password feedback uses the server's eight-character minimum", () => {
  const html = renderToStaticMarkup(createElement(PasswordStrength, { password: "Abcdef7", minLength: 8 }));
  assert.match(html, /at least 8 characters/);
  assert.match(html, /Password strength: <strong>Weak<\/strong>/);
  assert.match(html, /role="progressbar"/);
});

test("Hostinger SMTP_PASSWORD is recognized without inspecting its value", () => {
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PASS", "EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    assert.equal(isMailConfigured(), false);
    Object.assign(process.env, { SMTP_HOST: "mail.example.invalid", SMTP_PORT: "465", SMTP_USER: "test@example.invalid", SMTP_PASSWORD: "test-only" });
    assert.equal(isMailConfigured(), true);
    assert.equal(JORO_SENDER, "JORO <admin@joro.pk>");
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else Object.assign(process.env, { [key]: value }); }
  }
});

test("branded templates include text, logo and escaped user content", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  Object.assign(process.env, { NEXT_PUBLIC_APP_URL: "https://joro.pk" });
  try {
    const welcome = customerWelcomeEmail("Ahsan <script>");
    assert.equal(welcome.subject, "Welcome to JORO! Your Journey Starts Here");
    assert.match(welcome.html, /https:\/\/joro\.pk\/logo\.png/);
    assert.match(welcome.html, /Jo Chahiye, Yahin Mile!/);
    assert.doesNotMatch(welcome.html, /<script>/);
    assert.match(welcome.text, /https:\/\/joro\.pk/);
    assert.match(vendorApprovalEmail("Shop & More").html, /Shop &amp; More/);
    assert.match(customerPasswordResetEmail("Ahsan", "https://joro.pk/reset-password?token=abc").html, /Reset Password/);
    assert.doesNotMatch(campaignEmail("Offer", "Preview", "<p>Hello</p><script>alert(1)</script>").html, /<script>/);
  } finally { if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else Object.assign(process.env, { NEXT_PUBLIC_APP_URL: previous }); }
});

test("campaign drafts sanitize rich text and unsubscribe signatures reject tampering", () => {
  const parsed = emailCampaignInput.parse({ subject: "Offer", previewText: "Preview", bodyHtml: "<p>Hello <strong>JORO</strong></p><script>alert(1)</script>", audience: "CUSTOMERS", recipientIds: [] });
  assert.doesNotMatch(parsed.bodyHtml, /<script>/);
  const previous = process.env.NEXTAUTH_SECRET;
  Object.assign(process.env, { NEXTAUTH_SECRET: "test-only-unsubscribe-secret" });
  try {
    const token = createMarketingUnsubscribeToken("customer", "cm1234567890");
    assert.deepEqual(verifyMarketingUnsubscribeToken(token), { type: "customer", id: "cm1234567890" });
    assert.equal(verifyMarketingUnsubscribeToken(token.replace("customer", "vendor")), null);
  } finally { if (previous === undefined) delete process.env.NEXTAUTH_SECRET; else Object.assign(process.env, { NEXTAUTH_SECRET: previous }); }
});
