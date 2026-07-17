import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import {
  ActiveBookingLockQuerySchema,
  ActiveBookingLockResponseSchema,
  BookingAvailabilityQuerySchema,
  BookingAvailabilityResponseSchema,
  BookingBuildingsResponseSchema,
  BookingCheckEmailRequestSchema,
  BookingCheckEmailResponseSchema,
  BookingConfirmRequestSchema,
  BookingConfirmResponseSchema,
  BookingLockResponseSchema,
  BookingPriceRequestSchema,
  BookingPriceResponseSchema,
  BookingServicesQuerySchema,
  BookingServicesResponseSchema,
  BookingSpaceAvailabilityQuerySchema,
  BookingSpaceAvailabilityResponseSchema,
  BookingSpacesQuerySchema,
  BookingSpacesResponseSchema,
  BookingVerifyAccountRequestSchema,
  BookingVerifyAccountResponseSchema,
  CreateBookingLockRequestSchema,
  ReleaseBookingLockQuerySchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BookingAccountService } from "./booking-account.service.js";
import { BookingCatalogService } from "./booking-catalog.service.js";
import { BookingConfirmService } from "./booking-confirm.service.js";
import { BookingPriceService } from "./booking-price.service.js";
import { BookingService } from "./booking.service.js";

@Controller("booking")
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly bookingCatalog: BookingCatalogService,
    private readonly bookingPrice: BookingPriceService,
    private readonly bookingAccount: BookingAccountService,
    private readonly bookingConfirm: BookingConfirmService,
  ) {}

  @Get("availability")
  async searchAvailability(@Query() query: Record<string, unknown>) {
    const parsed = BookingAvailabilityQuerySchema.parse(query);
    const payload = await this.booking.searchAvailability(parsed);
    return BookingAvailabilityResponseSchema.parse(payload);
  }

  @Get("spaces")
  async listSpaces(@Query() query: Record<string, unknown>) {
    const parsed = BookingSpacesQuerySchema.parse(query);
    const payload = await this.booking.listSpaces(parsed);
    return BookingSpacesResponseSchema.parse(payload);
  }

  @Get("buildings")
  async listBuildings() {
    const payload = await this.booking.listActiveBuildings();
    return BookingBuildingsResponseSchema.parse(payload);
  }

  @Get("spaces/:spaceId/availability")
  async getSpaceAvailability(
    @Param("spaceId") spaceId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = BookingSpaceAvailabilityQuerySchema.parse(query);
    const payload = await this.booking.getSpaceAvailability(spaceId, parsed);
    return BookingSpaceAvailabilityResponseSchema.parse(payload);
  }

  @Post("lock")
  async createLock(@Body() body: unknown) {
    const parsed = CreateBookingLockRequestSchema.parse(body);
    const payload = await this.booking.createLock(parsed);
    return BookingLockResponseSchema.parse(payload);
  }

  @Get("lock/active")
  async getActiveLock(@Query() query: Record<string, unknown>) {
    const parsed = ActiveBookingLockQuerySchema.parse(query);
    const payload = await this.booking.getActiveLock(parsed.sessionId);
    return ActiveBookingLockResponseSchema.parse(payload);
  }

  @Delete("lock/:lockId")
  async releaseLock(@Param("lockId") lockId: string, @Query() query: Record<string, unknown>) {
    const parsed = ReleaseBookingLockQuerySchema.parse(query);
    await this.booking.releaseLock(lockId, parsed.sessionId);
    return { released: true };
  }

  @Get("services")
  async listServices(@Query() query: Record<string, unknown>) {
    const parsed = BookingServicesQuerySchema.parse(query);
    const payload = await this.bookingCatalog.listServicesForBuilding(parsed);
    return BookingServicesResponseSchema.parse(payload);
  }

  @Post("price")
  async computePrice(@Body() body: unknown) {
    const parsed = BookingPriceRequestSchema.parse(body);
    const payload = await this.bookingPrice.computePrice(parsed);
    return BookingPriceResponseSchema.parse(payload);
  }

  @Post("account/check-email")
  async checkEmail(@Body() body: unknown) {
    const parsed = BookingCheckEmailRequestSchema.parse(body);
    const payload = await this.bookingAccount.checkEmail(parsed);
    return BookingCheckEmailResponseSchema.parse(payload);
  }

  @Post("account/verify")
  async verifyAccount(@Body() body: unknown) {
    const parsed = BookingVerifyAccountRequestSchema.parse(body);
    const payload = await this.bookingAccount.verifyAccount(parsed);
    return BookingVerifyAccountResponseSchema.parse(payload);
  }

  @Get("payment-methods")
  getPaymentMethods(@Query() query: Record<string, unknown>) {
    const startAt = typeof query.startAt === "string" ? query.startAt : "";
    if (!startAt) {
      return this.bookingConfirm.getPaymentMethods(new Date().toISOString());
    }
    return this.bookingConfirm.getPaymentMethods(startAt);
  }

  @Post("confirm")
  async confirmBooking(@Body() body: unknown) {
    const parsed = BookingConfirmRequestSchema.parse(body);
    const payload = await this.bookingConfirm.confirm(parsed);
    return BookingConfirmResponseSchema.parse(payload);
  }
}
