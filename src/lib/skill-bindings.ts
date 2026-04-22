/**
 * skill-bindings.ts
 *
 * Pluggable storage bindings for raw SKILL.md files.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  LocalSkillBinding  (default)  reads / writes  skills/<id>/SKILL.md │
 * │  S3SkillBinding     (cloud)    reads / writes  s3://{bucket}/{prefix}{id}/SKILL.md │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * The active binding is chosen by getSkillFileBinding():
 *   S3_BUCKET env var set  →  S3SkillBinding
 *   Otherwise              →  LocalSkillBinding
 *
 * Environment variables for S3:
 *   S3_BUCKET   (required)  bucket name
 *   S3_REGION   (optional)  AWS region, default "us-east-1"
 *   S3_PREFIX   (optional)  key prefix,  default "skills/"
 *
 * AWS credentials are resolved via the standard credential chain:
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, ~/.aws/credentials, IAM roles.
 *
 * Requires @aws-sdk/client-s3 for the S3 binding (already in package.json).
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// ── Interface ─────────────────────────────────────────────────────────────────

/**
 * Raw file I/O for SKILL.md files.
 * Implementations handle storage; parsing is delegated to skill-loader.ts.
 */
export interface SkillFileBinding {
  /** Return all skill IDs currently available in the store. */
  listIds(): Promise<string[]>;
  /** Return raw SKILL.md string, or null if the skill does not exist. */
  readFile(id: string): Promise<string | null>;
  /** Persist raw SKILL.md content. Creates the entry if it does not exist. */
  writeFile(id: string, content: string): Promise<void>;
  /** Remove the skill entry. Returns true when something was deleted. */
  deleteFile(id: string): Promise<boolean>;
}

// ── Local binding (disk) ──────────────────────────────────────────────────────

const LOCAL_SKILLS_DIR = path.join(process.cwd(), "skills");

/**
 * File-system binding — the default.
 * Reads and writes skills/<id>/SKILL.md files on the local disk.
 * Create/update/delete operations are available without any env configuration.
 */
export class LocalSkillBinding implements SkillFileBinding {
  private skillDir(id: string): string {
    return path.join(LOCAL_SKILLS_DIR, id);
  }

  async listIds(): Promise<string[]> {
    try {
      return await readdir(LOCAL_SKILLS_DIR);
    } catch {
      return [];
    }
  }

  async readFile(id: string): Promise<string | null> {
    try {
      return await readFile(path.join(this.skillDir(id), "SKILL.md"), "utf8");
    } catch {
      return null;
    }
  }

  async writeFile(id: string, content: string): Promise<void> {
    const dir = this.skillDir(id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  }

  async deleteFile(id: string): Promise<boolean> {
    const dir = this.skillDir(id);
    if (!existsSync(dir)) return false;
    await rm(dir, { recursive: true, force: true });
    return true;
  }
}

// ── S3 binding ────────────────────────────────────────────────────────────────

/**
 * AWS S3 binding — activated when S3_BUCKET is set.
 * Each skill lives at `{S3_PREFIX}{id}/SKILL.md` in the configured bucket.
 *
 * env vars:
 *   S3_BUCKET   (required)
 *   S3_REGION   (optional, default "us-east-1")
 *   S3_PREFIX   (optional, default "skills/")
 */
export class S3SkillBinding implements SkillFileBinding {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly prefix: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("S3_BUCKET environment variable is required for the S3 skill binding.");
    }
    this.bucket = bucket;
    this.prefix = process.env.S3_PREFIX ?? "skills/";
    this.client = new S3Client({ region: process.env.S3_REGION ?? "us-east-1" });
  }

  private objectKey(id: string): string {
    return `${this.prefix}${id}/SKILL.md`;
  }

  async listIds(): Promise<string[]> {
    const ids = new Set<string>();
    let continuationToken: string | undefined;

    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const object of response.Contents ?? []) {
        if (!object.Key) continue;
        // Key: {prefix}{id}/SKILL.md  →  extract the id segment
        const relative = object.Key.slice(this.prefix.length);
        const segmentEnd = relative.indexOf("/");
        if (segmentEnd > 0) ids.add(relative.slice(0, segmentEnd));
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return [...ids].sort();
  }

  async readFile(id: string): Promise<string | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(id) }),
      );
      if (!response.Body) return null;
      return response.Body.transformToString("utf8");
    } catch (error: unknown) {
      const name = (error as { name?: string }).name ?? "";
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw error;
    }
  }

  async writeFile(id: string, content: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(id),
        Body: content,
        ContentType: "text/markdown; charset=utf-8",
      }),
    );
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.prefix}${id}/`,
        }),
      );

      const keys = (listed.Contents ?? []).map((object) => object.Key).filter(Boolean);

      if (keys.length === 0) return false;

      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((k) => ({ Key: k })) },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

// ── Factory (singleton per process) ──────────────────────────────────────────

let _binding: SkillFileBinding | null = null;

/**
 * Returns the active SkillFileBinding singleton.
 *   S3_BUCKET set  →  S3SkillBinding
 *   Otherwise      →  LocalSkillBinding (disk)
 */
export function getSkillFileBinding(): SkillFileBinding {
  if (_binding) return _binding;
  _binding = process.env.S3_BUCKET ? new S3SkillBinding() : new LocalSkillBinding();
  return _binding;
}

/** Reset the cached singleton — for testing only. */
export function _resetSkillFileBinding(): void {
  _binding = null;
}
