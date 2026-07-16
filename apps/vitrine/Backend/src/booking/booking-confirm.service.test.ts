import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const {
  confirmBookingCheckoutMock,
  connectMongoMock,
  getBuildingModelMock,
  getDiscountCodeModelMock,
  getServiceModelMock,
} = vi.hoisted(() => ({
  confirmBookingCheckoutMock: vi.fn(),
  connectMongoMock: vi.fn().mockResolvedValue(undefined),
  getBuildingModelMock: vi.fn(),
  getDiscountCodeModelMock: vi.fn(),
  getServiceModelMock: vi.fn(),
}));

vi.mock("@coworkprysme/db", () => ({
  confirmBookingCheckout: confirmBookingCheckoutMock,
  connectMongo: connectMongoMock,
  getBuildingModel: getBuildingModelMock,
  getDiscountCodeModel: getDiscountCodeModelMock,
  getServiceModel: getServiceModelMock,
  EmailAlreadyRegisteredError: class EmailAlreadyRegisteredError extends Error {},
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
  LockMismatchError: class LockMismatchError extends Error {},
  LockNotAvailableError: class LockNotAvailableError extends Error {},
  ReservationOverlapError: class ReservationOverlapError extends Error {},
}));

import { BookingConfirmService } from "./booking-confirm.service.js";
import type { AvailabilityService } from "./availability.service.js";
import type { BookingPriceService } from "./booking-price.service.js";
import type { MailService } from "../mail/mail.service.js";

const SPACE_ID = "507f1f77bcf86cd799439011";
const BUILDING_ID = new Types.ObjectId("507f1f77bcf86cd799439012");
const LOCK_ID = "507f1f77bcf86cd799439013";

const CLIENT_EMAIL = "client@example.com";
const BUILDING_CONTACT_EMAIL = "accueil-technopark-a1@coworkprysme.eu";

describe("BookingConfirmService — email recipients", () => {
  let service: BookingConfirmService;
  let sendMailMock: ReturnType<typeof vi.fn>;
  let availability: AvailabilityService;
  let bookingPrice: BookingPriceService;

  beforeEach(() => {
    vi.clearAllMocks();

    sendMailMock = vi.fn().mockResolvedValue(undefined);

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
        totalTTC: 4800,
        totalHT: 4000,
        lines: [{ label: "FOCUS", qty: 1, totalTTC: 4800, totalHT: 4000, vatRate: 20 }],
        vatBreakdown: [{ rate: 20, baseHT: 4000, vat: 800 }],
      }),
    } as unknown as BookingPriceService;

    getBuildingModelMock.mockResolvedValue({
      findById: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            _id: BUILDING_ID,
            name: "Cowork GERLAND",
            email: BUILDING_CONTACT_EMAIL,
            phone: "07 83 82 35 29",
            address: {
              street: "39 Rue Saint-Jean de Dieu",
              zip: "69007",
              city: "Lyon",
              accessInfo: "Sonner à CoworkPrysme.",
            },
          }),
        }),
      }),
    });

    confirmBookingCheckoutMock.mockResolvedValue({
      reservation: { reference: "RES-2026-00100" },
      invoiceReference: "PF-2026-00100",
      clientAccountId: new Types.ObjectId(),
      cardexId: new Types.ObjectId(),
      isNewAccount: true,
      clientEmail: CLIENT_EMAIL,
    });

    service = new BookingConfirmService(availability, bookingPrice, {
      sendMail: sendMailMock,
    } as unknown as MailService);
  });

  it("sends confirmation (and account) emails to clientAccount.email, never to building.contactEmail", async () => {
    await service.confirm({
      lockId: LOCK_ID,
      sessionId: "session-test-abcdefgh",
      spaceId: SPACE_ID,
      startAt: "2026-07-21T08:00:00.000Z",
      endAt: "2026-07-21T10:00:00.000Z",
      durationClass: "hourly",
      partySize: 4,
      services: [],
      accountMode: "new",
      email: CLIENT_EMAIL,
      password: "GoodPass1!",
      identity: {
        firstName: "Alice",
        lastName: "Martin",
      },
      privacyPolicyAccepted: true,
      marketingCommunicationsAccepted: false,
      cgvAccepted: true,
      withdrawalAcknowledged: true,
      paymentMethod: "proforma",
    });

    expect(sendMailMock).toHaveBeenCalled();
    const recipients = sendMailMock.mock.calls.map((call) => call[0].to as string);

    expect(recipients.length).toBeGreaterThanOrEqual(1);
    for (const to of recipients) {
      expect(to).toBe(CLIENT_EMAIL);
      expect(to).not.toBe(BUILDING_CONTACT_EMAIL);
    }

    // Body may still display the building contact (mailto) — that is allowed.
    const confirmationHtml = sendMailMock.mock.calls[0][0].html as string;
    expect(confirmationHtml).toContain(BUILDING_CONTACT_EMAIL);
  });
});
