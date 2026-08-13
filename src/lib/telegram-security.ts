import { createHmac, timingSafeEqual } from "node:crypto";

const LINK_TOKEN_AUDIENCE = "rumahbudget-telegram-link";
const LINK_TOKEN_VERSION = 1;
const DEFAULT_LINK_TOKEN_TTL_SECONDS = 15 * 60;
const MAX_LINK_TOKEN_TTL_SECONDS = 60 * 60;

type TelegramLinkTokenPayload = {
  aud: typeof LINK_TOKEN_AUDIENCE;
  exp: number;
  iat: number;
  sub: string;
  v: typeof LINK_TOKEN_VERSION;
};

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signEncodedPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`telegram-link-v1.${encodedPayload}`)
    .digest("base64url");
}

export function isValidTelegramSecret(
  secret: string | undefined,
): secret is string {
  return Boolean(secret && /^[A-Za-z0-9_-]{32,256}$/.test(secret));
}

export function secretsMatch(expected: string, actual: string | null) {
  if (!actual) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export function createTelegramLinkToken(
  userId: string,
  secret: string,
  options: { now?: Date; ttlSeconds?: number } = {},
) {
  if (!userId) {
    throw new Error("Telegram link token requires a user ID.");
  }
  if (!isValidTelegramSecret(secret)) {
    throw new Error("Telegram link token secret is missing or invalid.");
  }

  const ttlSeconds = options.ttlSeconds ?? DEFAULT_LINK_TOKEN_TTL_SECONDS;
  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds <= 0 ||
    ttlSeconds > MAX_LINK_TOKEN_TTL_SECONDS
  ) {
    throw new Error("Telegram link token TTL is invalid.");
  }

  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const payload: TelegramLinkTokenPayload = {
    aud: LINK_TOKEN_AUDIENCE,
    exp: issuedAt + ttlSeconds,
    iat: issuedAt,
    sub: userId,
    v: LINK_TOKEN_VERSION,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signEncodedPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyTelegramLinkToken(
  token: string,
  secret: string,
  options: { now?: Date } = {},
) {
  if (!isValidTelegramSecret(secret)) {
    return null;
  }

  const [encodedPayload, suppliedSignature, extraPart] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extraPart) {
    return null;
  }

  const expectedSignature = signEncodedPayload(encodedPayload, secret);
  if (!secretsMatch(expectedSignature, suppliedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<TelegramLinkTokenPayload>;
    const now = Math.floor((options.now ?? new Date()).getTime() / 1000);

    if (
      payload.aud !== LINK_TOKEN_AUDIENCE ||
      payload.v !== LINK_TOKEN_VERSION ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      (payload.iat as number) > now ||
      (payload.exp as number) <= now ||
      (payload.exp as number) - (payload.iat as number) >
        MAX_LINK_TOKEN_TTL_SECONDS
    ) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}
