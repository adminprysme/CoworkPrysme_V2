import { Injectable, UnauthorizedException } from "@nestjs/common";
import { clientAccountEmailExists, verifyClientAccountCredentials } from "@coworkprysme/db";
import {
  BOOKING_CONFIRM_ERROR_CODES,
  BookingCheckEmailResponseSchema,
  BookingVerifyAccountResponseSchema,
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
    const valid = await verifyClientAccountCredentials(input.email, input.password);
    if (!valid) {
      throw new UnauthorizedException({
        code: BOOKING_CONFIRM_ERROR_CODES.INVALID_CREDENTIALS,
        message: "Email ou mot de passe incorrect",
      });
    }
    return BookingVerifyAccountResponseSchema.parse({ valid: true });
  }
}
