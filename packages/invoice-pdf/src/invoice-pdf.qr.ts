import QRCode from "qrcode";

/** PNG data-URL QR for a devis payment URL. Only used on invoice PDFs when paymentUrl is set. */
export async function buildPaymentQrDataUri(paymentUrl: string): Promise<string> {
  const trimmed = paymentUrl.trim();
  if (!trimmed) {
    throw new Error("paymentUrl is required to build a QR code");
  }
  return QRCode.toDataURL(trimmed, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 160,
    type: "image/png",
  });
}
