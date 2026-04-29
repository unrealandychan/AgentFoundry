import type { SkillManifest } from "@/types";
import type { NextRequest } from "next/server";
import { getSkillStore } from "@/lib/skill-store";
import { SkillManifestSchema } from "@/lib/schemas";
import { checkApiKey } from "@/lib/auth";
import { skills as registrySkills } from "@/lib/registry";

/**
 * GET /api/skills — list ALL skills: registry (built-in) + store (custom/dynamic).
 *
 * Previously only returned store.list(), so custom skills saved via the store
 * were visible but all built-in registry skills disappeared from the wizard.
 * Now merges both sources, deduplicating by id (store takes precedence so
 * overrides are respected).
 */
export async function GET() {
  try {
    const store = getSkillStore();
    const storeSkills = await store.list();

    // Build a map seeded with registry skills, then overwrite with store skills
    // so user-customised versions of built-ins win.
    const merged = new Map<string, SkillManifest>(registrySkills.map((s) => [s.id, s]));
    for (const s of storeSkills) merged.set(s.id, s);

    const all = Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
    return Response.json(all);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load skills";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** POST /api/skills — create a new skill */
export async function POST(request: NextRequest) {
  const auth = checkApiKey(request);
  if (!auth.authorized) {
    return Response.json({ error: "Unauthorized", message: auth.reason }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SkillManifestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid skill data" },
      { status: 400 },
    );
  }

  try {
    const store = getSkillStore();
    const created = await store.create(parsed.data);
    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create skill";
    const status = message.includes("already exists") ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
