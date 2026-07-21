import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PlanningCalendarResponseSchema,
  PlanningOccupancyResponseSchema,
  PlanningReservationDetailSchema,
  PlanningSearchResponseSchema,
  PlanningSpaceHistoryResponseSchema,
  ServiceCustomAnswerSchema,
  type PlanningCalendarResponse,
  type PlanningHistoryEvent,
  type PlanningHistoryEventType,
  type PlanningOccupancyMetric,
  type PlanningOccupancyResponse,
  type PlanningPaymentStatus,
  type PlanningReservationDetail,
  type PlanningSearchResponse,
  type PlanningSpaceHistoryResponse,
  type ServiceCustomAnswer,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getAuditLogModel,
  getBuildingModel,
  getCardexModel,
  getClientAccountModel,
  getInvoiceModel,
  getPaymentModel,
  getReservationModel,
  getSlotClosureModel,
  getSpaceModel,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import type { Types } from "mongoose";

import {
  asReservationStatus,
  asSpaceType,
  endOfLocalDay,
  endOfMonthLocal,
  endOfWeekSundayLocal,
  formatClientLabel,
  formatOccupancyDayLabel,
  formatOccupancyMonthLabel,
  formatOccupancyWeekLabel,
  isBuildingIdInScope,
  isReservationReadOnly,
  mapInvoicePaymentStatus,
  mergeContactAccountIds,
  occupancyRatePercent,
  rangesOverlap,
  splitReservationSubtotalHT,
  startOfLocalDay,
  startOfMonthLocal,
  startOfWeekMondayLocal,
  type PlanningContactLinkVia,
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

function parseIsoDate(value: string | undefined, label: string): Date {
  if (!value) {
    throw new BadRequestException({
      code: "MISSING_DATE",
      message: `${label} requis (ISO 8601)`,
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: "INVALID_DATE",
      message: `${label} invalide`,
    });
  }
  return date;
}

function toIso(date: Date): string {
  return date.toISOString();
}

function formatFrDateTime(value: Date): string {
  return value.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
}

function auditDiffDateLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return formatFrDateTime(date);
}

/** Follow-up audits that only record SMTP delivery (same action as the mutation). */
function isEmailDeliveryOnlyAudit(
  diff?: Record<string, { before: unknown; after: unknown }> | null,
): boolean {
  if (!diff || diff.emailSent == null) {
    return false;
  }
  const substantive = Object.keys(diff).filter(
    (key) => key !== "spaceId" && key !== "emailSent" && key !== "emailError",
  );
  return substantive.length === 0;
}

