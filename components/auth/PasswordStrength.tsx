"use client";

export function PasswordStrength({ password, minLength = 6 }: { password: string; minLength?: number }) {
  const score = Number(password.length >= minLength) + Number(password.length >= 10) +
    Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) +
    Number(/\d/.test(password)) + Number(/[!@#$%^&*(),.?":{}|<>\[\]_-]/.test(password));
  const level = !password || password.length < minLength || score < 3 ? 1 : score < 5 ? 2 : 3;
  const labels = ["Weak", "Medium", "Strong"] as const;
  const colors = ["bg-amber-500", "bg-emerald-600", "bg-lime-500"] as const;
  const label = password ? labels[level - 1] : "Enter a password";

  return <div className="space-y-1.5 text-xs text-emerald-950" aria-live="polite">
    <div className="flex justify-between gap-2"><span>Password strength: <strong>{label}</strong></span></div>
    <div role="progressbar" aria-label="Password strength" aria-valuemin={0} aria-valuemax={3} aria-valuenow={password ? level : 0} aria-valuetext={label} className="h-1.5 overflow-hidden rounded-full bg-emerald-100">
      <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${colors[level - 1]}`} style={{ width: password ? `${level * 100 / 3}%` : "0%" }} />
    </div>
    <p className="text-neutral-500">Use at least {minLength} characters; add uppercase, numbers, and symbols for a stronger password.</p>
  </div>;
}
