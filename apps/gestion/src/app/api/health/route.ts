import { runHealthCheck } from "@coworkprysme/db";
import { HealthCheckResponseSchema } from "@coworkprysme/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await runHealthCheck();
    const payload = HealthCheckResponseSchema.parse(result);
    const httpStatus = payload.status === "error" ? 503 : 200;

    return NextResponse.json(payload, { status: httpStatus });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 },
    );
  }
}
