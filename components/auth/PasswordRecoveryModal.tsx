"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, LockKeyhole, Mail, Smartphone, X } from "lucide-react";
import { PasswordToggleInput } from "@/components/ui/PasswordToggleInput";
import styles from "./PasswordRecoveryModal.module.css";

type Step = "email" | "otp" | "password" | "success";
type Reply = { challengeId?: string; authorization?: string; retryAfter?: number; error?: string; message?: string };

export function PasswordRecoveryModal({ initialEmail = "", onClose }: { initialEmail?: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [challengeId, setChallengeId] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);
  const lock = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const node = dialog.current!.parentElement!;
    const siblings = Array.from(document.body.children).filter(child => child !== node) as HTMLElement[];
    const previousInert = siblings.map(child => child.inert);
    const previousHidden = siblings.map(child => child.getAttribute("aria-hidden"));
    siblings.forEach(child => { child.inert = true; child.setAttribute("aria-hidden", "true"); });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!lock.current) close.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      siblings.forEach((child, index) => {
        child.inert = previousInert[index];
        const hidden = previousHidden[index];
        if (hidden === null) child.removeAttribute("aria-hidden"); else child.setAttribute("aria-hidden", hidden);
      });
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (busy) return;
    if (step === "otp") otpInputs.current[0]?.focus();
    else if (step === "email") dialog.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
    else if (step === "password") dialog.current?.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')?.focus();
    else dialog.current?.focus();
  }, [step, busy]);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [deadline]);

  async function call(payload: object): Promise<Reply> {
    const response = await fetch("/api/customer/password-recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
    const data = await response.json() as Reply;
    if (!response.ok) {
      if (data.retryAfter) setDeadline(Date.now() + data.retryAfter * 1000);
      throw new Error(data.error || "Could not complete your request. Try again.");
    }
    return data;
  }

  async function requestCode() {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 255) throw new Error("Enter a valid email address.");
    const data = await call({ action: "request", email: normalized });
    if (!data.challengeId) throw new Error("Could not start recovery. Try again later.");
    setEmail(normalized); setChallengeId(data.challengeId); setAuthorization(""); setDigits(Array(6).fill(""));
    setDeadline(Date.now() + (data.retryAfter || 60) * 1000); setNotice(data.message || ""); setStep("otp");
    otpInputs.current[0]?.focus();
  }

  async function run(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await operation(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reach the server. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (step === "email") return requestCode();
      if (step === "otp") {
        const code = digits.join("");
        if (!/^\d{6}$/.test(code)) throw new Error("Enter all six digits.");
        const data = await call({ action: "verify", challengeId, code });
        if (!data.authorization) throw new Error("Verification could not be completed.");
        setAuthorization(data.authorization); setNotice(""); setDigits(Array(6).fill("")); setStep("password");
        return;
      }
      if (password.length < 6 || password.length > 72 || new TextEncoder().encode(password).length > 72) throw new Error("Use 6–72 characters and at most 72 UTF-8 bytes.");
      if (password !== confirm) throw new Error("Passwords do not match.");
      await call({ action: "reset", authorization, password, confirm });
      setPassword(""); setConfirm(""); setAuthorization(""); setStep("success");
    });
  }

  function back() {
    if (busy) return;
    setError(""); setNotice(""); setPassword(""); setConfirm("");
    // Verification consumes the OTP: going back starts a fresh email challenge.
    setAuthorization(""); setStep("email");
  }

  const titles = { email: "Reset Password", otp: "Enter OTP", password: "Set New Password", success: "Password Updated!" };
  const Icon = step === "email" ? Mail : step === "otp" ? Smartphone : step === "password" ? LockKeyhole : Check;
  const [local, domain = ""] = email.split("@");
  const maskedEmail = `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${domain.includes(".") ? domain.slice(domain.lastIndexOf(".")) : ""}`;

  return createPortal(<div className={styles.overlay} onPointerDown={event => { if (event.target === event.currentTarget && !lock.current) onClose(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={busy} tabIndex={-1} className={`${styles.card} ${step === "success" ? styles.success : ""}`}>
      <button type="button" aria-label="Close password recovery" disabled={busy} className={styles.close} onClick={onClose}><X aria-hidden="true" size={20} /></button>
      <div className={styles.icon}><Icon aria-hidden="true" size={30} strokeWidth={step === "success" ? 3 : 1.7} /></div>
      <h2 id={`${id}-title`}>{titles[step]}</h2>
      <p id={`${id}-description`} className={styles.description}>{step === "email" ? "Enter your email address and we'll send you a 6-digit verification code to reset your password." : step === "otp" ? <>If this email is eligible, a 6-digit verification code will be sent to <strong className={styles.email}>{maskedEmail}</strong></> : step === "password" ? "Create a new password for your account." : "Your password has been successfully updated. You can now sign in with your new password."}</p>
      {error && <p role="alert" id={`${id}-error`} className={styles.error}>{error}</p>}
      {step === "success" ? <button type="button" className={styles.primary} onClick={onClose}>Go to Sign In</button> : <form onSubmit={submit} noValidate>
        <fieldset disabled={busy}>
          {step === "email" && <div className={styles.field}><label htmlFor={`${id}-email`}>Email Address</label><div className={styles.inputWrap}><Mail aria-hidden="true" size={18}/><input id={`${id}-email`} type="email" autoComplete="email" placeholder="Enter your registered email" value={email} onChange={event => setEmail(event.target.value)} maxLength={255} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} /></div></div>}
          {step === "otp" && <><div role="group" aria-label="Six-digit verification code" className={styles.otp} onPaste={event => { const code = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); if (code) { event.preventDefault(); setDigits(Array.from(code.padEnd(6, " ")).map(value => value.trim())); otpInputs.current[Math.min(code.length, 5)]?.focus(); } }}>
            {digits.map((digit, index) => <input key={index} ref={node => { otpInputs.current[index] = node; }} aria-label={`Digit ${index + 1}`} inputMode="numeric" pattern="[0-9]*" autoComplete={index === 0 ? "one-time-code" : "off"} value={digit} onChange={event => { const code = event.target.value.replace(/\D/g, ""); if (code.length > 1) { const updated = [...digits]; Array.from(code.slice(0, 6 - index)).forEach((value, offset) => { updated[index + offset] = value; }); setDigits(updated); otpInputs.current[Math.min(index + code.length, 5)]?.focus(); } else { setDigits(previous => previous.map((value, offset) => offset === index ? code : value)); if (code && index < 5) otpInputs.current[index + 1]?.focus(); } }} onFocus={event => event.target.select()} onKeyDown={event => { if (event.key === "Backspace" && !digit && index > 0) { event.preventDefault(); setDigits(previous => previous.map((value, offset) => offset === index - 1 ? "" : value)); otpInputs.current[index - 1]?.focus(); } else if (event.key === "ArrowLeft" && index > 0) { event.preventDefault(); otpInputs.current[index - 1]?.focus(); } else if (event.key === "ArrowRight" && index < 5) { event.preventDefault(); otpInputs.current[index + 1]?.focus(); } }} />)}
          </div><div className={styles.resend}>{remaining > 0 ? <>Resend OTP in <strong>{`${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`}</strong></> : <button type="button" onClick={() => void run(requestCode)}>Resend OTP</button>}</div></>}
          {step === "password" && <>{(["password", "confirm"] as const).map(name => <div className={styles.field} key={name}><label htmlFor={`${id}-${name}`}>{name === "password" ? "New Password" : "Confirm New Password"}</label><div className={styles.passwordWrap}><LockKeyhole aria-hidden="true" size={18}/><PasswordToggleInput id={`${id}-${name}`} autoComplete="new-password" value={name === "password" ? password : confirm} onChange={event => (name === "password" ? setPassword : setConfirm)(event.target.value)} maxLength={72} disabled={busy} className={styles.passwordInput}/></div></div>)}<p className={styles.hint}>Use at least 6 characters (maximum 72 UTF-8 bytes).</p></>}
          <button type="submit" className={styles.primary}>{busy ? (step === "email" ? "Sending..." : step === "otp" ? "Verifying..." : "Resetting...") : step === "email" ? "Send OTP" : step === "otp" ? "Next" : "Reset Password"}</button>
          <button type="button" className={styles.secondary} onClick={step === "email" ? onClose : back}>{step === "email" ? "Cancel" : "Back"}</button>
        </fieldset>
      </form>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
    </section>
  </div>, document.body);
}
