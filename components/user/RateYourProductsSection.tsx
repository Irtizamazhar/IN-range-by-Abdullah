"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export type RateProductLine = {
  productId?: string | null;
  name: string;
  image: string;
};

function isLocalImg(src: string) {
  return src.startsWith("/api/") || src.startsWith("/uploads/");
}

export function RateYourProductsSection({
  parentOrderId,
  lines,
}: {
  parentOrderId: string;
  lines: RateProductLine[];
}) {
  const { data: session, status } = useSession();
  const { openAuthModal } = useCustomerAuth();
  const isCustomer = session?.user?.role === "customer";

  const withPid = useMemo(
    () => lines.filter((l) => l.productId && String(l.productId).trim()),
    [lines]
  );

  const [reviewedMap, setReviewedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!parentOrderId || status !== "authenticated" || !isCustomer) {
      setReviewedMap({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const results = await Promise.all(
        withPid.map(async (line) => {
          const pid = String(line.productId);
          try {
            const r = await fetch(
              `/api/reviews/check/${encodeURIComponent(parentOrderId)}/${encodeURIComponent(pid)}`,
              { credentials: "include" }
            );
            if (!r.ok) return [pid, false] as const;
            const d = (await r.json()) as { reviewed?: boolean };
            return [pid, !!d.reviewed] as const;
          } catch {
            return [pid, false] as const;
          }
        })
      );

      if (cancelled) return;
      setReviewedMap(Object.fromEntries(results));
    })();

    return () => {
      cancelled = true;
    };
  }, [parentOrderId, isCustomer, status, withPid]);

  if (!parentOrderId.trim() || !withPid.length) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <h2 className="mb-3 text-base font-bold text-emerald-800">Rate Your Products</h2>
      <p className="mb-4 text-xs text-darkText/65">
        Share feedback on items from this order. One review per product per order.
      </p>
      <div className="space-y-3">
        {withPid.map((line) => {
          const pid = String(line.productId);
          const href = `/products/${encodeURIComponent(pid)}?orderId=${encodeURIComponent(parentOrderId)}#review`;
          const reviewed = reviewedMap[pid] === true;

          return (
            <div
              key={`${parentOrderId}-${line.name}-${pid}`}
              className="flex gap-3 rounded-xl border border-borderGray bg-white p-3 shadow-sm"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-lightGray">
                {line.image ? (
                  <Image
                    src={line.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized={isLocalImg(line.image)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-darkText/40">
                    No img
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-darkText line-clamp-2">{line.name}</p>
                <p className="mt-1 text-xs tracking-tight text-[#FFC400]" aria-hidden>
                  {"★".repeat(5)}
                </p>
                {reviewed ? (
                  <button
                    type="button"
                    disabled
                    className="mt-2 cursor-not-allowed rounded-lg bg-emerald-100 px-4 py-2 text-xs font-bold text-emerald-800"
                  >
                    ✅ Reviewed
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="mt-2 inline-block rounded-lg bg-[#F57224] px-4 py-2 text-xs font-bold text-white hover:bg-[#e06520]"
                  >
                    Write a Review
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {status === "unauthenticated" ? (
        <p className="mt-3 text-xs text-darkText/60">
          <button
            type="button"
            onClick={() => openAuthModal("login")}
            className="font-semibold text-primaryBlue hover:underline"
          >
            Sign in
          </button>{" "}
          with the email used at checkout to attach reviews to your account.
        </p>
      ) : null}
    </div>
  );
}
