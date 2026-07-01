import { Injectable } from "@nestjs/common";
import { initGestionApiEnv, type GestionApiEnv } from "@coworkprysme/shared/server";

@Injectable()
export class AuthConfigService {
  readonly env: GestionApiEnv;

  constructor() {
    this.env = initGestionApiEnv();
  }
}
