const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const path = require('node:path');
const { build } = require('esbuild');
const { NextRequest } = require('next/server');
const { v2: cloudinary } = require('cloudinary');

(async () => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalConfig = { ...cloudinary.config() };
  let limited = false;
  globalThis.__cloudinaryRuntimeFixture = {
    requireRole: (_roles, handler) => handler,
    withRateLimit: async () => ({ success: !limited }),
  };
  try {
    const bundled = await build({
      entryPoints: ['src/app/api/upload/signature/route.ts'], bundle: true, write: false,
      platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent',
      // Reproduce an image built with no public cloud name, then configured at runtime.
      define: { 'process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME': '""' },
      plugins: [{ name: 'isolated-upload-services', setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/(rbac|rate-limit)$/ }, () => ({ path: 'services', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const {requireRole,withRateLimit}=globalThis.__cloudinaryRuntimeFixture;', loader: 'js' }));
      } }],
    });
    function load(environment) {
      for (const key of keys) {
        if (environment[key] === undefined) delete process.env[key];
        else process.env[key] = environment[key];
      }
      const loaded = { exports: {} };
      new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), loaded, loaded.exports);
      return loaded.exports.POST;
    }
    const credentials = { CLOUDINARY_API_KEY: 'runtime-test-key', CLOUDINARY_API_SECRET: 'runtime-test-secret-not-a-real-credential' };
    const session = { role: 'INSTITUTION', userId: 7, institutionId: 7 };
    async function sign(handler, body, identity = session) {
      return handler(new NextRequest('http://institution.localhost/api/upload/signature', {
        method: 'POST', ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
      }), { session: identity });
    }
    for (const environment of [
      { ...credentials, CLOUDINARY_CLOUD_NAME: 'runtime-cloud' },
      { ...credentials, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'runtime-cloud' },
      { ...credentials, CLOUDINARY_CLOUD_NAME: ' runtime-cloud ', NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'old-cloud' },
    ]) {
      const handler = load(environment);
      const response = await sign(handler);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert.equal(body.cloudName, 'runtime-cloud');
      assert.equal(body.apiKey, credentials.CLOUDINARY_API_KEY);
      assert.equal(body.folder, 'lms-uploads/tenant-7/institution/user-7');
      const expectedSignature = createHash('sha1').update(`allowed_formats=${body.allowedFormats}&folder=${body.folder}&timestamp=${body.timestamp}${credentials.CLOUDINARY_API_SECRET}`).digest('hex');
      assert.equal(body.signature, expectedSignature);
      assert(!JSON.stringify(body).includes(credentials.CLOUDINARY_API_SECRET));
      assert.equal(cloudinary.config().cloud_name, body.cloudName, 'SDK and signing must use the same cloud');
      assert.equal(cloudinary.config().api_key, body.apiKey);
      assert.equal((await sign(handler, { folder: 'another-tenant' })).status, 400);
      limited = true;
      assert.equal((await sign(handler)).status, 429);
      limited = false;
      const other = await (await sign(handler, undefined, { role: 'INSTITUTION', userId: 8, institutionId: 8 })).json();
      assert.equal(other.folder, 'lms-uploads/tenant-8/institution/user-8');
    }
    console.log('PASS: runtime-only and legacy cloud names work after an empty public build; signatures, SDK config, ownership and rate limits remain correct.');
    for (const missing of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      const environment = { ...credentials, CLOUDINARY_CLOUD_NAME: 'runtime-cloud', [missing]: ' ' };
      const response = await sign(load(environment));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.json();
      assert(body.error.includes(missing));
      assert(!JSON.stringify(body).includes(credentials.CLOUDINARY_API_KEY));
      assert(!JSON.stringify(body).includes(credentials.CLOUDINARY_API_SECRET));
    }
    console.log('PASS: missing/blank settings identify the variable names without disclosing credentials. No Cloudinary requests or live data used.');
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
    cloudinary.config(originalConfig);
    delete globalThis.__cloudinaryRuntimeFixture;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
