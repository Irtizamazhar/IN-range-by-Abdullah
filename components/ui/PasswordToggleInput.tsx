"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export type PasswordToggleInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type"
>;

/**
 * Password field with show/hide (eye) toggle. Add right padding on the input (e.g. pr-10 / pr-11) so text does not sit under the button.
 */
export function PasswordToggleInput({
  className = "",
  ...props
}: PasswordToggleInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? (
          <EyeOff className="h-[18px] w-[18px]" aria-hidden />
        ) : (
          <Eye className="h-[18px] w-[18px]" aria-hidden />
        )}
      </button>
    </div>
  );
}
