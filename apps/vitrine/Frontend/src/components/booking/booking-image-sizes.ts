/**
 * next/image `sizes` hints aligned with booking card CSS.
 *
 * Mobile (≤640px): card is full container width minus horizontal padding
 *   (container inset 2×--v-space-4 + card padding 2×--v-space-4 → 4rem total).
 * Desktop (>640px): fixed thumbnail columns (7rem spaces, 6rem services).
 */
export const BOOKING_SPACE_CARD_IMAGE_SIZES = "(max-width: 640px) calc(100vw - 4rem), 7rem";

export const BOOKING_SERVICE_CARD_IMAGE_SIZES = "(max-width: 640px) calc(100vw - 4rem), 6rem";
