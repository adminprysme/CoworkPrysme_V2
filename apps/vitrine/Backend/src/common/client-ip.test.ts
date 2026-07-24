import { describe, expect, it } from "vitest";

import { clientIpFromRequest } from "./client-ip.js";

describe("clientIpFromRequest", () => {
  it("returns IPv4 from req.ip", () => {
    expect(clientIpFromRequest({ ip: "203.0.113.10" } as never)).toBe("203.0.113.10");
  });

  it("unwraps IPv4-mapped IPv6", () => {
    expect(clientIpFromRequest({ ip: "::ffff:203.0.113.10" } as never)).toBe("203.0.113.10");
  });

  it("returns IPv6", () => {
    expect(clientIpFromRequest({ ip: "2001:db8::1" } as never)).toBe("2001:db8::1");
  });

  it("returns undefined when missing or invalid (accept must not fail)", () => {
    expect(clientIpFromRequest({} as never)).toBeUndefined();
    expect(clientIpFromRequest({ ip: "" } as never)).toBeUndefined();
    expect(clientIpFromRequest({ ip: "not-an-ip" } as never)).toBeUndefined();
    expect(clientIpFromRequest({ ip: "   " } as never)).toBeUndefined();
  });
});
