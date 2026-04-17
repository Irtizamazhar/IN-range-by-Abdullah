/** Client-only: pre-fill vendor login when user chose "Remember me". */
export const VENDOR_LOGIN_REMEMBER_EMAIL_KEY = "inrange_vendor_login_email";
export const VENDOR_LOGIN_REMEMBER_FLAG_KEY = "inrange_vendor_remember_me";

export function saveVendorLoginRememberPrefs(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const e = email.trim().toLowerCase();
    localStorage.setItem(VENDOR_LOGIN_REMEMBER_EMAIL_KEY, e);
    localStorage.setItem(VENDOR_LOGIN_REMEMBER_FLAG_KEY, "1");
  } catch {
    /* private mode / quota */
  }
}

export function clearVendorLoginRememberPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(VENDOR_LOGIN_REMEMBER_EMAIL_KEY);
    localStorage.removeItem(VENDOR_LOGIN_REMEMBER_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function loadVendorLoginRememberPrefs(): {
  email: string;
  rememberMe: boolean;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const flag = localStorage.getItem(VENDOR_LOGIN_REMEMBER_FLAG_KEY);
    const email = localStorage.getItem(VENDOR_LOGIN_REMEMBER_EMAIL_KEY);
    if (flag !== "1" || !email?.trim()) return null;
    return { email: email.trim().toLowerCase(), rememberMe: true };
  } catch {
    return null;
  }
}
