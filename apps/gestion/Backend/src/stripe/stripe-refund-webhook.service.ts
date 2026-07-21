import { Injectable, Logger } from "@nestjs/common";
import type Stripe from "stripe";
import {
  applyStripeCardRefund,
  getAuditLogModel,
  getClientAccountModel,
  getInvoiceModel,
  getPaymentModel,
  getReservationModel,
  markStripeCardRefundFailed,
} from "@coworkprysme/db";

/* eslint-disable @typescript-eslint/consistent-type-imports -- NestJS DI requires runtime class references */
import { MailService } from "../mail/mail.service.js";
import { renderRefundConfirmedEmail } from "../planning/planning-manage-emails.js";

@Injectable()
export class StripeRefundWebhookService {
  private readonly logger = new Logger(StripeRefundWebhookService.name);

  constructor(private readonly mail: MailService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    if (event.type === "refund.updated" || event.type === "refund.created") {
      await this.onRefund(event.data.object as Stripe.Refund);
      return;
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      for (const refund of charge.refunds?.data ?? []) {
        await this.onRefund(refund);
      }
    }
  }

  private async onRefund(refund: Stripe.Refund): Promise<void> {
    const stripeRefundId = refund.id;
    const amountCents = refund.amount;
    const status = refund.status ?? "pending";
    const paymentIntentId =
      typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;

    if (status === "failed" || status === "canceled") {
      await markStripeCardRefundFailed({ stripeRefundId });
      this.logger.warn(`Stripe refund ${stripeRefundId} status=${status}`);
      await this.writeRefundAudit({
        stripeRefundId,
        amountCents,
        refundStatus: "failed",
        paymentIntentId,
      });
      return;
    }

    if (status !== "succeeded") {
      this.logger.log(`Stripe refund ${stripeRefundId} still ${status} — waiting`);
      return;
    }

    if (!paymentIntentId) {
      this.logger.error(`Refund ${stripeRefundId} missing payment_intent`);
      return;
    }

    const Payment = await getPaymentModel();
    let pending = await Payment.findOne({
      "reconciliation.stripeRefundId": stripeRefundId,
    }).exec();
    if (!pending) {
      pending = await Payment.findOne({
        kind: "refund",
        method: "card",
        "reconciliation.stripePaymentIntentId": paymentIntentId,
        "reconciliation.status": "pending",
        amount: amountCents,
      })
        .sort({ createdAt: -1 })
        .exec();
      if (pending && !pending.reconciliation.stripeRefundId) {
        pending.reconciliation.stripeRefundId = stripeRefundId;
        await pending.save();
      }
    }

    if (!pending) {
      const cardPayment = await Payment.findOne({
        method: "card",
        kind: { $ne: "refund" },
        "reconciliation.stripePaymentIntentId": paymentIntentId,
      }).exec();
      if (!cardPayment) {
        this.logger.error(`No payment found for refund ${stripeRefundId} pi=${paymentIntentId}`);
        return;
      }
      const result = await applyStripeCardRefund({
        invoiceId: cardPayment.invoiceId,
        stripeRefundId,
        stripePaymentIntentId: paymentIntentId,
        amountCents,
        receivedAt: new Date(refund.created * 1000),
      });
      if (result.applied) {
        await this.afterRefundSucceeded({
          invoiceId: String(result.invoice._id),
          amountCents,
          stripeRefundId,
        });
      }
      return;
    }

    if (pending.reconciliation.status === "matched") {
      this.logger.log(`Refund ${stripeRefundId} already matched — idempotent skip`);
      return;
    }

    const result = await applyStripeCardRefund({
      invoiceId: pending.invoiceId,
      stripeRefundId,
      stripePaymentIntentId: paymentIntentId,
      amountCents,
      idempotencyKey: pending.reconciliation.idempotencyKey,
      receivedAt: new Date(refund.created * 1000),
    });

    if (result.applied) {
      await this.afterRefundSucceeded({
        invoiceId: String(result.invoice._id),
        amountCents,
        stripeRefundId,
      });
    }
  }

