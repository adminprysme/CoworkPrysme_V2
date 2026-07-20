import { Module } from "@nestjs/common";
import { InvoicePdfModule as SharedInvoicePdfModule } from "@coworkprysme/invoice-pdf";

@Module({
  imports: [SharedInvoicePdfModule],
  exports: [SharedInvoicePdfModule],
})
export class InvoicePdfModule {}
