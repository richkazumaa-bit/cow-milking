// Usage:
//   node render.mjs stills 0.5,3,7.2 out_dir      -> PNG stills
//   node render.mjs video out.mp4 [fps] [from] [to] -> frames piped to ffmpeg (no audio)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  const p = path.join(ROOT, urlPath);
  console.log('[server]', req.url, '->', p);
  if (!p.startsWith(ROOT)) { console.log('[server] 403:', req.url); res.writeHead(403); res.end(); return; }
  fs.readFile(p, (e, d) => {
    if (e) { console.log('[server] 404:', req.url, e.code); res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(0);
const port = server.address().port;

// GL=swiftshader forces software WebGL (slow, but works on machines without a usable GPU)
const GL = process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu'];
const browser = await chromium.launch({ args: [...GL, '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });

// A page error before window.ready means a module failed to load: fail immediately instead of waiting out the timeout.
let rejectOnPageError;
const pageErrorPromise = new Promise((_, reject) => { rejectOnPageError = reject; });
pageErrorPromise.catch(() => {}); // avoid unhandled-rejection noise if it fires after the race is over

page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => { console.log('[pageerror]', e.message); rejectOnPageError(new Error('pageerror: ' + e.message)); });
page.on('requestfailed', r => console.log('[requestfailed]', r.url(), r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) console.log('[http', r.status() + ']', r.url()); });

await page.goto(`http://localhost:${port}/index.html?render=1`);

// Wait for ready, with a long timeout (software WebGL + big module graph is slow on CI) and a debug fallback
const READY_TIMEOUT_MS = 180000;
try {
  await Promise.race([
    page.waitForFunction(() => window.renderAt && window.ready, null, { timeout: READY_TIMEOUT_MS }),
    pageErrorPromise,
  ]);
} catch (err) {
  const state = await page.evaluate(() => ({
    hasRenderAt: typeof window.renderAt,
    ready: String(window.ready),
    scripts: [...document.scripts].map(s => s.src || 'inline'),
  })).catch(e => ({ evaluateFailed: String(e) }));
  console.error('[debug] page state:', JSON.stringify(state, null, 2));
  await browser.close();
  server.close();
  throw err;
}

await page.evaluate(() => window.ready);
const shot = () => page.screenshot({ clip: { x: 0, y: 0, width: 720, height: 1280 }, type: 'png' });

const [mode, a, b, c, d] = process.argv.slice(2);
if (mode === 'stills') {
  fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) {
    const t0 = Date.now();
    await page.evaluate(t => window.renderAt(t), t);
    fs.writeFileSync(path.join(b, `t_${t.toFixed(2)}.png`), await shot());
    console.log('still', t, Date.now() - t0, 'ms');
  }
} else {
  const fps = Number(b || 30), dur = await page.evaluate(() => window.DURATION);
  const from = Number(c || 0), to = Math.min(Number(d || dur), dur);
  const n0 = Math.round(from * fps), n1 = Math.floor(to * fps);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', a], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code)));
  });
  ffDone.catch(() => {}); // surfaced below when awaited
  const T0 = Date.now();
  for (let n = n0; n < n1; n++) {
    await page.evaluate(t => window.renderAt(t), n / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (n % 30 === 0) console.log(`frame ${n}/${n1} ${((Date.now() - T0) / (n - n0 + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end();
  await ffDone;
  console.log('done:', a, `(${((Date.now() - T0) / 1000).toFixed(0)}s)`);
}
await browser.close();
server.close();
