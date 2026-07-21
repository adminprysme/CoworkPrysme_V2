import type { Types } from "mongoose";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  classifyDateChange,
  computeBookingPrice,
  computePriceDeltaCents,
  computeShortenRefundSuggestion,
  computeSuggestedRefundCents,
  isWithin48hOfStart,
  resolveSpaceStayPricing,
  PlanningCancelPreviewSchema,
  PlanningCancelResultSchema,
  PlanningContactTransferPreviewSchema,
  PlanningContactTransferResultSchema,
  PlanningDateChangePreviewSchema,
  PlanningDateChangeResultSchema,
  PlanningManageSpaceOptionSchema,
  PlanningPartySizePreviewSchema,
  PlanningPartySizeResultSchema,
  PlanningRestorePreviewSchema,
  PlanningRestoreResultSchema,
  PlanningSpaceChangePreviewSchema,
  PlanningSpaceChangeResultSchema,
  type BookingPriceLineInput,
  type DateChangeKind,
  type PlanningCancelPreview,
  type PlanningCancelRequest,
  type PlanningCancelResult,
  type PlanningContactTransferPreview,
  type PlanningContactTransferRequest,
  type PlanningContactTransferResult,
  type PlanningDateChangePreview,
  type PlanningDateChangeRequest,
  type PlanningDateChangeResult,
  type PlanningManageSpaceOption,
  type PlanningPartySizePreview,
  type PlanningPartySizeRequest,
  type PlanningPartySizeResult,
  type PlanningRestoreConflict,
  type PlanningRestorePreview,
  type PlanningRestoreRequest,
  type PlanningRestoreResult,
  type PlanningSpaceChangePreview,
  type PlanningSpaceChangeRequest,
  type PlanningSpaceChangeResult,
  type SpaceStayPricing,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getAuditLogModel,
  getBuildingModel,
  getCardexModel,
  getClientAccountModel,
  getInvoiceModel,
  getReservationModel,
  getSpaceModel,
  findOverlappingReservation,
  type ReservationDocument,
  type StaffProfileDocument,
  type StatusHistoryEntry,
} from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import { MailService } from "../mail/mail.service.js";
import { writePlanningManageAudit } from "./planning-manage-audit.js";
import {
  renderCancellationEmail,
  renderContactTransferEmail,
  renderDateChangeEmail,
  renderPartySizeEmail,
  renderRestoreEmail,
  renderSpaceChangeEmail,
} from "./planning-manage-emails.js";
import { appendInvoiceAdjustment } from "./planning-manage-invoice.js";
import { buildProformaPdfAttachments } from "./planning-manage-mail-attachments.js";
import { PlanningService } from "./planning.service.js";
/* eslint-enable @typescript-eslint/consistent-type-imports */
import {
  asSpaceType,
  formatClientLabel,
  isBuildingIdInScope,
  isReservationReadOnly,
} from "./planning.mapper.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: "INVALID_ID",
      message: `${label} invalide`,
    });
  }
  return value;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function formatFrDateTime(date: Date): string {
  return date.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

@Injectable()
export class PlanningManageService {
  private readonly logger = new Logger(PlanningManageService.name);

  constructor(
    private readonly mail: MailService,
    private readonly planning: PlanningService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  async listCandidateSpaces(
    profile: StaffProfileDocument,
    reservationId: string,
  ): Promise<PlanningManageSpaceOption[]> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const spaceType = asSpaceType(reservation.spaceSnapshot?.type ?? "meeting_room");

    const Space = await getSpaceModel();
    const query: Record<string, unknown> = {
      type: spaceType,
      status: "active",
      _id: { $ne: reservation.spaceId },
    };
    if (profile.scope.buildingIds.length > 0) {
      query.buildingId = { $in: profile.scope.buildingIds };
    }

    const spaces = await Space.find(query)
      .select({ name: 1, type: 1, buildingId: 1, floor: 1, capacity: 1, status: 1 })
      .sort({ buildingId: 1, name: 1 })
      .lean()
      .exec();

    if (spaces.length === 0) {
      return [];
    }

    const Building = await getBuildingModel();
    const buildingIds = [...new Set(spaces.map((space) => String(space.buildingId)))];
    const buildings = await Building.find({ _id: { $in: buildingIds } })
      .select({ name: 1 })
      .lean()
      .exec();
    const buildingNameById = new Map(buildings.map((b) => [String(b._id), b.name]));

    const currentBuildingId = String(reservation.buildingId);

    const options = await Promise.all(
      spaces.map(async (space) => {
        const overlap = await findOverlappingReservation(
          space._id,
          reservation.startAt,
          reservation.endAt,
          undefined,
          reservation._id,
        );
        return {
          id: String(space._id),
          name: space.name,
          type: asSpaceType(space.type),
          buildingId: String(space.buildingId),
          buildingName: buildingNameById.get(String(space.buildingId)) ?? "—",
          floor: space.floor != null ? String(space.floor) : undefined,
          capacity:
            typeof space.capacity === "number" && space.capacity > 0 ? space.capacity : undefined,
          available: !overlap,
          unavailableReason: overlap
            ? `Occupé par la réservation ${overlap.reference} sur ce créneau`
            : undefined,
        } satisfies PlanningManageSpaceOption;
      }),
    );

    options.sort((a, b) => {
      const aSame = a.buildingId === currentBuildingId ? 0 : 1;
      const bSame = b.buildingId === currentBuildingId ? 0 : 1;
      if (aSame !== bSame) {
        return aSame - bSame;
      }
      return a.name.localeCompare(b.name, "fr");
    });

    return options.map((option) => PlanningManageSpaceOptionSchema.parse(option));
  }

  async previewSpaceChange(
    profile: StaffProfileDocument,
    reservationId: string,
    nextSpaceId: string,
  ): Promise<PlanningSpaceChangePreview> {
    await connectMongo();
    const { reservation, nextSpace } = await this.loadReservationAndNextSpace(
      profile,
      reservationId,
      nextSpaceId,
    );

    const currentType = asSpaceType(reservation.spaceSnapshot?.type ?? "meeting_room");
    const nextType = asSpaceType(nextSpace.type);
    if (nextType !== currentType) {
      throw new BadRequestException({
        code: "SPACE_TYPE_MISMATCH",
        message: "Le type du nouvel espace ne correspond pas à la réservation",
      });
    }

    const overlap = await findOverlappingReservation(
      nextSpace._id,
      reservation.startAt,
      reservation.endAt,
      undefined,
      reservation._id,
    );

    const previousPricing = {
      subtotalHT: Math.trunc(reservation.pricing.subtotalHT),
      totalVAT: Math.trunc(reservation.pricing.totalVAT),
      totalTTC: Math.trunc(reservation.pricing.totalTTC),
    };

    let nextPricing = previousPricing;
    let deltaTTC = 0;
    let conflictMessage: string | undefined;

    if (overlap) {
      conflictMessage = `Ce créneau est déjà occupé par la réservation ${overlap.reference} sur cet espace.`;
    } else {
      const priced = this.repriceWithNextSpace(reservation, nextSpace);
      const nextTotalHTAfterDiscount = priced.subtotalHT - priced.discountTotal;
      const nextTotalVAT = priced.totalTTC - nextTotalHTAfterDiscount;
      nextPricing = {
        subtotalHT: priced.subtotalHT,
        totalVAT: nextTotalVAT,
        totalTTC: priced.totalTTC,
      };
      deltaTTC = computePriceDeltaCents(previousPricing.totalTTC, priced.totalTTC).deltaTTC;
    }

    const payload: PlanningSpaceChangePreview = {
      reservationId: String(reservation._id),
      currentSpace: {
        id: String(reservation.spaceId),
        name: reservation.spaceSnapshot?.name ?? "Espace",
        type: currentType,
      },
      nextSpace: {
        id: String(nextSpace._id),
        name: nextSpace.name,
        type: nextType,
      },
      available: !overlap,
      conflictMessage,
      previousPricing,
      nextPricing,
      deltaTTC,
    };

    return PlanningSpaceChangePreviewSchema.parse(payload);
  }

  async confirmSpaceChange(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningSpaceChangeRequest,
  ): Promise<PlanningSpaceChangeResult> {
    await connectMongo();
    const { reservation, nextSpace } = await this.loadReservationAndNextSpace(
      profile,
      reservationId,
      request.nextSpaceId,
    );

    if (isReservationReadOnly(reservation.status)) {
      throw new ConflictException({
        code: "RESERVATION_READ_ONLY",
        message: "Cette réservation est en lecture seule (annulée, terminée ou no-show)",
      });
    }

    const currentType = asSpaceType(reservation.spaceSnapshot?.type ?? "meeting_room");
    const nextType = asSpaceType(nextSpace.type);
    if (nextType !== currentType) {
      throw new BadRequestException({
        code: "SPACE_TYPE_MISMATCH",
        message: "Le type du nouvel espace ne correspond pas à la réservation",
      });
    }

    const overlap = await findOverlappingReservation(
      nextSpace._id,
      reservation.startAt,
      reservation.endAt,
      undefined,
      reservation._id,
    );
    if (overlap) {
      throw new ConflictException({
        code: "SPACE_UNAVAILABLE",
        message: `Ce créneau est déjà occupé par la réservation ${overlap.reference} sur cet espace.`,
      });
    }

    const previousTotalTTC = Math.trunc(reservation.pricing.totalTTC);
    const priced = this.repriceWithNextSpace(reservation, nextSpace);
    const nextTotalHTAfterDiscount = priced.subtotalHT - priced.discountTotal;
    const nextTotalVAT = priced.totalTTC - nextTotalHTAfterDiscount;
    const deltaTTC = computePriceDeltaCents(previousTotalTTC, priced.totalTTC).deltaTTC;

    if (deltaTTC !== 0 && !request.acknowledgePriceGap) {
      throw new BadRequestException({
        code: "PRICE_GAP_NOT_ACKNOWLEDGED",
        message: "Veuillez confirmer avoir pris connaissance de l'écart de prix",
      });
    }

    const previousSpaceId = String(reservation.spaceId);
    const previousSpaceName = reservation.spaceSnapshot?.name ?? "Espace";

    reservation.spaceId = nextSpace._id;
    reservation.buildingId = nextSpace.buildingId;
    reservation.spaceSnapshot = {
      name: nextSpace.name,
      type: nextSpace.type,
    };
    reservation.pricing = {
      subtotalHT: priced.subtotalHT,
      totalVAT: nextTotalVAT,
      totalTTC: priced.totalTTC,
      discountTotal: priced.discountTotal,
    };
    await reservation.save();

    let billedDifference = false;
    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reservationId: reservation._id }).exec();
    if (invoice && request.billDifference) {
      const nextLines = priced.lines.map((line) => ({
        label: line.label,
        kind: line.kind,
        qty: line.qty,
        unitPriceHT: line.unitPriceHT,
        vatRate: line.vatRate,
        discount: line.discount,
        totalHT: line.totalHT,
        totalVAT: line.totalVAT,
        totalTTC: line.totalTTC,
      }));
      invoice.lines = nextLines as typeof invoice.lines;
      const ht = priced.subtotalHT - priced.discountTotal;
      const ttc = priced.totalTTC;
      const vat = ttc - ht;
      const paidTotal = invoice.totals.paidTotal;
      const balanceDue = Math.max(0, ttc - paidTotal);
      invoice.totals = {
        ht,
        vat,
        ttc,
        discountTotal: priced.discountTotal,
        paidTotal,
        balanceDue,
      };
      invoice.status = balanceDue === 0 ? "paid" : paidTotal > 0 ? "partially_paid" : "proforma";
      invoice.type = "proforma";
      await invoice.save();
      billedDifference = true;
    }

    await writePlanningManageAudit({
      profile,
      action: "reservation.space_change",
      reservationId: reservation._id,
      diff: {
        spaceId: { before: previousSpaceId, after: String(nextSpace._id) },
        spaceName: { before: previousSpaceName, after: nextSpace.name },
        totalTTC: { before: previousTotalTTC, after: priced.totalTTC },
      },
    });

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (clientEmail) {
      const email = renderSpaceChangeEmail({
        reservationReference: reservation.reference,
        previousSpaceName,
        nextSpaceName: nextSpace.name,
        startAt: formatFrDateTime(reservation.startAt),
        endAt: formatFrDateTime(reservation.endAt),
        previousTotalTTC,
        nextTotalTTC: priced.totalTTC,
        deltaTTC,
        billedDifference,
      });
      // PDF only when proforma was rewritten in this request (billDifference).
      const attachments = billedDifference
        ? await buildProformaPdfAttachments(this.invoicePdf, invoice?.reference, (error) =>
            this.logger.error(
              `Invoice PDF attachment failed for space-change ${invoice?.reference}: ${String(error)}`,
            ),
          )
        : undefined;
      await this.mail.sendMail({
        to: clientEmail,
        subject: email.subject,
        html: email.html,
        attachments,
      });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningSpaceChangeResult = {
      reservation: detail,
      billedDifference,
      deltaTTC,
    };
    return PlanningSpaceChangeResultSchema.parse(result);
  }

  async previewCancel(
    profile: StaffProfileDocument,
    reservationId: string,
  ): Promise<PlanningCancelPreview> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reservationId: reservation._id })
      .select({ totals: 1 })
      .lean()
      .exec();
    const paidTotalCents = Math.trunc(invoice?.totals?.paidTotal ?? 0);

    const suggestion = computeSuggestedRefundCents({
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      paidTotalCents,
    });

    const payload: PlanningCancelPreview = {
      reservationId: String(reservation._id),
      reference: reservation.reference,
      status: reservation.status,
      startAt: toIso(reservation.startAt),
      endAt: toIso(reservation.endAt),
      paidTotalCents: suggestion.paidTotalCents,
      suggestedRefundCents: suggestion.suggestedRefundCents,
      basis: suggestion.basis,
      totalDurationMs: suggestion.totalDurationMs,
      remainingMs: suggestion.remainingMs,
      elapsedMs: suggestion.elapsedMs,
    };
    return PlanningCancelPreviewSchema.parse(payload);
  }

  async confirmCancel(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningCancelRequest,
  ): Promise<PlanningCancelResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (isReservationReadOnly(reservation.status)) {
      throw new ConflictException({
        code: "RESERVATION_READ_ONLY",
        message: "Cette réservation est déjà annulée, terminée ou en no-show",
      });
    }

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reservationId: reservation._id })
      .select({ totals: 1 })
      .lean()
      .exec();
    const paidTotalCents = Math.trunc(invoice?.totals?.paidTotal ?? 0);

    const suggestion = computeSuggestedRefundCents({
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      paidTotalCents,
    });

    if (!request.confirmRefund) {
      throw new BadRequestException({
        code: "REFUND_NOT_CONFIRMED",
        message: "Veuillez confirmer le montant de remboursement choisi",
      });
    }

    const accepted = request.acceptedRefundCents;
    if (request.refundMode === "suggested") {
      if (accepted !== suggestion.suggestedRefundCents) {
        throw new BadRequestException({
          code: "REFUND_MISMATCH",
          message:
            "Le montant du remboursement suggéré a changé, veuillez rafraîchir la prévisualisation",
        });
      }
    } else if (request.refundMode === "none") {
      if (accepted !== 0) {
        throw new BadRequestException({
          code: "REFUND_INVALID",
          message: "Le mode « Ne pas rembourser » impose un montant à 0",
        });
      }
    } else if (accepted > paidTotalCents) {
      throw new BadRequestException({
        code: "REFUND_EXCEEDS_PAID",
        message: "Le remboursement ne peut pas dépasser le montant réglé",
      });
    }

    if (request.refundMode !== "suggested") {
      const deviation = request.refundDeviationReason?.trim() ?? "";
      if (deviation.length < 3) {
        throw new BadRequestException({
          code: "REFUND_DEVIATION_REQUIRED",
          message: "Une justification est obligatoire lorsque le montant diffère du suggéré",
        });
      }
    }

    const previousStatus = reservation.status;
    const now = new Date();
    reservation.status = "cancelled";
    reservation.statusHistory.push({
      from: previousStatus,
      to: "cancelled",
      at: now,
      by: profile._id,
      reason: request.reason,
    } as unknown as StatusHistoryEntry);
    await reservation.save();

    const auditDiff: Record<string, { before: unknown; after: unknown }> = {
      status: { before: previousStatus, after: "cancelled" },
      // Always stamp spaceId so space-history audit filters can scope cancels
      // the same way as restore / space-change / date-change manage actions.
      spaceId: {
        before: String(reservation.spaceId),
        after: String(reservation.spaceId),
      },
      acceptedRefundCents: { before: 0, after: accepted },
      suggestedRefundCents: {
        before: suggestion.suggestedRefundCents,
        after: suggestion.suggestedRefundCents,
      },
      refundMode: { before: "suggested", after: request.refundMode },
    };
    if (request.refundMode !== "suggested" && request.refundDeviationReason) {
      auditDiff.refundDeviationReason = {
        before: null,
        after: request.refundDeviationReason.trim(),
      };
    }

    await writePlanningManageAudit({
      profile,
      action: "reservation.cancel",
      reservationId: reservation._id,
      diff: auditDiff,
      reason: request.reason,
      at: now,
    });

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (clientEmail) {
      const email = renderCancellationEmail({
        reservationReference: reservation.reference,
        spaceName: reservation.spaceSnapshot?.name ?? "Espace",
        startAt: formatFrDateTime(reservation.startAt),
        endAt: formatFrDateTime(reservation.endAt),
        paidTotalCents,
        refundCents: accepted,
      });
      await this.mail.sendMail({ to: clientEmail, subject: email.subject, html: email.html });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningCancelResult = {
      reservation: detail,
      suggestedRefundCents: suggestion.suggestedRefundCents,
      acceptedRefundCents: request.acceptedRefundCents,
      basis: suggestion.basis,
    };
    return PlanningCancelResultSchema.parse(result);
  }

  /**
   * Preview restore eligibility for a cancelled reservation.
   * Gates (both required for canRestore):
   * 1. Last cancel audit acceptedRefundCents === 0
   * 2. Slot free via findOverlappingReservation (self excluded)
   */
  async previewRestore(
    profile: StaffProfileDocument,
    reservationId: string,
  ): Promise<PlanningRestorePreview> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const eligibility = await this.computeRestoreEligibility(reservation);
    const preview: PlanningRestorePreview = {
      reservationId: String(reservation._id),
      reference: reservation.reference,
      status: reservation.status as PlanningRestorePreview["status"],
      ...eligibility,
    };
    return PlanningRestorePreviewSchema.parse(preview);
  }

  /**
   * Restore a cancelled reservation to `confirmed`.
   *
   * Exception to the transverse "cancelled ⇒ lecture pure" Manage rule:
   * this is the only staff mutation still allowed on a cancelled reservation,
   * and only when refund-at-cancel was 0 and the slot is free (re-checked here).
   */
  async confirmRestore(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningRestoreRequest,
  ): Promise<PlanningRestoreResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    if (request.confirm !== true) {
      throw new BadRequestException({
        code: "RESTORE_NOT_CONFIRMED",
        message: "Veuillez confirmer explicitement la restauration",
      });
    }

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (reservation.status !== "cancelled") {
      throw new ConflictException({
        code: "RESTORE_NOT_CANCELLED",
        message: "Seule une réservation annulée peut être restaurée",
      });
    }

    const eligibility = await this.computeRestoreEligibility(reservation);
    if (!eligibility.refundEligible) {
      throw new ConflictException({
        code: "RESTORE_REFUND_APPLIED",
        message:
          "Cette réservation ne peut pas être restaurée : un remboursement a été enregistré à l'annulation",
      });
    }
    if (!eligibility.slotAvailable || eligibility.conflictingReservation) {
      const conflict = eligibility.conflictingReservation;
      const conflictRef = conflict?.reference ?? "une autre réservation";
      throw new ConflictException({
        code: "RESTORE_SLOT_OCCUPIED",
        message: `Le créneau est occupé par ${conflictRef}. Déplacez ou annulez cette réservation avant de restaurer.`,
        conflictingReservationId: conflict?.id,
      });
    }

    // Re-check overlap under write path (never trust preview alone).
    const overlap = await findOverlappingReservation(
      reservation.spaceId,
      reservation.startAt,
      reservation.endAt,
      undefined,
      reservation._id,
    );
    if (overlap) {
      throw new ConflictException({
        code: "RESTORE_SLOT_OCCUPIED",
        message: `Le créneau est occupé par ${overlap.reference}. Déplacez ou annulez cette réservation avant de restaurer.`,
        conflictingReservationId: String(overlap._id),
      });
    }

    const now = new Date();
    const previousStatus = reservation.status;
    reservation.status = "confirmed";
    reservation.statusHistory.push({
      from: previousStatus,
      to: "confirmed",
      at: now,
      by: profile._id,
      reason: "Réservation restaurée",
    } as unknown as StatusHistoryEntry);
    await reservation.save();

    // Cardex / audit trail: dedicated restore entry (author + date + label).
    await writePlanningManageAudit({
      profile,
      action: "reservation.restore",
      reservationId: reservation._id,
      diff: {
        status: { before: "cancelled", after: "confirmed" },
        spaceId: {
          before: String(reservation.spaceId),
          after: String(reservation.spaceId),
        },
      },
      reason: "Réservation restaurée",
      at: now,
    });

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (clientEmail) {
      const email = renderRestoreEmail({
        reservationReference: reservation.reference,
        spaceName: reservation.spaceSnapshot?.name ?? "Espace",
        startAt: formatFrDateTime(reservation.startAt),
        endAt: formatFrDateTime(reservation.endAt),
      });
      await this.mail.sendMail({ to: clientEmail, subject: email.subject, html: email.html });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningRestoreResult = { reservation: detail };
    return PlanningRestoreResultSchema.parse(result);
  }

  async previewDateChange(
    profile: StaffProfileDocument,
    reservationId: string,
    startAtRaw: string,
    endAtRaw: string,
  ): Promise<PlanningDateChangePreview> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const { newStart, newEnd, kind } = this.parseDateChangeInput(reservation, startAtRaw, endAtRaw);

    const overlap = await this.checkDateChangeAvailability(reservation, kind, newStart, newEnd);
    const conflictingReservation = overlap ? await this.describeOverlapConflict(overlap) : null;
    const conflictMessage = overlap
      ? `Ce créneau est déjà occupé par la réservation ${overlap.reference} sur cet espace.`
      : undefined;

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reservationId: reservation._id })
      .select({ totals: 1 })
      .lean()
      .exec();
    const paidTotalCents = Math.trunc(invoice?.totals?.paidTotal ?? 0);

    const pricing = await this.priceDateChange(
      reservation,
      newStart,
      newEnd,
      reservation.startAt,
      reservation.endAt,
    );

    let suggestedRefundCents = 0;
    let refundBasis: PlanningDateChangePreview["refundBasis"];
    if (kind === "shorten") {
      const suggestion = computeShortenRefundSuggestion({
        durationClass: reservation.durationClass,
        oldStart: reservation.startAt,
        oldEnd: reservation.endAt,
        newStart,
        newEnd,
        paidTotalCents,
      });
      suggestedRefundCents = suggestion.suggestedRefundCents;
      refundBasis = suggestion.basis;
    }

    const payload: PlanningDateChangePreview = {
      reservationId: String(reservation._id),
      kind,
      previousStartAt: toIso(reservation.startAt),
      previousEndAt: toIso(reservation.endAt),
      nextStartAt: toIso(newStart),
      nextEndAt: toIso(newEnd),
      available: !overlap,
      conflictMessage,
      conflictingReservation,
      within48h: isWithin48hOfStart(reservation.startAt),
      previousDurationClass: pricing.previousDurationClass,
      nextDurationClass: pricing.nextDurationClass,
      previousUnits: pricing.previousUnits,
      nextUnits: pricing.nextUnits,
      unitPriceHT: pricing.unitPriceHT,
      vatRate: pricing.vatRate,
      previousSpaceTTC: pricing.previousSpaceTTC,
      nextSpaceTTC: pricing.nextSpaceTTC,
      complementTTC: pricing.complementTTC,
      suggestedRefundCents,
      refundBasis,
      paidTotalCents,
      billable: pricing.complementTTC > 0,
    };
    return PlanningDateChangePreviewSchema.parse(payload);
  }

  async confirmDateChange(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningDateChangeRequest,
  ): Promise<PlanningDateChangeResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (isReservationReadOnly(reservation.status)) {
      throw new ConflictException({
        code: "RESERVATION_READ_ONLY",
        message: "Cette réservation est en lecture seule (annulée, terminée ou no-show)",
      });
    }

    const previousStartAt = reservation.startAt;
    const previousEndAt = reservation.endAt;
    const { newStart, newEnd, kind } = this.parseDateChangeInput(
      reservation,
      request.startAt,
      request.endAt,
    );

    // Re-check availability under the write path (never trust preview alone).
    const overlap = await this.checkDateChangeAvailability(reservation, kind, newStart, newEnd);
    if (overlap) {
      throw new ConflictException({
        code: "SLOT_UNAVAILABLE",
        message: `Ce créneau est déjà occupé par la réservation ${overlap.reference} sur cet espace.`,
        conflictingReservationId: String(overlap._id),
      });
    }

    const within48h = isWithin48hOfStart(previousStartAt);
    if (within48h && !request.confirmLateChange) {
      throw new BadRequestException({
        code: "LATE_CHANGE_NOT_CONFIRMED",
        message:
          "Cette réservation démarre dans moins de 48h : veuillez confirmer explicitement la modification",
      });
    }

    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findOne({ reservationId: reservation._id }).exec();
    const paidTotalCents = Math.trunc(invoice?.totals?.paidTotal ?? 0);

    const pricing = await this.priceDateChange(
      reservation,
      newStart,
      newEnd,
      previousStartAt,
      previousEndAt,
    );

    if (pricing.complementTTC > 0 && !request.acknowledgePriceGap) {
      throw new BadRequestException({
        code: "PRICE_GAP_NOT_ACKNOWLEDGED",
        message: "Veuillez confirmer avoir pris connaissance de l'écart de prix",
      });
    }
    if (
      pricing.complementTTC > 0 &&
      !request.billDifference &&
      (request.skipBillingReason?.trim().length ?? 0) < 3
    ) {
      throw new BadRequestException({
        code: "SKIP_BILLING_REASON_REQUIRED",
        message:
          "Une justification est obligatoire pour ne pas facturer le complément (geste commercial)",
      });
    }

    let suggestedRefundCents = 0;
    let acceptedRefundCents: number | undefined;
    if (kind === "shorten") {
      const suggestion = computeShortenRefundSuggestion({
        durationClass: reservation.durationClass,
        oldStart: previousStartAt,
        oldEnd: previousEndAt,
        newStart,
        newEnd,
        paidTotalCents,
      });
      suggestedRefundCents = suggestion.suggestedRefundCents;

      const refundMode = request.refundMode ?? "suggested";
      const accepted = request.acceptedRefundCents;
      if (accepted == null) {
        throw new BadRequestException({
          code: "REFUND_NOT_CONFIRMED",
          message: "Veuillez confirmer le montant de remboursement suggéré",
        });
      }
      if (refundMode === "suggested") {
        if (accepted !== suggestedRefundCents) {
          throw new BadRequestException({
            code: "REFUND_MISMATCH",
            message:
              "Le montant du remboursement suggéré a changé, veuillez rafraîchir la prévisualisation",
          });
        }
      } else if (refundMode === "none") {
        if (accepted !== 0) {
          throw new BadRequestException({
            code: "REFUND_INVALID",
            message: "Le mode « Ne pas rembourser » impose un montant à 0",
          });
        }
      } else if (accepted > paidTotalCents) {
        throw new BadRequestException({
          code: "REFUND_EXCEEDS_PAID",
          message: "Le remboursement ne peut pas dépasser le montant réglé",
        });
      }
      if (refundMode !== "suggested" && (request.refundDeviationReason?.trim().length ?? 0) < 3) {
        throw new BadRequestException({
          code: "REFUND_DEVIATION_REQUIRED",
          message: "Une justification est obligatoire lorsque le montant diffère du suggéré",
        });
      }
      acceptedRefundCents = accepted;
    }

    reservation.startAt = newStart;
    reservation.endAt = newEnd;
    reservation.durationClass = pricing.nextDurationClass;
    await reservation.save();

    let billedDifference = false;
    if (invoice && pricing.complementTTC > 0 && request.billDifference) {
      const label =
        kind === "extend"
          ? `Complément — prolongation (${pricing.previousDurationClass} → ${pricing.nextDurationClass}, ${pricing.nextUnits} unité(s))`
          : `Complément — report du créneau`;
      await appendInvoiceAdjustment(invoice, {
        label,
        amountTTCCents: pricing.complementTTC,
        vatRate: pricing.vatRate,
      });
      billedDifference = true;
    }

    const auditDiff: Record<string, { before: unknown; after: unknown }> = {
      startAt: { before: toIso(previousStartAt), after: toIso(newStart) },
      endAt: { before: toIso(previousEndAt), after: toIso(newEnd) },
      durationClass: {
        before: pricing.previousDurationClass,
        after: pricing.nextDurationClass,
      },
      kind: { before: null, after: kind },
      complementTTC: { before: 0, after: pricing.complementTTC },
      billedDifference: { before: false, after: billedDifference },
      spaceId: { before: String(reservation.spaceId), after: String(reservation.spaceId) },
    };
    if (kind === "shorten") {
      auditDiff.suggestedRefundCents = { before: 0, after: suggestedRefundCents };
      auditDiff.acceptedRefundCents = { before: 0, after: acceptedRefundCents ?? 0 };
      auditDiff.refundMode = { before: "suggested", after: request.refundMode ?? "suggested" };
      if (request.refundDeviationReason) {
        auditDiff.refundDeviationReason = {
          before: null,
          after: request.refundDeviationReason.trim(),
        };
      }
    }

    const auditReasonParts = [
      request.lateChangeReason?.trim(),
      pricing.complementTTC > 0 && !request.billDifference
        ? `Geste commercial (complément non facturé) : ${request.skipBillingReason?.trim()}`
        : undefined,
    ].filter(Boolean);

    await writePlanningManageAudit({
      profile,
      action: "reservation.date_change",
      reservationId: reservation._id,
      diff: auditDiff,
      reason: auditReasonParts.length > 0 ? auditReasonParts.join(" — ") : undefined,
    });

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (clientEmail) {
      const email = renderDateChangeEmail({
        reservationReference: reservation.reference,
        kind,
        previousStartAt: formatFrDateTime(previousStartAt),
        previousEndAt: formatFrDateTime(previousEndAt),
        nextStartAt: formatFrDateTime(newStart),
        nextEndAt: formatFrDateTime(newEnd),
        complementTTC: pricing.complementTTC,
        billedDifference,
      });
      // PDF only when a complement line was appended to the proforma.
      const attachments = billedDifference
        ? await buildProformaPdfAttachments(this.invoicePdf, invoice?.reference, (error) =>
            this.logger.error(
              `Invoice PDF attachment failed for date-change ${invoice?.reference}: ${String(error)}`,
            ),
          )
        : undefined;
      await this.mail.sendMail({
        to: clientEmail,
        subject: email.subject,
        html: email.html,
        attachments,
      });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningDateChangeResult = {
      reservation: detail,
      kind,
      complementTTC: pricing.complementTTC,
      billedDifference,
      suggestedRefundCents,
      acceptedRefundCents,
    };
    return PlanningDateChangeResultSchema.parse(result);
  }

  async previewPartySize(
    profile: StaffProfileDocument,
    reservationId: string,
    newPartySize: number,
  ): Promise<PlanningPartySizePreview> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const Space = await getSpaceModel();
    const space = await Space.findById(reservation.spaceId).select({ capacity: 1 }).lean().exec();
    const capacity =
      typeof space?.capacity === "number" && space.capacity > 0 ? space.capacity : undefined;
    const exceedsCapacity = capacity != null && newPartySize > capacity;

    const payload: PlanningPartySizePreview = {
      reservationId: String(reservation._id),
      currentPartySize: Math.max(1, Math.trunc(reservation.partySize ?? 1)),
      newPartySize,
      capacity,
      exceedsCapacity,
      suggestSpaceChange: exceedsCapacity,
    };
    return PlanningPartySizePreviewSchema.parse(payload);
  }

  async confirmPartySize(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningPartySizeRequest,
  ): Promise<PlanningPartySizeResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (isReservationReadOnly(reservation.status)) {
      throw new ConflictException({
        code: "RESERVATION_READ_ONLY",
        message: "Cette réservation est en lecture seule (annulée, terminée ou no-show)",
      });
    }

    const Space = await getSpaceModel();
    const space = await Space.findById(reservation.spaceId).select({ capacity: 1 }).lean().exec();
    const capacity =
      typeof space?.capacity === "number" && space.capacity > 0 ? space.capacity : undefined;
    if (capacity != null && request.newPartySize > capacity) {
      throw new ConflictException({
        code: "PARTY_SIZE_EXCEEDS_CAPACITY",
        message: `La capacité de l'espace (${capacity}) est dépassée. Changez d'espace ou réduisez l'effectif.`,
      });
    }

    const previousPartySize = Math.max(1, Math.trunc(reservation.partySize ?? 1));
    reservation.partySize = request.newPartySize;
    await reservation.save();

    await writePlanningManageAudit({
      profile,
      action: "reservation.party_size_change",
      reservationId: reservation._id,
      diff: {
        partySize: { before: previousPartySize, after: request.newPartySize },
        spaceId: { before: String(reservation.spaceId), after: String(reservation.spaceId) },
      },
      reason: request.note?.trim(),
    });

    const clientEmail = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (clientEmail) {
      const email = renderPartySizeEmail({
        reservationReference: reservation.reference,
        spaceName: reservation.spaceSnapshot?.name ?? "Espace",
        startAt: formatFrDateTime(reservation.startAt),
        endAt: formatFrDateTime(reservation.endAt),
        previousPartySize,
        newPartySize: request.newPartySize,
      });
      await this.mail.sendMail({ to: clientEmail, subject: email.subject, html: email.html });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningPartySizeResult = {
      reservation: detail,
      previousPartySize,
      newPartySize: request.newPartySize,
    };
    return PlanningPartySizeResultSchema.parse(result);
  }

  async previewContactTransfer(
    profile: StaffProfileDocument,
    reservationId: string,
    nextClientAccountId: string,
  ): Promise<PlanningContactTransferPreview> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).lean().exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const currentContact =
      detail.contacts.find((contact) => contact.id === detail.clientAccountId) ??
      detail.contacts[0] ??
      null;
    const nextContact =
      detail.contacts.find((contact) => contact.id === nextClientAccountId) ?? null;
    const eligible = nextContact != null && nextContact.id !== detail.clientAccountId;
    const reason = !nextContact
      ? "Ce contact n'appartient pas au même dossier client (cardex)"
      : nextContact.id === detail.clientAccountId
        ? "Ce contact est déjà le contact principal de la réservation"
        : undefined;

    const payload: PlanningContactTransferPreview = {
      reservationId: String(reservation._id),
      currentContact,
      nextContact,
      eligible,
      reason,
    };
    return PlanningContactTransferPreviewSchema.parse(payload);
  }

  async confirmContactTransfer(
    profile: StaffProfileDocument,
    reservationId: string,
    request: PlanningContactTransferRequest,
  ): Promise<PlanningContactTransferResult> {
    await connectMongo();
    const id = assertObjectId(reservationId, "reservationId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (isReservationReadOnly(reservation.status)) {
      throw new ConflictException({
        code: "RESERVATION_READ_ONLY",
        message: "Cette réservation est en lecture seule (annulée, terminée ou no-show)",
      });
    }

    const detail = await this.planning.getReservationDetail(profile, reservationId);
    const nextContact = detail.contacts.find(
      (contact) => contact.id === request.nextClientAccountId,
    );
    if (!nextContact) {
      throw new BadRequestException({
        code: "CONTACT_NOT_ELIGIBLE",
        message: "Ce contact n'appartient pas au même dossier client (cardex)",
      });
    }
    const previousClientAccountId = reservation.clientAccountId
      ? String(reservation.clientAccountId)
      : undefined;
    if (previousClientAccountId === nextContact.id) {
      throw new BadRequestException({
        code: "CONTACT_UNCHANGED",
        message: "Ce contact est déjà le contact principal de la réservation",
      });
    }

    const ClientAccount = await getClientAccountModel();
    const nextAccount = await ClientAccount.findById(nextContact.id).select({ email: 1 }).exec();
    if (!nextAccount) {
      throw new NotFoundException({
        code: "CONTACT_NOT_FOUND",
        message: "Compte client introuvable",
      });
    }

    const previousEmail = await this.resolveClientEmail(previousClientAccountId);

    reservation.clientAccountId = nextAccount._id;
    await reservation.save();

    await writePlanningManageAudit({
      profile,
      action: "reservation.contact_transfer",
      reservationId: reservation._id,
      diff: {
        clientAccountId: { before: previousClientAccountId ?? null, after: nextContact.id },
        contactEmail: { before: previousEmail ?? null, after: nextAccount.email },
        spaceId: { before: String(reservation.spaceId), after: String(reservation.spaceId) },
      },
    });

    const spaceName = reservation.spaceSnapshot?.name ?? "Espace";
    const startAt = formatFrDateTime(reservation.startAt);
    const endAt = formatFrDateTime(reservation.endAt);
    if (previousEmail) {
      const email = renderContactTransferEmail({
        reservationReference: reservation.reference,
        spaceName,
        startAt,
        endAt,
        previousContactLabel: previousEmail,
        nextContactLabel: nextAccount.email,
        audience: "previous",
      });
      await this.mail.sendMail({ to: previousEmail, subject: email.subject, html: email.html });
    }
    if (nextAccount.email) {
      const email = renderContactTransferEmail({
        reservationReference: reservation.reference,
        spaceName,
        startAt,
        endAt,
        previousContactLabel: previousEmail ?? "—",
        nextContactLabel: nextAccount.email,
        audience: "next",
      });
      await this.mail.sendMail({ to: nextAccount.email, subject: email.subject, html: email.html });
    }

    const detailAfter = await this.planning.getReservationDetail(profile, reservationId);
    const result: PlanningContactTransferResult = {
      reservation: detailAfter,
      previousClientAccountId,
      nextClientAccountId: nextContact.id,
    };
    return PlanningContactTransferResultSchema.parse(result);
  }

  private parseDateChangeInput(
    reservation: { startAt: Date; endAt: Date },
    startAtRaw: string,
    endAtRaw: string,
  ): { newStart: Date; newEnd: Date; kind: DateChangeKind } {
    if (!startAtRaw || !endAtRaw) {
      throw new BadRequestException({
        code: "MISSING_DATE",
        message: "startAt et endAt sont requis (ISO 8601)",
      });
    }
    const newStart = new Date(startAtRaw);
    const newEnd = new Date(endAtRaw);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new BadRequestException({ code: "INVALID_DATE", message: "Date invalide" });
    }
    if (newEnd <= newStart) {
      throw new BadRequestException({
        code: "INVALID_RANGE",
        message: "La date de fin doit être postérieure à la date de début",
      });
    }
    if (
      newStart.getTime() === reservation.startAt.getTime() &&
      newEnd.getTime() === reservation.endAt.getTime()
    ) {
      throw new BadRequestException({
        code: "DATE_UNCHANGED",
        message: "Les dates n'ont pas changé",
      });
    }

    const kind = classifyDateChange({
      oldStart: reservation.startAt,
      oldEnd: reservation.endAt,
      newStart,
      newEnd,
    });
    return { newStart, newEnd, kind };
  }

  private async checkDateChangeAvailability(
    reservation: { _id: Types.ObjectId; spaceId: Types.ObjectId; startAt: Date; endAt: Date },
    kind: DateChangeKind,
    newStart: Date,
    newEnd: Date,
  ): Promise<ReservationDocument | null> {
    if (kind === "extend") {
      if (newStart.getTime() < reservation.startAt.getTime()) {
        const overlap = await findOverlappingReservation(
          reservation.spaceId,
          newStart,
          reservation.startAt,
          undefined,
          reservation._id,
        );
        if (overlap) {
          return overlap;
        }
      }
      if (newEnd.getTime() > reservation.endAt.getTime()) {
        const overlap = await findOverlappingReservation(
          reservation.spaceId,
          reservation.endAt,
          newEnd,
          undefined,
          reservation._id,
        );
        if (overlap) {
          return overlap;
        }
      }
      return null;
    }

    const isSubsetOfOld =
      newStart.getTime() >= reservation.startAt.getTime() &&
      newEnd.getTime() <= reservation.endAt.getTime();
    if (kind === "shorten" && isSubsetOfOld) {
      return null;
    }

    // Shift (or a shorten that also moves outside the original range): full check.
    return findOverlappingReservation(
      reservation.spaceId,
      newStart,
      newEnd,
      undefined,
      reservation._id,
    );
  }

  private async describeOverlapConflict(overlap: {
    _id: Types.ObjectId;
    reference: string;
    startAt: Date;
    endAt: Date;
    cardexId?: Types.ObjectId | null;
  }): Promise<PlanningRestoreConflict> {
    let clientLabel = overlap.reference;
    if (overlap.cardexId) {
      const Cardex = await getCardexModel();
      const cardex = await Cardex.findById(overlap.cardexId)
        .select({ identity: 1, company: 1 })
        .lean()
        .exec();
      if (cardex) {
        clientLabel = formatClientLabel({
          firstName: cardex.identity?.firstName,
          lastName: cardex.identity?.lastName,
          companyName: cardex.company?.legalName,
        });
      }
    }
    return {
      id: String(overlap._id),
      reference: overlap.reference,
      clientLabel,
      startAt: toIso(overlap.startAt),
      endAt: toIso(overlap.endAt),
    };
  }

  private async priceDateChange(
    reservation: {
      spaceId: Types.ObjectId;
      durationClass: string;
    },
    newStart: Date,
    newEnd: Date,
    oldStart: Date,
    oldEnd: Date,
  ): Promise<{
    previousDurationClass: SpaceStayPricing["durationClass"];
    nextDurationClass: SpaceStayPricing["durationClass"];
    unitPriceHT: number;
    vatRate: number;
    previousUnits: number;
    nextUnits: number;
    previousSpaceTTC: number;
    nextSpaceTTC: number;
    complementTTC: number;
  }> {
    const Space = await getSpaceModel();
    const space = await Space.findById(reservation.spaceId).select({ tariffs: 1 }).lean().exec();
    const tariffs = (space?.tariffs ?? []).map((tariff) => ({
      durationClass: tariff.durationClass as SpaceStayPricing["durationClass"],
      priceHT: tariff.priceHT,
      vatRate: tariff.vatRate,
      enabled: tariff.enabled,
    }));

    let previous: SpaceStayPricing;
    let next: SpaceStayPricing;
    try {
      previous = resolveSpaceStayPricing({ startAt: oldStart, endAt: oldEnd, tariffs });
      next = resolveSpaceStayPricing({ startAt: newStart, endAt: newEnd, tariffs });
    } catch {
      throw new BadRequestException({
        code: "TARIFF_UNAVAILABLE",
        message: "Aucun tarif applicable pour cette durée sur cet espace",
      });
    }

    const complementTTC = Math.max(0, next.spaceTTC - previous.spaceTTC);

    return {
      previousDurationClass: previous.durationClass,
      nextDurationClass: next.durationClass,
      unitPriceHT: next.unitPriceHT,
      vatRate: next.vatRate,
      previousUnits: previous.units,
      nextUnits: next.units,
      previousSpaceTTC: previous.spaceTTC,
      nextSpaceTTC: next.spaceTTC,
      complementTTC,
    };
  }

  private async computeRestoreEligibility(reservation: {
    _id: Types.ObjectId;
    reference: string;
    status: string;
    spaceId: Types.ObjectId;
    startAt: Date;
    endAt: Date;
    cardexId?: Types.ObjectId | null;
  }): Promise<{
    canRestore: boolean;
    refundEligible: boolean;
    acceptedRefundCentsAtCancel: number | null;
    slotAvailable: boolean;
    conflictingReservation: PlanningRestorePreview["conflictingReservation"];
  }> {
    if (reservation.status !== "cancelled") {
      return {
        canRestore: false,
        refundEligible: false,
        acceptedRefundCentsAtCancel: null,
        slotAvailable: false,
        conflictingReservation: null,
      };
    }

    const AuditLog = await getAuditLogModel();
    const cancelAudit = await AuditLog.findOne({
      action: "reservation.cancel",
      "entity.type": "reservation",
      "entity.id": reservation._id,
    })
      .sort({ at: -1 })
      .lean()
      .exec();

    const acceptedRaw = cancelAudit?.diff?.acceptedRefundCents?.after;
    const acceptedRefundCentsAtCancel =
      typeof acceptedRaw === "number" && Number.isInteger(acceptedRaw) && acceptedRaw >= 0
        ? acceptedRaw
        : null;
    const refundEligible = acceptedRefundCentsAtCancel === 0;

    const overlap = await findOverlappingReservation(
      reservation.spaceId,
      reservation.startAt,
      reservation.endAt,
      undefined,
      reservation._id,
    );

    let conflictingReservation: PlanningRestorePreview["conflictingReservation"] = null;
    if (overlap) {
      let clientLabel = overlap.reference;
      if (overlap.cardexId) {
        const Cardex = await getCardexModel();
        const cardex = await Cardex.findById(overlap.cardexId)
          .select({ identity: 1, company: 1 })
          .lean()
          .exec();
        if (cardex) {
          clientLabel = formatClientLabel({
            firstName: cardex.identity?.firstName,
            lastName: cardex.identity?.lastName,
            companyName: cardex.company?.legalName,
          });
        }
      }
      conflictingReservation = {
        id: String(overlap._id),
        reference: overlap.reference,
        clientLabel,
        startAt: toIso(overlap.startAt),
        endAt: toIso(overlap.endAt),
      };
    }

    const slotAvailable = !overlap;
    return {
      canRestore: refundEligible && slotAvailable,
      refundEligible,
      acceptedRefundCentsAtCancel,
      slotAvailable,
      conflictingReservation,
    };
  }

  private async loadReservationAndNextSpace(
    profile: StaffProfileDocument,
    reservationId: string,
    nextSpaceId: string,
  ) {
    const id = assertObjectId(reservationId, "reservationId");
    const nextId = assertObjectId(nextSpaceId, "nextSpaceId");

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(id).exec();
    if (!reservation) {
      throw new NotFoundException({
        code: "RESERVATION_NOT_FOUND",
        message: "Réservation introuvable",
      });
    }
    if (!isBuildingIdInScope(reservation.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const Space = await getSpaceModel();
    const nextSpace = await Space.findById(nextId).exec();
    if (!nextSpace) {
      throw new NotFoundException({
        code: "SPACE_NOT_FOUND",
        message: "Espace introuvable",
      });
    }
    if (!isBuildingIdInScope(nextSpace.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }
    if (nextSpace.status !== "active") {
      throw new BadRequestException({
        code: "SPACE_INACTIVE",
        message: "Cet espace n'est pas actif",
      });
    }

    return { reservation, nextSpace };
  }

  private repriceWithNextSpace(
    reservation: {
      durationClass: string;
      services: ReadonlyArray<{
        serviceId: unknown;
        label: string;
        qty: number;
        unitPriceHT: number;
        vatRate: number;
      }>;
    },
    nextSpace: {
      name: string;
      _id: unknown;
      tariffs: ReadonlyArray<{
        durationClass: string;
        priceHT: number;
        vatRate: number;
        enabled: boolean;
      }>;
    },
  ) {
    const tariff = nextSpace.tariffs.find(
      (t) => t.durationClass === reservation.durationClass && t.enabled,
    );
    if (!tariff) {
      throw new BadRequestException({
        code: "TARIFF_UNAVAILABLE",
        message: "Aucun tarif actif pour cette durée sur le nouvel espace",
      });
    }

    const lines: BookingPriceLineInput[] = [
      {
        label: nextSpace.name,
        kind: "space",
        refId: String(nextSpace._id),
        qty: 1,
        unitPriceHT: tariff.priceHT,
        vatRate: tariff.vatRate,
      },
      ...reservation.services.map((service) => ({
        label: service.label,
        kind: "service" as const,
        refId: String(service.serviceId),
        qty: service.qty,
        unitPriceHT: service.unitPriceHT,
        vatRate: service.vatRate,
      })),
    ];

    return computeBookingPrice({ lines });
  }

  private async resolveClientEmail(clientAccountId: string | undefined): Promise<string | null> {
    if (!clientAccountId) {
      return null;
    }
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(clientAccountId)
      .select({ email: 1 })
      .lean()
      .exec();
    return account?.email?.trim().toLowerCase() || null;
  }
}
