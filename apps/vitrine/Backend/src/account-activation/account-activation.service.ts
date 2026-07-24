import { ConflictException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ClientAccountActivationError,
  consumeClientAccountActivation,
  getPendingActivationByRawToken,
} from "@coworkprysme/db";
import {
  CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES,
  PublicAccountActivationAcceptResponseSchema,
  PublicAccountActivationPreviewSchema,
  type PublicAccountActivationAcceptRequest,
  type PublicAccountActivationAcceptResponse,
  type PublicAccountActivationPreview,
} from "@coworkprysme/shared";
import { parseVitrineApiEnv } from "@coworkprysme/shared/server";

@Injectable()
export class AccountActivationService {
  private tokenSecret(): string {
    return parseVitrineApiEnv().CLIENT_ACCOUNT_ACTIVATION_TOKEN_SECRET;
  }

  async preview(rawToken: string): Promise<PublicAccountActivationPreview> {
    const pending = await getPendingActivationByRawToken(rawToken, this.tokenSecret());
    if (!pending) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_ACTIVATION_ERROR_CODES.ACTIVATION_NOT_FOUND,
        message: "Lien d'activation invalide ou introuvable.",
      });
    }
    return PublicAccountActivationPreviewSchema.parse({
      emailMasked: pending.emailMasked,
      expiresAt: pending.expiresAt.toISOString(),
    });
  }

  async accept(
    rawToken: string,
    body: PublicAccountActivationAcceptRequest,
  ): Promise<PublicAccountActivationAcceptResponse> {
    try {
      const result = await consumeClientAccountActivation({
        rawToken,
        tokenSecret: this.tokenSecret(),
        password: body.password,
      });
      return PublicAccountActivationAcceptResponseSchema.parse({
        clientAccount: {
          id: String(result.clientAccountId),
          email: result.email,
          status: "active",
        },
      });
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof ClientAccountActivationError) {
      const body = { code: error.code, message: error.message };
      if (error.code === "ACTIVATION_EXPIRED") throw new GoneException(body);
      if (
        error.code === "ACTIVATION_ALREADY_USED" ||
        error.code === "ACTIVATION_REVOKED" ||
        error.code === "ACTIVATION_ACCOUNT_INVALID" ||
        error.code === "ACTIVATION_EMAIL_MISMATCH"
      ) {
        throw new ConflictException(body);
      }
      throw new NotFoundException(body);
    }
    throw error;
  }
}
