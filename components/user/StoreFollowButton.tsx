"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Heart } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export function StoreFollowButton({
  vendorId,
  initialFollowing = false,
  initialFollowers,
}: {
  vendorId: string;
  initialFollowing?: boolean;
  initialFollowers: number;
}) {
  const { isCustomer, openAuthModal, authLoading } = useCustomerAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!isCustomer) { openAuthModal("login"); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/stores/${vendorId}/follow`, {
        method: following ? "DELETE" : "PUT",
      });
      const data = (await response.json()) as { error?: string; following?: boolean; followers?: number };
      if (!response.ok) return toast.error(data.error || "Could not update follow");
      setFollowing(!!data.following);
      setFollowers(typeof data.followers === "number" ? data.followers : followers);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || authLoading}
      onClick={() => void toggle()}
      aria-pressed={following}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60 ${
        following
          ? "border border-brand-primary bg-brand-soft text-brand-dark"
          : "bg-brand-primary text-brand-dark hover:bg-brand-hover"
      }`}
    >
      <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />
      {following ? "Following" : "Follow"} · {followers}
    </button>
  );
}
