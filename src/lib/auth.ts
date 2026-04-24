/**
 * Lightweight API key auth for skill mutation endpoints.
 * If AGENT_FOUNDRY_API_KEY env var is not set, auth is disabled (allow all) for easy local dev.
 */
export function checkApiKey(request: Request): { authorized: boolean; reason?: string } {
  const apiKey = process.env.AGENT_FOUNDRY_API_KEY;

  // Auth disabled in local dev if no key configured
  if (!apiKey) return { authorized: true };

  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  const provided = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : apiKeyHeader ?? null;

  if (!provided) {
    return { authorized: false, reason: 'Missing Authorization header or X-API-Key' };
  }

  if (provided !== apiKey) {
    return { authorized: false, reason: 'Invalid API key' };
  }

  return { authorized: true };
}
