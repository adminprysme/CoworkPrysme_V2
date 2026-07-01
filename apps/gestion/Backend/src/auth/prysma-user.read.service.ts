import { Injectable } from "@nestjs/common";
import { connectMongo } from "@coworkprysme/db";
import { initGestionApiEnv } from "@coworkprysme/shared/server";
import type { PrysmaEnrichment } from "@coworkprysme/shared";

const PRYSMA_USER_PROJECTION = {
  photo: 1,
  position: 1,
  service: 1,
  office: 1,
  email_principal: 1,
  display_name: 1,
  is_active: 1,
  is_archived: 1,
} as const;

interface PrysmaUserDoc {
  photo?: string;
  position?: string;
  service?: string;
  office?: string;
  email_principal?: string;
  display_name?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

/** Read-only enrichment from prysma_bdd.users — SSO mode only. */
@Injectable()
export class PrysmaUserReadService {
  async findEnrichment(prysmAppUserId: string): Promise<PrysmaEnrichment | undefined> {
    const env = initGestionApiEnv();
    const mongoose = await connectMongo();
    const client = mongoose.connection.getClient();
    const prysmaDb = client.db(env.MONGODB_DB_PRYSMA);

    const doc = (await prysmaDb
      .collection("users")
      .findOne(
        { id: prysmAppUserId },
        { projection: PRYSMA_USER_PROJECTION },
      )) as PrysmaUserDoc | null;

    if (!doc || doc.is_archived === true || doc.is_active === false) {
      return undefined;
    }

    return {
      photo: doc.photo,
      position: doc.position,
      service: doc.service,
      office: doc.office,
    };
  }
}
