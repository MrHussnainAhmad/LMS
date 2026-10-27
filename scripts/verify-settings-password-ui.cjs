const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');

(async () => {
  const browser = process.env.BROWSER_BIN || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  assert(fs.existsSync(browser), 'Set BROWSER_BIN to a Chromium browser.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-password-'));
  const component = path.resolve('src/app/(institution)/institution/settings/ChangePasswordForm.tsx');
  const bundle = await build({
    stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import {ChangePasswordForm} from ${JSON.stringify(component)};
      createRoot(document.getElementById('root')).render(<><ChangePasswordForm/><div id="readonly"><ChangePasswordForm readOnly/></div></>);`,
    resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'isolated-password-browser', setup(builder) {
      // Match Next's browser alias when bundling the shared ActionForm via Input.
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: require.resolve('next/dist/client/components/unstable-rethrow.browser') }));
      builder.onResolve({ filter: /^@\/lib\/api-client$/ }, () => ({ path: 'api', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export class ApiError extends Error{};export const api={post:async(url,body)=>{
        window.calls.push({url,body});await new Promise(resolve=>setTimeout(resolve,150));
        if(window.fail)throw Error('Invalid current password');return {role:'INSTITUTION'};
      }};` }));
      builder.onLoad({ filter: /ChangePasswordForm\.tsx$/ }, args => ({
        contents: fs.readFileSync(args.path, 'utf8').replace('window.location.replace("/institution-login")', 'window.passwordRedirect = "/institution-login"'), loader: 'tsx',
      }));
    } }],
  });
  const cssDirectory = '.next/static/css';
  const css = fs.existsSync(cssDirectory) ? fs.readdirSync(cssDirectory).filter(file => file.endsWith('.css')).map(file => fs.readFileSync(path.join(cssDirectory, file), 'utf8')).join('\n') : '';
  const checks = `window.calls=[];window.fail=true;const checks=[];
    const form=()=>document.querySelector('form');const field=name=>form().elements.namedItem(name);
    const check=(name,ok)=>checks.push({name,ok:Boolean(ok)});
    function fill(current,next,confirm){field('currentPassword').value=current;field('newPassword').value=next;field('confirmPassword').value=confirm}
    setTimeout(()=>{
      check('read-only campus disables password changes',document.querySelector('#readonly fieldset').disabled);
      check('labels and password autofill are configured',field('currentPassword').labels.length===1&&field('currentPassword').autocomplete==='current-password'&&field('newPassword').autocomplete==='new-password');
      form().requestSubmit();
      check('required fields block submission',calls.length===0);
      fill('CurrentPassword!123','NewPassword!456','DifferentPassword!789');form().requestSubmit();
    },500);
    setTimeout(()=>{
      check('confirmation mismatch is shown without a request',calls.length===0&&form().textContent.includes('do not match'));
      fill('CurrentPassword!123','short','short');form().requestSubmit();
    },800);
    setTimeout(()=>{
      check('short replacement is blocked',calls.length===0);
      fill('CurrentPassword!123','CurrentPassword!123','CurrentPassword!123');form().requestSubmit();
    },1100);
    setTimeout(()=>{
      check('unchanged password is blocked',calls.length===0&&form().textContent.includes('different'));
      fill('CurrentPassword!123','1234567890','1234567890');form().requestSubmit();
    },1400);
    setTimeout(()=>{
      check('default password is blocked',calls.length===0&&form().textContent.includes('default'));
      fill('WrongPassword!123','NewPassword!456','NewPassword!456');form().requestSubmit();form().requestSubmit();
    },1700);
    setTimeout(()=>{
      check('API errors are shown and form can be retried',calls.length===1&&form().textContent.includes('Invalid current password')&&!form().querySelector('fieldset').disabled&&field('newPassword').value==='NewPassword!456');
      window.fail=false;fill('CurrentPassword!123','NewPassword!456','NewPassword!456');form().requestSubmit();form().requestSubmit();
    },2100);
    setTimeout(()=>{
      check('successful change submits once and returns to institution login',calls.length===2&&passwordRedirect==='/institution-login');
      check('confirmation is excluded from API payload',calls[1].url==='/api/auth/change-password'&&Object.keys(calls[1].body).sort().join(',')==='currentPassword,newPassword');
      check('successful change clears password fields',field('currentPassword').value===''&&field('newPassword').value===''&&field('confirmPassword').value==='');
      const result=document.createElement('pre');result.id='checks';result.textContent=JSON.stringify(checks);document.body.appendChild(result);
    },2500);`;
  for (const width of [1280, 390]) {
    const file = path.join(directory, `password-${width}.html`);
    fs.writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}</style></head><body><main id="root"></main><script>${checks}</script><script>${bundle.outputFiles[0].text}</script></body></html>`);
    const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-sandbox', '--allow-file-access-from-files', `--user-data-dir=${path.join(directory, 'browser-' + width)}`, `--window-size=${width},900`, '--virtual-time-budget=4000', '--dump-dom', pathToFileURL(file).href], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 45000, windowsHide: true });
    const match = result.stdout?.match(/<pre id="checks">([^<]+)<\/pre>/);
    assert(match, `Missing browser results at ${width}px: ${result.error || result.stderr?.slice(-500)}`);
    const results = JSON.parse(match[1]);
    assert.equal(results.length, 11);
    assert.deepEqual(results.filter(check => !check.ok), []);
    console.log(`PASS: 11 password form checks at ${width}px (validation, API errors, retry, duplicate prevention, successful redirect and read-only campus).`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
