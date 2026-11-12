// Shared backend contract against the Node server (the desktop app runs the same file in
// src-tauri/src/contract_tests.rs). Scenarios: tests/contract/scenarios.json.  node --test server/test/contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { createServer } = createRequire(import.meta.url)('../atelieroot-server.js');
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const spec = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'tests', 'contract', 'scenarios.json'), 'utf8'));

// HTTP status -> contract code (400 invalid path and 403 not allowed are both "denied": the request is refused)
const codeOf = async r => {
  if (r.status === 400 || r.status === 401 || r.status === 403) return 'denied';
  if (r.status === 404) return 'missing';
  if (r.status === 409) return /destino/.test((await r.json().catch(() => ({}))).error || '') ? 'exists' : 'conflict';
  return 'io:' + r.status;
};

function makeFixture(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atelieroot-contract-')), root = path.join(tmp, 'notas');
  for (const [rel, text] of Object.entries(spec.fixture)){ const f = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); }
  return { tmp, root };
}

for (const c of spec.cases){
  test(c.name, async () => {
    const { tmp, root } = makeFixture();
    const srv = createServer({ dir: root, port: 0 }), port = await srv.listen();
    const H = { 'X-AtelieRoot-Token': srv.token, 'Content-Type': 'application/json' };
    const api = (method, p, body) => fetch(`http://127.0.0.1:${port}/api/${p}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
    const enc = encodeURIComponent;
    try {
      for (const [i, s] of c.steps.entries()){
        const where = `${c.name} / step ${i + 1} (${s.op} ${s.path || s.from || ''})`;
        let r, got;
        if (s.op === 'list'){ r = await api('GET', 'list' + (s.hidden ? '?hidden=1' : '')); }
        else if (s.op === 'read'){ r = await api('GET', `file?p=${enc(s.path)}` + (s.optional ? '&optional=1' : '')); }
        else if (s.op === 'write'){
          let q = '';
          if (s.expect_mtime === 'current'){ const cur = await (await api('GET', `file?p=${enc(s.path)}`)).json(); q = '&expect=' + cur.m; }
          if (s.expect_mtime === 'stale') q = '&expect=1';
          r = await api('PUT', `file?p=${enc(s.path)}${q}`, { text: s.text });
        }
        else if (s.op === 'read_many'){ r = await api('POST', 'files', { paths: s.paths }); }
        else if (s.op === 'mkdir'){ r = await api('POST', `mkdir?p=${enc(s.path)}`); }
        else if (s.op === 'move'){ r = await api('POST', 'move', { from: s.from, to: s.to }); }
        else if (s.op === 'delete'){ r = await api('DELETE', `file?p=${enc(s.path)}` + (s.recursive ? '&recursive=1' : '')); }
        else throw new Error('unknown op ' + s.op);
        if (!r.ok){ got = await codeOf(r); }
        else {
          const j = await r.json();
          if (s.op === 'list') got = { entries: j.entries.map(e => e.t + ':' + e.p).sort() };
          else if (s.op === 'read') got = j.missing ? { absent: true } : { text: j.text };
          else if (s.op === 'read_many') got = { files: j.files.map(f => f.error ? { error: f.error } : { text: f.text }) };
          else got = 'ok';
        }
        assert.deepEqual(got, s.expect, where);
      }
    } finally { await srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}
