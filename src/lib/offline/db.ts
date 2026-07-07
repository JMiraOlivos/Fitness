import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface PendingOperation {
  id?: number;
  type: "start_workout" | "log_set" | "finish_workout" | "substitute_exercise" | "readiness_log";
  clientOperationId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

interface FitnessOfflineDB extends DBSchema {
  "pendingOps": {
    key: number;
    value: PendingOperation;
    indexes: { "by-type": string; "by-created": string };
  };
}

let dbPromise: Promise<IDBPDatabase<FitnessOfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FitnessOfflineDB>("fitness-offline", 1, {
      upgrade(db) {
        const store = db.createObjectStore("pendingOps", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-type", "type");
        store.createIndex("by-created", "createdAt");
      },
    });
  }
  return dbPromise;
}

export async function addPendingOp(op: Omit<PendingOperation, "id" | "createdAt" | "retryCount">) {
  const db = await getDB();
  return db.add("pendingOps", {
    ...op,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}

export async function getAllPendingOps(): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAll("pendingOps");
}

export async function deletePendingOp(id: number) {
  const db = await getDB();
  return db.delete("pendingOps", id);
}

export async function updatePendingOpRetry(id: number, error: string) {
  const db = await getDB();
  const tx = db.transaction("pendingOps", "readwrite");
  const store = tx.objectStore("pendingOps");
  const op = await store.get(id);
  if (op) {
    op.retryCount += 1;
    op.lastError = error;
    await store.put(op);
  }
  await tx.done;
}

export async function countPendingOps(): Promise<number> {
  const db = await getDB();
  return db.count("pendingOps");
}
