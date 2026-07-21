/** Typed invitation errors — map to HTTP in the API layer. Never include the raw token. */
export type ClientInvitationErrorCode =
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED"
  | "INVITE_ALREADY_USED"
  | "INVITE_EMAIL_ALREADY_REGISTERED";

export class ClientInvitationError extends Error {
  readonly code: ClientInvitationErrorCode;

  constructor(code: ClientInvitationErrorCode, message: string) {
    super(message);
    this.name = "ClientInvitationError";
    this.code = code;
  }
}
