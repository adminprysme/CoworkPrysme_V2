/**
 * Booking tunnel configuration (future).
 *
 * CGV acceptance — before payment confirmation, render a required checkbox:
 *   "J'accepte les Conditions Générales de Vente" linking to /cgv
 * See also: BOOKING_CGV_ACCEPTANCE_HOOK in @/config/legal/meta
 */
export const BOOKING_CGV_PATH = "/cgv" as const;
