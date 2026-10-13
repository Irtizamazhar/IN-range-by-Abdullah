"use client";

import { Eye, EyeOff, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./ComingSoonGate.module.css";

type GateLoginModalProps = {
  onClose: () => void;
};

export function GateLoginModal({ onClose }: GateLoginModalProps) {
  const [gateEmail, setGateEmail] = useState("");
  const [gatePassword, setGatePassword] = useState("");
  const [showGatePassword, setShowGatePassword] = useState(false);
  const [gateError, setGateError] = useState("");
  const [gateSubmitting, setGateSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Credentials are verified on the server, which sets an HttpOnly preview
  // session cookie; reloading lets middleware serve the real page.
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (gateSubmitting) return;
    if (!gateEmail.trim() || !gatePassword) {
      setGateError("Enter your email and password.");
      return;
    }

    setGateError("");
    setGateSubmitting(true);
    try {
      const res = await fetch("/api/preview-access/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: gateEmail, password: gatePassword }),
        credentials: "same-origin",
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setGateError(data?.error || "Invalid email or password.");
    } catch {
      setGateError("Could not reach the server. Please try again.");
    }
    setGatePassword("");
    setGateSubmitting(false);
  };

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="joro-cs-modal-title"
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>

        <div className={styles.modalIcon} aria-hidden="true">
          <Lock />
        </div>
        <h2 id="joro-cs-modal-title" className={styles.modalTitle}>
          Team access
        </h2>
        <p className={styles.modalSubtitle}>
          For authorized JORO team members only.
        </p>

        <form
          id="joro-cs-gate-form"
          className={styles.modalForm}
          onSubmit={handleSubmit}
          noValidate
          autoComplete="off"
        >
          <label className={styles.field} htmlFor="joro-cs-gate-email">
            <span className={styles.fieldLabel}>Email</span>
            <input
              ref={emailRef}
              id="joro-cs-gate-email"
              name="joroCsGateEmail"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="you@example.com"
              className={styles.fieldInput}
              value={gateEmail}
              onChange={(event) => {
                setGateEmail(event.target.value);
                if (gateError) setGateError("");
              }}
              aria-invalid={gateError ? true : undefined}
            />
          </label>

          <label className={styles.field} htmlFor="joro-cs-gate-password">
            <span className={styles.fieldLabel}>Password</span>
            <span className={styles.passwordWrap}>
              <input
                id="joro-cs-gate-password"
                name="joroCsGatePassword"
                type={showGatePassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${styles.fieldInput} ${styles.fieldInputWithToggle}`}
                value={gatePassword}
                onChange={(event) => {
                  setGatePassword(event.target.value);
                  if (gateError) setGateError("");
                }}
                aria-invalid={gateError ? true : undefined}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowGatePassword((value) => !value)}
                aria-label={showGatePassword ? "Hide password" : "Show password"}
              >
                {showGatePassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </span>
          </label>

          {gateError && (
            <p className={styles.error} role="alert">
              {gateError}
            </p>
          )}

          <button
            type="submit"
            id="joro-cs-gate-submit"
            className={styles.submitButton}
            disabled={gateSubmitting}
          >
            {gateSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
