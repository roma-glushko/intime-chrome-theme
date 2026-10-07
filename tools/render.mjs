#!/usr/bin/env node
/*
 * Dependency-free "page -> PNG": launches headless Chrome, drives it over the DevTools protocol and
 * saves a screenshot at an exact pixel size (Chrome's own --screenshot flag can't do tiny or odd sizes).
 *
 *   node tools/render.mjs <url> <out.png> [--width 1920] [--height 1080] [--scale 1] [--wait 600]
 *                         [--eval "js run after load"] [--frames 1] [--every 100] [--transparent]
 *                         [--clip x,y,w,h,scale]
 *
 * With --frames N the output name gets a -0, -1, ... suffix. Set CHROME to use another binary and
 * TMPDIR to choose where the throwaway profile lives. Page console output is echoed to stderr.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USAGE = 'usage: node tools/render.mjs <url> <out.png> [--width N] [--height N] [--scale N] [--wait ms] [--eval js] [--frames N] [--every ms] [--transparent] [--clip x,y,w,h,scale]';

function parseArgs(argv) {
  const opts = { width: 1920, height: 1080, scale: 1, wait: 600, frames: 1, every: 100, transparent: false, eval: '', clip: '' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--transparent') opts.transparent = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      opts[key] = typeof opts[key] === 'number' ? Number(argv[++i]) : argv[++i];
    } else positional.push(arg);
  }
  [opts.url, opts.out] = positional;
  return opts;
}

async function launch(profile) {
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--force-device-scale-factor=1', '--disable-extensions', '--allow-file-access-from-files',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 100; i++) {
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
      if (port) return { chrome, port: Number(port) };
    } catch { /* not written yet */ }
    await sleep(100);
  }
  chrome.kill();
  throw new Error('Chrome did not expose a DevTools port');
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
        else resolve(msg.result);
      } else {
        for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) {
    this.listeners.set(method, [...(this.listeners.get(method) ?? []), fn]);
  }
  once(method) {
    return new Promise((resolve) => {
      const fn = (params) => {
        this.listeners.set(method, this.listeners.get(method).filter((f) => f !== fn));
        resolve(params);
      };
      this.on(method, fn);
    });
  }
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.url || !opts.out) {
  console.error(USAGE);
  process.exit(2);
}

const profile = await mkdtemp(join(tmpdir(), 'intime-render-'));
const { chrome, port } = await launch(profile);
try {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const cdp = new CDP(ws);

  cdp.on('Runtime.consoleAPICalled', (e) => console.error('[page]', e.type, e.args.map((a) => a.value ?? a.description).join(' ')));
  cdp.on('Runtime.exceptionThrown', (e) => console.error('[page error]', e.exceptionDetails.exception?.description ?? e.exceptionDetails.text));
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: opts.width, height: opts.height, deviceScaleFactor: opts.scale, mobile: false });
  if (opts.transparent) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });

  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: opts.url });
  await loaded;
  if (opts.eval) {
    const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: opts.eval, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) console.error('[eval error]', exceptionDetails.exception?.description ?? exceptionDetails.text);
    else if (result.value !== undefined) console.log('[eval]', JSON.stringify(result.value));
  }
  await sleep(opts.wait);

  const [cx, cy, cw, ch, cs = 1] = opts.clip ? opts.clip.split(',').map(Number) : [];
  const clip = opts.clip ? { x: cx, y: cy, width: cw, height: ch, scale: cs } : undefined;
  for (let i = 0; i < opts.frames; i++) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, clip });
    const file = opts.frames > 1 ? opts.out.replace(/(\.png)?$/, `-${i}.png`) : opts.out;
    await writeFile(file, Buffer.from(data, 'base64'));
    console.log(`wrote ${file}`);
    if (i < opts.frames - 1) await sleep(opts.every);
  }
  ws.close();
} finally {
  chrome.kill();
  await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(3000)]);
  // Chrome may still be flushing files as it exits; retry, and never fail a finished render over temp-dir cleanup.
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
