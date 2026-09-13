export function customerOwnsRecord(
  recordCustomerId: string | null | undefined,
  sessionCustomerId: string | null | undefined
): boolean {
  return Boolean(
    recordCustomerId &&
      sessionCustomerId &&
      recordCustomerId === sessionCustomerId
  );
}
