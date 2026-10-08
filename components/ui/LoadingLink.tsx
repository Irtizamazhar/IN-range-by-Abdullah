"use client";

import NextLink from "next/link";
import { forwardRef, useRef, useState, type ComponentProps, type MouseEvent } from "react";
import { formatUrl } from "next/dist/shared/lib/router/utils/format-url";
import toast from "react-hot-toast";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { actionErrorMessage } from "@/lib/action-feedback";
import styles from "./LoadingControl.module.css";

type LoadingLinkProps = ComponentProps<typeof NextLink> & { loadingLabel?: string; onNavigateComplete?: () => void };

/** Native Link semantics (prefetch, modified clicks, downloads, hashes) stay intact. */
const LoadingLink = forwardRef<HTMLAnchorElement, LoadingLinkProps>(function LoadingLink({
  children, className = "", loadingLabel = "Loading…", onClick, onNavigateComplete, style, ...props
}, forwardedRef) {
  const router = useLoadingRouter();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  async function click(event: MouseEvent<HTMLAnchorElement>) {
    if (locked.current) { event.preventDefault(); return; }
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.download || (props.target && props.target !== "_self")) return;
    const rawHref = props.as || props.href;
    const href = typeof rawHref === "string" ? rawHref : formatUrl(rawHref);
    const target = new URL(href, window.location.href);
    // A fragment jump, unchanged URL, or external destination is not a data transition.
    if (target.origin !== window.location.origin) return;
    if (target.pathname === window.location.pathname && target.search === window.location.search) { onNavigateComplete?.(); return; }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    locked.current = true;
    setPending(true);
    try {
      await (props.replace ? router.replace(href, { scroll: props.scroll }) : router.push(href, { scroll: props.scroll }));
      onNavigateComplete?.();
    }
    catch (error) { toast.error(actionErrorMessage(error, "Could not open this page. Please try again.")); }
    finally { locked.current = false; setPending(false); setSize(null); }
  }

  return <NextLink {...props} ref={forwardedRef} onClick={click} className={`${styles.control} ${className}`}
    style={{ ...style, ...(pending && size ? { width: size.width, minWidth: size.width, height: size.height, minHeight: size.height } : {}) }}
    aria-busy={pending || undefined} aria-disabled={pending || undefined} aria-label={pending ? loadingLabel : props["aria-label"]} data-loading={pending ? "true" : undefined}>
    <span className={`${styles.content} ${pending ? styles.hidden : ""}`} aria-hidden={pending || undefined}>{children}</span>
    {pending && <span className={styles.indicator} aria-hidden="true"><span className={styles.spinner} />{(size?.width ?? 0) >= 76 && <span className={styles.label}>{loadingLabel}</span>}</span>}
    <span className={styles.srOnly} role="status" aria-live="polite">{pending ? loadingLabel : ""}</span>
  </NextLink>;
});

export { LoadingLink };
export default LoadingLink;
