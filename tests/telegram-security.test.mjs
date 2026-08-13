import assert from "node:assert/strict";
import test from "node:test";

import {
  createTelegramLinkToken,
  isValidTelegramSecret,
  secretsMatch,
  verifyTelegramLinkToken,
} from "../src/lib/telegram-security.ts";

const secret = "telegram_secret_1234567890_secure";
const otherSecret = "different_secret_1234567890_secure";
const userId = "9c218d21-2ea2-48d2-9948-d5d55e6fa3a5";
const issuedAt = new Date("2026-08-13T00:00:00.000Z");

test("accepts configured Telegram secrets and compares them safely", () => {
  assert.equal(isValidTelegramSecret(secret), true);
  assert.equal(isValidTelegramSecret("too-short"), false);
  assert.equal(isValidTelegramSecret("invalid secret with spaces that is long enough"), false);
  assert.equal(secretsMatch(secret, secret), true);
  assert.equal(secretsMatch(secret, otherSecret), false);
  assert.equal(secretsMatch(secret, null), false);
});

test("creates and verifies an unexpired user-bound link token", () => {
  const token = createTelegramLinkToken(userId, secret, {
    now: issuedAt,
    ttlSeconds: 900,
  });

  assert.equal(
    verifyTelegramLinkToken(token, secret, {
      now: new Date("2026-08-13T00:14:59.000Z"),
    }),
    userId,
  );
});

test("rejects expired, tampered, and incorrectly signed link tokens", () => {
  const token = createTelegramLinkToken(userId, secret, {
    now: issuedAt,
    ttlSeconds: 900,
  });
  const [payload, signature] = token.split(".");

  assert.equal(
    verifyTelegramLinkToken(token, secret, {
      now: new Date("2026-08-13T00:15:00.000Z"),
    }),
    null,
  );
  assert.equal(verifyTelegramLinkToken(token, otherSecret, { now: issuedAt }), null);
  assert.equal(
    verifyTelegramLinkToken(`${payload}a.${signature}`, secret, { now: issuedAt }),
    null,
  );
  assert.equal(verifyTelegramLinkToken(userId, secret, { now: issuedAt }), null);
  assert.equal(
    verifyTelegramLinkToken(Buffer.from(userId).toString("base64"), secret, {
      now: issuedAt,
    }),
    null,
  );
});
