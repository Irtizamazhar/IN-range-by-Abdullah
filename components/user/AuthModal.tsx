"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  X,
} from "lucide-react";
import { getSession, signIn, signOut } from "next-auth/react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import toast from "react-hot-toast";
import { LogoMark } from "@/components/user/LogoMark";

export type AuthModalView = "login" | "signup" | "forgot";

export type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "login" | "signup";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<
  Record<
    | "loginEmail"
    | "loginPass"
    | "suName"
    | "suPhone"
    | "suEmail"
    | "suPass"
    | "forgotEmail",
    string
  >
>;

const transition = { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const };

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white py-0 pl-10 pr-4 text-sm text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 focus:border-primaryBlue focus:ring-2 focus:ring-primaryBlue/25";

const inputPasswordClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white py-0 pl-10 pr-11 text-sm text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 focus:border-primaryBlue focus:ring-2 focus:ring-primaryBlue/25";

function AuthField({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
        aria-hidden
      />
      {children}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="relative my-5 flex items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 h-px bg-gray-200" aria-hidden />
      <span className="relative bg-white px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
        or
      </span>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, initialTab = "login" }: AuthModalProps) {
  const titleId = useId();
  const [view, setView] = useState<AuthModalView>(initialTab);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [suName, setSuName] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPass, setSuPass] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  const clearErrors = useCallback(() => setErrors({}), []);

  useEffect(() => {
    if (!isOpen) return;
    setView(initialTab === "signup" ? "signup" : "login");
    clearErrors();
    setShowPassword(false);
  }, [isOpen, initialTab, clearErrors]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const headerCopy = useMemo(() => {
    switch (view) {
      case "login":
        return {
          title: "Welcome Back!",
          subtitle: "Sign in to your account",
        };
      case "signup":
        return {
          title: "Create Account",
          subtitle: "Join us to shop & track orders",
        };
      default:
        return {
          title: "Reset password",
          subtitle: "Enter your email and we’ll send you a reset link",
        };
    }
  }, [view]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    const next: Errors = {};
    const em = loginEmail.trim();
    if (!em) next.loginEmail = "Email is required";
    else if (!EMAIL_RE.test(em)) next.loginEmail = "Enter a valid email";
    if (!loginPass) next.loginPass = "Password is required";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const res = await signIn("credentials", {
        email: em,
        password: loginPass,
        redirect: false,
      });
      if (res?.error) {
        toast.error("Invalid email or password");
        return;
      }
      const s = await getSession();
      if (s?.user?.role === "admin") {
        await signOut({ redirect: false });
        toast.error(
          "That account is for admin. Please create a customer account to shop."
        );
        return;
      }
      if (s?.user?.role !== "customer") {
        toast.error("Sign-in failed. Try again.");
        return;
      }
      toast.success("Welcome back!");
      setLoginPass("");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    const next: Errors = {};
    if (!suName.trim()) next.suName = "Full name is required";
    if (!suPhone.trim()) next.suPhone = "Phone number is required";
    const em = suEmail.trim();
    if (!em) next.suEmail = "Email is required";
    else if (!EMAIL_RE.test(em)) next.suEmail = "Enter a valid email";
    if (!suPass) next.suPass = "Password is required";
    else if (suPass.length < 6)
      next.suPass = "Password must be at least 6 characters";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suName.trim(),
          email: em,
          password: suPass,
          phone: suPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sign-up failed");
        return;
      }
      toast.success("Account created. Signing you in…");
      const res2 = await signIn("credentials", {
        email: em,
        password: suPass,
        redirect: false,
      });
      if (res2?.error) {
        toast.error("Account created. Please sign in manually.");
        setView("login");
        setLoginEmail(em);
        return;
      }
      const s3 = await getSession();
      if (s3?.user?.role !== "customer") {
        toast.error("Could not verify session. Please sign in.");
        setView("login");
        setLoginEmail(em);
        return;
      }
      setSuPass("");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();
    const em = forgotEmail.trim();
    const next: Errors = {};
    if (!em) next.forgotEmail = "Email is required";
    else if (!EMAIL_RE.test(em)) next.forgotEmail = "Enter a valid email";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        return;
      }
      toast.success(data.message || "Check your inbox for next steps.");
      setView("login");
      setLoginEmail(em);
    } finally {
      setBusy(false);
    }
  }

  const primaryBtnClass =
    "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primaryBlue text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-darkBlue disabled:pointer-events-none disabled:opacity-55";
  const socialBtnClass =
    "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-primaryBlue/25 bg-white text-sm font-semibold text-primaryBlue shadow-sm transition duration-200 hover:bg-primaryBlue/5 disabled:pointer-events-none disabled:opacity-55";

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[100dvh] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[min(92dvh,880px)]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={transition}
          >
            {/* Brand header */}
            <div className="relative min-h-[140px] shrink-0 bg-gradient-to-br from-darkBlue to-primaryBlue px-6 py-8 text-center text-white">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white transition-opacity duration-200 hover:opacity-80"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.25} />
              </button>

              <div className="mx-auto mb-4 flex justify-center">
                <LogoMark
                  href={null}
                  compact
                  className="justify-center [&_img]:h-10 [&_img]:max-h-10 [&_img]:w-auto [&_img]:brightness-0 [&_img]:invert"
                />
              </div>
              <h2
                id={titleId}
                className="text-xl font-bold tracking-tight text-white sm:text-2xl"
              >
                {headerCopy.title}
              </h2>
              <p className="mt-1.5 text-sm font-normal text-white/90">
                {headerCopy.subtitle}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-6 py-6">
              <AnimatePresence mode="wait" initial={false}>
                {view === "login" ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={transition}
                  >
                    <form onSubmit={(e) => void onLogin(e)} className="space-y-4">
                      <AuthField icon={Mail}>
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="Email"
                          value={loginEmail}
                          onChange={(e) => {
                            setLoginEmail(e.target.value);
                            if (errors.loginEmail)
                              setErrors((o) => ({ ...o, loginEmail: undefined }));
                          }}
                          className={inputClass}
                        />
                      </AuthField>
                      {errors.loginEmail ? (
                        <p className="-mt-2 text-xs text-red-600">
                          {errors.loginEmail}
                        </p>
                      ) : null}

                      <AuthField icon={Lock}>
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Password"
                          value={loginPass}
                          onChange={(e) => {
                            setLoginPass(e.target.value);
                            if (errors.loginPass)
                              setErrors((o) => ({ ...o, loginPass: undefined }));
                          }}
                          className={inputPasswordClass}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-[18px] w-[18px]" />
                          ) : (
                            <Eye className="h-[18px] w-[18px]" />
                          )}
                        </button>
                      </AuthField>
                      {errors.loginPass ? (
                        <p className="-mt-2 text-xs text-red-600">
                          {errors.loginPass}
                        </p>
                      ) : null}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          className="text-xs font-medium text-primaryBlue transition-opacity hover:opacity-80"
                          onClick={() => {
                            setView("forgot");
                            clearErrors();
                          }}
                        >
                          Forgot password?
                        </button>
                      </div>

                      <button type="submit" disabled={busy} className={primaryBtnClass}>
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : null}
                        Log in
                      </button>
                    </form>

                    <OrDivider />
                    <button
                      type="button"
                      className={socialBtnClass}
                      onClick={() =>
                        void signIn("google", {
                          callbackUrl:
                            typeof window !== "undefined"
                              ? window.location.pathname + window.location.search
                              : "/",
                        }, {
                          prompt: "select_account",
                        })
                      }
                    >
                      <GoogleIcon className="h-5 w-5" />
                      Sign in with Google
                    </button>

                    <p className="text-center text-sm text-gray-600">
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        className="font-semibold text-primaryBlue hover:underline"
                        onClick={() => {
                          setView("signup");
                          clearErrors();
                        }}
                      >
                        Sign up
                      </button>
                    </p>
                  </motion.div>
                ) : null}

                {view === "signup" ? (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={transition}
                  >
                    <form onSubmit={(e) => void onSignup(e)} className="space-y-4">
                      {(
                        [
                          {
                            key: "suName",
                            icon: User,
                            type: "text",
                            autoComplete: "name" as const,
                            placeholder: "Full name",
                            value: suName,
                            set: setSuName,
                          },
                          {
                            key: "suPhone",
                            icon: Phone,
                            type: "tel",
                            autoComplete: "tel" as const,
                            placeholder: "Phone number",
                            value: suPhone,
                            set: setSuPhone,
                          },
                          {
                            key: "suEmail",
                            icon: Mail,
                            type: "email",
                            autoComplete: "email" as const,
                            placeholder: "Email",
                            value: suEmail,
                            set: setSuEmail,
                          },
                        ] as const
                      ).map((f) => (
                        <div key={f.key}>
                          <AuthField icon={f.icon}>
                            <input
                              type={f.type}
                              autoComplete={f.autoComplete}
                              placeholder={f.placeholder}
                              value={f.value}
                              onChange={(e) => {
                                f.set(e.target.value);
                                const k = f.key as keyof Errors;
                                if (errors[k])
                                  setErrors((o) => ({ ...o, [k]: undefined }));
                              }}
                              className={inputClass}
                            />
                          </AuthField>
                          {errors[f.key as keyof Errors] ? (
                            <p className="mt-1 text-xs text-red-600">
                              {errors[f.key as keyof Errors]}
                            </p>
                          ) : null}
                        </div>
                      ))}

                      <AuthField icon={Lock}>
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Password (min. 6 characters)"
                          value={suPass}
                          onChange={(e) => {
                            setSuPass(e.target.value);
                            if (errors.suPass)
                              setErrors((o) => ({ ...o, suPass: undefined }));
                          }}
                          className={inputPasswordClass}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-[18px] w-[18px]" />
                          ) : (
                            <Eye className="h-[18px] w-[18px]" />
                          )}
                        </button>
                      </AuthField>
                      {errors.suPass ? (
                        <p className="mt-1 text-xs text-red-600">{errors.suPass}</p>
                      ) : null}

                      <button type="submit" disabled={busy} className={primaryBtnClass}>
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : null}
                        Create account
                      </button>
                    </form>

                    <OrDivider />
                    <button
                      type="button"
                      className={socialBtnClass}
                      onClick={() =>
                        void signIn("google", {
                          callbackUrl:
                            typeof window !== "undefined"
                              ? window.location.pathname + window.location.search
                              : "/",
                        }, {
                          prompt: "select_account",
                        })
                      }
                    >
                      <GoogleIcon className="h-5 w-5" />
                      Sign in with Google
                    </button>

                    <p className="text-center text-sm text-gray-600">
                      Already have an account?{" "}
                      <button
                        type="button"
                        className="font-semibold text-primaryBlue hover:underline"
                        onClick={() => {
                          setView("login");
                          clearErrors();
                        }}
                      >
                        Log in
                      </button>
                    </p>
                  </motion.div>
                ) : null}

                {view === "forgot" ? (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={transition}
                  >
                    <form onSubmit={(e) => void onForgot(e)} className="space-y-4">
                      <AuthField icon={Mail}>
                        <input
                          type="email"
                          autoComplete="email"
                          placeholder="Email"
                          value={forgotEmail}
                          onChange={(e) => {
                            setForgotEmail(e.target.value);
                            if (errors.forgotEmail)
                              setErrors((o) => ({ ...o, forgotEmail: undefined }));
                          }}
                          className={inputClass}
                        />
                      </AuthField>
                      {errors.forgotEmail ? (
                        <p className="-mt-2 text-xs text-red-600">
                          {errors.forgotEmail}
                        </p>
                      ) : null}

                      <button type="submit" disabled={busy} className={primaryBtnClass}>
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : null}
                        Send reset link
                      </button>

                      <button
                        type="button"
                        className="w-full pt-1 text-center text-sm font-medium text-gray-500 transition-colors hover:text-primaryBlue"
                        onClick={() => {
                          setView("login");
                          clearErrors();
                        }}
                      >
                        ← Back to log in
                      </button>
                    </form>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
