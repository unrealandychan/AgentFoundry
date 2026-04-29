/**
 * sandbox-session-store.ts
 *
 * Server-side persistence for Skill Sandbox sessions.
 * Mirrors the SkillStore adapter pattern:
 *
 *   MONGODB_URI set  →  MongoDB collection "sandbox_sessions"
 *   Otherwise        →  Local disk  sandbox-sessions/<id>.json
 *
 * This is intentionally simpler than SkillStore (no S3 path) —
 * sandbox sessions are ephemeral enough that S3 is overkill.
 */

import { readFile, writeFile, unlink, readdir, mkdir } from "fs/promises";
import { join } from "path";
import type { SandboxSession } from "@/types";

// ─── Interface ─────────────────────────────────────────────────────────────────

export interface SandboxSessionStore {
  list(): Promise<SandboxSession[]>;
  get(id: string): Promise<SandboxSession | null>;
  upsert(session: SandboxSession): Promise<SandboxSession>;
  patch(id: string, partial: Partial<SandboxSession>): Promise<SandboxSession | null>;
  delete(id: string): Promise<void>;
}

// ─── File-backed store ─────────────────────────────────────────────────────────

const SESSIONS_DIR = join(process.cwd(), "sandbox-sessions");

async function ensureDir(): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

class FileSessionStore implements SandboxSessionStore {
  async list(): Promise<SandboxSession[]> {
    await ensureDir();
    let files: string[];
    try {
      files = await readdir(SESSIONS_DIR);
    } catch {
      return [];
    }
    const sessions = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(SESSIONS_DIR, f), "utf8");
            return JSON.parse(raw) as SandboxSession;
          } catch {
            return null;
          }
        }),
    );
    return sessions
      .filter((s): s is SandboxSession => s !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async get(id: string): Promise<SandboxSession | null> {
    await ensureDir();
    try {
      const raw = await readFile(join(SESSIONS_DIR, `${id}.json`), "utf8");
      return JSON.parse(raw) as SandboxSession;
    } catch {
      return null;
    }
  }

  async upsert(session: SandboxSession): Promise<SandboxSession> {
    await ensureDir();
    await writeFile(join(SESSIONS_DIR, `${session.id}.json`), JSON.stringify(session, null, 2));
    return session;
  }

  async patch(id: string, partial: Partial<SandboxSession>): Promise<SandboxSession | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const updated: SandboxSession = {
      ...existing,
      ...partial,
      id, // never allow id override
      updatedAt: new Date().toISOString(),
    };
    return this.upsert(updated);
  }

  async delete(id: string): Promise<void> {
    try {
      await unlink(join(SESSIONS_DIR, `${id}.json`));
    } catch {
      /* already gone */
    }
  }
}

// ─── MongoDB store ─────────────────────────────────────────────────────────────

import type { MongoClient, Collection } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

async function getMongoClient(uri: string): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

const DB_NAME = process.env.MONGODB_DB_NAME ?? "agentfoundry";
const COL_NAME = "sandbox_sessions";

class MongoSessionStore implements SandboxSessionStore {
  constructor(private readonly uri: string) {}

  private async col(): Promise<Collection<Omit<SandboxSession, "_id">>> {
    const client = await getMongoClient(this.uri);
    return client.db(DB_NAME).collection<Omit<SandboxSession, "_id">>(COL_NAME);
  }

  async list(): Promise<SandboxSession[]> {
    const col = await this.col();
    return col
      .find({}, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .toArray() as unknown as SandboxSession[];
  }

  async get(id: string): Promise<SandboxSession | null> {
    const col = await this.col();
    return col.findOne({ id }, { projection: { _id: 0 } }) as unknown as SandboxSession | null;
  }

  async upsert(session: SandboxSession): Promise<SandboxSession> {
    const col = await this.col();
    await col.replaceOne({ id: session.id }, session as Omit<SandboxSession, "_id">, { upsert: true });
    return session;
  }

  async patch(id: string, partial: Partial<SandboxSession>): Promise<SandboxSession | null> {
    const col = await this.col();
    const result = await col.findOneAndUpdate(
      { id },
      { $set: { ...partial, updatedAt: new Date().toISOString() } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    return result as unknown as SandboxSession | null;
  }

  async delete(id: string): Promise<void> {
    const col = await this.col();
    await col.deleteOne({ id });
  }
}

// ─── Factory singleton ─────────────────────────────────────────────────────────

let _store: SandboxSessionStore | null = null;

export function getSandboxSessionStore(): SandboxSessionStore {
  if (_store) return _store;
  const mongoUri = process.env.MONGODB_URI;
  _store = mongoUri ? new MongoSessionStore(mongoUri) : new FileSessionStore();
  return _store;
}

/** Exposed for unit tests — resets the cached singleton. */
export function _resetSandboxSessionStore(): void {
  _store = null;
}
