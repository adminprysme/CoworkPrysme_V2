import { describe, expect, it } from "vitest";

import {
  hashClientAccountActivationToken,
  isClientAccountActivationTokenFormat,
  issueClientAccountActivationToken,
  activationTokenMatchesHash,
} from "./activation-token.js";

const SECRET = "activation-secret-at-least-32-chars!!";
const OTHER = "other-activation-secret-32chars-min!";

describe("client account activation token", () => {
  it("issues opaque 64-char hex token + hash (invite pattern)", () => {
    const issued = issueClientAccountActivationToken(SECRET);
    expect(issued.rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(isClientAccountActivationTokenFormat(issued.rawToken)).toBe(true);
    expect(issued.tokenHash).toBe(hashClientAccountActivationToken(issued.rawToken, SECRET));
  });

  it("does not collide across secrets", () => {
    const raw = "c".repeat(64);
    expect(hashClientAccountActivationToken(raw, SECRET)).not.toBe(
      hashClientAccountActivationToken(raw, OTHER),
    );
  });

  it("verifies with timing-safe compare", () => {
    const { rawToken, tokenHash } = issueClientAccountActivationToken(SECRET);
    expect(activationTokenMatchesHash(rawToken, tokenHash, SECRET)).toBe(true);
    expect(activationTokenMatchesHash("d".repeat(64), tokenHash, SECRET)).toBe(false);
  });
});
