import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import {
  ActiveBookingLockQuerySchema,
  ActiveBookingLockResponseSchema,
  BookingAvailabilityQuerySchema,
  BookingAvailabilityResponseSchema,
  BookingLockResponseSchema,
  BookingPriceRequestSchema,
  BookingPriceResponseSchema,
  BookingServicesQuerySchema,
  BookingServicesResponseSchema,
  BookingSpaceAvailabilityQuerySchema,
  BookingSpaceAvailabilityResponseSchema,
  BookingSpacesQuerySchema,
  BookingSpacesResponseSchema,
  CreateBookingLockRequestSchema,
  ReleaseBookingLockQuerySchema,
} from "@coworkprysme/shared";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { BookingCatalogService } from "./booking-catalog.service.js";
import { BookingPriceService } from "./booking-price.service.js";
import { BookingService } from "./booking.service.js";

@Controller("booking")
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly bookingCatalog: BookingCatalogService,
    private readonly bookingPrice: BookingPriceService,
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
}
