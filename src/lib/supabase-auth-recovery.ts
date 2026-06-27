import { AuthApiError } from "@supabase/supabase-js";

export const AUTH_SESSION_RESTORE_TIMEOUT_MS = 8000;

export function isSupabaseAuthStorageKey(key: string) {
  return key.startsWith("sb-") || key.includes("auth-token");
}

export function clearSupabaseAuthStorage() {
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);

    if (key && isSupabaseAuthStorageKey(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
}

export function isRecoverableSupabaseAuthError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { message?: string; name?: string };
  const message = candidate.message?.toLowerCase() ?? "";

  return (
    error instanceof AuthApiError ||
    candidate.name === "AuthApiError" ||
    message.includes("refresh token") ||
    message.includes("invalid_grant") ||
    message.includes("refresh_token") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout")
  );
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("Supabase session restore timeout"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}
