import { Injectable } from "@nestjs/common";
import { compare } from "bcryptjs";
import { connectMongo } from "@coworkprysme/db";
import { initGestionApiEnv } from "@coworkprysme/shared/server";
import type { CentraleValidatedUser, PrysmaEnrichment } from "@coworkprysme/shared";

const PRYSMA_ENRICHMENT_PROJECTION = {
  photo: 1,
  position: 1,
  service: 1,
  office: 1,
  email_principal: 1,
  display_name: 1,
  is_active: 1,
  is_archived: 1,
} as const;

/** Strict read-only projection for local login — hash field never leaves this service. */
const PRYSMA_CREDENTIALS_PROJECTION = {
  id: 1,
  username: 1,
  password: 1,
  first_name: 1,
  last_name: 1,
  email_principal: 1,
  is_active: 1,
  is_archived: 1,
} as const;

interface PrysmaEnrichmentDoc {
  photo?: string;
  position?: string;
  service?: string;
  office?: string;
  email_principal?: string;
  display_name?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

interface PrysmaCredentialsDoc {
  id?: string;
  username?: string;
  /** Prysm stores the bcrypt hash in field `password`. Never log or return. */
  password?: string;
  first_name?: string;
  last_name?: string;
  email_principal?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

function isPrysmaUserActive(doc: { is_active?: boolean; is_archived?: boolean }): boolean {
  return doc.is_archived !== true && doc.is_active !== false;
}

function toCentraleValidatedUser(doc: PrysmaCredentialsDoc): CentraleValidatedUser | undefined {
  if (!doc.id || !doc.username || !doc.email_principal) {
    return undefined;
  }

  return {
    id: doc.id,
    username: doc.username,
    email: doc.email_principal,
    first_name: doc.first_name ?? "",
    last_name: doc.last_name ?? "",
  };
}

/** Read-only access to prysma_bdd.users — native driver, no Mongoose models. */
@Injectable()
export class PrysmaUserReadService {
  async validateLocalCredentials(
    username: string,
    plainPassword: string,
  ): Promise<CentraleValidatedUser | undefined> {
    const env = initGestionApiEnv();
    const mongoose = await connectMongo();
    const prysmaDb = mongoose.connection.getClient().db(env.MONGODB_DB_PRYSMA);

    const doc = (await prysmaDb
      .collection("users")
      .findOne(
        { username },
        { projection: PRYSMA_CREDENTIALS_PROJECTION },
      )) as PrysmaCredentialsDoc | null;

    if (!doc || !isPrysmaUserActive(doc)) {
      return undefined;
    }

    const passwordHash = doc.password;
    if (!passwordHash) {
      return undefined;
    }

    const passwordMatches = await compare(plainPassword, passwordHash);
    if (!passwordMatches) {
      return undefined;
    }

    return toCentraleValidatedUser(doc);
  }

  async findEnrichment(prysmAppUserId: string): Promise<PrysmaEnrichment | undefined> {
    const env = initGestionApiEnv();
    const mongoose = await connectMongo();
    const prysmaDb = mongoose.connection.getClient().db(env.MONGODB_DB_PRYSMA);

    const doc = (await prysmaDb
      .collection("users")
      .findOne(
        { id: prysmAppUserId },
        { projection: PRYSMA_ENRICHMENT_PROJECTION },
      )) as PrysmaEnrichmentDoc | null;

    if (!doc || !isPrysmaUserActive(doc)) {
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
