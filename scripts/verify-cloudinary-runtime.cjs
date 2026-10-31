const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { build } = require('esbuild');
const { v2: cloudinary } = require('cloudinary');
(async () => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalConfig = { ...cloudinary.config() };
  try {
    const bundled = await build({ entryPoints: ['src/lib/cloudinary.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', logLevel: 'silent', define: { 'process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME': '""' } });
    const credentials = { CLOUDINARY_API_KEY: 'fixture-key', CLOUDINARY_API_SECRET: 'fixture-secret' };
    for (const environment of [
      { ...credentials, CLOUDINARY_CLOUD_NAME: 'runtime-cloud' },
      { ...credentials, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'runtime-cloud' },
      { ...credentials, CLOUDINARY_CLOUD_NAME: ' runtime-cloud ', NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'old-cloud' },
    ]) {
      for (const key of keys) { if (environment[key] === undefined) delete process.env[key]; else process.env[key] = environment[key]; }
      const moduleValue = { exports: {} };
      new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(createRequire(path.resolve('package.json')), moduleValue, moduleValue.exports);
      assert.equal(cloudinary.config().cloud_name, 'runtime-cloud');
      assert.equal(cloudinary.config().api_key, credentials.CLOUDINARY_API_KEY);
      assert.equal(cloudinary.config().api_secret, credentials.CLOUDINARY_API_SECRET);
    }
    console.log('PASS: server and legacy cloud names configure the SDK at runtime after an empty public build. No provider calls made.');
  } finally {
    for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; }
    cloudinary.config(originalConfig);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
