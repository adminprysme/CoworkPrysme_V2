import { type ArgumentsHost, HttpStatus } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ZodValidationExceptionFilter } from "./zod-validation.exception-filter.js";

describe("ZodValidationExceptionFilter", () => {
  it("returns 400 with structured validation errors", () => {
    const schema = z.object({ durationClass: z.enum(["hourly", "daily"]) });
    let zodError: z.ZodError | null = null;

    try {
      schema.parse({ durationClass: "halfday" });
    } catch (error) {
      zodError = error as z.ZodError;
    }

    expect(zodError).toBeInstanceOf(z.ZodError);

    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ZodValidationExceptionFilter().catch(zodError!, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["durationClass"],
            message: expect.any(String),
          }),
        ]),
      }),
    );
  });
});
