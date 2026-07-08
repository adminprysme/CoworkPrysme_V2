import type { Connection } from "mongoose";

import { registerStaffSessionModel } from "./auth/index.js";
import { registerCardexModel, registerClientAccountModel } from "./client/index.js";
import { registerInvoiceModel, registerPaymentModel, registerQuoteModel } from "./billing/index.js";
import {
  registerNotificationModel,
  registerNewsOfferModel,
  registerIncidentModel,
  registerReviewModel,
  registerSatisfactionSurveyModel,
  registerVitrineContentModel,
} from "./peripheral/index.js";
import {
  registerDiscountCodeModel,
  registerServiceModel,
  registerTariffModel,
} from "./pricing/index.js";
import {
  registerReservationModel,
  registerReservationRequestModel,
  registerSlotLockModel,
} from "./reservation/index.js";
import {
  registerBuildingModel,
  registerSlotClosureModel,
  registerSpaceModel,
} from "./structure/index.js";
import { registerAuditLogModel, registerStaffProfileModel } from "./staff/index.js";

/** Registers every cowork_bdd model on the given connection. Never touches prysma. */
export function registerAllCoworkModels(connection: Connection): void {
  registerBuildingModel(connection);
  registerSpaceModel(connection);
  registerSlotClosureModel(connection);
  registerReservationModel(connection);
  registerSlotLockModel(connection);
  registerReservationRequestModel(connection);
  registerClientAccountModel(connection);
  registerCardexModel(connection);
  registerStaffProfileModel(connection);
  registerStaffSessionModel(connection);
  registerAuditLogModel(connection);
  registerTariffModel(connection);
  registerServiceModel(connection);
  registerDiscountCodeModel(connection);
  registerQuoteModel(connection);
  registerInvoiceModel(connection);
  registerPaymentModel(connection);
  registerNotificationModel(connection);
  registerReviewModel(connection);
  registerSatisfactionSurveyModel(connection);
  registerNewsOfferModel(connection);
  registerIncidentModel(connection);
  registerVitrineContentModel(connection);
}

export const COWORK_COLLECTION_NAMES = [
  "buildings",
  "spaces",
  "slotClosures",
  "reservations",
  "slotLocks",
  "reservationRequests",
  "clientAccounts",
  "cardex",
  "staffProfiles",
  "staffSessions",
  "auditLogs",
  "tariffs",
  "services",
  "discountCodes",
  "quotes",
  "invoices",
  "payments",
  "notifications",
  "reviews",
  "satisfactionSurveys",
  "newsOffers",
  "incidents",
  "vitrineContent",
] as const;
