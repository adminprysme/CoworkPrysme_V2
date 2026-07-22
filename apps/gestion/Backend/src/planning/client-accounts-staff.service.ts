import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  assertReplicaSetForTransactions,
  connectMongo,
  getCardexModel,
  getClientAccountModel,
  type ClientAccount,
  type StaffProfileDocument,
} from "@coworkprysme/db";
import {
  CLIENT_ACCOUNT_STAFF_ERROR_CODES,
  CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES,
  StaffClientAccountSchema,
  StaffTransferCardexOwnershipResultSchema,
  type StaffClientAccount,
  type StaffDeactivateClientAccountRequest,
  type StaffTransferCardexOwnershipRequest,
  type StaffTransferCardexOwnershipResult,
} from "@coworkprysme/shared";
import type { Types } from "mongoose";

import { writeClientStaffAudit } from "./client-accounts-staff-audit.js";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

function assertObjectId(value: string, label: string): string {
  if (!OBJECT_ID_PATTERN.test(value)) {
    throw new BadRequestException({
      code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.INVALID_ID,
      message: `${label} invalide`,
    });
  }
  return value;
}

function toIso(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  return new Date(value).toISOString();
}

function mapAccount(doc: ClientAccount & { _id: Types.ObjectId }): StaffClientAccount {
  return StaffClientAccountSchema.parse({
    id: String(doc._id),
    email: doc.email,
    role: doc.role,
    status: doc.status,
    ...(doc.cardexId ? { cardexId: String(doc.cardexId) } : {}),
    ...(doc.lockedAt ? { lockedAt: toIso(doc.lockedAt) } : {}),
    ...(doc.lockedByStaffProfileId
      ? { lockedByStaffProfileId: String(doc.lockedByStaffProfileId) }
      : {}),
    ...(doc.lockReason ? { lockReason: doc.lockReason } : {}),
    ...(doc.unlockedAt ? { unlockedAt: toIso(doc.unlockedAt) } : {}),
    ...(doc.unlockedByStaffProfileId
      ? { unlockedByStaffProfileId: String(doc.unlockedByStaffProfileId) }
      : {}),
  });
}

