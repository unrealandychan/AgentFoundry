/**
 * GET  /api/sandbox/sessions       — list all sessions
 * POST /api/sandbox/sessions       — create a session
 *
 * Sessions are stored under the same adapter as SkillStore
 * (local disk / S3 / MongoDB) so they survive browser clears.
 *
 * Storage layout (file adapter):
 *   sandbox-sessions/<id>.json  — one file per session
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SandboxSession } from "@/types";
import { getSandboxSessionStore } from "@/lib/sandbox-session-store";

export async function GET() {
  try {
    const store = getSandboxSessionStore();
    const sessions = await store.list();
    return NextResponse.json(sessions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const session = body as SandboxSession;
  if (!session?.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const store = getSandboxSessionStore();
    const created = await store.upsert(session);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
