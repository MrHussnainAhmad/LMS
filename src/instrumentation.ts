/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Registers graceful shutdown so pg/redis/argon2 workers don't linger.
 */
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  // Route templates identify failures without recording URLs, credentials or SQL.
  const digest = error && typeof error === 'object' && 'digest' in error ? error.digest : undefined;
  console.error(JSON.stringify({ event: 'server_request_error', method: request.method, route: context.routePath,
    requestId: /^[a-f0-9-]{36}$/i.test(String(request.headers['x-request-id'] ?? '')) ? request.headers['x-request-id'] : undefined,
    digest: /^[a-z0-9_-]{1,80}$/i.test(String(digest ?? '')) ? digest : undefined }));
};

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateProductionEnvironment } = await import('./lib/production-env');
    validateProductionEnvironment();
    await (await import('./lib/database-role')).assertRuntimeDatabaseRole();
    const { registerShutdownHandlers } = await import('./lib/process-lifecycle');
    registerShutdownHandlers();
  }
}