@Injectable()
export class ClientAccountsStaffService {
  async deactivate(
    profile: StaffProfileDocument,
    clientAccountId: string,
    request: StaffDeactivateClientAccountRequest,
  ): Promise<StaffClientAccount> {
    await connectMongo();
    const id = assertObjectId(clientAccountId, "clientAccountId");
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(id).exec();
    if (!account) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
      });
    }

    if (account.status === "anonymized") {
      throw new ConflictException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_ANONYMIZED,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_ANONYMIZED,
      });
    }

    if (account.status === "locked") {
      throw new ConflictException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_ALREADY_LOCKED,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_ALREADY_LOCKED,
      });
    }

    if (account.role === "owner") {
      throw new ConflictException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_IS_OWNER,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_IS_OWNER,
      });
    }

    if (account.cardexId) {
      const Cardex = await getCardexModel();
      const cardex = await Cardex.findById(account.cardexId)
        .select({ clientAccountId: 1 })
        .lean()
        .exec();
      if (cardex && String(cardex.clientAccountId) === String(account._id)) {
        throw new ConflictException({
          code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_IS_OWNER,
          message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_IS_OWNER,
        });
      }

      const activeCount = await ClientAccount.countDocuments({
        cardexId: account.cardexId,
        status: "active",
      }).exec();
      if (activeCount <= 1) {
        throw new ConflictException({
          code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_LAST_ACTIVE,
          message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_LAST_ACTIVE,
        });
      }
    }

    const before = {
      status: account.status,
      lockedAt: account.lockedAt ? toIso(account.lockedAt) : null,
      lockedByStaffProfileId: account.lockedByStaffProfileId
        ? String(account.lockedByStaffProfileId)
        : null,
      lockReason: account.lockReason ?? null,
    };

    const now = new Date();
    const $set: Record<string, unknown> = {
      status: "locked",
      lockedAt: now,
      lockedByStaffProfileId: profile._id,
    };
    if (request.reason) {
      $set.lockReason = request.reason;
    }
    const $unset: Record<string, 1> = {
      unlockedAt: 1,
      unlockedByStaffProfileId: 1,
    };
    if (!request.reason) {
      $unset.lockReason = 1;
    }

    const updated = await ClientAccount.findByIdAndUpdate(
      account._id,
      { $set, $unset },
      { new: true },
    ).exec();
    if (!updated) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
      });
    }

    await writeClientStaffAudit({
      profile,
      action: "client.account.lock",
      entity: { type: "clientAccount", id: updated._id },
      reason: request.reason,
      diff: {
        status: { before: before.status, after: "locked" },
        lockedAt: { before: before.lockedAt, after: toIso(now) },
        lockedByStaffProfileId: {
          before: before.lockedByStaffProfileId,
          after: String(profile._id),
        },
        lockReason: { before: before.lockReason, after: request.reason ?? null },
      },
      at: now,
    });

    return mapAccount(updated.toObject());
  }

  async reactivate(
    profile: StaffProfileDocument,
    clientAccountId: string,
  ): Promise<StaffClientAccount> {
    await connectMongo();
    const id = assertObjectId(clientAccountId, "clientAccountId");
    const ClientAccount = await getClientAccountModel();
    const account = await ClientAccount.findById(id).exec();
    if (!account) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
      });
    }

    if (account.status === "anonymized") {
      throw new ConflictException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_ANONYMIZED,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_ANONYMIZED,
      });
    }

    if (account.status !== "locked") {
      throw new ConflictException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_LOCKED,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_LOCKED,
      });
    }

    const before = {
      status: account.status,
      lockedAt: account.lockedAt ? toIso(account.lockedAt) : null,
      lockedByStaffProfileId: account.lockedByStaffProfileId
        ? String(account.lockedByStaffProfileId)
        : null,
      lockReason: account.lockReason ?? null,
    };

    const now = new Date();
    const updated = await ClientAccount.findByIdAndUpdate(
      account._id,
      {
        $set: {
          status: "active",
          unlockedAt: now,
          unlockedByStaffProfileId: profile._id,
        },
        $unset: {
          lockedAt: 1,
          lockedByStaffProfileId: 1,
          lockReason: 1,
        },
      },
      { new: true },
    ).exec();
    if (!updated) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
      });
    }

    await writeClientStaffAudit({
      profile,
      action: "client.account.unlock",
      entity: { type: "clientAccount", id: updated._id },
      diff: {
        status: { before: before.status, after: "active" },
        unlockedAt: { before: null, after: toIso(now) },
        unlockedByStaffProfileId: { before: null, after: String(profile._id) },
        lockedAt: { before: before.lockedAt, after: null },
        lockReason: { before: before.lockReason, after: null },
      },
      at: now,
    });

    return mapAccount(updated.toObject());
  }

  async transferOwnership(
    profile: StaffProfileDocument,
    cardexId: string,
    request: StaffTransferCardexOwnershipRequest,
    /**
     * Test/proof hook: runs after the fast-path active check and before the
     * transaction (TOCTOU window). Never pass from HTTP controllers.
     */
    options?: { afterActivePrecheck?: () => Promise<void> },
  ): Promise<StaffTransferCardexOwnershipResult> {
    await connectMongo();
    const id = assertObjectId(cardexId, "cardexId");
    const nextId = assertObjectId(request.nextClientAccountId, "nextClientAccountId");

    const Cardex = await getCardexModel();
    const ClientAccount = await getClientAccountModel();

    const cardex = await Cardex.findById(id).exec();
    if (!cardex) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.CARDEX_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.CARDEX_NOT_FOUND,
      });
    }

    const currentOwnerId = String(cardex.clientAccountId);
    if (currentOwnerId === nextId) {
      throw new BadRequestException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_IS_OWNER,
      });
    }

    const nextAccount = await ClientAccount.findById(nextId).exec();
    if (!nextAccount) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_NOT_FOUND,
      });
    }

    if (!nextAccount.cardexId || String(nextAccount.cardexId) !== id) {
      throw new BadRequestException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_OTHER_CARDEX,
      });
    }

    if (nextAccount.status !== "active") {
      throw new BadRequestException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_NOT_ACTIVE,
      });
    }

    const previousOwner = await ClientAccount.findById(currentOwnerId).exec();
    if (!previousOwner) {
      throw new NotFoundException({
        code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.ACCOUNT_NOT_FOUND,
        message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.ACCOUNT_NOT_FOUND,
      });
    }

    if (options?.afterActivePrecheck) {
      await options.afterActivePrecheck();
    }

    const mongooseInstance = await connectMongo();
    await assertReplicaSetForTransactions(mongooseInstance.connection);
    const session = await mongooseInstance.startSession();
    const now = new Date();

    try {
      await session.withTransaction(async () => {
        // Atomic gate: promote only if still active at write time (closes TOCTOU).
        const promoted = await ClientAccount.findOneAndUpdate(
          { _id: nextAccount._id, status: "active" },
          { $set: { role: "owner" } },
          { session, returnDocument: "after" },
        ).exec();

        if (!promoted) {
          throw new BadRequestException({
            code: CLIENT_ACCOUNT_STAFF_ERROR_CODES.TRANSFER_TARGET_INVALID,
            message: CLIENT_ACCOUNT_STAFF_ERROR_MESSAGES.TRANSFER_TARGET_NOT_ACTIVE,
          });
        }

        await Cardex.updateOne(
          { _id: cardex._id },
          { $set: { clientAccountId: nextAccount._id } },
          { session },
        ).exec();

        await ClientAccount.updateOne(
          { _id: previousOwner._id },
          { $set: { role: "member" } },
          { session },
        ).exec();
      });
    } finally {
      await session.endSession();
    }

    const [previousAfter, nextAfter, cardexAfter] = await Promise.all([
      ClientAccount.findById(previousOwner._id).lean().exec(),
      ClientAccount.findById(nextAccount._id).lean().exec(),
      Cardex.findById(cardex._id).lean().exec(),
    ]);
    if (!previousAfter || !nextAfter || !cardexAfter) {
      throw new Error("Ownership transfer reload failed");
    }

    await writeClientStaffAudit({
      profile,
      action: "client.account.transfer_ownership",
      entity: { type: "cardex", id: cardex._id },
      reason: request.reason,
      diff: {
        clientAccountId: { before: currentOwnerId, after: nextId },
        previousOwnerRole: { before: previousOwner.role, after: previousAfter.role },
        nextOwnerRole: { before: nextAccount.role, after: nextAfter.role },
      },
      at: now,
    });

    return StaffTransferCardexOwnershipResultSchema.parse({
      cardexId: String(cardexAfter._id),
      previousOwner: mapAccount(previousAfter),
      nextOwner: mapAccount(nextAfter),
    });
  }
}
