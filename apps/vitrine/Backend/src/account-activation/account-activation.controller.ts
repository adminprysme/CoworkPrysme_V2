import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES,
  PublicAccountActivationAcceptRequestSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { AccountActivationService } from "./account-activation.service.js";

@Controller("account/activation")
export class AccountActivationController {
  constructor(private readonly activation: AccountActivationService) {}

  @Get(":token")
  async preview(@Param("token") token: string) {
    return this.activation.preview(token);
  }

  @Post(":token")
  async accept(@Param("token") token: string, @Body() body: unknown) {
    const parsed = PublicAccountActivationAcceptRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.activation.accept(token, parsed.data);
  }
}
