/**
 * Wave2 invoice PDF attachment proof — real SMTP + real @coworkprysme/invoice-pdf.
 *
 * Exercises PlanningManageService paths that mutate the proforma then attach PDF:
 *   1) date-change extend with billDifference
 *   2) space-change with billDifference
 *
 * Cancel / shorten refunds are intentionally NOT covered here: they do not write
 * the invoice (suggested refund only) → no PDF per product rule.
 *
 * Usage (from apps/gestion/Backend, after nest build):
 *   node --env-file=.env scripts/send-wave2-invoice-pdf-email-proof.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { InvoicePdfService } from "@coworkprysme/invoice-pdf";
import {
  connectMongo,
  getClientAccountModel,
  getInvoiceModel,
  getReservationModel,
  getSpaceModel,
  getStaffProfileModel,
} from "@coworkprysme/db";

import { MailService } from "../dist/mail/mail.service.js";
import { PlanningManageService } from "../dist/planning/planning-manage.service.js";
import { PlanningService } from "../dist/planning/planning.service.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "tmp", "wave2-invoice-pdf-email-proof");
mkdirSync(OUT, { recursive: true });

const PROOF_TO = process.env.EMAIL_TO?.trim() || "team-comm@prysme.eu";
const PREFIX = "[PROOF Wave2-invoice]";

if (!process.env.SMTP_HOST) {
  throw new Error("SMTP_HOST missing — refuse dry-run for Wave2 invoice PDF proof");
}

await connectMongo();

const StaffProfile = await getStaffProfileModel();
const profile = await StaffProfile.findOne({ email: "paul.thomas@local.coworkprysme.dev" }).exec();
if (!profile) throw new Error("demo staff missing");

const ClientAccount = await getClientAccountModel();
const team = await ClientAccount.findOne({ email: "team-comm@prysme.eu" }).lean();
if (!team) throw new Error("team-comm@prysme.eu client account missing");

const Space = await getSpaceModel();
const focus = await Space.findOne({ name: "FOCUS" }).lean();
const focus2 = await Space.findOne({ name: "FOCUS 2 (test manage)" }).lean();
if (!focus || !focus2) throw new Error("FOCUS / FOCUS 2 spaces missing");

const Reservation = await getReservationModel();
const Invoice = await getInvoiceModel();

const refs = {
  extend: "RES-2026-PROOF-W2-INV-EXTEND",
  space: "RES-2026-PROOF-W2-INV-SPACE",
};
const invRefs = {
  extend: "PF-2026-PROOF-W2-INV-EXTEND",
  space: "PF-2026-PROOF-W2-INV-SPACE",
};

for (const ref of Object.values(refs)) {
  const existing = await Reservation.findOne({ reference: ref }).lean();
  if (existing) {
    await Invoice.deleteMany({ reservationId: existing._id });
    await Reservation.deleteOne({ _id: existing._id });
  }
}
await Invoice.deleteMany({ reference: { $in: Object.values(invRefs) } });

function dailyLine(label, priceHT) {
  const vatRate = 20;
  const totalHT = priceHT;
  const totalVAT = Math.round((totalHT * vatRate) / 100);
  const totalTTC = totalHT + totalVAT;
  return {
    label,
    kind: "space",
    qty: 1,
    unitPriceHT: priceHT,
    vatRate,
    discount: 0,
    totalHT,
    totalVAT,
    totalTTC,
  };
}

async function seedReservation({ reference, invoiceReference, startAt, endAt, space }) {
  const line = dailyLine(space.name, 18000);
  const reservation = await Reservation.create({
    reference,
    type: "meeting_room",
    status: "confirmed",
    clientAccountId: team._id,
    cardexId: team.cardexId,
    buildingId: space.buildingId,
    spaceId: space._id,
    startAt,
    endAt,
    durationClass: "daily",
    partySize: 2,
    spaceSnapshot: {
      name: space.name,
      type: space.type,
      capacity: space.capacity,
    },
    services: [],
    pricing: {
      subtotalHT: line.totalHT,
      totalVAT: line.totalVAT,
      totalTTC: line.totalTTC,
      discountTotal: 0,
    },
    createdChannel: "staff",
    statusHistory: [
      {
        from: "pending",
        to: "confirmed",
        at: new Date(),
        reason: "wave2 invoice pdf proof seed",
      },
    ],
  });

  await Invoice.create({
    reference: invoiceReference,
    currency: "EUR",
    type: "proforma",
    cardexId: team.cardexId,
    reservationId: reservation._id,
    lines: [line],
    vatBreakdown: [{ rate: 20, baseHT: line.totalHT, vat: line.totalVAT }],
    totals: {
      ht: line.totalHT,
      vat: line.totalVAT,
      ttc: line.totalTTC,
      discountTotal: 0,
      paidTotal: 0,
      balanceDue: line.totalTTC,
    },
    paymentSituation: "on_quote",
    status: "proforma",
    issuedAt: new Date(),
  });

  return reservation;
}

// Far-future slots (avoid 48h gate + overlaps with live bookings).
const extendStart = new Date("2026-11-02T07:00:00.000Z"); // Mon 08:00 Paris
const extendEnd = new Date("2026-11-02T17:00:00.000Z");
const extendNewEnd = new Date("2026-11-03T17:00:00.000Z"); // +1 day

const spaceStart = new Date("2026-11-09T07:00:00.000Z");
const spaceEnd = new Date("2026-11-09T17:00:00.000Z");

const extendRes = await seedReservation({
  reference: refs.extend,
  invoiceReference: invRefs.extend,
  startAt: extendStart,
  endAt: extendEnd,
  space: focus,
});
const spaceRes = await seedReservation({
  reference: refs.space,
  invoiceReference: invRefs.space,
  startAt: spaceStart,
  endAt: spaceEnd,
  space: focus,
});

const realMail = new MailService();
const invoicePdf = new InvoicePdfService();
const captured = [];

const mail = {
  async sendMail(input) {
    const att = input.attachments?.[0];
    const pdfMagic = att?.content?.subarray(0, 4)?.toString("utf8") ?? null;
    const pdfBytes = att?.content?.length ?? 0;
    if (att?.content) {
      writeFileSync(join(OUT, att.filename), att.content);
    }
    const subject = `${PREFIX} ${input.subject}`;
    const entry = {
      to: PROOF_TO,
      originalTo: input.to,
      subject,
      hasAttachment: Boolean(att),
      filename: att?.filename ?? null,
      pdfMagic,
      pdfBytes,
      contentType: att?.contentType ?? null,
    };
    captured.push(entry);
    const result = await realMail.sendMail({
      to: PROOF_TO,
      subject,
      html: `${input.html}<p style="margin-top:24px;font-size:12px;color:#666;">PROOF Wave2-invoice — attached=${entry.hasAttachment} bytes=${pdfBytes}</p>`,
      attachments: input.attachments,
    });
    return { ...result, proof: entry };
  },
};

const planning = new PlanningService();
const manage = new PlanningManageService(mail, planning, invoicePdf);

const audit = {
  decisionRule:
    "Attach regenerated proforma PDF only when this manage action persisted a real invoice mutation (rewritten lines or appended complement). Suggested refunds (cancel / shorten) never update the proforma → no PDF.",
  rows: [
    {
      email: "Changement de salle (billDifference=true)",
      financialImpactOnProforma: "yes",
      pdfAttached: "yes",
      justification: "Invoice lines+totals rewritten then PDF regenerated via @coworkprysme/invoice-pdf",
    },
    {
      email: "Changement de salle (billDifference=false)",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification:
        "Invoice document untouched; reservation.pricing may change but encaissement/final PDF read invoice.totals — future proforma unchanged",
    },
    {
      email: "Annulation avec remboursement suggéré/libre > 0",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification:
        "Refund stored in audit only; invoice lines/totals unchanged (snapshot + suggested refund rule)",
    },
    {
      email: "Annulation sans remboursement",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "No invoice write",
    },
    {
      email: "Dates — agrandir / report avec complément facturé",
      financialImpactOnProforma: "yes",
      pdfAttached: "yes",
      justification: "appendInvoiceAdjustment then PDF regenerate",
    },
    {
      email: "Dates — raccourcir avec remboursement > 0",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "Suggestion only; same as cancel — no invoice write",
    },
    {
      email: "Dates — raccourcir/report sans écart facturé",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "No invoice mutation",
    },
    {
      email: "Modifier l'effectif",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "partySize is capacity-only; tariffs never multiply by headcount",
    },
    {
      email: "Transfert de contact (×2)",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "Contact swap only; no price/docs impact",
    },
    {
      email: "Restauration",
      financialImpactOnProforma: "no",
      pdfAttached: "no",
      justification: "Status restore only; invoice unchanged",
    },
  ],
};

writeFileSync(join(OUT, "audit.json"), JSON.stringify(audit, null, 2));

console.log("=== confirm date-change extend (bill) ===");
const extendResult = await manage.confirmDateChange(profile, String(extendRes._id), {
  startAt: extendStart.toISOString(),
  endAt: extendNewEnd.toISOString(),
  confirmLateChange: false,
  acknowledgePriceGap: true,
  billDifference: true,
  confirm: true,
});
console.log(
  JSON.stringify(
    {
      kind: extendResult.kind,
      complementTTC: extendResult.complementTTC,
      billedDifference: extendResult.billedDifference,
    },
    null,
    2,
  ),
);

console.log("=== confirm space-change (bill) ===");
const spaceResult = await manage.confirmSpaceChange(profile, String(spaceRes._id), {
  nextSpaceId: String(focus2._id),
  acknowledgePriceGap: true,
  billDifference: true,
});
console.log(
  JSON.stringify(
    {
      billedDifference: spaceResult.billedDifference,
      deltaTTC: spaceResult.deltaTTC,
    },
    null,
    2,
  ),
);

const updatedExtend = await Invoice.findOne({ reference: invRefs.extend }).lean();
const updatedSpace = await Invoice.findOne({ reference: invRefs.space }).lean();

const summary = {
  to: PROOF_TO,
  decisionRule: audit.decisionRule,
  smtpCases: captured,
  invoiceAfter: {
    extend: {
      reference: updatedExtend?.reference,
      type: updatedExtend?.type,
      ttc: updatedExtend?.totals?.ttc,
      lineCount: updatedExtend?.lines?.length,
      lastLine: updatedExtend?.lines?.at(-1)?.label,
    },
    space: {
      reference: updatedSpace?.reference,
      type: updatedSpace?.type,
      ttc: updatedSpace?.totals?.ttc,
      spaceLine: updatedSpace?.lines?.find((l) => l.kind === "space"),
    },
  },
  manageResults: {
    extend: {
      kind: extendResult.kind,
      complementTTC: extendResult.complementTTC,
      billedDifference: extendResult.billedDifference,
    },
    space: {
      billedDifference: spaceResult.billedDifference,
      deltaTTC: spaceResult.deltaTTC,
    },
  },
};

for (const c of captured) {
  if (!c.hasAttachment) throw new Error(`Expected PDF attachment missing for ${c.subject}`);
  if (c.pdfMagic !== "%PDF") throw new Error(`Bad PDF magic for ${c.subject}: ${c.pdfMagic}`);
  if (c.pdfBytes < 5_000) throw new Error(`PDF too small for ${c.subject}: ${c.pdfBytes}`);
}

writeFileSync(join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("Wrote", join(OUT, "summary.json"));
console.log(JSON.stringify(summary.smtpCases, null, 2));

await invoicePdf.onModuleDestroy?.();
process.exit(0);
