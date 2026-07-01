import { Injectable } from "@nestjs/common";
import { parseVitrineApiEnv } from "@coworkprysme/shared";

@Injectable()
export class GestionClientService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = parseVitrineApiEnv().GESTION_API_URL;
  }

  /** Placeholder — verifies gestion-api is reachable (no business logic). */
  async pingGestionHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error("[gestion-client]", error instanceof Error ? error.message : "Unknown error");
      return false;
    }
  }
}
