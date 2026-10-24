import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { customerRecoveryService } from "../lib/customer-recovery-service";
import { hashResetToken, matchesOtp, newOtp, otpVerifier, recoveryPassword, usableOtp } from "../lib/password-recovery";
import { consumeOrReject, createLoginRateLimiter } from "../lib/security/rate-limit";
import { customerPasswordOtpEmail } from "../lib/joro-email-templates";

process.env.NEXTAUTH_SECRET = "test-only-recovery-secret";
type Row = { id: string; customerId: string; tokenHash: string; otpHash: string | null; attempts: number; createdAt: Date; expiresAt: Date; usedAt: Date | null };
type Account = { id: string; email: string; name: string; isActive: boolean; passwordHash: string; sessionVersion: number };

// Transactional in-memory adapter exercises the real service without a database or SMTP.
function fixture() {
  let rows: Row[] = [];
  let accounts: Account[] = [{ id: "c1", email: "recovery@example.test", name: "Test", isActive: true, passwordHash: "old", sessionVersion: 2 }];
  let queued = Promise.resolve();
  const matches = (row: Row, where: Record<string, unknown>) => Object.entries(where).every(([key, expected]) => {
    const value = row[key as keyof Row];
    if (expected && typeof expected === "object" && "gt" in expected) return value instanceof Date && value > (expected as { gt: Date }).gt;
    return value === expected;
  });
  const tx = {
    customer: {
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) => accounts.find(account => where.id ? account.id === where.id : account.email === where.email) || null,
      update: async ({ where, data }: { where: { id: string }; data: { passwordHash: string } }) => {
        const account = accounts.find(value => value.id === where.id)!;
        account.passwordHash = data.passwordHash; account.sessionVersion++;
        return { email: account.email, name: account.name };
      },
    },
    customerPasswordResetToken: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter(row => matches(row, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      findUnique: async ({ where }: { where: Record<string, unknown> }) => { const row = rows.find(row => matches(row, where)); return row ? { ...row } : null; },
      create: async ({ data }: { data: Partial<Row> }) => { const row = { attempts: 0, otpHash: null, usedAt: null, createdAt: new Date(), ...data } as Row; rows.push(row); return row; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of rows) if (matches(row, where)) { count++; for (const [key, value] of Object.entries(data)) { if (key === "attempts" && value && typeof value === "object") row.attempts++; else Object.assign(row, { [key]: value }); } }
        return { count };
      },
    },
  };
  const db = { ...tx, $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => {
    const previous = queued; let release!: () => void; queued = new Promise(resolve => { release = resolve; }); await previous;
    const snapshot = structuredClone({ rows, accounts });
    try { return await operation(tx); } catch (error) { rows = snapshot.rows; accounts = snapshot.accounts; throw error; } finally { release(); }
  } } as unknown as PrismaClient;
  const sent: { email: string; code: string }[] = [];
  const service = customerRecoveryService(db, async (email, code) => { sent.push({ email, code }); return true; });
  return { service, sent, rows: () => rows, accounts: () => accounts, db };
}

test("cryptographic code verifiers are purpose/challenge bound and expire at ten minutes", () => {
  for (let index = 0; index < 20; index++) assert.match(newOtp(), /^\d{6}$/);
  const hash = otpVerifier("challenge", "123456");
  assert.notEqual(hash, "123456"); assert.equal(matchesOtp("challenge", "123456", hash), true);
  assert.equal(matchesOtp("other", "123456", hash), false);
  assert.equal(matchesOtp("challenge", "654321", hash), false);
  assert.equal(usableOtp({ otpHash: hash, attempts: 0, usedAt: null, expiresAt: new Date(600000) }, 600000), false);
});

test("unknown and inactive addresses have the same public response as eligible addresses", async () => {
  const f = fixture(); const known = await f.service.request("recovery@example.test");
  const unknown = await f.service.request("missing@example.test");
  f.accounts()[0].isActive = false; const inactive = await f.service.request("recovery@example.test");
  for (const result of [unknown, inactive]) assert.deepEqual({ ...result, challengeId: "redacted" }, { ...known, challengeId: "redacted" });
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].email, "recovery@example.test");
  assert.equal(JSON.stringify(known).includes(f.sent[0].code), false);
});

