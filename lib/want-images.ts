/** Wants currently store one reference photo (`Want.photo`); expose it as a list so galleries handle more later. */
export function wantImages(want: { photo?: string | null }) {
  return want.photo ? [want.photo] : [];
}
