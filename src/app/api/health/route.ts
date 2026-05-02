import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * Lightweight liveness probe for Docker Compose healthcheck and load balancers.
 * Returns 200 with a JSON body. No auth required.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
