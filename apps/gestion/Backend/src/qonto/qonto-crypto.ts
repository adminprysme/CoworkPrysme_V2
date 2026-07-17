import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT = "coworkprysme-qonto-oauth-v1";
const KEY_LEN = 32;

function deriveKey(keyMaterial: string): Buffer {
  return scryptSync(keyMaterial, SALT, KEY_LEN);
}

/** Encrypt a secret with AES-256-GCM. Output: iv.tag.ciphertext (base64url). */
export function encryptSecret(plaintext: string, keyMaterial: string): string {
  const key = deriveKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string, keyMaterial: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Invalid encrypted secret payload");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveKey(keyMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
