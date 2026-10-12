let locks = 0;
let saved: { html: string; body: string; padding: string } | null = null;

/**
 * Locks page scroll while a modal is open. `html` has `overflow-x: hidden` in globals.css, which makes
 * <html> (not <body>) the page scroller, so both elements must be locked. Returns the matching unlock.
 */
export function lockPageScroll() {
  if (locks++ === 0) {
    const { documentElement: html, body } = document;
    saved = { html: html.style.overflow, body: body.style.overflow, padding: body.style.paddingRight };
    const scrollbar = window.innerWidth - html.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    html.style.overflow = "hidden"; body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return; released = true;
    if (--locks === 0 && saved) {
      document.documentElement.style.overflow = saved.html; document.body.style.overflow = saved.body; document.body.style.paddingRight = saved.padding; saved = null;
    }
  };
}
