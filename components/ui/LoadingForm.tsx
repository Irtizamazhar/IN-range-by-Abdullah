"use client";

import { createContext, forwardRef, useContext, useRef, useState, type FormEvent, type FormHTMLAttributes } from "react";
import toast from "react-hot-toast";
import { actionErrorMessage } from "@/lib/action-feedback";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import styles from "./LoadingControl.module.css";

const FormPendingContext = createContext<{ pending: boolean; submitter: HTMLElement | null }>({ pending: false, submitter: null });
export const useFormPending = () => useContext(FormPendingContext);

type LoadingFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => unknown;
  errorMessage?: string;
};

export const LoadingForm = forwardRef<HTMLFormElement, LoadingFormProps>(function LoadingForm({ onSubmit, children, errorMessage, ...props }, ref) {
  const locked = useRef(false);
  const router = useLoadingRouter();
  const [state, setState] = useState<{ pending: boolean; submitter: HTMLElement | null }>({ pending: false, submitter: null });

  async function submit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const navigateGet = !onSubmit && form.method.toLowerCase() === "get" && (!form.target || form.target === "_self") && new URL(form.action).origin === window.location.origin;
    if (!onSubmit && !navigateGet) return;
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    const submitter = (event.nativeEvent as SubmitEvent).submitter
      ?? form.querySelector<HTMLButtonElement>('button[type="submit"]:not(:disabled), button:not([type]):not(:disabled), input[type="submit"]:not(:disabled)');
    try {
      let result: unknown;
      if (onSubmit) result = onSubmit(event);
      else {
        const url = new URL(form.action);
        url.search = "";
        new FormData(form, submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined).forEach((value, key) => url.searchParams.append(key, typeof value === "string" ? value : value.name));
        result = router.push(`${url.pathname}${url.search}${url.hash}`);
      }
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        setState({ pending: true, submitter });
        await result;
      }
    } catch (error) {
      toast.error(actionErrorMessage(error, errorMessage));
    } finally {
      locked.current = false;
      setState({ pending: false, submitter: null });
    }
  }

  return <FormPendingContext.Provider value={state}>
    <form {...props} ref={ref} onSubmit={submit} aria-busy={state.pending || undefined}>{children}</form>
    <span className={styles.srOnly} role="status" aria-live="polite">{state.pending ? "Submitting form. Please wait." : ""}</span>
  </FormPendingContext.Provider>;
});
