import { Module } from "@nestjs/common";

import { InvoicePdfService } from "./invoice-pdf.service.js";

@Module({
  providers: [InvoicePdfService],
  exports: [InvoicePdfService],
})
export class InvoicePdfModule {}
