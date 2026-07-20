import { Module } from "@nestjs/common";

import { BookingEmailsService } from "./booking-emails.service.js";
import { AvailabilityService } from "./availability.service.js";
import { BookingAccountService } from "./booking-account.service.js";
import { BookingCatalogService } from "./booking-catalog.service.js";
import { BookingConfirmService } from "./booking-confirm.service.js";
import { BookingController } from "./booking.controller.js";
import { BookingPriceService } from "./booking-price.service.js";
import { BookingService } from "./booking.service.js";
import { SlotGenerationService } from "./slot-generation.service.js";
import { DbModule } from "../db/db.module.js";
import { DiscountCodesModule } from "../discount-codes/discount-codes.module.js";
import { InvoicePdfModule } from "../invoice-pdf/invoice-pdf.module.js";
import { MailModule } from "../mail/mail.module.js";

@Module({
  imports: [DbModule, DiscountCodesModule, MailModule, InvoicePdfModule],
  controllers: [BookingController],
  providers: [
    AvailabilityService,
    SlotGenerationService,
    BookingService,
    BookingCatalogService,
    BookingPriceService,
    BookingAccountService,
    BookingEmailsService,
    BookingConfirmService,
  ],
  exports: [BookingEmailsService],
})
export class BookingModule {}
