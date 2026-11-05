import { cache } from "react";
/** Next's RSC runtime supplies request memoization; plain Node/route runtimes stay uncached. */
export function requestCache<Args extends unknown[], Result>(read: (...args: Args) => Result): (...args: Args) => Result {
  return typeof cache === "function" ? cache(read) : read;
}
