import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./qonto-crypto.js";

describe("qonto-crypto", () => {
  it("round-trips plaintext", () => {
    const key = "k".repeat(32);
    const encrypted = encryptSecret("refresh-token-value", key);
    expect(encrypted).not.toContain("refresh-token-value");
    expect(decryptSecret(encrypted, key)).toBe("refresh-token-value");
  });

  it("rejects tampered ciphertext", () => {
    const key = "k".repeat(32);
    const encrypted = encryptSecret("secret", key);
    const tampered = `${encrypted.slice(0, -4)}xxxx`;
    expect(() => decryptSecret(tampered, key)).toThrow();
  });
});
