import { unsafeOrigin } from './request-security';
import type { NextRequest } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { applyCorsHeaders } from './cors';
import { stripSessionHeaders } from './session-header';
import { ARCHIVED_ADMISSION_MESSAGE, isArchivedAdmissionError } from './admission-archive-error';
import { inputErrorResponse } from './input-error-response';
import type { NativeJsonResponse } from './native-json-response';

/** Keep API transport policy in guarded routes so hot endpoints can skip Proxy. */
export function withApiPolicy<TContext, TResult extends Response | NativeJsonResponse = Response>(handler: (req: NextRequest, context: TContext) => Promise<TResult>) {
  return async (req: NextRequest, context: TContext = {} as TContext) => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    req.headers.set('x-request-id', requestId);
    if (unsafeOrigin(req)) return Response.json({ error: 'Forbidden origin', code: 'FORBIDDEN' }, { status: 403, headers: { 'X-Request-ID': requestId } });
    stripSessionHeaders(req.headers);
    try {
      const response = applyCorsHeaders(req, await handler(req, context));
      response.headers.set('X-Request-ID', requestId);
      if (response.status >= 500) console.error(JSON.stringify({ event: 'api_unavailable', requestId, method: req.method, route: req.nextUrl.pathname.split('/').slice(0, 4).join('/'), status: response.status, durationMs: Math.round(performance.now() - started) }));
      return response;
    } catch (error) {
      unstable_rethrow(error);
      const inputError = inputErrorResponse(error);
      if (inputError) return applyCorsHeaders(req, Response.json(inputError.body, { status: inputError.status, headers: { 'X-Request-ID': requestId } }));
      if (isArchivedAdmissionError(error)) return applyCorsHeaders(req, Response.json({ error: ARCHIVED_ADMISSION_MESSAGE, code: 'ADMISSION_ARCHIVED' }, { status: 409, headers: { 'X-Request-ID': requestId } }));
      console.error(JSON.stringify({ event: 'api_error', requestId, method: req.method, route: req.nextUrl.pathname.split('/').slice(0, 4).join('/'), durationMs: Math.round(performance.now() - started) }));
      return applyCorsHeaders(req, Response.json({ error: 'The service is temporarily unavailable. Please try again.', code: 'INTERNAL_ERROR', requestId }, { status: 500, headers: { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' } })) as TResult;
    }
  };
}
