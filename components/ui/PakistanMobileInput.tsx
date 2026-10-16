"use client";

import { forwardRef, useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatPakistanNational, mobileCaretPosition, pakistanMobileStorageValue } from "@/lib/pakistan-mobile-input";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "maxLength"> & {
  value: string;
  onValueChange: (value: string) => void;
  wrapperClassName?: string;
};

export const PakistanMobileInput = forwardRef<HTMLInputElement, Props>(function PakistanMobileInput({ value, onValueChange, className = "", wrapperClassName = "", onKeyDown, onPaste, ...props }, forwardedRef) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selection = useRef<number | null>(null);
  const display = formatPakistanNational(value);
  useLayoutEffect(() => {
    if (selection.current !== null && document.activeElement === inputRef.current) inputRef.current?.setSelectionRange(selection.current, selection.current);
    selection.current = null;
  });
  function edit(raw: string, position: number) {
    const formatted = formatPakistanNational(raw);
    const digits = raw.replace(/\D/g, "");
    const removed = digits.startsWith("0092") ? 4 : digits.startsWith("92") ? 2 : digits.startsWith("0") ? 1 : 0;
    selection.current = mobileCaretPosition(formatted, Math.max(0, raw.slice(0, position).replace(/\D/g, "").length - Math.max(0, removed)));
    onValueChange(pakistanMobileStorageValue(raw));
  }
  return <span className={`flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-neutral-300 bg-white font-normal focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-100 ${wrapperClassName}`}>
    <span aria-hidden="true" className="flex shrink-0 items-center border-r border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-600">+92</span>
    <input {...props} ref={node => { inputRef.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} type="tel" inputMode="numeric" autoComplete={props.autoComplete || "tel-national"} value={display} placeholder="300-1234567" maxLength={11} pattern="3[0-9]{2}-[0-9]{7}" className={`h-12 w-full min-w-0 bg-transparent px-3 text-base outline-none ${className} !m-0 !rounded-none !border-0 !pl-3 !ring-0`} onChange={event => edit(event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onPaste={event => {
      onPaste?.(event); if (event.defaultPrevented) return;
      const input = event.currentTarget;
      const pasted = event.clipboardData.getData("text").trim();
      if (!/^[+\d\s()-]+$/.test(pasted) || pasted.startsWith("+") && !pasted.startsWith("+92")) { event.preventDefault(); return; }
      // Only a full-number paste may replace a trunk/country prefix.
      if (input.value === "" || input.selectionStart === 0 && input.selectionEnd === input.value.length || /^(?:\+92|0092|92|03)/.test(pasted.replace(/[ -]/g, ""))) {
        event.preventDefault();
        const next = formatPakistanNational(pasted);
        selection.current = next.length;
        onValueChange(pakistanMobileStorageValue(pasted));
      }
    }} onKeyDown={event => {
      onKeyDown?.(event); if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const input = event.currentTarget, at = input.selectionStart;
      if (at === null || at !== input.selectionEnd) return;
      if (event.key === "Backspace" && input.value[at - 1] === "-") input.setSelectionRange(at - 1, at - 1);
      if (event.key === "Delete" && input.value[at] === "-") input.setSelectionRange(at + 1, at + 1);
    }} />
  </span>;
});
