import type { Types } from "mongoose";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  computeBookingPrice,
  computePriceDeltaCents,
  computeSuggestedRefundCents,
  PlanningCancelPreviewSchema,
  PlanningCancelResultSchema,
  PlanningManageSpaceOptionSchema,
  PlanningRestorePreviewSchema,
  PlanningRestoreResultSchema,
  PlanningSpaceChangePreviewSchema,
  PlanningSpaceChangeResultSchema,
  type BookingPriceLineInput,
  type PlanningCancelPreview,
  type PlanningCancelRequest,
  type PlanningCancelResult,
  type PlanningManageSpaceOption,
  type PlanningRestorePreview,
  type PlanningRestoreRequest,
  type PlanningRestoreResult,
  type PlanningSpaceChangePreview,
  type PlanningSpaceChangeRequest,
  type PlanningSpaceChangeResult,
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
  type StaffProfileDocument,
  type StatusHistoryEntry,
} from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService } from "../mail/mail.service.js";
import { writePlanningManageAudit } from "./planning-manage-audit.js";
import {
  renderCancellationEmail,
  renderRestoreEmail,
  renderSpaceChangeEmail,
} from "./planning-manage-emails.js";
import { PlanningService } from "./planning.service.js";
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
  constructor(
    private readonly mail: MailService,
    private readonly planning: PlanningService,
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
      await this.mail.sendMail({ to: clientEmail, subject: email.subject, html: email.html });
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
