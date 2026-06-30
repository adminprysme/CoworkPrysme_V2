import { LivenessResponseSchema } from "@coworkprysme/shared";
import { NextResponse } from "next/server";

export async function GET() {
  const payload = LivenessResponseSchema.parse({ status: "ok" });
  return NextResponse.json(payload, { status: 200 });
}
