export function canProceedToBookingPayment(input: {
  cgvAccepted: boolean;
  withdrawalAcknowledged: boolean;
}): boolean {
  return input.cgvAccepted && input.withdrawalAcknowledged;
}
