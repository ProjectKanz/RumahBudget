const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLivingAccountIds(value: unknown): string[] {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (accountId) =>
        typeof accountId !== "string" || !UUID_PATTERN.test(accountId),
    )
  ) {
    return [];
  }

  return [...new Set(parsed)];
}

export function getLivingAccountStorageKey(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("User ID is required for living-account preferences.");
  }

  return `rumahbudget.livingAccountIds.${normalizedUserId}`;
}
