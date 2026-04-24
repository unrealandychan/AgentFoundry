import type { NextRequest } from "next/server";
import { getSkillStore } from "@/lib/skill-store";
import { SkillManifestSchema } from "@/lib/schemas";
import { checkApiKey } from "@/lib/auth";

interface RouteContext {
  params: { id: string };
}

/** GET /api/skills/:id */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = params;
  try {
    const store = getSkillStore();
    const skill = await store.get(id);
    if (!skill) return Response.json({ error: "Skill not found" }, { status: 404 });
    return Response.json(skill);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch skill";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/skills/:id — full or partial update */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = checkApiKey(request);
  if (!auth.authorized) {
    return Response.json({ error: "Unauthorized", message: auth.reason }, { status: 401 });
  }

  const { id } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SkillManifestSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid skill data" },
      { status: 400 },
    );
  }

  try {
    const store = getSkillStore();
    const updated = await store.update(id, parsed.data);
    if (!updated) return Response.json({ error: "Skill not found" }, { status: 404 });
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update skill";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/skills/:id */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = checkApiKey(_request);
  if (!auth.authorized) {
    return Response.json({ error: "Unauthorized", message: auth.reason }, { status: 401 });
  }

  const { id } = params;
  try {
    const store = getSkillStore();
    const deleted = await store.delete(id);
    if (!deleted) return Response.json({ error: "Skill not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete skill";
    return Response.json({ error: message }, { status: 500 });
  }
}
