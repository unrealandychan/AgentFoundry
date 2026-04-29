/**
 * GET    /api/sandbox/sessions/[id]  — get one session
 * PATCH  /api/sandbox/sessions/[id]  — update / upsert a session
 * DELETE /api/sandbox/sessions/[id]  — delete a session
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SandboxSession } from "@/types";
import { getSandboxSessionStore } from "@/lib/sandbox-session-store";

type Params = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const store = getSandboxSessionStore();
    const session = await store.get(params.id);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(session);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const store = getSandboxSessionStore();
    const updated = await store.patch(params.id, body as Partial<SandboxSession>);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const store = getSandboxSessionStore();
    await store.delete(params.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
