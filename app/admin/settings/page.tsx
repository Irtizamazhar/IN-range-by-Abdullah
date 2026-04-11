"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { ISettings } from "@/types/settings";

type BankSlotKey = "meezanBank" | "hbl" | "easypaisa" | "jazzCash";
const WALLET_SEP = "||";

function parseWalletValue(raw: string, fallbackName: string) {
  const val = (raw || "").trim();
  if (!val || val === "—") return { name: "", holder: "", number: "" };
  if (!val.includes(WALLET_SEP)) {
    return { name: fallbackName, holder: "", number: val };
  }

  const parts = val.split(WALLET_SEP).map((p) => (p || "").trim());
  const [namePart, holderPart, numberPart] = parts;

  // Backward compatible:
  // - "BankName||Number"
  // - "BankName||HolderName||Number"
  if (parts.length === 2) {
    return {
      name: (namePart || "").trim() || fallbackName,
      holder: "",
      number: (holderPart || "").trim(),
    };
  }

  return {
    name: (namePart || "").trim() || fallbackName,
    holder: (holderPart || "").trim(),
    number: (numberPart || "").trim(),
  };
}

function packWalletValue(name: string, holder: string, number: string) {
  const n = name.trim();
  const h = holder.trim();
  const m = number.trim();
  if (!n && !h && !m) return "";
  if (!h) {
    // Backward format: BankName||Number
    return `${n}${WALLET_SEP}${m}`;
  }
  return `${n}${WALLET_SEP}${h}${WALLET_SEP}${m}`;
}