  private async afterRefundSucceeded(input: {
    invoiceId: string;
    amountCents: number;
    stripeRefundId: string;
  }): Promise<void> {
    const Invoice = await getInvoiceModel();
    const invoice = await Invoice.findById(input.invoiceId).lean().exec();
    if (!invoice) return;

    const Reservation = await getReservationModel();
    const reservation = await Reservation.findById(invoice.reservationId).lean().exec();
    if (!reservation) return;

    const AuditLog = await getAuditLogModel();
    const alreadyHandled = await AuditLog.findOne({
      action: "reservation.refund",
      "diff.stripeRefundId.after": input.stripeRefundId,
      "diff.refundStatus.after": "succeeded",
    })
      .lean()
      .exec();
    // Cancel path may have already applied + mailed when Stripe returned succeeded sync.
    const alreadyMailed = await AuditLog.findOne({
      action: "reservation.refund",
      "diff.stripeRefundId.after": input.stripeRefundId,
      "diff.emailSent.after": true,
    })
      .lean()
      .exec();

    if (!alreadyHandled) {
      await this.writeRefundAudit({
        stripeRefundId: input.stripeRefundId,
        amountCents: input.amountCents,
        refundStatus: "succeeded",
        reservationId: String(reservation._id),
        spaceId: String(reservation.spaceId),
      });
    }

    if (alreadyMailed) return;

    const email = await this.resolveClientEmail(reservation.clientAccountId?.toString());
    if (email) {
      const mail = renderRefundConfirmedEmail({
        reservationReference: reservation.reference,
        amountCents: input.amountCents,
        channel: "stripe_card",
        stripeRefundId: input.stripeRefundId,
      });
      await this.mail.sendMail({ to: email, subject: mail.subject, html: mail.html });
    }

    await AuditLog.create({
      actor: { kind: "system", id: "stripe-webhook" },
      action: "reservation.refund",
      entity: { type: "reservation", id: reservation._id },
      diff: {
        spaceId: { before: String(reservation.spaceId), after: String(reservation.spaceId) },
        amountCents: { before: 0, after: input.amountCents },
        refundStatus: { before: "pending", after: "succeeded" },
        stripeRefundId: { before: null, after: input.stripeRefundId },
        emailSent: { before: false, after: true },
      },
      at: new Date(),
    });
  }

  private async writeRefundAudit(input: {
    stripeRefundId: string;
    amountCents: number;
    refundStatus: string;
    paymentIntentId?: string;
    reservationId?: string;
    spaceId?: string;
  }): Promise<void> {
    let reservationId = input.reservationId;
    let spaceId = input.spaceId;

    if (!reservationId) {
      const Payment = await getPaymentModel();
      const pay = await Payment.findOne({
        "reconciliation.stripeRefundId": input.stripeRefundId,
      })
        .lean()
        .exec();
      if (pay) {
        const Invoice = await getInvoiceModel();
        const invoice = await Invoice.findById(pay.invoiceId).lean().exec();
        if (invoice) {
          reservationId = String(invoice.reservationId);
          const Reservation = await getReservationModel();
          const reservation = await Reservation.findById(invoice.reservationId).lean().exec();
          spaceId = reservation ? String(reservation.spaceId) : undefined;
        }
      }
    }
    if (!reservationId) return;

    const AuditLog = await getAuditLogModel();
    await AuditLog.create({
      actor: { kind: "system", id: "stripe-webhook" },
      action: "reservation.refund",
      entity: { type: "reservation", id: reservationId },
      diff: {
        ...(spaceId ? { spaceId: { before: spaceId, after: spaceId } } : {}),
        amountCents: { before: 0, after: input.amountCents },
        refundStatus: { before: null, after: input.refundStatus },
        stripeRefundId: { before: null, after: input.stripeRefundId },
      },
      at: new Date(),
    });
  }

  private async resolveClientEmail(clientAccountId?: string): Promise<string | null> {
    if (!clientAccountId) return null;
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(clientAccountId)
      .select({ email: 1 })
      .lean()
      .exec();
    return account?.email?.trim() || null;
  }
}
