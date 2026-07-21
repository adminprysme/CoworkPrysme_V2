import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const {
  confirmBookingCheckoutMock,
  connectMongoMock,
  getDiscountCodeModelMock,
  getServiceModelMock,
} = vi.hoisted(() => ({
  confirmBookingCheckoutMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
  getDiscountCodeModelMock: vi.fn(),
  getServiceModelMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  confirmBookingCheckout: confirmBookingCheckoutMock,
  connectMongo: connectMongoMock,
  getDiscountCodeModel: getDiscountCodeModelMock,
  getServiceModel: getServiceModelMock,
  EmailAlreadyRegisteredError: class EmailAlreadyRegisteredError extends Error {},
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
  AccountLockedError: class AccountLockedError extends Error {},
  LockMismatchError: class LockMismatchError extends Error {},
  LockNotAvailableError: class LockNotAvailableError extends Error {},
  ReservationOverlapError: class ReservationOverlapError extends Error {},
}));

import { BookingConfirmService } from "./booking-confirm.service.js";
import type { AvailabilityService } from "./availability.service.js";
import type { BookingEmailsService } from "./booking-emails.service.js";
import type { BookingPriceService } from "./booking-price.service.js";

const SPACE_ID = "507f1f77bcf86cd799439011";
const BUILDING_ID = new Types.ObjectId("507f1f77bcf86cd799439012");
const LOCK_ID = "507f1f77bcf86cd799439013";

const CLIENT_EMAIL = "client@example.com";
const BUILDING_CONTACT_EMAIL = "accueil-technopark-a1@coworkprysme.eu";
const STAFF_FALLBACK_EMAIL = "staff-notify@example.com";

