import { Module } from "@nestjs/common";

import { AboutContentModule } from "./about-content/about-content.module.js";
import { BookingModule } from "./booking/booking.module.js";
import { CatalogContentModule } from "./catalog-content/catalog-content.module.js";
import { DbModule } from "./db/db.module.js";
import { DiscountCodesModule } from "./discount-codes/discount-codes.module.js";
import { GestionModule } from "./gestion/gestion.module.js";
import { HealthModule } from "./health/health.module.js";
import { HomeContentModule } from "./home-content/home-content.module.js";
import { InvoicePdfModule } from "./invoice-pdf/invoice-pdf.module.js";
import { InvitationsModule } from "./invitations/invitations.module.js";
import { MediaModule } from "./media/media.module.js";
import { ServicesContentModule } from "./services-content/services-content.module.js";
import { SiteContactModule } from "./site-contact/site-contact.module.js";
import { StripeModule } from "./stripe/stripe.module.js";

@Module({
  imports: [
    DbModule,
    HealthModule,
    GestionModule,
    MediaModule,
    HomeContentModule,
    AboutContentModule,
    CatalogContentModule,
    BookingModule,
    DiscountCodesModule,
    ServicesContentModule,
    SiteContactModule,
    StripeModule,
    InvoicePdfModule,
    InvitationsModule,
  ],
})
export class AppModule {}
