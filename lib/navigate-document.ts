/** For authentication boundaries that deliberately need a fresh document. */
export function navigateDocument(href: string, replace = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const complete = () => resolve();
    window.addEventListener("pagehide", complete, { once: true });
    try {
      if (replace) window.location.replace(href);
      else window.location.assign(href);
    } catch (error) {
      window.removeEventListener("pagehide", complete);
      reject(error);
    }
  });
}
