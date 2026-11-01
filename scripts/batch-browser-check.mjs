import { spawn, spawnSync } from 'node:child_process';
import { readFile, appendFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const arg = (name, fallback) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const inputPath = resolve(root, 'test-results/oauth-apps-input.json');
const logPath = resolve(root, arg('log', 'test-results/launchpath-browser-check.jsonl'));
const apps = JSON.parse(await readFile(inputPath, 'utf8'));
const start = Number(arg('start', '0'));
const end = Number(arg('end', String(apps.length)));
const base = arg('base', 'http://127.0.0.1:3000').replace(/\/$/, '');
const timeoutMs = Number(arg('timeout-ms', '600000'));
const chromePath = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync);
if (!chromePath) throw new Error('Google Chrome executable was not found.');

await mkdir(resolve(root, 'test-results'), { recursive: true });
const existing = existsSync(logPath)
  ? (await readFile(logPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(x => JSON.parse(x)).filter(Boolean)
  : [];
const done = new Set(existing.map(x => `${x.provider}\n${x.website}`));
const userDir = join(tmpdir(), `launchpath-browser-${process.pid}`);
await rm(userDir, { recursive: true, force: true });
const child = spawn(chromePath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  `--user-data-dir=${userDir}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let socket;
let nextId = 1;
const pending = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function retry(fn, deadline, label) {
  let last;
  while (Date.now() < deadline) {
    try { return await fn(); } catch (e) { last = e; await sleep(300); }
  }
  throw new Error(`${label}: ${last?.message || 'timeout'}`);
}

try {
  const activePortFile = join(userDir, 'DevToolsActivePort');
  const bootstrapDeadline = Date.now() + 30000;
  await retry(async () => {
    if (!existsSync(activePortFile)) throw new Error('DevTools port not ready');
  }, bootstrapDeadline, 'Chrome startup');
  const cdpPort = Number((await readFile(activePortFile, 'utf8')).split(/\r?\n/)[0]);
  const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const target = targets.find(x => x.type === 'page');
  if (!target) throw new Error('Chrome did not expose a page target.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const p = pending.get(message.id);
    if (!p) return;
    pending.delete(message.id);
    if (message.error) p.reject(new Error(message.error.message));
    else p.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolveResult, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolveResult, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result?.value;
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');

  const subset = apps.slice(start, end);
  for (const [offset, app] of subset.entries()) {
    const index = start + offset + 1;
    const key = `${app.provider}\n${app.website}`;
    if (done.has(key)) {
      console.log(`[${index}/${apps.length}] SKIP already logged: ${app.provider}`);
      continue;
    }
    const record = {
      provider: app.provider, website: app.website, base, startedAt: new Date().toISOString(),
      status: 'running', guideUrl: null, runId: null, durationMs: null, events: [], error: null,
    };
    const began = Date.now();
    console.log(`[${index}/${apps.length}] ${app.provider} — ${app.website}`);
    try {
      await cdp('Page.navigate', { url: `${base}/` });
      await retry(async () => {
        const ready = await evaluate(`document.readyState === 'complete' && !!document.querySelector('#research-form')`);
        if (!ready) throw new Error('Research form not loaded');
      }, Date.now() + 30000, 'Open Launchpath');
      await evaluate(`(() => {
        const provider = document.querySelector('#provider');
        const website = document.querySelector('#website');
        const set = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set(provider, ${JSON.stringify(app.provider)});
        set(website, ${JSON.stringify(app.website)});
        document.querySelector('#submit').click();
        return { provider: provider.value, website: website.value };
      })()`);

      await retry(async () => {
        const state = await evaluate(`({ path: location.pathname, error: document.querySelector('#form-error')?.textContent?.trim() || '' })`);
        if (state.path.startsWith('/r/')) { record.runId = state.path.slice(3); return true; }
        if (state.error) throw new Error(`Form submission failed: ${state.error}`);
        throw new Error('Waiting for research run URL');
      }, Date.now() + 30000, 'Submit research form');

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const ui = await evaluate(`(() => ({
          path: location.pathname,
          title: document.querySelector('#guide-title')?.textContent?.trim() || '',
          meta: document.querySelector('#guide-meta')?.textContent?.trim() || '',
          status: document.querySelector('#run-status')?.textContent?.trim() || '',
          events: [...document.querySelectorAll('#events li')].map(x => x.innerText.trim()),
          actions: document.querySelector('#run-actions')?.innerText?.trim() || '',
          error: document.querySelector('#form-error')?.textContent?.trim() || ''
        }))()`);
        if(ui.events.length)record.events = ui.events;
        if (ui.path.startsWith('/g/')) {
          record.status = 'report_generated';
          record.guideUrl = `${base}${ui.path}`;
          record.title = ui.title;
          record.guideMeta = ui.meta;
          // Reconcile with persisted evidence; reaching /g/ is not proof that
          // the report contains a walkthrough. Preserve events after navigation.
          const guide=await(await fetch(`${base}/api/guides/${ui.path.slice(3)}`)).json();
          record.guideStatus=guide.status;
          record.steps=guide.content?.steps?.length||0;
          record.resultType=record.steps?'walkthrough':'evidence_only';
          if(record.runId){const savedRun=await(await fetch(`${base}/api/runs/${record.runId}`)).json();record.events=savedRun.events?.map(e=>`${e.stage}: ${e.message}`)||record.events;}
          break;
        }
        if (ui.status.includes('needs input')) {
          record.status = 'needs_input'; record.error = ui.status; break;
        }
        if (ui.status.includes('failed') || ui.status.includes('timed out') || ui.status.includes('interrupted') ||
            ui.actions.includes('Review inputs and retry') || ui.events.some(x => /^error\b/i.test(x))) {
          record.status = 'failed'; record.error = ui.status || ui.events.at(-1) || ui.actions; break;
        }
        if (ui.error) { record.status = 'failed'; record.error = ui.error; break; }
        await sleep(1200);
      }
      if (record.status === 'running') {
        record.status = 'observation_timeout';
        record.error = `No terminal UI result within ${timeoutMs} ms.`;
      }
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
    }
    record.finishedAt = new Date().toISOString();
    record.durationMs = Date.now() - began;
    await appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8');
    done.add(key);
    console.log(`  ${record.status}${record.guideUrl ? ` ${record.guideUrl}` : ''}${record.error ? ` — ${record.error}` : ''}`);
  }
} finally {
  try { socket?.close(); } catch {}
  if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else child.kill();
  await sleep(300);
  try { await rm(userDir, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }); } catch {}
}
