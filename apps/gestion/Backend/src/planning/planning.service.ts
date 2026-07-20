import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PlanningCalendarResponseSchema,
  PlanningReservationDetailSchema,
  PlanningSpaceHistoryResponseSchema,
  type PlanningCalendarResponse,
  type PlanningHistoryEvent,
  type PlanningHistoryEventType,
  type PlanningPaymentStatus,
  type PlanningReservationDetail,
  type PlanningSpaceHistoryResponse,
} from "@coworkprysme/shared";
import {
  connectMongo,
  getAuditLogModel,
  getBuildingModel,
  getCardexModel,
  getClientAccountModel,
  getInvoiceModel,
  getReservationModel,
  getSlotClosureModel,
  getSpaceModel,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import type { Types } from "mongoose";

import {
  asReservationStatus,
  asSpaceType,
  formatClientLabel,
  isBuildingIdInScope,
  isReservationReadOnly,
  mapInvoicePaymentStatus,
  mergeContactAccountIds,
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

@Injectable()
export class PlanningService {
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
          .select({ name: 1, type: 1, buildingId: 1, floor: 1 })
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

    const [Building, Space, Invoice, Cardex, ClientAccount] = await Promise.all([
      getBuildingModel(),
      getSpaceModel(),
      getInvoiceModel(),
      getCardexModel(),
      getClientAccountModel(),
    ]);

    const [building, space, invoice, cardex] = await Promise.all([
      Building.findById(reservation.buildingId).select({ name: 1 }).lean().exec(),
      Space.findById(reservation.spaceId).select({ name: 1, type: 1 }).lean().exec(),
      Invoice.findOne({ reservationId: reservation._id })
        .select({ reference: 1, status: 1, totals: 1 })
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
            .select({ email: 1, status: 1, emailVerifiedAt: 1 })
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

    const primaryEmail =
      accounts.find((a) => contactIds.get(String(a._id)) === "reservation")?.email ??
      accounts[0]?.email;

    const payload: PlanningReservationDetail = {
      id: String(reservation._id),
      reference: reservation.reference,
      status,
      paymentStatus,
      readOnly: isReservationReadOnly(status),
      startAt: toIso(reservation.startAt),
      endAt: toIso(reservation.endAt),
      space: {
        id: String(reservation.spaceId),
        name: space?.name ?? reservation.spaceSnapshot?.name ?? "Espace",
        type: asSpaceType(space?.type ?? reservation.spaceSnapshot?.type ?? "meeting_room"),
        buildingId: String(reservation.buildingId),
        buildingName: building?.name ?? "—",
      },
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
      services: (reservation.services ?? []).map((s) => ({
        serviceId: String(s.serviceId),
        label: s.label,
        qty: Math.trunc(s.qty),
        unitPriceHT: Math.trunc(s.unitPriceHT),
        vatRate: s.vatRate,
      })),
      pricing: {
        subtotalHT: Math.trunc(reservation.pricing?.subtotalHT ?? 0),
        totalVAT: Math.trunc(reservation.pricing?.totalVAT ?? 0),
        totalTTC: Math.trunc(reservation.pricing?.totalTTC ?? 0),
        discountTotal: Math.trunc(reservation.pricing?.discountTotal ?? 0),
      },
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
      contacts: accounts.map((account) => ({
        id: String(account._id),
        email: account.email,
        status: account.status,
        emailVerified: Boolean(account.emailVerifiedAt),
        linkedVia: contactIds.get(String(account._id)) ?? "cardex",
      })),
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
      (query.types?.split(",") ?? ["reservation", "cancellation", "space_change", "closure"])
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

      for (const reservation of reservations) {
        const status = asReservationStatus(reservation.status);
        const invoice = invoiceByRes.get(String(reservation._id));
        const paymentStatus: PlanningPaymentStatus = mapInvoicePaymentStatus({
          invoiceStatus: invoice?.status,
          paidTotal: invoice?.totals?.paidTotal,
          balanceDue: invoice?.totals?.balanceDue,
          reservationStatus: status,
        });

        if (status === "cancelled" && typeFilter.has("cancellation")) {
          const cancelEntry = [...(reservation.statusHistory ?? [])]
            .reverse()
            .find((h) => h.to === "cancelled");
          events.push({
            id: `cancel-${String(reservation._id)}`,
            type: "cancellation",
            at: toIso(cancelEntry?.at ?? reservation.endAt),
            endAt: toIso(reservation.endAt),
            title: `Annulation ${reservation.reference}`,
            detail: cancelEntry?.reason,
            reservationId: String(reservation._id),
            reservationReference: reservation.reference,
            reservationStatus: status,
            paymentStatus,
          });
        } else if (status !== "cancelled" && typeFilter.has("reservation")) {
          events.push({
            id: `res-${String(reservation._id)}`,
            type: "reservation",
            at: toIso(reservation.startAt),
            endAt: toIso(reservation.endAt),
            title: reservation.reference,
            detail: `Statut ${status}`,
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
      const logs = await AuditLog.find({
        "entity.type": "reservation",
        at: { $gte: from, $lt: to },
        "diff.spaceId.after": String(id),
      })
        .sort({ at: -1 })
        .lean()
        .exec();

      for (const log of logs) {
        const before = log.diff?.spaceId?.before;
        events.push({
          id: `audit-${String(log._id)}`,
          type: "space_change",
          at: toIso(log.at),
          title: "Changement de salle",
          detail:
            typeof before === "string" ? `Depuis l’espace ${before}` : (log.reason ?? log.action),
          reservationId: log.entity?.id ? String(log.entity.id) : undefined,
        });
      }
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
}
