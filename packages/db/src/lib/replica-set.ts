import type { Connection } from "mongoose";

export interface ReplicaSetDetectionResult {
  supported: boolean;
  setName?: string;
  warning?: string;
}

const REPLICA_SET_WARNING =
  "MongoDB transactions require a replica set (a single-node replica set is sufficient). " +
  "Configure your Coolify MongoDB deployment with --replSet or use a managed cluster. " +
  "Without a replica set, createReservation and other transactional operations will fail.";

/**
 * Detects whether the connected MongoDB deployment supports multi-document transactions.
 */
export async function detectReplicaSet(connection: Connection): Promise<ReplicaSetDetectionResult> {
  const database = connection.db;
  if (!database) {
    return { supported: false, warning: REPLICA_SET_WARNING };
  }
  const admin = database.admin();
  const hello = (await admin.command({ hello: 1 })) as {
    setName?: string;
    msg?: string;
  };

  if (hello.setName) {
    return { supported: true, setName: hello.setName };
  }

  return {
    supported: false,
    warning: REPLICA_SET_WARNING,
  };
}

/**
 * Logs a clear warning when transactions are not supported. Does not throw.
 */
export async function warnIfNoReplicaSet(
  connection: Connection,
): Promise<ReplicaSetDetectionResult> {
  const result = await detectReplicaSet(connection);
  if (!result.supported && result.warning) {
    console.warn(`[cowork-db] ${result.warning}`);
  }
  return result;
}

/**
 * Ensures the connection targets a replica set before starting a transaction.
 * Fails fast — never degrades to non-transactional writes.
 */
export async function assertReplicaSetForTransactions(connection: Connection): Promise<void> {
  const result = await detectReplicaSet(connection);
  if (!result.supported) {
    throw new Error(result.warning ?? REPLICA_SET_WARNING);
  }
}
