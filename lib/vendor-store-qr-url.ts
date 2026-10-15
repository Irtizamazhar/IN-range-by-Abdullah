/** Stable public address for printed vendor QR cards. Store slugs remain editable. */
export function vendorStoreQrUrl(vendorId: string): string {
  if (!vendorId || !/^[a-zA-Z0-9_-]+$/.test(vendorId)) throw new Error("Invalid vendor ID");
  return `https://joro.pk/stores/${encodeURIComponent(vendorId)}`;
}