test("five wrong codes block a challenge and expiry rejects a correct code", async () => {
  const f = fixture(); const request = await f.service.request("recovery@example.test");
  const wrong = f.sent[0].code === "000000" ? "111111" : "000000";
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(f.service.verify(request.challengeId, wrong));
  assert.equal(f.rows()[0].attempts, 5);
  await assert.rejects(f.service.verify(request.challengeId, f.sent[0].code));
  const g = fixture(); const challenge = await g.service.request("recovery@example.test");
  g.rows()[0].expiresAt = new Date(0); await assert.rejects(g.service.verify(challenge.challengeId, g.sent[0].code));
});

test("resend cooldown, persistent hourly limits, replacement and old-code invalidation", async () => {
  const f = fixture(); const first = await f.service.request("recovery@example.test");
  await f.service.request("recovery@example.test"); assert.equal(f.sent.length, 1);
  f.rows()[0].createdAt = new Date(Date.now() - 61000);
  const second = await f.service.request("recovery@example.test"); assert.equal(f.sent.length, 2);
  await assert.rejects(f.service.verify(first.challengeId, f.sent[0].code));
  assert.ok(await f.service.verify(second.challengeId, f.sent[1].code));
  for (let index = 0; index < 4; index++) { f.rows().forEach(row => { row.createdAt = new Date(Date.now() - 61000); }); await f.service.request("recovery@example.test"); }
  assert.equal(f.sent.length, 5);
});

test("verified authorization is single-use, bcrypt hashes correctly and old sessions/codes are revoked", async () => {
  const f = fixture(); const initialHash = await bcrypt.hash("old-password", 4); f.accounts()[0].passwordHash = initialHash;
  const request = await f.service.request("recovery@example.test");
  const authorization = await f.service.verify(request.challengeId, f.sent[0].code);
  assert.equal(f.rows()[0].tokenHash, hashResetToken(authorization)); assert.equal(f.rows()[0].otpHash, null);
  await assert.rejects(f.service.verify(request.challengeId, f.sent[0].code));
  await assert.rejects(f.service.reset("invalid", "new-password"));
  const results = await Promise.allSettled([f.service.reset(authorization, "new-password"), f.service.reset(authorization, "new-password")]);
  assert.equal(results.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(await bcrypt.compare("old-password", f.accounts()[0].passwordHash), false);
  assert.equal(await bcrypt.compare("new-password", f.accounts()[0].passwordHash), true);
  assert.equal(f.accounts()[0].sessionVersion, 3); assert.ok(f.rows().every(row => row.usedAt));
});

test("unverified and expired authorizations cannot reset; OAuth recovery follows existing policy", async () => {
  const f = fixture(); f.accounts()[0].passwordHash = "oauth-only:random";
  const request = await f.service.request("recovery@example.test");
  await assert.rejects(f.service.reset("0".repeat(64), "new-password"));
  const authorization = await f.service.verify(request.challengeId, f.sent[0].code);
  f.rows()[0].expiresAt = new Date(0); await assert.rejects(f.service.reset(authorization, "new-password"));
});

test("failed SMTP acceptance invalidates the challenge without revealing the account", async () => {
  const f = fixture(); const service = customerRecoveryService(f.db, async () => false);
  const result = await service.request("recovery@example.test"); assert.equal(result.ok, true);
  assert.ok(f.rows()[0].usedAt); assert.match(result.message, /If this email is eligible/);
});

test("IP/account limiter rejects excess requests and customer password policy rejects bcrypt truncation", async () => {
  const limiter = createLoginRateLimiter();
  for (let index = 0; index < 5; index++) assert.equal((await consumeOrReject(limiter, "test-ip")).ok, true);
  assert.equal((await consumeOrReject(limiter, "test-ip")).ok, false);
  assert.equal((await consumeOrReject(limiter, "other-ip")).ok, true);
  assert.equal(recoveryPassword.safeParse("12345").success, false);
  assert.equal(recoveryPassword.safeParse("123456").success, true);
  assert.equal(recoveryPassword.safeParse("a".repeat(73)).success, false);
  assert.equal(recoveryPassword.safeParse("é".repeat(37)).success, false);
});

test("OTP mail uses the existing branded HTML and plain-text alternatives", () => {
  const email = customerPasswordOtpEmail("012345");
  assert.equal(email.subject, "JORO | Password Reset Verification Code");
  assert.match(email.html, /<table/); assert.match(email.html, /012345/); assert.match(email.text, /10 minutes/);
  assert.match(email.text, /never share/); assert.throws(() => customerPasswordOtpEmail('<img>'));
});
