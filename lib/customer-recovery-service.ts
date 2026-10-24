import bcrypt from "bcryptjs";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashResetToken, matchesOtp, newOtp, newResetToken, otpVerifier, OTP_COOLDOWN_MS, OTP_TTL_MS, RESET_TTL_MS, usableOtp } from "./password-recovery";

export class RecoveryError extends Error {}

/** Injectable transport keeps tests off SMTP and real customer accounts. */
export function customerRecoveryService(db: PrismaClient, deliver: (email: string, code: string) => Promise<boolean>) {
  return {
    async request(email: string) {
      const challengeId = randomUUID();
      const code = newOtp();
      const now = new Date();
      const customer = await db.$transaction(async tx => {
        const account = await tx.customer.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } });
        if (!account?.isActive) return null;
        // Existing policy explicitly permits verified email recovery for OAuth-only accounts.
        // Keep used rows until expiry so resend and hourly limits survive process restarts.
        const recent = await tx.customerPasswordResetToken.findMany({ where: { customerId: account.id, createdAt: { gt: new Date(now.getTime() - 3600000) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
        if (recent.length >= 5 || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < OTP_COOLDOWN_MS)) return null;
        await tx.customerPasswordResetToken.updateMany({ where: { customerId: account.id, usedAt: null }, data: { usedAt: now } });
        await tx.customerPasswordResetToken.create({ data: { id: challengeId, customerId: account.id, tokenHash: hashResetToken(newResetToken()), otpHash: otpVerifier(challengeId, code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) } });
        return account;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (customer) {
        let sent = false;
        try { sent = await deliver(customer.email, code); } catch { /* Never log codes or mail payloads. */ }
        if (!sent) {
          await db.customerPasswordResetToken.updateMany({ where: { id: challengeId }, data: { usedAt: new Date() } });
          // A per-address delivery failure must not reveal whether an account exists.
          console.error("Password recovery email was not accepted; check the configured mail provider.");
        }
      }
      // Unknown, inactive, throttled and eligible accounts get the same response shape.
      return { ok: true, challengeId, retryAfter: 60, message: "If this email is eligible, a verification code will arrive shortly. If no code arrives, try again later or contact support." };
    },

    async verify(challengeId: string, code: string) {
      const authorization = newResetToken();
      const result = await db.$transaction(async tx => {
        const row = await tx.customerPasswordResetToken.findUnique({ where: { id: challengeId } });
        if (!row || !usableOtp(row)) return false;
        const valid = matchesOtp(challengeId, code, row.otpHash!);
        // Compare-and-swap counts concurrent attempts and lets only one verification win.
        const gate = await tx.customerPasswordResetToken.updateMany({
          where: { id: row.id, usedAt: null, attempts: row.attempts, otpHash: row.otpHash, expiresAt: { gt: new Date() } },
          data: valid ? { otpHash: null, tokenHash: hashResetToken(authorization), expiresAt: new Date(Date.now() + RESET_TTL_MS), attempts: { increment: 1 } } : { attempts: { increment: 1 } },
        });
        return valid && gate.count === 1;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!result) throw new RecoveryError("This code is invalid, expired, or has reached its attempt limit. Request a new code.");
      return authorization;
    },

    async reset(authorization: string, password: string) {
      const passwordHash = await bcrypt.hash(password, 12);
      return db.$transaction(async tx => {
        const row = await tx.customerPasswordResetToken.findUnique({ where: { tokenHash: hashResetToken(authorization) } });
        if (!row || row.attempts < 1 || row.otpHash || row.usedAt || row.expiresAt.getTime() <= Date.now()) throw new RecoveryError("Reset authorization is invalid or expired. Start again.");
        const gate = await tx.customerPasswordResetToken.updateMany({ where: { id: row.id, usedAt: null, otpHash: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (gate.count !== 1) throw new RecoveryError("Reset authorization has already been used.");
        const account = await tx.customer.findUnique({ where: { id: row.customerId }, select: { isActive: true } });
        if (!account?.isActive) throw new RecoveryError("This account cannot be recovered. Contact support.");
        const customer = await tx.customer.update({ where: { id: row.customerId }, data: { passwordHash, sessionVersion: { increment: 1 } }, select: { email: true, name: true } });
        await tx.customerPasswordResetToken.updateMany({ where: { customerId: row.customerId, usedAt: null }, data: { usedAt: new Date() } });
        return customer;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    },
  };
}
