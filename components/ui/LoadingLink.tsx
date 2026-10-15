"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentProps, type MouseEvent } from "react";

type LoadingLinkProps = ComponentProps<typeof NextLink> & { loadingLabel?: string; onNavigateComplete?: () => void };

/** Keep native Next.js link navigation and close transient menus on activation. */
const LoadingLink = forwardRef<HTMLAnchorElement, LoadingLinkProps>(function LoadingLink({
  onClick, onNavigateComplete, loadingLabel: _loadingLabel, ...props
}, ref) {
  void _loadingLabel; // Accepted for existing call sites; navigation no longer shows link loaders.
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      onNavigateComplete?.();
    }
  }

  return <NextLink {...props} ref={ref} onClick={click} />;
});

export { LoadingLink };
export default LoadingLink;