function withEmailDeliveryHint(
  detail: string | undefined,
  diff?: Record<string, { before: unknown; after: unknown }> | null,
): string | undefined {
  if (diff?.emailSent?.after !== false) {
    return detail;
  }
  const hint = "⚠ Email non envoyé";
  return detail ? `${detail} · ${hint}` : hint;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

@Injectable()
export class PlanningService {
  async getOccupancy(profile: StaffProfileDocument): Promise<PlanningOccupancyResponse> {
    await connectMongo();

    const now = new Date();
    const dayStart = startOfLocalDay(now);
    const dayEnd = endOfLocalDay(now);
    const weekStart = startOfWeekMondayLocal(now);
    const weekEnd = endOfWeekSundayLocal(now);
    const monthStart = startOfMonthLocal(now);
    const monthEnd = endOfMonthLocal(now);

    const rangeStart = new Date(
      Math.min(dayStart.getTime(), weekStart.getTime(), monthStart.getTime()),
    );
    const rangeEnd = new Date(Math.max(dayEnd.getTime(), weekEnd.getTime(), monthEnd.getTime()));

    const Building = await getBuildingModel();
    const Space = await getSpaceModel();
    const Reservation = await getReservationModel();

    const activeBuildingsQuery: Record<string, unknown> = { status: "active" };
    if (profile.scope.buildingIds.length > 0) {
      activeBuildingsQuery._id = { $in: profile.scope.buildingIds };
    }

    const buildings = await Building.find(activeBuildingsQuery).select({ _id: 1 }).lean().exec();
    const buildingIds = buildings.map((b) => b._id);

    const spaces = buildingIds.length
      ? await Space.find({
          status: "active",
          buildingId: { $in: buildingIds },
        })
          .select({ _id: 1 })
          .lean()
          .exec()
      : [];

    const spaceIds = spaces.map((s) => s._id);
    const totalActiveSpaces = spaceIds.length;

    const reservations =
      spaceIds.length === 0
        ? []
        : await Reservation.find({
            spaceId: { $in: spaceIds },
            status: { $ne: "cancelled" },
            startAt: { $lt: rangeEnd },
            endAt: { $gt: rangeStart },
          })
            .select({ spaceId: 1, startAt: 1, endAt: 1, status: 1, reference: 1 })
            .lean()
            .exec();

    const countOccupied = (predicate: (startAt: Date, endAt: Date) => boolean): number => {
      const occupied = new Set<string>();
      for (const reservation of reservations) {
        const startAt = new Date(reservation.startAt);
        const endAt = new Date(reservation.endAt);
        if (!predicate(startAt, endAt)) {
          continue;
        }
        occupied.add(String(reservation.spaceId));
      }
      return occupied.size;
    };

    const buildMetric = (input: {
      occupiedSpaces: number;
      periodLabel: string;
      periodStart: Date;
      periodEnd: Date;
    }): PlanningOccupancyMetric => ({
      rate: occupancyRatePercent(input.occupiedSpaces, totalActiveSpaces),
      occupiedSpaces: input.occupiedSpaces,
      totalActiveSpaces,
      periodLabel: input.periodLabel,
      periodStart: toIso(input.periodStart),
      periodEnd: toIso(input.periodEnd),
    });

    const payload: PlanningOccupancyResponse = {
      computedAt: toIso(now),
      totalActiveSpaces,
      day: buildMetric({
        occupiedSpaces: countOccupied((startAt, endAt) =>
          rangesOverlap(startAt, endAt, dayStart, dayEnd),
        ),
        periodLabel: formatOccupancyDayLabel(now),
        periodStart: dayStart,
        periodEnd: dayEnd,
      }),
      week: buildMetric({
        occupiedSpaces: countOccupied((startAt, endAt) =>
          rangesOverlap(startAt, endAt, weekStart, weekEnd),
        ),
        periodLabel: formatOccupancyWeekLabel(weekStart, weekEnd),
        periodStart: weekStart,
        periodEnd: weekEnd,
      }),
      month: buildMetric({
        occupiedSpaces: countOccupied((startAt, endAt) =>
          rangesOverlap(startAt, endAt, monthStart, monthEnd),
        ),
        periodLabel: formatOccupancyMonthLabel(now),
        periodStart: monthStart,
        periodEnd: monthEnd,
      }),
    };

    return PlanningOccupancyResponseSchema.parse(payload);
  }

  async search(
    profile: StaffProfileDocument,
    query: { q?: string },
  ): Promise<PlanningSearchResponse> {
    await connectMongo();

    const raw = (query.q ?? "").trim();
    if (raw.length < 2) {
      return PlanningSearchResponseSchema.parse({ query: raw, results: [] });
    }

    const Building = await getBuildingModel();
    const Space = await getSpaceModel();
    const Reservation = await getReservationModel();
    const Cardex = await getCardexModel();
    const Invoice = await getInvoiceModel();

    const activeBuildingsQuery: Record<string, unknown> = { status: "active" };
    if (profile.scope.buildingIds.length > 0) {
      activeBuildingsQuery._id = { $in: profile.scope.buildingIds };
    }
    const buildings = await Building.find(activeBuildingsQuery).select({ _id: 1 }).lean().exec();
    const buildingIds = buildings.map((b) => b._id);
    const spaces = buildingIds.length
      ? await Space.find({
          status: "active",
          buildingId: { $in: buildingIds },
        })
          .select({ _id: 1 })
          .lean()
          .exec()
      : [];
    const spaceIds = spaces.map((s) => s._id);
    if (spaceIds.length === 0) {
      return PlanningSearchResponseSchema.parse({ query: raw, results: [] });
    }

    const pattern = escapeRegex(raw);
    const regex = new RegExp(pattern, "i");

    const [cardexMatches, invoiceMatches] = await Promise.all([
      Cardex.find({
        $or: [
          { "identity.firstName": regex },
          { "identity.lastName": regex },
          { "company.legalName": regex },
        ],
      })
        .select({ _id: 1 })
        .limit(50)
        .lean()
        .exec(),
      Invoice.find({ reference: regex })
        .select({ reservationId: 1, reference: 1, status: 1, totals: 1 })
        .limit(50)
        .lean()
        .exec(),
    ]);

    const cardexIds = cardexMatches.map((doc) => doc._id);
    const invoiceReservationIds = invoiceMatches
      .map((doc) => doc.reservationId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const orClauses: Record<string, unknown>[] = [
      { reference: regex },
      { "spaceSnapshot.name": regex },
    ];
    if (cardexIds.length > 0) {
      orClauses.push({ cardexId: { $in: cardexIds } });
    }
    if (invoiceReservationIds.length > 0) {
      orClauses.push({ _id: { $in: invoiceReservationIds } });
    }

    const reservations = await Reservation.find({
      spaceId: { $in: spaceIds },
      status: { $ne: "cancelled" },
      $or: orClauses,
    })
      .select({
        reference: 1,
        spaceId: 1,
        startAt: 1,
        endAt: 1,
        status: 1,
        spaceSnapshot: 1,
        cardexId: 1,
      })
      .sort({ startAt: -1 })
      .limit(25)
      .lean()
      .exec();

    const reservationIds = reservations.map((r) => r._id);
    const reservationCardexIds = [
      ...new Set(
        reservations
          .map((r) => r.cardexId)
          .filter((id): id is Types.ObjectId => Boolean(id))
          .map((id) => String(id)),
      ),
    ];

    const [invoices, cardexDocs] = await Promise.all([
      reservationIds.length
        ? Invoice.find({ reservationId: { $in: reservationIds } })
            .select({ reservationId: 1, reference: 1, status: 1, totals: 1 })
            .lean()
            .exec()
        : Promise.resolve([]),
      reservationCardexIds.length
        ? Cardex.find({ _id: { $in: reservationCardexIds } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const invoiceByReservationId = new Map(
      invoices.filter((inv) => inv.reservationId).map((inv) => [String(inv.reservationId), inv]),
    );
    const cardexById = new Map(cardexDocs.map((c) => [String(c._id), c]));

    const results = reservations.map((r) => {
      const status = asReservationStatus(r.status);
      const invoice = invoiceByReservationId.get(String(r._id));
      const cardex = r.cardexId ? cardexById.get(String(r.cardexId)) : undefined;
      const paymentStatus = mapInvoicePaymentStatus({
        invoiceStatus: invoice?.status,
        paidTotal: invoice?.totals?.paidTotal,
        balanceDue: invoice?.totals?.balanceDue,
        reservationStatus: status,
      });
      return {
        reservationId: String(r._id),
        reference: r.reference,
        clientLabel: formatClientLabel({
          firstName: cardex?.identity?.firstName,
          lastName: cardex?.identity?.lastName,
          companyName: cardex?.company?.legalName,
        }),
        spaceName: r.spaceSnapshot?.name ?? "Espace",
        startAt: toIso(r.startAt),
        endAt: toIso(r.endAt),
        paymentStatus,
        invoiceReference: invoice?.reference,
      };
    });

    return PlanningSearchResponseSchema.parse({ query: raw, results });
  }

  async getCalendar(
    profile: StaffProfileDocument,
    query: { from?: string; to?: string; buildingId?: string },
  ): Promise<PlanningCalendarResponse> {
    await connectMongo();

    const from = parseIsoDate(query.from, "from");
    const to = parseIsoDate(query.to, "to");
    if (to <= from) {
      throw new BadRequestException({
        code: "INVALID_RANGE",
        message: "La plage to doit être postérieure à from",
      });
    }

    const scopedBuildingIds = profile.scope.buildingIds;
    let buildingFilterId: string | undefined;
    if (query.buildingId) {
      buildingFilterId = assertObjectId(query.buildingId, "buildingId");
      if (
        scopedBuildingIds.length > 0 &&
        !scopedBuildingIds.some((id) => String(id) === buildingFilterId)
      ) {
        throw new ForbiddenException();
      }
    }

    const Building = await getBuildingModel();
    const Space = await getSpaceModel();
    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();
    const Cardex = await getCardexModel();
    const SlotClosure = await getSlotClosureModel();

    const activeBuildingsQuery: Record<string, unknown> = { status: "active" };
    if (buildingFilterId) {
      activeBuildingsQuery._id = buildingFilterId;
    } else if (scopedBuildingIds.length > 0) {
      activeBuildingsQuery._id = { $in: scopedBuildingIds };
    }

    const buildings = await Building.find(activeBuildingsQuery)
      .select({ name: 1 })
      .sort({ name: 1 })
      .lean()
      .exec();

    const buildingIds = buildings.map((b) => b._id);
    const buildingNameById = new Map(buildings.map((b) => [String(b._id), b.name]));

    // Active spaces only — never featuredOnVitrine / visibleOnVitrine
    const spaces = buildingIds.length
      ? await Space.find({
          status: "active",
          buildingId: { $in: buildingIds },
        })
          .select({ name: 1, type: 1, buildingId: 1, floor: 1, capacity: 1 })
          .sort({ type: 1, name: 1 })
          .lean()
          .exec()
      : [];

    const spaceIds = spaces.map((s) => s._id);

    const reservations =
      spaceIds.length === 0
        ? []
        : await Reservation.find({
            spaceId: { $in: spaceIds },
            startAt: { $lt: to },
            endAt: { $gt: from },
          })
            .select({
              reference: 1,
              spaceId: 1,
              buildingId: 1,
              startAt: 1,
              endAt: 1,
              status: 1,
              spaceSnapshot: 1,
              cardexId: 1,
              pricing: 1,
            })
            .lean()
            .exec();

    const reservationIds = reservations.map((r) => r._id);
    const cardexIds = [
      ...new Set(
        reservations
          .map((r) => r.cardexId)
          .filter((id): id is Types.ObjectId => Boolean(id))
          .map((id) => String(id)),
      ),
    ];

    const [invoices, cardexDocs, closures] = await Promise.all([
      reservationIds.length
        ? Invoice.find({ reservationId: { $in: reservationIds } })
            .select({
              reservationId: 1,
              reference: 1,
              status: 1,
              totals: 1,
            })
            .lean()
            .exec()
        : Promise.resolve([]),
      cardexIds.length
        ? Cardex.find({ _id: { $in: cardexIds } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : Promise.resolve([]),
      SlotClosure.find({
        startAt: { $lt: to },
        endAt: { $gt: from },
        $or: [
          { "scope.spaceId": { $in: spaceIds } },
          { "scope.buildingId": { $in: buildingIds } },
          { "scope.spaceType": { $exists: true } },
        ],
      })
        .lean()
        .exec(),
    ]);

    const invoiceByReservationId = new Map(
      invoices.filter((inv) => inv.reservationId).map((inv) => [String(inv.reservationId), inv]),
    );
    const cardexById = new Map(cardexDocs.map((c) => [String(c._id), c]));

    const payload: PlanningCalendarResponse = {
      from: toIso(from),
      to: toIso(to),
      buildings: buildings.map((b) => ({
        id: String(b._id),
        name: b.name,
      })),
      spaces: spaces.map((s) => ({
        id: String(s._id),
        buildingId: String(s.buildingId),
        buildingName: buildingNameById.get(String(s.buildingId)) ?? "—",
        name: s.name,
        type: asSpaceType(s.type),
        floor: s.floor != null ? String(s.floor) : undefined,
        capacity: typeof s.capacity === "number" && s.capacity > 0 ? s.capacity : undefined,
      })),
      reservations: reservations.map((r) => {
        const status = asReservationStatus(r.status);
        const invoice = invoiceByReservationId.get(String(r._id));
        const cardex = r.cardexId ? cardexById.get(String(r.cardexId)) : undefined;
        const paymentStatus = mapInvoicePaymentStatus({
          invoiceStatus: invoice?.status,
          paidTotal: invoice?.totals?.paidTotal,
          balanceDue: invoice?.totals?.balanceDue,
          reservationStatus: status,
        });
        return {
          id: String(r._id),
          reference: r.reference,
          spaceId: String(r.spaceId),
          buildingId: String(r.buildingId),
          startAt: toIso(r.startAt),
          endAt: toIso(r.endAt),
          status,
          paymentStatus,
          clientLabel: formatClientLabel({
            firstName: cardex?.identity?.firstName,
            lastName: cardex?.identity?.lastName,
            companyName: cardex?.company?.legalName,
          }),
          clientFirstName: cardex?.identity?.firstName,
          clientLastName: cardex?.identity?.lastName,
          clientCompanyName: cardex?.company?.legalName,
          spaceName: r.spaceSnapshot?.name ?? "Espace",
          totalTTC: Math.trunc(r.pricing?.totalTTC ?? 0),
          invoiceReference: invoice?.reference,
        };
      }),
      closures: closures.map((c) => ({
        id: String(c._id),
        kind: c.kind,
        startAt: toIso(c.startAt),
        endAt: toIso(c.endAt),
        reason: c.reason,
        spaceId: c.scope.spaceId ? String(c.scope.spaceId) : undefined,
        buildingId: c.scope.buildingId ? String(c.scope.buildingId) : undefined,
        spaceType: c.scope.spaceType ? asSpaceType(c.scope.spaceType) : undefined,
      })),
    };

    return PlanningCalendarResponseSchema.parse(payload);
  }

  async getReservationDetail(
    profile: StaffProfileDocument,
    reservationId: string,
  ): Promise<PlanningReservationDetail> {
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

    const [Building, Space, Invoice, Cardex, ClientAccount, Payment] = await Promise.all([
      getBuildingModel(),
      getSpaceModel(),
      getInvoiceModel(),
      getCardexModel(),
      getClientAccountModel(),
      getPaymentModel(),
    ]);

    const [building, space, invoice, cardex] = await Promise.all([
      Building.findById(reservation.buildingId).select({ name: 1 }).lean().exec(),
      Space.findById(reservation.spaceId).select({ name: 1, type: 1, capacity: 1 }).lean().exec(),
      Invoice.findOne({ reservationId: reservation._id })
        .select({ reference: 1, status: 1, totals: 1, lines: 1 })
        .lean()
        .exec(),
      reservation.cardexId
        ? Cardex.findById(reservation.cardexId).lean().exec()
        : Promise.resolve(null),
    ]);

    const status = asReservationStatus(reservation.status);
    const paymentStatus = mapInvoicePaymentStatus({
      invoiceStatus: invoice?.status,
      paidTotal: invoice?.totals?.paidTotal,
      balanceDue: invoice?.totals?.balanceDue,
      reservationStatus: status,
    });

    let refundStatus: PlanningReservationDetail["refundStatus"] = "none";
    let stripeRefundId: string | undefined;
    if (invoice?._id) {
      const latestRefund = await Payment.findOne({
        invoiceId: invoice._id,
        kind: "refund",
      })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
      if (latestRefund) {
        stripeRefundId = latestRefund.reconciliation?.stripeRefundId;
        if (latestRefund.reconciliation?.status === "pending") {
          refundStatus = "pending";
        } else if (latestRefund.reconciliation?.status === "failed") {
          refundStatus = "failed";
        } else if (latestRefund.method === "transfer") {
          refundStatus = "manual_succeeded";
        } else {
          refundStatus = "succeeded";
        }
      }
    }

    const contactSeeds: Array<{ id: string; via: PlanningContactLinkVia }> = [];
    if (reservation.clientAccountId) {
      contactSeeds.push({ id: String(reservation.clientAccountId), via: "reservation" });
    }
    if (cardex?.clientAccountId) {
      contactSeeds.push({ id: String(cardex.clientAccountId), via: "cardex" });
    }

    if (reservation.cardexId) {
      const accountsOnCardex = await ClientAccount.find({ cardexId: reservation.cardexId })
        .select({ _id: 1 })
        .lean()
        .exec();
      for (const account of accountsOnCardex) {
        contactSeeds.push({ id: String(account._id), via: "cardex" });
      }
    }

    const companySiret = cardex?.company?.siret?.trim();
    if (companySiret) {
      const siblingCardexes = await Cardex.find({ "company.siret": companySiret })
        .select({ _id: 1, clientAccountId: 1 })
        .lean()
        .exec();
      const siblingCardexIds = siblingCardexes.map((doc) => doc._id);
      for (const sibling of siblingCardexes) {
        contactSeeds.push({ id: String(sibling.clientAccountId), via: "cardex" });
      }
      if (siblingCardexIds.length > 0) {
        const companyAccounts = await ClientAccount.find({
          cardexId: { $in: siblingCardexIds },
        })
          .select({ _id: 1 })
          .lean()
          .exec();
        for (const account of companyAccounts) {
          contactSeeds.push({ id: String(account._id), via: "cardex" });
        }
      }
    }

    const contactIds = mergeContactAccountIds(contactSeeds);

    const accounts =
      contactIds.size > 0
        ? await ClientAccount.find({
            _id: { $in: [...contactIds.keys()] },
          })
            .select({ email: 1, createdAt: 1 })
            .lean()
            .exec()
        : [];

    accounts.sort((a, b) => {
      const viaA = contactIds.get(String(a._id));
      const viaB = contactIds.get(String(b._id));
      if (viaA === "reservation" && viaB !== "reservation") {
        return -1;
      }
      if (viaB === "reservation" && viaA !== "reservation") {
        return 1;
      }
      return String(a.email).localeCompare(String(b.email), "fr");
    });

    const contactCardexes =
      accounts.length > 0
        ? await Cardex.find({
            clientAccountId: { $in: accounts.map((account) => account._id) },
          })
            .select({ clientAccountId: 1, identity: 1 })
            .lean()
            .exec()
        : [];

    const cardexByAccountId = new Map<
      string,
      { firstName?: string; lastName?: string; phone?: string }
    >();
    for (const doc of contactCardexes) {
      cardexByAccountId.set(String(doc.clientAccountId), {
        firstName: doc.identity?.firstName?.trim() || undefined,
        lastName: doc.identity?.lastName?.trim() || undefined,
        phone: doc.identity?.phone?.trim() || undefined,
      });
    }

    const primaryEmail =
      accounts.find((a) => contactIds.get(String(a._id)) === "reservation")?.email ??
      accounts[0]?.email;

    const AuditLog = await getAuditLogModel();
    const latestEmailAudit = await AuditLog.findOne({
      "entity.type": "reservation",
      "entity.id": { $in: [reservation._id, String(reservation._id)] },
      "diff.emailSent": { $exists: true },
    })
      .sort({ at: -1 })
      .lean()
      .exec();

    let emailDeliveryWarning: PlanningReservationDetail["emailDeliveryWarning"];
    if (latestEmailAudit?.diff?.emailSent?.after === false) {
      const rawError = latestEmailAudit.diff.emailError?.after;
      emailDeliveryWarning = {
        at: toIso(latestEmailAudit.at),
        ...(typeof rawError === "string" && rawError.trim()
          ? { error: rawError.trim().slice(0, 400) }
          : {}),
      };
    }

    const payload: PlanningReservationDetail = {
      id: String(reservation._id),
      reference: reservation.reference,
      status,
      paymentStatus,
      refundStatus,
      stripeRefundId,
      ...(emailDeliveryWarning ? { emailDeliveryWarning } : {}),
      readOnly: isReservationReadOnly(status),
      startAt: toIso(reservation.startAt),
      endAt: toIso(reservation.endAt),
      partySize: Math.max(1, Math.trunc(reservation.partySize ?? 1)),
      durationClass: reservation.durationClass,
      space: {
        id: String(reservation.spaceId),
        name: space?.name ?? reservation.spaceSnapshot?.name ?? "Espace",
        type: asSpaceType(space?.type ?? reservation.spaceSnapshot?.type ?? "meeting_room"),
        buildingId: String(reservation.buildingId),
        buildingName: building?.name ?? "—",
        capacity:
          typeof space?.capacity === "number" && space.capacity > 0 ? space.capacity : undefined,
      },
      clientAccountId: reservation.clientAccountId
        ? String(reservation.clientAccountId)
        : undefined,
      cardexId: reservation.cardexId ? String(reservation.cardexId) : undefined,
      client: {
        label: formatClientLabel({
          firstName: cardex?.identity?.firstName,
          lastName: cardex?.identity?.lastName,
          companyName: cardex?.company?.legalName,
          email: primaryEmail,
        }),
        firstName: cardex?.identity?.firstName,
        lastName: cardex?.identity?.lastName,
        phone: cardex?.identity?.phone,
        companyName: cardex?.company?.legalName,
        email: primaryEmail,
      },
      services: (reservation.services ?? []).map((s) => {
        const customAnswers: ServiceCustomAnswer[] = [];
        for (const answer of s.customAnswers ?? []) {
          const parsed = ServiceCustomAnswerSchema.safeParse(answer);
          if (parsed.success) {
            customAnswers.push(parsed.data);
          }
        }

        return {
          serviceId: String(s.serviceId),
          label: s.label,
          qty: Math.trunc(s.qty),
          unitPriceHT: Math.trunc(s.unitPriceHT),
          vatRate: s.vatRate,
          ...(customAnswers.length > 0 ? { customAnswers } : {}),
        } satisfies PlanningReservationDetail["services"][number];
      }),
      pricing: (() => {
        const subtotalHT = Math.trunc(reservation.pricing?.subtotalHT ?? 0);
        const invoiceSpaceLines = (invoice?.lines ?? []).filter(
          (line) => String(line.kind ?? "").trim() === "space",
        );
        const { spaceHT, servicesHT } = splitReservationSubtotalHT({
          subtotalHT,
          services: reservation.services ?? [],
          invoiceSpaceLines,
        });
        return {
          subtotalHT,
          totalVAT: Math.trunc(reservation.pricing?.totalVAT ?? 0),
          totalTTC: Math.trunc(reservation.pricing?.totalTTC ?? 0),
          discountTotal: Math.trunc(reservation.pricing?.discountTotal ?? 0),
          spaceHT,
          servicesHT,
        };
      })(),
      invoice: invoice
        ? {
            id: String(invoice._id),
            reference: invoice.reference,
            status: invoice.status,
            paidTotal: Math.trunc(invoice.totals?.paidTotal ?? 0),
            balanceDue: Math.trunc(invoice.totals?.balanceDue ?? 0),
          }
        : null,
      awaitingPaymentMethod: reservation.awaitingPaymentMethod,
      awaitingPaymentExpiresAt: reservation.awaitingPaymentExpiresAt
        ? toIso(reservation.awaitingPaymentExpiresAt)
        : undefined,
      contacts: accounts.map((account) => {
        const identity = cardexByAccountId.get(String(account._id));
        return {
          id: String(account._id),
          email: account.email,
          firstName: identity?.firstName,
          lastName: identity?.lastName,
          phone: identity?.phone,
          createdAt: toIso(account.createdAt),
        };
      }),
      createdChannel: reservation.createdChannel,
    };

    return PlanningReservationDetailSchema.parse(payload);
  }

  async getSpaceHistory(
    profile: StaffProfileDocument,
    spaceId: string,
    query: { from?: string; to?: string; types?: string },
  ): Promise<PlanningSpaceHistoryResponse> {
    await connectMongo();
    const id = assertObjectId(spaceId, "spaceId");
    const from = parseIsoDate(query.from, "from");
    const to = parseIsoDate(query.to, "to");
    if (to <= from) {
      throw new BadRequestException({
        code: "INVALID_RANGE",
        message: "La plage to doit être postérieure à from",
      });
    }

    const typeFilter = new Set<PlanningHistoryEventType>(
      (
        query.types?.split(",") ?? [
          "reservation",
          "cancellation",
          "space_change",
          "restoration",
          "closure",
          "date_change",
          "party_size_change",
          "contact_transfer",
        ]
      )
        .map((t) => t.trim())
        .filter(Boolean) as PlanningHistoryEventType[],
    );

    const Space = await getSpaceModel();
    const space = await Space.findById(id).lean().exec();
    if (!space) {
      throw new NotFoundException({
        code: "SPACE_NOT_FOUND",
        message: "Espace introuvable",
      });
    }
    if (!isBuildingIdInScope(space.buildingId, profile.scope.buildingIds)) {
      throw new ForbiddenException();
    }

    const Building = await getBuildingModel();
    const building = await Building.findById(space.buildingId).select({ name: 1 }).lean().exec();

    const events: PlanningHistoryEvent[] = [];

    if (typeFilter.has("reservation") || typeFilter.has("cancellation")) {
      const Reservation = await getReservationModel();
      const Invoice = await getInvoiceModel();
      const Cardex = await getCardexModel();
      const reservations = await Reservation.find({
        spaceId: id,
        startAt: { $lt: to },
        endAt: { $gt: from },
      })
        .select({
          reference: 1,
          status: 1,
          startAt: 1,
          endAt: 1,
          pricing: 1,
          statusHistory: 1,
          cardexId: 1,
        })
        .lean()
        .exec();

      const invoices = await Invoice.find({
        reservationId: { $in: reservations.map((r) => r._id) },
      })
        .select({ reservationId: 1, status: 1, totals: 1 })
        .lean()
        .exec();
      const invoiceByRes = new Map(
        invoices.filter((i) => i.reservationId).map((i) => [String(i.reservationId), i]),
      );

      const cardexIds = [
        ...new Set(
          reservations
            .map((r) => r.cardexId)
            .filter((cid): cid is Types.ObjectId => Boolean(cid))
            .map((cid) => String(cid)),
        ),
      ];
      const cardexDocs = cardexIds.length
        ? await Cardex.find({ _id: { $in: cardexIds } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : [];
      const cardexById = new Map(cardexDocs.map((doc) => [String(doc._id), doc]));

      for (const reservation of reservations) {
        const status = asReservationStatus(reservation.status);
        const invoice = invoiceByRes.get(String(reservation._id));
        const paymentStatus: PlanningPaymentStatus = mapInvoicePaymentStatus({
          invoiceStatus: invoice?.status,
          paidTotal: invoice?.totals?.paidTotal,
          balanceDue: invoice?.totals?.balanceDue,
          reservationStatus: status,
        });
        const cardex = reservation.cardexId
          ? cardexById.get(String(reservation.cardexId))
          : undefined;
        const clientLabel = formatClientLabel({
          firstName: cardex?.identity?.firstName,
          lastName: cardex?.identity?.lastName,
          companyName: cardex?.company?.legalName,
        });

        // Cancellation events come from statusHistory transitions, not from the
        // *current* status — otherwise a restored reservation would erase past
        // cancellations from the timeline.
        if (typeFilter.has("cancellation")) {
          const cancelEntries = (reservation.statusHistory ?? []).filter(
            (entry) => entry.to === "cancelled",
          );
          if (cancelEntries.length === 0 && status === "cancelled") {
            events.push({
              id: `cancel-${String(reservation._id)}`,
              type: "cancellation",
              at: toIso(reservation.endAt),
              startAt: toIso(reservation.startAt),
              endAt: toIso(reservation.endAt),
              title: clientLabel,
              clientLabel,
              reservationId: String(reservation._id),
              reservationReference: reservation.reference,
              reservationStatus: status,
              paymentStatus,
            });
          } else {
            for (const [index, cancelEntry] of cancelEntries.entries()) {
              events.push({
                id: `cancel-${String(reservation._id)}-${index}-${toIso(cancelEntry.at)}`,
                type: "cancellation",
                at: toIso(cancelEntry.at),
                startAt: toIso(reservation.startAt),
                endAt: toIso(reservation.endAt),
                title: clientLabel,
                detail: cancelEntry.reason,
                clientLabel,
                reservationId: String(reservation._id),
                reservationReference: reservation.reference,
                // Current reservation status (e.g. confirmed after restore), not
                // the historical cancel snapshot — the event type carries "cancellation".
                reservationStatus: status,
                paymentStatus,
              });
            }
          }
        }
        if (status !== "cancelled" && typeFilter.has("reservation")) {
          events.push({
            id: `res-${String(reservation._id)}`,
            type: "reservation",
            at: toIso(reservation.startAt),
            startAt: toIso(reservation.startAt),
            endAt: toIso(reservation.endAt),
            title: clientLabel,
            clientLabel,
            reservationId: String(reservation._id),
            reservationReference: reservation.reference,
            reservationStatus: status,
            paymentStatus,
          });
        }
      }
    }

    if (typeFilter.has("closure")) {
      const SlotClosure = await getSlotClosureModel();
      const closures = await SlotClosure.find({
        startAt: { $lt: to },
        endAt: { $gt: from },
        $or: [
          { "scope.spaceId": id },
          {
            "scope.buildingId": space.buildingId,
            "scope.spaceId": { $exists: false },
          },
          {
            "scope.spaceType": space.type,
            "scope.spaceId": { $exists: false },
          },
        ],
      })
        .lean()
        .exec();

      for (const closure of closures) {
        events.push({
          id: `closure-${String(closure._id)}`,
          type: "closure",
          at: toIso(closure.startAt),
          endAt: toIso(closure.endAt),
          title:
            closure.kind === "closed" ? "Fermeture exceptionnelle" : "Ouverture exceptionnelle",
          detail: closure.reason,
        });
      }
    }

    if (typeFilter.has("space_change")) {
      const AuditLog = await getAuditLogModel();
      const Reservation = await getReservationModel();
      const Invoice = await getInvoiceModel();
      const Cardex = await getCardexModel();
      const logs = (
        await AuditLog.find({
          "entity.type": "reservation",
          at: { $gte: from, $lt: to },
          "diff.spaceId.after": String(id),
        })
          .sort({ at: -1 })
          .lean()
          .exec()
      ).filter((log) => !isEmailDeliveryOnlyAudit(log.diff));

      const linkedReservationIds = [
        ...new Set(
          logs
            .map((log) => (log.entity?.id != null ? String(log.entity.id) : null))
            .filter((entityId): entityId is string => Boolean(entityId))
            .filter((entityId) => OBJECT_ID_PATTERN.test(entityId)),
        ),
      ];

      const linkedReservations = linkedReservationIds.length
        ? await Reservation.find({ _id: { $in: linkedReservationIds } })
            .select({
              reference: 1,
              status: 1,
              startAt: 1,
              endAt: 1,
              cardexId: 1,
            })
            .lean()
            .exec()
        : [];
      const reservationById = new Map(
        linkedReservations.map((reservation) => [String(reservation._id), reservation]),
      );

      const linkedInvoices = linkedReservations.length
        ? await Invoice.find({
            reservationId: { $in: linkedReservations.map((reservation) => reservation._id) },
          })
            .select({ reservationId: 1, status: 1, totals: 1 })
            .lean()
            .exec()
        : [];
      const invoiceByRes = new Map(
        linkedInvoices
          .filter((invoice) => invoice.reservationId)
          .map((invoice) => [String(invoice.reservationId), invoice]),
      );

      const cardexIds = [
        ...new Set(
          linkedReservations
            .map((reservation) => reservation.cardexId)
            .filter((cid): cid is Types.ObjectId => Boolean(cid))
            .map((cid) => String(cid)),
        ),
      ];
      const cardexDocs = cardexIds.length
        ? await Cardex.find({ _id: { $in: cardexIds } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : [];
      const cardexById = new Map(cardexDocs.map((doc) => [String(doc._id), doc]));

      const beforeSpaceIds = [
        ...new Set(
          logs
            .map((log) => {
              const before = log.diff?.spaceId?.before;
              return typeof before === "string" && OBJECT_ID_PATTERN.test(before) ? before : null;
            })
            .filter((sid): sid is string => Boolean(sid)),
        ),
      ];
      const beforeSpaceDocs = beforeSpaceIds.length
        ? await Space.find({ _id: { $in: beforeSpaceIds } })
            .select({ name: 1 })
            .lean()
            .exec()
        : [];
      const beforeSpaceNameById = new Map(
        beforeSpaceDocs.map((doc) => [String(doc._id), doc.name]),
      );

      for (const log of logs) {
        const beforeId = log.diff?.spaceId?.before;
        const beforeNameFromAudit =
          typeof log.diff?.spaceName?.before === "string" ? log.diff.spaceName.before : undefined;
        const beforeSpaceName =
          beforeNameFromAudit ??
          (typeof beforeId === "string" ? beforeSpaceNameById.get(beforeId) : undefined) ??
          (typeof beforeId === "string" ? beforeId : undefined);
        const reservationId = log.entity?.id ? String(log.entity.id) : undefined;
        const reservation = reservationId ? reservationById.get(reservationId) : undefined;
        const cardex = reservation?.cardexId
          ? cardexById.get(String(reservation.cardexId))
          : undefined;
        const clientLabel = reservation
          ? formatClientLabel({
              firstName: cardex?.identity?.firstName,
              lastName: cardex?.identity?.lastName,
              companyName: cardex?.company?.legalName,
            })
          : undefined;
        const status = reservation ? asReservationStatus(reservation.status) : undefined;
        const invoice = reservationId ? invoiceByRes.get(reservationId) : undefined;
        const paymentStatus =
          reservation && status
            ? mapInvoicePaymentStatus({
                invoiceStatus: invoice?.status,
                paidTotal: invoice?.totals?.paidTotal,
                balanceDue: invoice?.totals?.balanceDue,
                reservationStatus: status,
              })
            : undefined;

        events.push({
          id: `audit-${String(log._id)}`,
          type: "space_change",
          at: toIso(log.at),
          startAt: reservation ? toIso(reservation.startAt) : undefined,
          endAt: reservation ? toIso(reservation.endAt) : undefined,
          title: clientLabel ?? "Changement de salle",
          detail: withEmailDeliveryHint(
            typeof beforeSpaceName === "string"
              ? `Depuis l’espace ${beforeSpaceName}`
              : (log.reason ?? log.action),
            log.diff,
          ),
          clientLabel,
          reservationId,
          reservationReference: reservation?.reference,
          reservationStatus: status,
          paymentStatus,
        });
      }
    }

    if (typeFilter.has("restoration")) {
      const AuditLog = await getAuditLogModel();
      const Reservation = await getReservationModel();
      const Invoice = await getInvoiceModel();
      const Cardex = await getCardexModel();
      const logs = (
        await AuditLog.find({
          action: "reservation.restore",
          "entity.type": "reservation",
          at: { $gte: from, $lt: to },
          "diff.spaceId.after": String(id),
        })
          .sort({ at: -1 })
          .lean()
          .exec()
      ).filter((log) => !isEmailDeliveryOnlyAudit(log.diff));

      const linkedReservationIds = [
        ...new Set(
          logs
            .map((log) => (log.entity?.id != null ? String(log.entity.id) : null))
            .filter((entityId): entityId is string => Boolean(entityId))
            .filter((entityId) => OBJECT_ID_PATTERN.test(entityId)),
        ),
      ];

      const linkedReservations = linkedReservationIds.length
        ? await Reservation.find({ _id: { $in: linkedReservationIds } })
            .select({
              reference: 1,
              status: 1,
              startAt: 1,
              endAt: 1,
              cardexId: 1,
            })
            .lean()
            .exec()
        : [];
      const reservationById = new Map(
        linkedReservations.map((reservation) => [String(reservation._id), reservation]),
      );

      const linkedInvoices = linkedReservations.length
        ? await Invoice.find({
            reservationId: { $in: linkedReservations.map((reservation) => reservation._id) },
          })
            .select({ reservationId: 1, status: 1, totals: 1 })
            .lean()
            .exec()
        : [];
      const invoiceByRes = new Map(
        linkedInvoices
          .filter((invoice) => invoice.reservationId)
          .map((invoice) => [String(invoice.reservationId), invoice]),
      );

      const cardexIds = [
        ...new Set(
          linkedReservations
            .map((reservation) => reservation.cardexId)
            .filter((cid): cid is Types.ObjectId => Boolean(cid))
            .map((cid) => String(cid)),
        ),
      ];
      const cardexDocs = cardexIds.length
        ? await Cardex.find({ _id: { $in: cardexIds } })
            .select({ identity: 1, company: 1 })
            .lean()
            .exec()
        : [];
      const cardexById = new Map(cardexDocs.map((doc) => [String(doc._id), doc]));

      for (const log of logs) {
        const reservationId = log.entity?.id ? String(log.entity.id) : undefined;
        const reservation = reservationId ? reservationById.get(reservationId) : undefined;
        const cardex = reservation?.cardexId
          ? cardexById.get(String(reservation.cardexId))
          : undefined;
        const clientLabel = reservation
          ? formatClientLabel({
              firstName: cardex?.identity?.firstName,
              lastName: cardex?.identity?.lastName,
              companyName: cardex?.company?.legalName,
            })
          : undefined;
        const status = reservation ? asReservationStatus(reservation.status) : undefined;
        const invoice = reservationId ? invoiceByRes.get(reservationId) : undefined;
        const paymentStatus =
          reservation && status
            ? mapInvoicePaymentStatus({
                invoiceStatus: invoice?.status,
                paidTotal: invoice?.totals?.paidTotal,
                balanceDue: invoice?.totals?.balanceDue,
                reservationStatus: status,
              })
            : undefined;

        events.push({
          id: `restore-${String(log._id)}`,
          type: "restoration",
          at: toIso(log.at),
          startAt: reservation ? toIso(reservation.startAt) : undefined,
          endAt: reservation ? toIso(reservation.endAt) : undefined,
          title: clientLabel ?? "Réservation restaurée",
          detail: withEmailDeliveryHint(log.reason ?? "Réservation restaurée", log.diff),
          clientLabel,
          reservationId,
          reservationReference: reservation?.reference,
          reservationStatus: status,
          paymentStatus,
        });
      }
    }

    if (typeFilter.has("date_change")) {
      events.push(
        ...(await this.buildManageActionEvents(String(id), from, to, {
          action: "reservation.date_change",
          type: "date_change",
          titleFallback: "Modification des dates",
          detail: (log) => {
            const kindRaw = log.diff?.kind?.after;
            const kindLabel =
              kindRaw === "extend"
                ? "Agrandissement du créneau"
                : kindRaw === "shorten"
                  ? "Raccourcissement du créneau"
                  : "Report du créneau";
            const nextStart = auditDiffDateLabel(log.diff?.startAt?.after);
            const nextEnd = auditDiffDateLabel(log.diff?.endAt?.after);
            if (nextStart && nextEnd) {
              return `${kindLabel} — nouveau créneau du ${nextStart} au ${nextEnd}`;
            }
            return kindLabel;
          },
        })),
      );
    }

    if (typeFilter.has("party_size_change")) {
      events.push(
        ...(await this.buildManageActionEvents(String(id), from, to, {
          action: "reservation.party_size_change",
          type: "party_size_change",
          titleFallback: "Modification du nombre de personnes",
          detail: (log) => {
            const before = log.diff?.partySize?.before;
            const after = log.diff?.partySize?.after;
            if (typeof before === "number" && typeof after === "number") {
              return `Effectif modifié : ${before} → ${after} personne${after > 1 ? "s" : ""}`;
            }
            return "Effectif modifié";
          },
        })),
      );
    }

    if (typeFilter.has("contact_transfer")) {
      events.push(
        ...(await this.buildManageActionEvents(String(id), from, to, {
          action: "reservation.contact_transfer",
          type: "contact_transfer",
          titleFallback: "Transfert de contact",
          detail: (log) => {
            const before = log.diff?.contactEmail?.before;
            const after = log.diff?.contactEmail?.after;
            if (typeof before === "string" && typeof after === "string") {
              return `Contact transféré : ${before} → ${after}`;
            }
            return "Contact transféré à un autre interlocuteur";
          },
        })),
      );
    }

    if (typeFilter.has("refund")) {
      events.push(
        ...(await this.buildManageActionEvents(String(id), from, to, {
          action: "reservation.refund",
          type: "refund",
          titleFallback: "Remboursement",
          detail: (log) => {
            const amount = log.diff?.amountCents?.after;
            const status = log.diff?.refundStatus?.after;
            const stripeId = log.diff?.stripeRefundId?.after;
            const method = log.diff?.method?.after;
            const parts: string[] = [];
            if (typeof amount === "number") {
              parts.push(`${(amount / 100).toFixed(2).replace(".", ",")} €`);
            }
            if (typeof status === "string") {
              parts.push(
                status === "pending"
                  ? "en cours"
                  : status === "succeeded" || status === "manual_succeeded"
                    ? "confirmé"
                    : status === "failed"
                      ? "échec"
                      : status,
              );
            }
            if (method === "card" && typeof stripeId === "string") {
              parts.push(stripeId);
            } else if (method === "transfer") {
              parts.push("virement manuel");
            }
            return parts.length > 0 ? parts.join(" · ") : "Remboursement";
          },
        })),
      );
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const payload: PlanningSpaceHistoryResponse = {
      space: {
        id: String(space._id),
        buildingId: String(space.buildingId),
        buildingName: building?.name ?? "—",
        name: space.name,
        type: asSpaceType(space.type),
        floor: space.floor != null ? String(space.floor) : undefined,
      },
      from: toIso(from),
      to: toIso(to),
      events,
    };

    return PlanningSpaceHistoryResponseSchema.parse(payload);
  }

  /**
   * Generic builder for audit-based history events (mirrors the `restoration`
   * block): finds `AuditLog` entries for `action` scoped to this space via
   * `diff.spaceId.after` (always present on Wave 2 manage-action audits, even
   * when the space itself did not change — it is only used for filtering).
   */
  private async buildManageActionEvents(
    spaceId: string,
    from: Date,
    to: Date,
    input: {
      action: string;
      type: PlanningHistoryEventType;
      titleFallback: string;
      detail: (log: {
        diff?: Record<string, { before: unknown; after: unknown }>;
        reason?: string;
      }) => string | undefined;
    },
  ): Promise<PlanningHistoryEvent[]> {
    const AuditLog = await getAuditLogModel();
    const logs = (
      await AuditLog.find({
        action: input.action,
        "entity.type": "reservation",
        at: { $gte: from, $lt: to },
        "diff.spaceId.after": spaceId,
      })
        .sort({ at: -1 })
        .lean()
        .exec()
    ).filter((log) => !isEmailDeliveryOnlyAudit(log.diff));

    if (logs.length === 0) {
      return [];
    }

    const Reservation = await getReservationModel();
    const Invoice = await getInvoiceModel();
    const Cardex = await getCardexModel();

    const linkedReservationIds = [
      ...new Set(
        logs
          .map((log) => (log.entity?.id != null ? String(log.entity.id) : null))
          .filter((entityId): entityId is string => Boolean(entityId))
          .filter((entityId) => OBJECT_ID_PATTERN.test(entityId)),
      ),
    ];

    const linkedReservations = linkedReservationIds.length
      ? await Reservation.find({ _id: { $in: linkedReservationIds } })
          .select({ reference: 1, status: 1, startAt: 1, endAt: 1, cardexId: 1 })
          .lean()
          .exec()
      : [];
    const reservationById = new Map(
      linkedReservations.map((reservation) => [String(reservation._id), reservation]),
    );

    const linkedInvoices = linkedReservations.length
      ? await Invoice.find({
          reservationId: { $in: linkedReservations.map((reservation) => reservation._id) },
        })
          .select({ reservationId: 1, status: 1, totals: 1 })
          .lean()
          .exec()
      : [];
    const invoiceByRes = new Map(
      linkedInvoices
        .filter((invoice) => invoice.reservationId)
        .map((invoice) => [String(invoice.reservationId), invoice]),
    );

    const cardexIds = [
      ...new Set(
        linkedReservations
          .map((reservation) => reservation.cardexId)
          .filter((cid): cid is Types.ObjectId => Boolean(cid))
          .map((cid) => String(cid)),
      ),
    ];
    const cardexDocs = cardexIds.length
      ? await Cardex.find({ _id: { $in: cardexIds } })
          .select({ identity: 1, company: 1 })
          .lean()
          .exec()
      : [];
    const cardexById = new Map(cardexDocs.map((doc) => [String(doc._id), doc]));

    return logs.map((log) => {
      const reservationId = log.entity?.id ? String(log.entity.id) : undefined;
      const reservation = reservationId ? reservationById.get(reservationId) : undefined;
      const cardex = reservation?.cardexId
        ? cardexById.get(String(reservation.cardexId))
        : undefined;
      const clientLabel = reservation
        ? formatClientLabel({
            firstName: cardex?.identity?.firstName,
            lastName: cardex?.identity?.lastName,
            companyName: cardex?.company?.legalName,
          })
        : undefined;
      const status = reservation ? asReservationStatus(reservation.status) : undefined;
      const invoice = reservationId ? invoiceByRes.get(reservationId) : undefined;
      const paymentStatus =
        reservation && status
          ? mapInvoicePaymentStatus({
              invoiceStatus: invoice?.status,
              paidTotal: invoice?.totals?.paidTotal,
              balanceDue: invoice?.totals?.balanceDue,
              reservationStatus: status,
            })
          : undefined;

      return {
        id: `${input.type}-${String(log._id)}`,
        type: input.type,
        at: toIso(log.at),
        startAt: reservation ? toIso(reservation.startAt) : undefined,
        endAt: reservation ? toIso(reservation.endAt) : undefined,
        title: clientLabel ?? input.titleFallback,
        detail: withEmailDeliveryHint(
          input.detail(log) ?? log.reason ?? input.titleFallback,
          log.diff,
        ),
        clientLabel,
        reservationId,
        reservationReference: reservation?.reference,
        reservationStatus: status,
        paymentStatus,
      } satisfies PlanningHistoryEvent;
    });
  }
}
