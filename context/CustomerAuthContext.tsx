"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { signOut, useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { AuthModal } from "@/components/user/AuthModal";
import { CustomerProfileModal } from "@/components/user/CustomerProfileModal";

type Tab = "signup" | "login";

type CustomerAuthContextValue = {
  openAuthModal: (tab?: Tab) => void;
  closeAuthModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  requireCustomer: (action: () => void, tab?: Tab) => void;
  isCustomer: boolean;
  authLoading: boolean;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(
  null
);

function formatMemberSince(iso: string | undefined | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function CustomerAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("signup");
  const [profileOpen, setProfileOpen] = useState(false);

  const [pfName, setPfName] = useState("");
  const [pfPhone, setPfPhone] = useState("");
  const [pfEmail, setPfEmail] = useState("");
  const [memberSinceIso, setMemberSinceIso] = useState<string | null>(null);
  const [profileLoad, setProfileLoad] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const isCustomer = session?.user?.role === "customer";
  const authLoading = status === "loading";

  const openAuthModal = useCallback((t: Tab = "signup") => {
    setTab(t);
    setOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setOpen(false);
  }, []);

  const closeProfileModal = useCallback(() => {
    setProfileOpen(false);
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoad(true);
    try {
      const res = await fetch("/api/customer/profile");
      const data = (await res.json()) as {
        error?: string;
        name?: string;
        phone?: string;
        email?: string;
        createdAt?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Could not load profile");
        closeProfileModal();
        return;
      }
      setPfName(data.name || "");
      setPfPhone(data.phone || "");
      setPfEmail(data.email || "");
      setMemberSinceIso(data.createdAt ?? null);
    } catch {
      toast.error("Could not load profile");
      closeProfileModal();
    } finally {
      setProfileLoad(false);
    }
  }, [closeProfileModal]);

  const handleOpenProfile = useCallback(() => {
    setProfileOpen(true);
    void loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = useCallback(async () => {
    const name = pfName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: pfPhone.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        name?: string;
        phone?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Could not save");
        return;
      }
      await update({
        name: data.name,
        phone: data.phone ?? "",
      });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save");
    } finally {
      setProfileSaving(false);
    }
  }, [pfName, pfPhone, update]);

  const requireCustomer = useCallback(
    (action: () => void, preferTab: Tab = "signup") => {
      if (authLoading) return;
      if (session?.user?.role === "customer") {
        action();
        return;
      }
      openAuthModal(preferTab);
    },
    [session, authLoading, openAuthModal]
  );

  const value = useMemo(
    () => ({
      openAuthModal,
      closeAuthModal,
      openProfileModal: handleOpenProfile,
      closeProfileModal,
      requireCustomer,
      isCustomer,
      authLoading,
    }),
    [
      openAuthModal,
      closeAuthModal,
      handleOpenProfile,
      closeProfileModal,
      requireCustomer,
      isCustomer,
      authLoading,
    ]
  );

  const memberSinceLabel = formatMemberSince(memberSinceIso);

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={open}
        onClose={closeAuthModal}
        initialTab={tab}
      />

      <CustomerProfileModal
        isOpen={profileOpen && isCustomer}
        onClose={closeProfileModal}
        displayName={session?.user?.name || pfName}
        name={pfName}
        setName={setPfName}
        phone={pfPhone}
        setPhone={setPfPhone}
        email={pfEmail}
        memberSinceLabel={memberSinceLabel}
        loading={profileLoad}
        saving={profileSaving}
        onSave={handleSaveProfile}
        onLogout={() => {
          closeProfileModal();
          void signOut({ callbackUrl: "/" });
        }}
      />
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }
  return ctx;
}
