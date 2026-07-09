import { Injectable } from "@nestjs/common";

@Injectable()
export class GestionClientService {
  async pingHealth(): Promise<boolean> {
    const baseUrl = process.env.GESTION_API_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      return false;
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
