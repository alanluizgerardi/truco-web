import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { SCORE_STEPS, HISTORY_STEPS, scoreSteps, historySteps } from '../tutorial.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('all HTML scripts, styles, icons and manifest are local and exist', async () => {
  const html = await file('index.html');
  const links = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]);
  assert.ok(links.length >= 5);
  for (const link of links) {
    assert.ok(link.startsWith('./'), `Must be a relative project path: ${link}`);
    await access(new URL(`../${link}`, import.meta.url));
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
  assert.match(html, /viewport-fit=cover/);
  assert.doesNotMatch(html, /maximum-scale|user-scalable=no/);
});

test('manifest and offline cache use valid files and project-relative scope', async () => {
  const manifest = JSON.parse(await file('manifest.webmanifest'));
  assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) await access(new URL(`../${icon.src}`, import.meta.url));
  const worker = await file('sw.js');
  const array = worker.match(/const FILES = \[([\s\S]*?)\];/)[1];
  for (const match of array.matchAll(/'([^']+)'/g)) {
    if (match[1] !== './') await access(new URL(`../${match[1]}`, import.meta.url));
  }
  const png = await readFile(new URL('../apple-touch-icon.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 180); assert.equal(png.readUInt32BE(20), 180);
});

test('tutorial targets exist and finished matches highlight confirmation', async () => {
  const html = await file('index.html'), app = await file('app.js');
  for (const step of [...SCORE_STEPS, ...HISTORY_STEPS, ...scoreSteps(false, 1), ...historySteps(1)]) {
    assert.ok(html.includes(`id="${step.target}"`) || app.includes(`'${step.target}'`), step.target);
    assert.ok(step.title.length > 0 && step.message.length > 0);
  }
  assert.ok(scoreSteps(true).some(step => step.target === 'confirm-button'));
  assert.ok(!scoreSteps(true).some(step => step.target === 'hand-selector'));
  assert.equal(scoreSteps(false), SCORE_STEPS);
  assert.match(SCORE_STEPS.find(step => step.target === 'round-table').message, /N indica Nós e E indica Eles/);
});

test('HTTP server serves modules and assets at root and project Pages subpath', async t => {
  const server = spawn(process.execPath, ['tools/serve.mjs'], {
    cwd: root, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { server.kill(); });
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.stdout.on('data', chunk => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) { clearTimeout(timeout); resolve(match[0]); }
    });
  });
  for (const prefix of ['', 'truco-web/']) {
    const response = await fetch(url + prefix);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Truco · Marcador avulso/);
    for (const name of ['app.js', 'engine.js', 'styles.css', 'sw.js', 'apple-touch-icon.png', 'assets/toast_mascot.png']) {
      const asset = await fetch(url + prefix + name); assert.equal(asset.status, 200, name);
      if (name.endsWith('.js')) assert.match(asset.headers.get('content-type'), /text\/javascript/);
    }
  }
  assert.equal((await fetch(url + 'missing-file.js')).status, 404);
});
