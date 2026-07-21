import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  CLIENT_INVITATION_ERROR_CODES,
  PublicInvitationAcceptRequestSchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvitationsService } from "./invitations.service.js";

@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(":token")
  async getByToken(@Param("token") token: string) {
    return this.invitations.getByToken(token);
  }

  @Post(":token/accept")
  async accept(@Param("token") token: string, @Body() body: unknown) {
    const parsed = PublicInvitationAcceptRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: CLIENT_INVITATION_ERROR_CODES.VALIDATION_ERROR,
        message: parsed.error.issues[0]?.message ?? "Payload invalide",
      });
    }
    return this.invitations.accept(token, parsed.data);
  }
}
