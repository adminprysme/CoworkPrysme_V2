/** Typed activation errors — map to HTTP in the API layer. Never include the raw token. */
export type ClientAccountActivationErrorCode =
  | "ACTIVATION_NOT_FOUND"
  | "ACTIVATION_EXPIRED"
  | "ACTIVATION_REVOKED"
  | "ACTIVATION_ALREADY_USED"
  | "ACTIVATION_ACCOUNT_INVALID"
  | "ACTIVATION_EMAIL_MISMATCH";

export class ClientAccountActivationError extends Error {
  readonly code: ClientAccountActivationErrorCode;

  constructor(code: ClientAccountActivationErrorCode, message: string) {
    super(message);
    this.name = "ClientAccountActivationError";
    this.code = code;
  }
}
