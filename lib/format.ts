export function formatPKR(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `Rs. ${n.toLocaleString("en-PK")}`;
}
