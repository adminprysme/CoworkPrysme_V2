import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  CARDEX_DOCUMENT_STAFF_ERROR_CODES,
  CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES,
  StaffPatchCardexDocumentRequestSchema,
  StaffUploadCardexDocumentFieldsSchema,
} from "@coworkprysme/shared";
import { parseGestionApiEnv } from "@coworkprysme/shared/server";
import type { Request, Response } from "express";
import { createReadStream } from "node:fs";
import { memoryStorage } from "multer";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { ClientsPermissionGuard } from "../auth/clients-permission.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import { StaffContextService } from "../auth/staff-context.service.js";
import { CardexDocumentsService } from "./cardex-documents.service.js";

function documentUploadLimits() {
  const env = parseGestionApiEnv();
  return { fileSize: env.UPLOAD_MAX_BYTES_DOCUMENT };
}

function contentDispositionAttachment(filename: string): string {
  const fallback =
    filename
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\]/g, "_")
      .trim() || "document";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

@Controller("planning/cardexes")
@UseGuards(SessionGuard, ClientsPermissionGuard)
export class CardexDocumentsController {
  constructor(
    private readonly documents: CardexDocumentsService,
    private readonly staffContext: StaffContextService,
  ) {}

  @Get(":cardexId/documents")
  async list(@Param("cardexId") cardexId: string) {
    return this.documents.list(cardexId);
  }

  @Post(":cardexId/documents")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: documentUploadLimits(),
    }),
  )
  async upload(
    @Param("cardexId") cardexId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.MISSING_FILE,
        message: CARDEX_DOCUMENT_STAFF_ERROR_MESSAGES.MISSING_FILE,
      });
    }

    const parsed = StaffUploadCardexDocumentFieldsSchema.safeParse({
      category: request.body?.category,
      label: request.body?.label,
    });
    if (!parsed.success) {
      throw new BadRequestException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.VALIDATION_ERROR,
        message: "Champs d'upload invalides",
        issues: parsed.error.issues,
      });
    }

    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.documents.upload(
      profile,
      cardexId,
      file.buffer,
      file.originalname || "document",
      parsed.data,
    );
  }

  @Get(":cardexId/documents/:documentId/download")
  async download(
    @Param("cardexId") cardexId: string,
    @Param("documentId") documentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const prepared = await this.documents.prepareDownload(cardexId, documentId);
    response.setHeader("Content-Type", prepared.contentType);
    response.setHeader(
      "Content-Disposition",
      contentDispositionAttachment(prepared.originalFilename),
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");

    const stream = createReadStream(prepared.absolutePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.status(404).end();
        return;
      }
      response.destroy();
    });
    stream.pipe(response);
  }

  @Patch(":cardexId/documents/:documentId")
  async patchLabel(
    @Param("cardexId") cardexId: string,
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ) {
    const parsed = StaffPatchCardexDocumentRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: CARDEX_DOCUMENT_STAFF_ERROR_CODES.VALIDATION_ERROR,
        message: "Libellé invalide (120 caractères max)",
        issues: parsed.error.issues,
      });
    }
    return this.documents.updateLabel(cardexId, documentId, parsed.data.label);
  }

  @Delete(":cardexId/documents/:documentId")
  async remove(
    @Param("cardexId") cardexId: string,
    @Param("documentId") documentId: string,
    @Req() request: Request,
  ) {
    const profile = await this.staffContext.requireProfileFromRequest(request);
    return this.documents.delete(profile, cardexId, documentId);
  }
}
