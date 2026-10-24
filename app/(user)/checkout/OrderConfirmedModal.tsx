"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useLoadingRouter } from "@/hooks/useLoadingRouter";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatPKR } from "@/lib/format";
import type { CheckoutReceipt } from "@/lib/checkout-response";
import styles from "./Confirmation.module.css";

export function OrderConfirmedModal({ order }: { order: CheckoutReceipt }) {
  const router = useLoadingRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const navigating = useRef(false);
  const [error, setError] = useState("");
  const destination = `/account/orders/${encodeURIComponent(order._id)}`;

  const done = useCallback(async () => {
    if (navigating.current) return;
    navigating.current = true;
    setError("");
    try { await router.replace(destination); }
    catch {
      navigating.current = false;
      setError("Your order is confirmed. Please tap Done to open its details.");
    }
  }, [destination, router]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => { void done(); }, 3000);
    return () => {
      window.clearTimeout(timer);
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [done]);

  return <main className={styles.page}>
    <dialog ref={dialog} className={styles.card} aria-labelledby="order-confirmed-title" aria-describedby="order-confirmed-description" onCancel={event => { event.preventDefault(); void done(); }}>
      <span className={styles.check} aria-hidden="true"><Check strokeWidth={3} /></span>
      <h1 id="order-confirmed-title" className={styles.heading}>Order confirmed!</h1>
      <p id="order-confirmed-description" className={styles.subheading}>Thank you! Your order has been placed successfully.</p>
      <div className={styles.orderPanel}>
        <p className={styles.label}>Order number</p>
        <p className={styles.orderNumber}>{order.orderNumber}</p>
        {order.totalAmount != null && <p className={styles.total}>Order total <strong>{formatPKR(order.totalAmount)}</strong></p>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <LoadingButton type="button" onClick={done} loadingLabel="Opening your order..." className={styles.done}>Done</LoadingButton>
      <p className={styles.redirect}>{error ? "Your order is saved." : "Opening your order details in 3 seconds..."}</p>
    </dialog>
  </main>;
}
