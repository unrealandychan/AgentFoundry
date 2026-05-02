/**
 * Skill storage abstraction.
 *
 * Storage is selected by environment:
 *
 *   Default (Local disk):
 *     `skills/<id>/SKILL.md` files are the single source of truth.
 *     Full CRUD — create writes a new folder+file, update rewrites the file,
 *     delete removes the folder. Restart not required; changes are live.
 *
 *   Cloud (S3_BUCKET set):
 *     Skills are stored as `{S3_PREFIX}{id}/SKILL.md` objects in S3.
 *     Full CRUD via the AWS SDK. Set S3_BUCKET, S3_REGION, S3_PREFIX and
 *     standard AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 *
 *   Enterprise (MONGODB_URI set, takes precedence over S3/Local):
 *     Reads and writes from a MongoDB collection.
 *     Seeded from disk on first run.
 *
 * Usage:
 *   import { getSkillStore } from "@/lib/skill-store";
 *   const store = getSkillStore();
 *   const skills = await store.list();
 */

import type { MongoClient, Collection } from "mongodb";
import type { SkillManifest } from "@/types";
import { SkillManifestSchema } from "@/lib/schemas";
import {
  loadAllSkillsFromDisk,
  parseSkillContent,
  serializeSkillToMarkdown,
} from "@/lib/skill-loader";
import { type SkillFileBinding, getSkillFileBinding } from "@/lib/skill-bindings";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SkillStore {
  /** Return all skills. */
  list(): Promise<SkillManifest[]>;
  /** Return one skill by id, or null. */
  get(id: string): Promise<SkillManifest | null>;
  /** Create a new skill (enterprise only). */
  create(skill: SkillManifest): Promise<SkillManifest>;
  /** Patch an existing skill (enterprise only). Returns null if not found. */
  update(id: string, patch: Partial<SkillManifest>): Promise<SkillManifest | null>;
  /** Delete a skill (enterprise only). Returns true when deleted. */
  delete(id: string): Promise<boolean>;
}

// ─── File-backed store (Local disk or S3) ─────────────────────────────────────

/**
 * Full-CRUD skill store backed by a SkillFileBinding (Local or S3).
 * Parsing is done via parseSkillContent(); writes use serializeSkillToMarkdown().
 */
class FileBackedSkillStore implements SkillStore {
  constructor(private readonly binding: SkillFileBinding) {}

  async list(): Promise<SkillManifest[]> {
    const ids = await this.binding.listIds();
    // Cap concurrent S3/file reads to avoid exhausting connections or hitting rate limits
    const CONCURRENCY = 10;
    const results: (SkillManifest | null)[] = [];
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (id) => {
          const content = await this.binding.readFile(id);
          return content ? parseSkillContent(id, content) : null;
        }),
      );
      results.push(...batchResults);
    }
    return results
      .filter((skill): skill is SkillManifest => skill !== null)
      .sort((skillA, skillB) => skillA.title.localeCompare(skillB.title));
  }

  async get(id: string): Promise<SkillManifest | null> {
    const content = await this.binding.readFile(id);
    return content ? parseSkillContent(id, content) : null;
  }

  async create(skill: SkillManifest): Promise<SkillManifest> {
    const validated = SkillManifestSchema.parse(skill);
    const existing = await this.binding.readFile(validated.id);
    if (existing !== null) {
      throw new Error(`A skill with id "${validated.id}" already exists.`);
    }
    await this.binding.writeFile(validated.id, serializeSkillToMarkdown(validated));
    return validated;
  }

  async update(id: string, patch: Partial<SkillManifest>): Promise<SkillManifest | null> {
    const existing = await this.binding.readFile(id);
    if (existing === null) return null;

    const current = parseSkillContent(id, existing);
    if (!current) return null;

    const { _id: _removed, ...safePatch } = patch as Partial<SkillManifest> & { _id?: unknown };
    const merged: SkillManifest = { ...current, ...safePatch, id };
    await this.binding.writeFile(id, serializeSkillToMarkdown(merged));
    return merged;
  }

  async delete(id: string): Promise<boolean> {
    return this.binding.deleteFile(id);
  }
}

