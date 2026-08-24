/**
 * Liveness probe. Hit by Caddy (every 10s per upstream) and by both containers'
 * Docker healthchecks, so it runs ~24x/min in steady state and must stay cheap.
 *
 * `no-store` matters here: without it a CDN or intermediary is free to cache
 * "ok" and keep reporting a dead replica as healthy.
 *
 * The `timestamp` field is kept — nothing parses it, but it is the only way to
 * tell a live probe from a cached one when debugging, and one Date allocation
 * per probe is not a measurable cost.
 */
export async function GET() {
  return new Response(`{"status":"ok","timestamp":"${new Date().toISOString()}"}`, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
