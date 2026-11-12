// Pruebas del servidor local: node --test server/test/server.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const { createServer } = createRequire(import.meta.url)('../atelierroot-server.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelierroot-test-'));
const work = path.join(tmp, 'notas'), app = path.join(tmp, 'app'), outside = path.join(tmp, 'fuera');
for (const d of [work, app, outside]) fs.mkdirSync(d, { recursive: true });
fs.writeFileSync(path.join(app, 'index.html'), '<!doctype html><html><head><title>t</title></head><body>hola</body></html>');
fs.writeFileSync(path.join(outside, 'secreto.md'), 'no debería leerse');
fs.writeFileSync(path.join(work, 'a.md'), '# A\n');
fs.mkdirSync(path.join(work, 'Carpeta')); fs.writeFileSync(path.join(work, 'Carpeta', 'b.md'), 'B');
fs.writeFileSync(path.join(work, 'notas.txt'), 'no md'); fs.mkdirSync(path.join(work, '.git')); fs.writeFileSync(path.join(work, '.git', 'x.md'), 'oculto');

const srv = createServer({ dir: work, app, port: 0 });
const port = await srv.listen();
const base = `http://127.0.0.1:${port}`, H = { 'X-AtelierRoot-Token': srv.token };
const call = (method, p, body, headers = H) => fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: body === undefined ? undefined : JSON.stringify(body) });
test.after(async () => { await srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

test('sin token no hay API; con token sí', async () => {
  assert.equal((await fetch(base + '/api/ping')).status, 401);
  assert.equal((await fetch(base + '/api/ping', { headers: { 'X-AtelierRoot-Token': 'mal' } })).status, 401);
  const r = await call('GET', '/api/ping'); assert.equal(r.status, 200); assert.equal((await r.json()).name, 'notas');
});
test('un Host que no es el propio se rechaza (DNS rebinding)', async () => {
  const status = await new Promise((res, rej) => { const q = http.request({ host: '127.0.0.1', port, path: '/api/ping', headers: Object.assign({ Host: 'evil.example.com' }, H) }, r => { r.resume(); res(r.statusCode); }); q.on('error', rej); q.end(); });
  assert.equal(status, 403);
});
test('la lista incluye solo .md y carpetas visibles (no .git, no .txt)', async () => {
  const { entries } = await (await call('GET', '/api/list')).json(); const ps = entries.map(e => e.p).sort();
  assert.deepEqual(ps, ['Carpeta', 'Carpeta/b.md', 'a.md']);
});
test('leer y escribir un .md, con mtime', async () => {
  const w = await (await call('PUT', '/api/file?p=nuevo.md', { text: '# Hola\n' })).json(); assert.ok(w.m > 0 && w.s === 7);
  const r = await (await call('GET', '/api/file?p=nuevo.md')).json(); assert.equal(r.text, '# Hola\n'); assert.equal(r.m, w.m);
  assert.deepEqual(fs.readdirSync(work).filter(n => n.startsWith('.atelierroot-tmp')), [], 'no deben quedar temporales');
});
test('escribir con expect: si el archivo cambió fuera, 409 y no se pisa', async () => {
  const w = await (await call('PUT', '/api/file?p=c.md', { text: 'uno' })).json();
  assert.equal((await call('PUT', `/api/file?p=c.md&expect=${w.m}`, { text: 'dos' })).status, 200);
  assert.equal((await call('PUT', `/api/file?p=c.md&expect=${w.m - 5000}`, { text: 'tres' })).status, 409);
  assert.equal(fs.readFileSync(path.join(work, 'c.md'), 'utf8'), 'dos');
});
test('rutas peligrosas y archivos no permitidos se rechazan', async () => {
  const bad = ['../fuera/secreto.md', '/etc/passwd', 'a\\b.md', 'C:/x.md', '.git/x.md', 'a/../../x.md', 'x.txt', 'x.js', '.hidden.md', '..%2Ffuera%2Fsecreto.md', '\u0000.md', 'a\u0000/../../x.md', ''];
  for (const p of bad) { const r = await call('PUT', '/api/file?p=' + encodeURIComponent(p).replace(/%2F/g, '/'), { text: 'x' }); assert.ok([400, 403].includes(r.status), `PUT ${p} → ${r.status}`); }
  for (const p of ['../fuera/secreto.md', '/etc/passwd', 'notas.txt', '.git/x.md']) { const r = await call('GET', '/api/file?p=' + p); assert.ok([400, 403, 404].includes(r.status), `GET ${p} → ${r.status}`); }
  assert.ok(!fs.existsSync(path.join(tmp, 'x.md')) && !fs.existsSync(path.join(work, 'x.txt')));
});
test('un enlace simbólico no puede sacar a escribir fuera de la carpeta', async t => {
  try { fs.symlinkSync(outside, path.join(work, 'enlace'), 'dir'); } catch { t.skip('este sistema no permite crear enlaces simbólicos'); return; }
  assert.equal((await call('PUT', '/api/file?p=enlace/nuevo.md', { text: 'x' })).status, 403);
  assert.equal((await call('GET', '/api/file?p=enlace/secreto.md')).status, 403);
  assert.ok(!fs.existsSync(path.join(outside, 'nuevo.md')));
});
test('leer en lote (POST /api/files): enlaces a fuera, token y límite de rutas', async t => {
  assert.equal((await call('POST', '/api/files', { paths: ['Carpeta/b.md'] }, {})).status, 401);
  assert.equal((await call('POST', '/api/files', { paths: Array(501).fill('Carpeta/b.md') })).status, 400);
  assert.equal((await call('POST', '/api/files', { paths: 'Carpeta/b.md' })).status, 400);
  let links = true;
  try { fs.symlinkSync(outside, path.join(work, 'enlace2'), 'dir'); fs.symlinkSync(path.join(outside, 'secreto.md'), path.join(work, 'atajo.md'), 'file'); } catch { links = false; }
  const { files } = await (await call('POST', '/api/files', { paths: ['Carpeta/b.md', 'enlace2/secreto.md', 'atajo.md', 'enlace2/secreto.md'] })).json();
  assert.deepEqual(files[0], { text: 'B', m: files[0].m, s: 1 });
  if (!links) { t.skip('este sistema no permite crear enlaces simbólicos'); return; }
  assert.deepEqual(files.slice(1).map(f => f.error), ['denied', 'denied', 'denied'], 'una carpeta o un archivo enlazados fuera no se leen');
});
test('mkdir, move (archivo y carpeta), destino ocupado y delete', async () => {
  assert.equal((await call('POST', '/api/mkdir?p=Nueva/Sub')).status, 200); assert.ok(fs.statSync(path.join(work, 'Nueva/Sub')).isDirectory());
  assert.equal((await call('POST', '/api/move', { from: 'a.md', to: 'Nueva/a.md' })).status, 200); assert.ok(fs.existsSync(path.join(work, 'Nueva/a.md')));
  assert.equal((await call('POST', '/api/move', { from: 'Nueva', to: 'Renombrada' })).status, 200); assert.ok(fs.existsSync(path.join(work, 'Renombrada/a.md')));
  assert.equal((await call('POST', '/api/move', { from: 'Renombrada/a.md', to: 'Carpeta/b.md' })).status, 409);
  assert.equal((await call('POST', '/api/move', { from: 'Renombrada/a.md', to: '../a.md' })).status, 400);
  assert.equal((await call('POST', '/api/move', { from: 'noexiste.md', to: 'z.md' })).status, 404);
  assert.equal((await call('DELETE', '/api/file?p=Renombrada/a.md')).status, 200); assert.ok(!fs.existsSync(path.join(work, 'Renombrada/a.md')));
  assert.equal((await call('DELETE', '/api/file?p=Renombrada&recursive=1')).status, 403, 'una carpeta normal no se borra por /file: se mueve a la papelera');
});
test('.atelierroot/ se puede escribir y listar solo con hidden=1', async () => {
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/state.json', { text: '{"v":1}' })).status, 200);
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/.gitignore', { text: 'trash/\n' })).status, 200);
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/trash/t1/doc.md', { text: 'x' })).status, 200);
  assert.equal((await (await call('GET', '/api/file?p=.atelierroot/state.json')).json()).text, '{"v":1}');
  assert.ok(!(await (await call('GET', '/api/list')).json()).entries.some(e => e.p.startsWith('.atelierroot')));
  assert.ok((await (await call('GET', '/api/list?hidden=1')).json()).entries.some(e => e.p === '.atelierroot/trash/t1/doc.md'));
  assert.equal((await call('DELETE', '/api/file?p=.atelierroot/trash/t1&recursive=1')).status, 200);
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/../a.md', { text: 'x' })).status, 400);
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/.secreto', { text: 'x' })).status, 403);
});
test('la página se sirve con el token inyectado y no se sirve el servidor ni se sale de la app', async () => {
  const html = await (await fetch(base + '/')).text(); assert.ok(html.includes(`name="atelierroot-token" content="${srv.token}"`));
  assert.equal((await fetch(base + '/server/atelierroot-server.js')).status, 404);
  assert.equal((await fetch(base + '/..%2Fnotas%2Fa.md')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e/%2e%2e/etc/passwd')).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});
test('every response carries a Content-Security-Policy that blocks network, plugins and framing', async () => {
  for (const r of [await fetch(base + '/'), await call('GET', '/api/ping')]) {
    const csp = r.headers.get('content-security-policy') || '';
    for (const d of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(csp.includes(d), `missing ${d} in "${csp}"`);
  }
});
test('avisa por eventos cuando algo cambia fuera de AtelierRoot', async () => {
  const ac = new AbortController(), r = await fetch(`${base}/api/events?token=${srv.token}`, { signal: ac.signal });
  const reader = r.body.getReader(), dec = new TextDecoder(); let got = '';
  setTimeout(() => fs.writeFileSync(path.join(work, 'externo.md'), 'cambio ' + Date.now()), 1700);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !got.includes('data: change')) { const { value } = await reader.read(); if (value) got += dec.decode(value); }
  ac.abort(); assert.ok(got.includes('data: change'), 'debía llegar un evento: ' + JSON.stringify(got));
});
test('desde la papelera vuelven imágenes y similares, pero nunca scripts ni ejecutables', async () => {
  for (const f of ['foto.png', 'doc.pdf', 'datos.csv']) {
    assert.equal((await call('PUT', `/api/file?p=.atelierroot/trash/r1/${f}`, { text: 'x' })).status, 200);
    assert.equal((await call('POST', '/api/move', { from: `.atelierroot/trash/r1/${f}`, to: f })).status, 200, f); assert.ok(fs.existsSync(path.join(work, f)));
  }
  for (const f of ['evil.js', 'evil.html', 'evil.sh', 'evil.exe', 'evil.bat', '.bashrc']) {
    assert.equal((await call('PUT', `/api/file?p=.atelierroot/trash/r1/${f.replace(/^\./, '')}`, { text: 'x' })).status, 200);
    assert.equal((await call('POST', '/api/move', { from: `.atelierroot/trash/r1/${f.replace(/^\./, '')}`, to: f })).status, 403, f); assert.ok(!fs.existsSync(path.join(work, f)));
  }
  assert.equal((await call('PUT', '/api/file?p=.atelierroot/trash/r1/dentro.png', { text: 'x' })).status, 200);
  assert.equal((await call('POST', '/api/move', { from: '.atelierroot/trash/r1/dentro.png', to: '.atelierroot/otra.png' })).status, 200, 'dentro de .atelierroot todo se mueve');
  assert.equal((await call('POST', '/api/move', { from: 'foto.png', to: 'foto2.png' })).status, 403, 'fuera de la papelera, solo .md');
});
