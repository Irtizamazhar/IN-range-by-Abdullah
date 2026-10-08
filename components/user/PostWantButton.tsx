"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { usePostWant } from "@/context/PostWantContext";

type PostWantButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { initialTitle?: string };

export const PostWantButton = forwardRef<HTMLButtonElement, PostWantButtonProps>(function PostWantButton({ initialTitle, onClick, type = "button", ...props }, ref) {
  const { openPostWant } = usePostWant();
  return <button {...props} ref={ref} type={type} aria-haspopup="dialog" data-post-want-trigger="true" onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented) openPostWant(initialTitle);
  }} />;
});
