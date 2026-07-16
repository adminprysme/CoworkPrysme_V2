import { afterEach, describe, expect, it } from "vitest";

import { resolveBookingNotificationRecipients } from "./resolve-booking-notification-recipients.js";

describe("resolveBookingNotificationRecipients", () => {
  const previous = process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL;
    } else {
      process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL = previous;
    }
  });

  it("returns an empty list when no fallback is configured", async () => {
    delete process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL;
    await expect(resolveBookingNotificationRecipients("507f1f77bcf86cd799439012")).resolves.toEqual(
      [],
    );
  });

  it("returns the temporary FALLBACK_BOOKING_NOTIFICATION_EMAIL when set", async () => {
    process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL = "  Staff.Notify@Example.com ";
    await expect(resolveBookingNotificationRecipients("507f1f77bcf86cd799439012")).resolves.toEqual(
      ["staff.notify@example.com"],
    );
  });
});
