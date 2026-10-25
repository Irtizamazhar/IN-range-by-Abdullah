/** A Want can carry up to this many reference photos. */
export const MAX_WANT_PHOTOS = 5;

/**
 * All reference photos of a Want, in order. `photos` holds the full list; older Wants only have `photo`,
 * which always mirrors the first entry so single-image cards keep working.
 */
export function wantImages(want: { photo?: string | null; photos?: unknown }) {
  const list = Array.isArray(want.photos) ? want.photos.filter((p): p is string => typeof p === "string" && p.length > 0) : [];
  if (list.length) return list.slice(0, MAX_WANT_PHOTOS);
  return want.photo ? [want.photo] : [];
}
