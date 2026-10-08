"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatPakistanCnicInput, MAX_PAKISTAN_CNIC_LENGTH } from "@/lib/pakistan-cnic";

type CnicInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function CnicInput({ value, onValueChange, onKeyDown, onPaste, ...props }: CnicInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    if (selection && document.activeElement === inputRef.current) {
      inputRef.current?.setSelectionRange(selection.start, selection.end);
    }
  }, [selection, value]);

  function updateInput(input: HTMLInputElement) {
    const raw = input.value;
    const formatted = formatPakistanCnicInput(raw);
    // Track the entered characters so inserting dashes never moves the caret to the end.
    const mapPosition = (position: number) => {
      if (formatted === raw) return position;
      const characters = raw.slice(0, position).replace(/[ -]/g, "").length;
      if (!characters) return 0;
      let count = 0;
      for (let index = 0; index < formatted.length; index++) {
        if (formatted[index] !== " " && formatted[index] !== "-" && ++count === characters) {
          return index + 1;
        }
      }
      return formatted.length;
    };
    setSelection({
      start: mapPosition(input.selectionStart ?? raw.length),
      end: mapPosition(input.selectionEnd ?? raw.length),
    });
    onValueChange(formatted);
  }

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={MAX_PAKISTAN_CNIC_LENGTH}
      value={value}
      onChange={event => updateInput(event.currentTarget)}
      onPaste={event => {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        const input = event.currentTarget;
        if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
          // Format a full pasted replacement before enforcing its digit limit.
          event.preventDefault();
          const pasted = formatPakistanCnicInput(event.clipboardData.getData("text"));
          if (pasted.length > MAX_PAKISTAN_CNIC_LENGTH) return;
          input.setRangeText(pasted, 0, input.value.length, "end");
          updateInput(input);
        }
      }}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        const input = event.currentTarget;
        const position = input.selectionStart;
        if (position === null || position !== input.selectionEnd) return;
        // Delete the adjacent digit instead of getting stuck on an automatic separator.
        if (event.key === "Backspace" && input.value[position - 1] === "-") {
          input.setSelectionRange(position - 1, position - 1);
        }
        if (event.key === "Delete" && input.value[position] === "-") {
          input.setSelectionRange(position + 1, position + 1);
        }
      }}
    />
  );
}
