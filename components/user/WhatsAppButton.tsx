"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppButton({
  number,
  className = "",
  label,
}: {
  number: string;
  className?: string;
  label?: string;
}) {
  const n = number.replace(/\D/g, "");
  const href = `https://wa.me/${n}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-white font-medium shadow-md hover:opacity-95 ${className}`}
    >
      <MessageCircle className="h-5 w-5" />
      {label ?? "WhatsApp"}
    </a>
  );
}

export function WhatsAppIconLink({
  number,
  className = "",
}: {
  number: string;
  className?: string;
}) {
  const n = number.replace(/\D/g, "");
  return (
    <a
      href={`https://wa.me/${n}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex text-primaryBlue hover:text-darkBlue ${className}`}
      aria-label="WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}

export function WhatsAppFloat({ number }: { number: string }) {
  const n = number.replace(/\D/g, "");
  return (
    <a
      href={`https://wa.me/${n}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 md:bottom-[30px] md:right-[30px]"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}