export default function AdminSettingsPage() {
  const [s, setS] = useState<ISettings | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleBankSlots, setVisibleBankSlots] = useState<BankSlotKey[]>([]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: ISettings) => {
        setS(data);
        const slots: BankSlotKey[] = ["meezanBank", "hbl", "easypaisa", "jazzCash"];
        const filled = slots.filter((slot) => {
          if (slot === "meezanBank" || slot === "hbl") {
            const pair = data.bankAccounts[slot];
            return (
              !!pair.accountTitle &&
              pair.accountTitle !== "—"
            );
          }
          const wallet = data.bankAccounts[slot];
          const parsed = parseWalletValue(
            wallet.mobileNumber,
            slot === "easypaisa" ? "EasyPaisa" : "JazzCash"
          );
          return !!parsed.number;
        });
        setVisibleBankSlots(filled.length ? filled : ["meezanBank"]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !s) {
    return <div className="p-8 text-darkText/50">Loading…</div>;
  }

  const b = s.bankAccounts;

  function clearSlot(slot: BankSlotKey) {
    if (!s) return;
    if (slot === "meezanBank" || slot === "hbl") {
      setS({
        ...s,
        bankAccounts: {
          ...s.bankAccounts,
          [slot]: { accountTitle: "", accountNumber: "" },
        },
      });
      return;
    }
    setS({
      ...s,
      bankAccounts: {
        ...s.bankAccounts,
        [slot]: { mobileNumber: "" },
      },
    });
  }

  function addBankSlot() {
    const order: BankSlotKey[] = ["meezanBank", "hbl", "easypaisa", "jazzCash"];
    const next = order.find((slot) => !visibleBankSlots.includes(slot));
    if (!next) {
      toast.error("Maximum 4 bank accounts can be configured");
      return;
    }
    setVisibleBankSlots((prev) => [...prev, next]);
  }

  function removeBankSlot(slot: BankSlotKey) {
    clearSlot(slot);
    setVisibleBankSlots((prev) => prev.filter((x) => x !== slot));
  }

  function addCity() {
    if (!s) return;
    const c = cityInput.trim();
    if (!c) return;
    if (s.codAvailableCities.includes(c)) return;
    setS({
      ...s,
      codAvailableCities: [...s.codAvailableCities, c],
    });
    setCityInput("");
  }

  function removeCity(c: string) {
    if (!s) return;
    setS({
      ...s,
      codAvailableCities: s.codAvailableCities.filter((x) => x !== c),
    });
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!res.ok) {
        toast.error("Could not save settings");
        return;
      }
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-darkText">Settings</h1>
      </div>

      <section className="rounded-card border border-borderGray bg-white p-6 shadow-card space-y-4">
        <h2 className="font-bold text-lg">Shop</h2>
        <input
          className="w-full rounded-xl border border-borderGray px-4 py-2"
          value={s.shopName}
          onChange={(e) => setS({ ...s, shopName: e.target.value })}
        />
        <div>
          <label className="text-sm font-medium">WhatsApp number</label>
          <input
            className="mt-1 w-full rounded-xl border border-borderGray px-4 py-2"
            value={s.whatsappNumber}
            onChange={(e) => setS({ ...s, whatsappNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium">COD charges (PKR)</label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-xl border border-borderGray px-4 py-2"
            value={s.codCharges}
            onChange={(e) =>
              setS({ ...s, codCharges: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
      </section>

      <section className="rounded-card border border-borderGray bg-white p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-lg">Bank Accounts</h2>
          <button
            type="button"
            onClick={addBankSlot}
            className="rounded-lg bg-primaryBlue px-3 py-1.5 text-xs font-semibold text-white"
          >
            Add bank account
          </button>
        </div>
        <p className="text-xs text-darkText/60">
          You can configure up to 4 accounts (Meezan, HBL, EasyPaisa, JazzCash).
        </p>

        {visibleBankSlots.map((slot) => {
          const title =
            slot === "meezanBank"
              ? "Meezan Bank"
              : slot === "hbl"
                ? "HBL"
                : slot === "easypaisa"
                  ? "EasyPaisa"
                  : "JazzCash";
          const isPair = slot === "meezanBank" || slot === "hbl";

          return (
            <div key={slot} className="rounded-xl border border-borderGray p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{title}</h3>
                <button
                  type="button"
                  onClick={() => removeBankSlot(slot)}
                  className="text-xs font-semibold text-red-600"
                >
                  Remove
                </button>
              </div>

              {isPair ? (
                <>
                  <input
                    className="w-full rounded-xl border border-borderGray px-4 py-2"
                    placeholder="Bank name"
                    value={slot === "meezanBank" ? b.meezanBank.accountTitle : b.hbl.accountTitle}
                    onChange={(e) =>
                      setS({
                        ...s,
                        bankAccounts: {
                          ...s.bankAccounts,
                          [slot]: {
                            ...(slot === "meezanBank" ? b.meezanBank : b.hbl),
                            accountTitle: e.target.value,
                          },
                        },
                      })
                    }
                  />
                  <input
                    className="w-full rounded-xl border border-borderGray px-4 py-2"
                    placeholder="Account number"
                    value={slot === "meezanBank" ? b.meezanBank.accountNumber : b.hbl.accountNumber}
                    onChange={(e) =>
                      setS({
                        ...s,
                        bankAccounts: {
                          ...s.bankAccounts,
                          [slot]: {
                            ...(slot === "meezanBank" ? b.meezanBank : b.hbl),
                            accountNumber: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </>
              ) : (
                (() => {
                  const parsed = parseWalletValue(
                    slot === "easypaisa" ? b.easypaisa.mobileNumber : b.jazzCash.mobileNumber,
                    slot === "easypaisa" ? "EasyPaisa" : "JazzCash"
                  );
                  return (
                    <>
                      <input
                        className="w-full rounded-xl border border-borderGray px-4 py-2"
                        placeholder="Bank name"
                        value={parsed.name}
                        onChange={(e) => {
                          const mobileNumber = packWalletValue(
                            e.target.value,
                            parsed.holder,
                            parsed.number
                          );
                          setS({
                            ...s,
                            bankAccounts: {
                              ...s.bankAccounts,
                              [slot]: { mobileNumber },
                            },
                          });
                        }}
                      />
                      <input
                        className="w-full rounded-xl border border-borderGray px-4 py-2"
                        placeholder="Account holder name"
                        value={parsed.holder}
                        onChange={(e) => {
                          const mobileNumber = packWalletValue(
                            parsed.name,
                            e.target.value,
                            parsed.number
                          );
                          setS({
                            ...s,
                            bankAccounts: {
                              ...s.bankAccounts,
                              [slot]: { mobileNumber },
                            },
                          });
                        }}
                      />
                      <input
                        className="w-full rounded-xl border border-borderGray px-4 py-2"
                        placeholder="Mobile number"
                        value={parsed.number}
                        onChange={(e) => {
                          const mobileNumber = packWalletValue(
                            parsed.name,
                            parsed.holder,
                            e.target.value
                          );
                          setS({
                            ...s,
                            bankAccounts: {
                              ...s.bankAccounts,
                              [slot]: { mobileNumber },
                            },
                          });
                        }}
                      />
                    </>
                  );
                })()
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-card border border-borderGray bg-white p-6 shadow-card space-y-4">
        <h2 className="font-bold text-lg">COD cities</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-borderGray px-4 py-2"
            placeholder="City name"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())}
          />
          <button
            type="button"
            onClick={addCity}
            className="rounded-xl bg-primaryYellow px-4 py-2 font-semibold text-white"
          >
            Add
          </button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {s.codAvailableCities.map((c) => (
            <li
              key={c}
              className="flex items-center gap-1 rounded-full bg-lightGray px-3 py-1 text-sm"
            >
              {c}
              <button
                type="button"
                className="text-red-600 font-bold ml-1"
                onClick={() => removeCity(c)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-primaryBlue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
