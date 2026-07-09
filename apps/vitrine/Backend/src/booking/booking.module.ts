import { Module } from "@nestjs/common";

import { DbModule } from "../db/db.module.js";
import { AvailabilityService } from "./availability.service.js";
import { BookingController } from "./booking.controller.js";
import { BookingService } from "./booking.service.js";
import { SlotGenerationService } from "./slot-generation.service.js";

@Module({
  imports: [DbModule],
  controllers: [BookingController],
  providers: [AvailabilityService, SlotGenerationService, BookingService],
})
export class BookingModule {}
