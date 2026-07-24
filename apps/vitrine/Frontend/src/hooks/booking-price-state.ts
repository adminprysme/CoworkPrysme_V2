import {
  DISCOUNT_CODE_INVALID_MESSAGE,
  DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE,
  type BookingPriceRequest,
} from "@coworkprysme/shared";

export function shouldPreservePriceOnPromoError(
  request: BookingPriceRequest,
  errorMessage: string,
): boolean {
  if (!request.discountCode?.trim()) {
    return false;
  }

  return (
    errorMessage === DISCOUNT_CODE_INVALID_MESSAGE ||
    errorMessage === DISCOUNT_CODE_PREFERENTIAL_PENDING_MESSAGE
  );
}
