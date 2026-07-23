import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  AccountLockedError,
  AccountPendingActivationError,
  clientAccountEmailExists,
  verifyClientAccountCredentials,
} from "@coworkprysme/db";
import {
  BOOKING_CONFIRM_ERROR_CODES,
  BookingCheckEmailResponseSchema,
  BookingVerifyAccountResponseSchema,
  CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
  CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
  type BookingCheckEmailRequest,
  type BookingVerifyAccountRequest,
} from "@coworkprysme/shared";

@Injectable()
export class BookingAccountService {
  async checkEmail(input: BookingCheckEmailRequest) {
    const exists = await clientAccountEmailExists(input.email);
    return BookingCheckEmailResponseSchema.parse({ exists });
  }

  async verifyAccount(input: BookingVerifyAccountRequest) {
    try {
      const valid = await verifyClientAccountCredentials(input.email, input.password);
      if (!valid) {
        throw new UnauthorizedException({
          code: BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS,
          message: "Email ou mot de passe incorrect",
        });
      }
      return BookingVerifyAccountResponseSchema.parse({ valid: true });
    } catch (error) {
      if (error instanceof AccountPendingActivationError) {
        throw new ForbiddenException({
          code: BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_PENDING_ACTIVATION,
          message: CLIENT_ACCOUNT_PENDING_ACTIVATION_USER_MESSAGE,
        });
      }
      if (error instanceof AccountLockedError) {
        throw new ForbiddenException({
          code: BOOKING_CONFIRM_ERROR_CODES.ACCOUNT_LOCKED,
          message: CLIENT_ACCOUNT_LOCKED_USER_MESSAGE,
        });
      }
      throw error;
    }
  }
}
