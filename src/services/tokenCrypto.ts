import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env.js";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

function getKey(): Buffer | null {
  const raw = env.PLAID_ACCESS_TOKEN_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("PLAID_ACCESS_TOKEN_KEY must be 32 bytes (base64-encoded).");
  }
  return buf;
}

export function encryptPlaidAccessToken(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, enc]);
  return `${PREFIX}${packed.toString("base64")}`;
}

export function decryptPlaidAccessToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const key = getKey();
  if (!key) {
    throw new Error(
      "Encrypted Plaid token in DB but PLAID_ACCESS_TOKEN_KEY is not set. Set the key or re-link the bank."
    );
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
