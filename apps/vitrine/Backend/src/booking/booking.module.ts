import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { DiscountCodesModule } from "../discount-codes/discount-codes.module.js";
import { AvailabilityService } from "./availability.service.js";
import { BookingCatalogService } from "./booking-catalog.service.js";
import { BookingController } from "./booking.controller.js";
import { BookingPriceService } from "./booking-price.service.js";
import { BookingService } from "./booking.service.js";
import { SlotGenerationService } from "./slot-generation.service.js";

@Module({
  imports: [DbModule, DiscountCodesModule],
  controllers: [BookingController],
  providers: [
    AvailabilityService,
    SlotGenerationService,
    BookingService,
    BookingCatalogService,
    BookingPriceService,
  ],
})
export class BookingModule {}
