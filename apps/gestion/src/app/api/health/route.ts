import { runReadinessCheck } from "@coworkprysme/db";
import { ReadinessResponseSchema } from "@coworkprysme/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runReadinessCheck();
    const payload = ReadinessResponseSchema.parse(result);
    const httpStatus = payload.status === "error" ? 503 : 200;

    return NextResponse.json(payload, { status: httpStatus });
  } catch (error) {
    console.error("[health:readiness]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      ReadinessResponseSchema.parse({
        status: "error",
        timestamp: new Date().toISOString(),
        checks: { cowork: false, prysma: false },
      }),
      { status: 503 },
    );
  }
}
