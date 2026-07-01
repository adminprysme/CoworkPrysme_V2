import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import { CoworkReadinessResponseSchema } from "@coworkprysme/shared";
import type { Response } from "express";

import { DbService } from "../db/db.service.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(DbService) private readonly dbService: DbService) {}

  @Get()
  async getHealth(@Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.dbService.runCoworkReadinessCheck();
      const payload = CoworkReadinessResponseSchema.parse(result);
      if (payload.status === "error") {
        res.status(HttpStatus.SERVICE_UNAVAILABLE);
      }
      return payload;
    } catch (error) {
      console.error("[health:readiness]", error instanceof Error ? error.message : "Unknown error");
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return CoworkReadinessResponseSchema.parse({
        status: "error",
        timestamp: new Date().toISOString(),
        checks: { cowork: false },
      });
    }
  }
}