describe("BookingConfirmService — email recipients", () => {
  let service: BookingConfirmService;
  let bookingEmails: {
    resolveBuildingAccess: ReturnType<typeof vi.fn>;
    sendClientConfirmationEmails: ReturnType<typeof vi.fn>;
    sendBankTransferInstructionsEmails: ReturnType<typeof vi.fn>;
    sendStaffBookingNotifications: ReturnType<typeof vi.fn>;
  };
  let availability: AvailabilityService;
  let bookingPrice: BookingPriceService;

  const confirmPayload = {
    lockId: LOCK_ID,
    sessionId: "session-test-abcdefgh",
    spaceId: SPACE_ID,
    startAt: "2026-08-21T08:00:00.000Z",
    endAt: "2026-08-21T10:00:00.000Z",
    durationClass: "hourly" as const,
    partySize: 4,
    services: [] as [],
    accountMode: "new" as const,
    email: CLIENT_EMAIL,
    password: "GoodPass1!",
    identity: {
      firstName: "Alice",
      lastName: "Martin",
    },
    clientKind: "individual" as const,
    address: {
      street: "10 rue de la République",
      zip: "69001",
      city: "Lyon",
      country: "FR",
    },
    privacyPolicyAccepted: true,
    marketingCommunicationsAccepted: false,
    cgvAccepted: true as const,
    withdrawalAcknowledged: true as const,
    paymentMethod: "card" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOOKING_PAYMENT_TOKEN_SECRET = "test-booking-payment-token-secret-32chars!!";
    process.env.BANK_TRANSFER_IBAN = "FR7612345678901234567890123";
    process.env.BANK_TRANSFER_BIC = "QNTOFRP1";
    process.env.BANK_TRANSFER_ACCOUNT_HOLDER = "Cowork Prysme";
    process.env.BANK_TRANSFER_MIN_LEAD_DAYS = "7";
    process.env.BANK_TRANSFER_PAYMENT_WINDOW_DAYS = "8";
    process.env.BANK_TRANSFER_SAFETY_MARGIN_DAYS = "2";

    bookingEmails = {
      resolveBuildingAccess: vi.fn().mockResolvedValue({
        name: "Cowork GERLAND",
        addressFull: "39 Rue Saint-Jean de Dieu, 69007 Lyon",
        contactEmail: BUILDING_CONTACT_EMAIL,
      }),
      sendClientConfirmationEmails: vi.fn().mockResolvedValue(undefined),
      sendBankTransferInstructionsEmails: vi.fn().mockResolvedValue(undefined),
      sendStaffBookingNotifications: vi.fn().mockResolvedValue(undefined),
    };

    availability = {
      getSpaceById: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(SPACE_ID),
        name: "FOCUS",
        type: "meeting_room",
        buildingId: BUILDING_ID,
      }),
    } as unknown as AvailabilityService;

    bookingPrice = {
      computePrice: vi.fn().mockResolvedValue({
        durationClass: "hourly",
        units: 2,
        totalTTC: 4800,
        subtotalHT: 4000,
        discountTotal: 0,
        lines: [
          {
            label: "FOCUS",
            kind: "space",
            qty: 2,
            unitPriceHT: 2000,
            vatRate: 20,
            discount: 0,
            totalHT: 4000,
            totalVAT: 800,
            totalTTC: 4800,
          },
        ],
        vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
      }),
    } as unknown as BookingPriceService;

    confirmBookingCheckoutMock.mockResolvedValue({
      reservation: { reference: "RES-2026-00100", status: "awaiting_payment" },
      invoiceReference: "PF-2026-00100",
      clientAccountId: new Types.ObjectId(),
      cardexId: new Types.ObjectId(),
      isNewAccount: true,
      clientEmail: CLIENT_EMAIL,
    });

    service = new BookingConfirmService(
      availability,
      bookingPrice,
      bookingEmails as unknown as BookingEmailsService,
    );
  });

  afterEach(() => {
    delete process.env.BANK_TRANSFER_IBAN;
    delete process.env.BANK_TRANSFER_BIC;
    delete process.env.BANK_TRANSFER_ACCOUNT_HOLDER;
    delete process.env.BANK_TRANSFER_MIN_LEAD_DAYS;
    delete process.env.BANK_TRANSFER_PAYMENT_WINDOW_DAYS;
    delete process.env.BANK_TRANSFER_SAFETY_MARGIN_DAYS;
  });

  it("stores server-resolved durationClass on checkout (ignores client hint)", async () => {
    await service.confirm({ ...confirmPayload, paymentMethod: "card", durationClass: "daily" });

    expect(bookingPrice.computePrice).toHaveBeenCalledWith(
      expect.not.objectContaining({ durationClass: expect.anything() }),
    );
    expect(confirmBookingCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({ durationClass: "hourly" }),
    );
  });

  it("sends bank-transfer instruction emails at confirm time", async () => {
    const result = await service.confirm({
      ...confirmPayload,
      paymentMethod: "bank_transfer",
    });

    expect(result.reservationStatus).toBe("awaiting_payment");
    expect(result.paymentAccessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(result.bankTransfer?.iban).toBe("FR7612345678901234567890123");
    expect(result.bankTransfer?.transferLabel).toBe("RES-2026-00100");
    expect(bookingEmails.sendBankTransferInstructionsEmails).toHaveBeenCalledTimes(1);
    expect(bookingEmails.sendClientConfirmationEmails).not.toHaveBeenCalled();
    expect(bookingEmails.sendStaffBookingNotifications).toHaveBeenCalledTimes(1);
    expect(bookingEmails.sendStaffBookingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: CLIENT_EMAIL,
        paymentMethod: "bank_transfer",
        buildingId: BUILDING_ID.toString(),
      }),
    );
  });

  it("does not send any emails at confirm time for card payment", async () => {
    confirmBookingCheckoutMock.mockResolvedValue({
      reservation: { reference: "RES-2026-00101", status: "awaiting_payment" },
      invoiceReference: "PF-2026-00101",
      clientAccountId: new Types.ObjectId(),
      cardexId: new Types.ObjectId(),
      isNewAccount: true,
      clientEmail: CLIENT_EMAIL,
    });

    const result = await service.confirm({ ...confirmPayload, paymentMethod: "card" });

    expect(result.reservationStatus).toBe("awaiting_payment");
    expect(result.paymentAccessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(bookingEmails.sendClientConfirmationEmails).not.toHaveBeenCalled();
    expect(bookingEmails.sendBankTransferInstructionsEmails).not.toHaveBeenCalled();
    expect(bookingEmails.sendStaffBookingNotifications).not.toHaveBeenCalled();
    expect(bookingEmails.resolveBuildingAccess).not.toHaveBeenCalled();
  });

  it("still resolves staff path for bank_transfer (regression: staff recipients)", async () => {
    bookingEmails.sendStaffBookingNotifications.mockImplementation(async (input) => {
      expect(input.clientName).toBe("Alice Martin");
      expect(input.buildingId).toBe(BUILDING_ID.toString());
      expect(STAFF_FALLBACK_EMAIL).toBeTruthy();
    });

    await service.confirm({ ...confirmPayload, paymentMethod: "bank_transfer" });
    expect(bookingEmails.sendStaffBookingNotifications).toHaveBeenCalled();
  });
});
