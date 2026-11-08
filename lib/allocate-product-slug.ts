import { slugBase } from "@/lib/catalog-urls";
import { randomUUID } from "node:crypto";
/** Assigned once; the unique index also protects concurrent creation. */
export function newProductSlug(name: string): string {
  return slugBase(name) + "-" + randomUUID().replace(/-/g, "").slice(0, 16);
}
