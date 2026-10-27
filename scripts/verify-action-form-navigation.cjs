const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');
const { getRedirectError } = require('next/dist/client/components/redirect');

(async () => {
  const browser = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  assert(fs.existsSync(browser), 'Set BROWSER_BIN to a Chromium browser.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'action-form-navigation-'));
  const redirectError = getRedirectError('/sa/institutions', 'push', 303);
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
    import {ActionForm} from './src/components/ui/action-form';
    import {SubmitButton} from './src/components/ui/submit-button';
    import {Input} from './src/components/ui/input';
    const action=async()=>{
      window.calls++;
      if(window.mode==='approve'){window.status='APPROVED';throw Object.assign(new Error('NEXT_REDIRECT'),{digest:${JSON.stringify(redirectError.digest)}})}
      if(window.mode==='validation')return {ok:false,error:'Institution name is required.',fieldErrors:{name:['Institution name is required.']}};
      if(window.mode==='notFound')throw Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'),{digest:'NEXT_HTTP_ERROR_FALLBACK;404'});
      return {ok:true,data:{saved:true}};
    };
    createRoot(document.getElementById('root')).render(<ActionForm action={action} onFailure={()=>window.failures++}>
      <label>Name<Input name="name" defaultValue="Example School" required/></label>
      <SubmitButton loadingText="Approving...">Approve</SubmitButton></ActionForm>);`;
  const bundled = await build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'browser-navigation-fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: require.resolve('next/dist/client/components/unstable-rethrow.browser') }));
      builder.onResolve({ filter: /^@\/components\/ui\/toaster$|^\.\/toaster$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const toast=value=>window.messages.push(value);', loader: 'js' }));
    } }],
  });
  const checks = `window.calls=0;window.messages=[];window.failures=0;window.mode='approve';window.navigation=[];const checks=[];
    // Stand in for Next's router boundary: verify the original signal reaches it.
    addEventListener('error',event=>{if(event.error?.digest){navigation.push(event.error.digest);event.preventDefault()}});
    addEventListener('unhandledrejection',event=>{if(event.reason?.digest){navigation.push(event.reason.digest);event.preventDefault()}});
    const form=()=>document.querySelector('form');const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
    setTimeout(()=>form().requestSubmit(),500);
    setTimeout(()=>{
      check('institution approval completes once',calls===1&&window.status==='APPROVED');
      check('approval redirect reaches router boundary',navigation.length===1&&navigation[0]===${JSON.stringify(redirectError.digest)});
      check('redirect produces no submission error or failure callback',messages.length===0&&failures===0&&!document.querySelector('[role=alert]'));
      check('pending state clears after redirect signal',!document.querySelector('button[type=submit]').disabled&&form().getAttribute('aria-busy')==='false');
      mode='validation';form().requestSubmit();
    },1000);
    setTimeout(()=>{
      check('real validation errors still show a toast and field errors',messages.length===1&&failures===1&&form().textContent.includes('Institution name is required.')&&form().elements.name.getAttribute('aria-invalid')==='true');
      check('failed submissions retain entered values',form().elements.name.value==='Example School');
      mode='notFound';form().requestSubmit();
    },1500);
    setTimeout(()=>{
      check('not-found signal also reaches router boundary',navigation.length===2&&navigation[1]==='NEXT_HTTP_ERROR_FALLBACK;404');
      check('not-found produces no extra submission error',messages.length===1&&failures===1&&!document.querySelector('[role=alert]'));
      mode='success';form().elements.name.value='Changed School';form().requestSubmit();
    },2000);
    setTimeout(()=>{
      check('ordinary successful submissions still reset form',calls===4&&form().elements.name.value==='Example School'&&!document.querySelector('button[type=submit]').disabled);
      const pre=document.createElement('pre');pre.id='checks';pre.textContent=JSON.stringify(checks);document.body.appendChild(pre);
    },2500);`;
  const file = path.join(directory, 'navigation.html');
  fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"></head><body><main id="root"></main><script>${checks}</script><script>${bundled.outputFiles[0].text}</script></body></html>`);
  const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-sandbox', '--allow-file-access-from-files', `--user-data-dir=${path.join(directory, 'browser')}`, '--virtual-time-budget=4000', '--dump-dom', pathToFileURL(file).href], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 45000, windowsHide: true });
  const match = result.stdout?.match(/<pre id="checks">([^<]+)<\/pre>/);
  assert(match, `Missing browser results: ${result.error || result.stderr?.slice(-500)}`);
  const results = JSON.parse(match[1]);
  assert.equal(results.length, 9);
  assert.deepEqual(results.filter(check => !check.ok), []);
  console.log('PASS: 9 browser checks for approval redirects, not-found signals, real validation errors, pending state and successful form reset.');
})().catch(error => { console.error(error); process.exitCode = 1; });