// ─── MongoDB store (enterprise / cloud) ──────────────────────────────────────

const DB_NAME = process.env.MONGODB_DB_NAME ?? "agentfoundry";
const COL_NAME = "skills";

// Singleton client — survives Next.js hot-reload in development.
// We declare on globalThis so the reference isn't lost across module re-evaluations.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

async function getMongoClient(uri: string): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    // Dynamic import keeps the mongodb package out of client bundles.
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect();
  }
  return global._mongoClientPromise;
}

class MongoSkillStore implements SkillStore {
  constructor(private readonly uri: string) {}

  private async col(): Promise<Collection<Omit<SkillManifest, "_id">>> {
    const client = await getMongoClient(this.uri);
    const database = client.db(DB_NAME);
    const col = database.collection<Omit<SkillManifest, "_id">>(COL_NAME);

    // Seed on first run if the collection is empty.
    const count = await col.estimatedDocumentCount();
    if (count === 0) {
      const diskSkills = await loadAllSkillsFromDisk();
      if (diskSkills.length > 0) {
        await col.insertMany(diskSkills as Omit<SkillManifest, "_id">[]);
      }
    }

    return col;
  }

  async list(): Promise<SkillManifest[]> {
    const col = await this.col();
    const docs = await col
      .find({}, { projection: { _id: 0 } })
      .sort({ title: 1 })
      .toArray();
    return docs
      .map((doc) => {
        const result = SkillManifestSchema.safeParse(doc);
        return result.success ? result.data : null;
      })
      .filter((skill): skill is SkillManifest => skill !== null);
  }

  async get(id: string): Promise<SkillManifest | null> {
    const col = await this.col();
    const doc = await col.findOne({ id }, { projection: { _id: 0 } });
    if (!doc) return null;
    const result = SkillManifestSchema.safeParse(doc);
    return result.success ? result.data : null;
  }

  async create(skill: SkillManifest): Promise<SkillManifest> {
    const validated = SkillManifestSchema.parse(skill);
    const col = await this.col();
    const existing = await col.findOne({ id: validated.id }, { projection: { _id: 0 } });
    if (existing) throw new Error(`A skill with id "${validated.id}" already exists.`);
    await col.insertOne(validated as Omit<SkillManifest, "_id">);
    return validated;
  }

  async update(id: string, patch: Partial<SkillManifest>): Promise<SkillManifest | null> {
    // Strip _id from patch if accidentally passed
    const { ...safePatch } = patch as Partial<SkillManifest> & { _id?: unknown };
    delete (safePatch as { _id?: unknown })._id;

    const col = await this.col();
    const raw = await col.findOneAndUpdate(
      { id },
      { $set: safePatch },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    if (!raw) return null;
    const validated = SkillManifestSchema.safeParse(raw);
    return validated.success ? validated.data : null;
  }

  async delete(id: string): Promise<boolean> {
    const col = await this.col();
    const result = await col.deleteOne({ id });
    return result.deletedCount === 1;
  }
}

// ─── Factory (singleton per process) ─────────────────────────────────────────

let _store: SkillStore | null = null;

/**
 * Returns the active SkillStore singleton.
 *   MONGODB_URI set  →  MongoSkillStore   (enterprise / cloud DB)
 *   S3_BUCKET set    →  FileBackedSkillStore(S3SkillBinding)
 *   Otherwise        →  FileBackedSkillStore(LocalSkillBinding)  (default)
 */
export function getSkillStore(): SkillStore {
  if (_store) return _store;
  const mongoUri = process.env.MONGODB_URI;
  _store = mongoUri
    ? new MongoSkillStore(mongoUri)
    : new FileBackedSkillStore(getSkillFileBinding());
  return _store;
}

/** Exposed for unit tests — resets the cached singleton. */
export function _resetSkillStore(): void {
  _store = null;
}
