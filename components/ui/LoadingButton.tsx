"use client";

import { forwardRef, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { actionErrorMessage } from "@/lib/action-feedback";
import { useFormPending } from "./LoadingForm";
import styles from "./LoadingControl.module.css";

export type LoadingButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown;
  loading?: boolean;
  loadingLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  children?: ReactNode;
};

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(function LoadingButton({
  onClick, loading = false, loadingLabel = "Loading…", successMessage, errorMessage,
  disabled, children, className = "", style, ...props
}, forwardedRef) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const lock = useRef(false);
  const [ownPending, setOwnPending] = useState(false);
  const form = useFormPending();
  const pending = loading || ownPending || (form.pending && form.submitter === ref.current);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const idleSize = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (pending) {
      setSize(idleSize.current);
      return;
    }
    setSize(null);
    const measure = () => { const box = node.getBoundingClientRect(); idleSize.current = { width: box.width, height: box.height }; };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pending]);

  async function click(event: MouseEvent<HTMLButtonElement>) {
    if (lock.current || pending || disabled) { event.preventDefault(); return; }
    if (!onClick) return;
    lock.current = true;
    const box = event.currentTarget.getBoundingClientRect();
    idleSize.current = { width: box.width, height: box.height };
    try {
      const result = onClick(event);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        setSize(idleSize.current);
        setOwnPending(true);
        await result;
        if (successMessage) toast.success(successMessage);
      }
    } catch (error) {
      toast.error(actionErrorMessage(error, errorMessage));
    } finally {
      lock.current = false;
      setOwnPending(false);
    }
  }

  const lockedStyle: CSSProperties = pending && size ? { width: size.width, minWidth: size.width, maxWidth: size.width, height: size.height, minHeight: size.height, maxHeight: size.height } : {};
  const iconOnly = !!props["aria-label"] && (size?.width ?? idleSize.current?.width ?? 100) < 76;

  return <button {...props} ref={node => {
    ref.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }} onClick={click} disabled={disabled || pending} aria-busy={pending || undefined}
    aria-label={pending ? loadingLabel : props["aria-label"]}
    data-loading={pending ? "true" : undefined}
    className={`${styles.control} ${className}`} style={{ ...style, ...lockedStyle }}>
    <span className={`${styles.content} ${pending ? styles.hidden : ""}`} aria-hidden={pending || undefined}>{children}</span>
    {pending && <span className={styles.indicator} aria-hidden="true"><span className={styles.spinner} />{!iconOnly && <span className={styles.label}>{loadingLabel}</span>}</span>}
    <span className={styles.srOnly} role="status" aria-live="polite">{pending ? loadingLabel : ""}</span>
  </button>;
});
