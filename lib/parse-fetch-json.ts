/**
 * Read fetch Response body without throwing on empty or invalid JSON.
 */
export async function safeParseResponseJson<T extends Record<string, unknown>>(
  r: Response
): Promise<{ data: T; parseError: boolean }> {
  const raw = await r.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    return { data: {} as T, parseError: false };
  }
  try {
    return { data: JSON.parse(trimmed) as T, parseError: false };
  } catch {
    return {
      data: { error: `Invalid response (${r.status})` } as unknown as T,
      parseError: true,
    };
  }
}
