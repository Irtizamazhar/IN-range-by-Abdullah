"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Heart } from "lucide-react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export function StoreFollowButton({
  vendorId,
  initialFollowing,
  initialFollowers,
}: {
  vendorId: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const { openAuthModal } = useCustomerAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const response = await fetch(`/api/stores/${vendorId}/follow`, {
        method: following ? "DELETE" : "POST",
      });
      if (response.status === 401) {
        openAuthModal("login");
        return;
      }
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return toast.error(data.error || "Could not update follow");
      setFollowing((value) => !value);
      setFollowers((value) => Math.max(0, value + (following ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
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
