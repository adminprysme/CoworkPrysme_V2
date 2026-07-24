import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  PublicQuoteAcceptConfirmLoginRequestSchema,
  PublicQuoteAcceptConfirmRequestSchema,
  PublicQuoteAcceptRegisterRequestSchema,
  QUOTE_ACCEPT_ERROR_CODES,
} from "@coworkprysme/shared";
import type { Request } from "express";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { clientIpFromRequest } from "../common/client-ip.js";
import { QuotesAcceptService } from "./quotes-accept.service.js";

@Controller("quotes/accept")
export class QuotesAcceptController {
  constructor(@Inject(QuotesAcceptService) private readonly quotesAccept: QuotesAcceptService) {}

  @Get(":token")
  async preview(@Param("token") token: string) {
    return this.quotesAccept.preview(token);
  }

  @Post(":token/register")
  async register(@Param("token") token: string, @Body() body: unknown) {
    const parsed = PublicQuoteAcceptRegisterRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quotesAccept.register(token, parsed.data);
  }

  @Post(":token/confirm")
  async confirm(@Param("token") token: string, @Body() body: unknown, @Req() req: Request) {
    const parsed = PublicQuoteAcceptConfirmRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quotesAccept.confirm(token, parsed.data, {
      ipAddress: clientIpFromRequest(req),
    });
  }

  /** Existing account: email + password → accept (needsRegistration=false). */
  @Post(":token/confirm-login")
  async confirmLogin(@Param("token") token: string, @Body() body: unknown, @Req() req: Request) {
    const parsed = PublicQuoteAcceptConfirmLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: QUOTE_ACCEPT_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.quotesAccept.confirmExistingWithPassword(token, parsed.data, {
      ipAddress: clientIpFromRequest(req),
    });
  }
}
