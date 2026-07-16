/**
 * Sole entry point for staff booking-notification recipients.
 *
 * TEMPORARY stub — awaiting the Permissions module (gestion):
 * staffProfiles with permission "Reçoit les emails de réservation"
 * scoped to `buildingIds`. When that lands, replace ONLY the body of
 * this function (query staffProfiles); callers must keep using this API.
 *
 * Until then, optionally reads FALLBACK_BOOKING_NOTIFICATION_EMAIL
 * (TEMPORARY) so a single address can receive notifications for testing.
 * `buildingId` is unused in the stub; the future implementation will filter by it.
 *
 * Permanent rule: never return `buildings.email` (building contact is display-only).
 */
export async function resolveBookingNotificationRecipients(_buildingId: string): Promise<string[]> {
  const fallback = process.env.FALLBACK_BOOKING_NOTIFICATION_EMAIL?.trim().toLowerCase();
  if (!fallback) {
    return [];
  }
  return [fallback];
}
