import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail, verifyMailTransport } from "@/lib/mailer";
import { customerPasswordOtpEmail, passwordChangedEmail } from "@/lib/joro-email-templates";
import { customerRecoveryService, RecoveryError } from "@/lib/customer-recovery-service";
import { hashResetToken, recoveryEmail, recoveryPassword } from "@/lib/password-recovery";
import { consumeOrReject, createApiRateLimiter, createLoginRateLimiter } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/vendor-ip";
import { customerRegistrationSameOrigin } from "@/lib/customer-registration-origin";

export const dynamic = "force-dynamic";
const requests = createLoginRateLimiter();
const operations = createApiRateLimiter();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), email: recoveryEmail }),
  z.object({ action: z.literal("verify"), challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("reset"), authorization: z.string().regex(/^[a-f0-9]{64}$/), password: recoveryPassword, confirm: z.string() }),
]);
const service = customerRecoveryService(prisma, (to, code) => sendMail({ to, ...customerPasswordOtpEmail(code) }));
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  try { customerRegistrationSameOrigin(req); } catch { return json({ error: "Invalid request origin." }, 403); }
  const ip = clientIp(req);
  const limit = await consumeOrReject(operations, `recovery:${ip}`);
  if (!limit.ok) return json({ error: "Too many attempts. Try again later.", retryAfter: limit.retrySecs }, 429);
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Check your email, six-digit code, or password (6–72 characters, at most 72 UTF-8 bytes)." }, 400);
  const input = parsed.data;
  try {
    if (input.action === "request") {
      for (const key of [`ip:${ip}`, `email:${hashResetToken(input.email)}`]) {
        const limited = await consumeOrReject(requests, key);
        if (!limited.ok) return json({ error: "Too many reset requests. Try again later.", retryAfter: limited.retrySecs }, 429);
      }
      if (!isMailConfigured() || !process.env.NEXTAUTH_SECRET) return json({ error: "Password recovery email is unavailable. Please contact support." }, 503);
      // Check for every valid address so provider outages do not disclose account existence.
      if (!await verifyMailTransport()) return json({ error: "Password recovery email is temporarily unavailable. Please try again later." }, 503);
      return json(await service.request(input.email));
    }
    if (input.action === "verify") return json({ ok: true, authorization: await service.verify(input.challengeId, input.code) });
    if (input.password !== input.confirm) return json({ error: "Passwords do not match." }, 400);
    const customer = await service.reset(input.authorization, input.password);
    // Notification delivery cannot undo a committed password update.
    try { await sendMail({ to: customer.email, ...passwordChangedEmail(customer.name) }); } catch { console.error("Password change notification unavailable."); }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof RecoveryError) return json({ error: error.message }, 400);
    // Do not serialize Prisma errors, account records, authorizations or mail bodies.
    console.error("Password recovery operation unavailable.");
    return json({ error: "Password recovery is temporarily unavailable. Please try again later." }, 503);
  }
}
