#!/usr/bin/env node
'use strict';
/**
 * Servidor local de AtelieRoot (sin dependencias).
 *
 *   node server/atelieroot-server.js --dir ./notas [--port 4321] [--app ./dist] [--open]
 *
 * Sirve la aplicación y expone una API mínima para leer y escribir los .md de UNA carpeta.
 * Seguridad (solo escucha en la propia máquina):
 *   - escucha únicamente en 127.0.0.1;
 *   - cada arranque genera un token que solo recibe la página que sirve este servidor (cabecera X-AtelieRoot-Token);
 *   - se rechazan peticiones cuyo Host no sea el propio servidor (defensa contra «DNS rebinding»);
 *   - toda ruta se confina a la carpeta de trabajo (nada de «..», rutas absolutas ni enlaces simbólicos hacia fuera);
 *   - solo se escriben archivos .md/.markdown y lo que haya dentro de .atelieroot/.
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const VERSION = '2.0.0';
const MAX_BODY = 25 * 1024 * 1024;           // 25 MB por escritura
const MAX_MANY = 500;                        // rutas por POST /api/files
const MAX_ENTRIES = 50000;
const RESTORE_EXT = /\.(?:png|jpe?g|gif|webp|bmp|ico|svg|pdf|txt|csv|tsv|json|ya?ml|toml|ini|log|docx?|xlsx?|pptx?|odt|ods|odp|zip|mp3|mp4|wav|webm)$/i;   // lo único que no es .md y puede volver de la papelera
// The page may only talk to this server; remote images in a document stay allowed (http/https), scripts never.
// 'unsafe-inline' is needed because the build inlines all scripts and the editor sets inline styles; escaping (esc/urlAllowed) is the XSS barrier.
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const POLL_MS = 1200;                       // cada cuánto se mira si algo cambió fuera (para avisar a la página)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

function parseArgs(argv) {
  const o = { dir: './notas', port: 4321, app: null, open: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--dir') o.dir = next();
    else if (a === '--port') o.port = parseInt(next(), 10);
    else if (a === '--app') o.app = next();
    else if (a === '--open') o.open = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  return o;
}

function findAppDir(explicit) {
  const here = __dirname;
  const cands = explicit ? [explicit] : [path.join(here, '..', 'app'), path.join(here, '..', 'dist'), path.join(here, '..', 'src'), path.join(here, '..')];
  for (const c of cands) if (fs.existsSync(path.join(c, 'index.html'))) return path.resolve(c);
  throw new Error('No encuentro index.html de la aplicación. Usa --app <carpeta>.');
}

/** Crea el servidor. Devuelve { server, token, root, listen(), close() }. */
// v2.0 renamed the hidden folder: a folder used by v1 has .atelierroot/ (state, trash); it becomes .atelieroot/
function migrateHidden(root) {
  const from = path.join(root, '.atelierroot'), to = path.join(root, '.atelieroot');
  try { if (fs.statSync(from).isDirectory() && !fs.existsSync(to)) fs.renameSync(from, to); } catch (_) {}
}

function createServer(opts) {
  // native, like fsp.realpath below: the JS version keeps 8.3 short names (C:\Users\RUNNER~1) and every path would look "outside"
  const root = fs.realpathSync.native(path.resolve(opts.dir));
  migrateHidden(root);
  const appDir = findAppDir(opts.app);
  const token = crypto.randomBytes(24).toString('hex');
  const sseClients = new Set();
  let lastSig = null, pollTimer = null, port = opts.port;

  const send = (res, code, body, headers = {}) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    res.writeHead(code, Object.assign({ 'Content-Length': buf.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP }, headers));
    res.end(buf);
  };
  const json = (res, code, obj) => send(res, code, obj, { 'Content-Type': 'application/json; charset=utf-8' });
  const fail = (res, code, msg) => json(res, code, { error: msg });

  /** Ruta relativa con «/» → partes, o null si es peligrosa. */
  const safeRel = rel => {
    if (typeof rel !== 'string' || !rel || rel.includes('\0') || rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return null;
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length || parts.some(p => p === '..' || p === '.')) return null;
    if (parts.some(p => p.length > 255 || p.includes(':'))) return null;   // «a:b» would be a hidden NTFS stream on Windows (same rule as fsops.rs)
    return parts;
  };
  const absOf = parts => path.join(root, ...parts);
  const insideRoot = abs => abs === root || abs.startsWith(root + path.sep);
  /** Comprueba que lo que YA existe de la ruta no se escapa de la carpeta por un enlace simbólico. */
  const realInside = async abs => {
    let cur = abs;
    for (;;) {
      try { const r = await fsp.realpath(cur); return insideRoot(r); }
      catch (e) { if (e.code !== 'ENOENT') return false; const up = path.dirname(cur); if (up === cur) return false; cur = up; }
    }
  };
  const metaDotOk = p => !p.startsWith('.') || p === '.keep' || p === '.gitignore';
  const writable = parts => {
    if (parts[0] === '.atelieroot') return parts.length > 1 && parts.slice(1).every(metaDotOk);
    if (parts.some(p => p.startsWith('.'))) return false;
    const last = parts[parts.length - 1].toLowerCase();
    return last.endsWith('.md') || last.endsWith('.markdown');
  };
  const writableDir = parts => parts[0] === '.atelieroot' ? parts.length > 1 : !parts.some(p => p.startsWith('.'));

  async function listAll(includeHidden) {
    const out = [];
    const walk = async (dirAbs, rel) => {
      let ents; try { ents = await fsp.readdir(dirAbs, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (out.length >= MAX_ENTRIES) return;
        const hidden = e.name.startsWith('.'), isMeta = rel === '' && e.name === '.atelieroot';
        if (e.name === 'node_modules' || e.isSymbolicLink()) continue;
        if (hidden && !(includeHidden && isMeta) && !(includeHidden && rel.startsWith('.atelieroot'))) continue;
        const p = rel ? `${rel}/${e.name}` : e.name, abs = path.join(dirAbs, e.name);
        if (e.isDirectory()) { out.push({ p, t: 'd', s: 0, m: 0 }); await walk(abs, p); }
        else if (e.isFile()) {
          const lower = e.name.toLowerCase(), isMd = lower.endsWith('.md') || lower.endsWith('.markdown');
          if (!isMd && !(p.startsWith('.atelieroot/') && includeHidden)) continue;
          try { const st = await fsp.stat(abs); out.push({ p, t: 'f', s: st.size, m: Math.round(st.mtimeMs) }); } catch { /* desapareció */ }
        }
      }
    };
    await walk(root, '');
    return out;
  }
  const sigOf = list => list.map(e => `${e.p}|${e.s}|${e.m}`).join('\n');

  const hostOk = req => {
    const h = String(req.headers.host || '').toLowerCase();
    return h === `localhost:${port}` || h === `127.0.0.1:${port}` || h === `[::1]:${port}`;
  };
  const tokenOk = (req, url) => {
    const t = req.headers['x-atelieroot-token'] || url.searchParams.get('token') || '';
    const a = Buffer.from(String(t)), b = Buffer.from(token);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  const readBody = req => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { reject(Object.assign(new Error('demasiado grande'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  // one read for POST /api/files, with the rules of GET /api/file: { text, m, s } or { error: denied|missing|io }
  // dirs: realInside of each folder, shared by one batch (a plain file adds nothing to its folder's real path;
  // a link, junction included, is resolved in full like in GET /api/file)
  async function readOne(p, dirs) {
    const parts = typeof p === 'string' ? safeRel(p) : null; if (!parts) return { error: 'denied' };   // like the 400 of GET /api/file
    const abs = absOf(parts);
    if (!insideRoot(abs) || (parts[0] !== '.atelieroot' && !writable(parts))) return { error: 'denied' };
    let st; try { st = await fsp.lstat(abs); } catch (e) { return { error: e.code === 'ENOENT' ? 'missing' : 'io' }; }
    const dir = path.dirname(abs);
    if (!dirs.has(dir)) dirs.set(dir, realInside(dir));
    if (!(await (st.isSymbolicLink() ? realInside(abs) : dirs.get(dir)))) return { error: 'denied' };
    try { const st = await fsp.stat(abs); if (!st.isFile()) return { error: 'missing' }; return { text: await fsp.readFile(abs, 'utf8'), m: Math.round(st.mtimeMs), s: st.size }; }
    catch (e) { return { error: e.code === 'ENOENT' ? 'missing' : 'io' }; }
  }

  async function api(req, res, url) {
    const q = k => url.searchParams.get(k);
    const route = url.pathname.slice(5);                 // sin «/api/»
    if (route === 'ping') return json(res, 200, { name: path.basename(root), version: VERSION, server: true });
    if (route === 'events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n'); sseClients.add(res); req.on('close', () => sseClients.delete(res)); return;
    }
    if (route === 'list' && req.method === 'GET') return json(res, 200, { entries: await listAll(q('hidden') === '1') });
    if (route === 'files' && req.method === 'POST') {            // many reads in one request (opening a large folder)
      let paths; try { paths = JSON.parse((await readBody(req)).toString('utf8')).paths; } catch (_) { return fail(res, 400, 'JSON no válido'); }
      if (!Array.isArray(paths) || paths.length > MAX_MANY) return fail(res, 400, `paths: lista de hasta ${MAX_MANY} rutas`);
      const out = new Array(paths.length), dirs = new Map();
      let i = 0;
      await Promise.all(Array.from({ length: Math.min(16, paths.length) }, async () => { while (i < paths.length) { const k = i++; out[k] = await readOne(paths[k], dirs); } }));
      return json(res, 200, { files: out });
    }
    if (route === 'file') {
      const parts = safeRel(q('p')); if (!parts) return fail(res, 400, 'ruta no válida');
      const abs = absOf(parts);
      if (!insideRoot(abs) || !(await realInside(abs))) return fail(res, 403, 'fuera de la carpeta');
      if (req.method === 'GET') {
        const isMeta = parts[0] === '.atelieroot';
        if (!isMeta && !writable(parts)) return fail(res, 403, 'solo se leen .md');
        try { const st = await fsp.stat(abs); if (!st.isFile()) return fail(res, 404, 'no es un archivo'); return json(res, 200, { text: await fsp.readFile(abs, 'utf8'), m: Math.round(st.mtimeMs), s: st.size }); }
        catch (e) {
          if (e.code === 'ENOENT' && q('optional') === '1') return json(res, 200, { missing: true });      // «si existe»: no es un error que falte (así la consola no se llena de 404)
          return fail(res, e.code === 'ENOENT' ? 404 : 500, e.code === 'ENOENT' ? 'no existe' : e.message);
        }
      }
      if (req.method === 'PUT') {
        if (!writable(parts)) return fail(res, 403, 'solo se escriben .md y .atelieroot/');
        const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        if (typeof body.text !== 'string') return fail(res, 400, 'falta text');
        const expect = q('expect');
        if (expect !== null && expect !== '') {                                  // detección de cambios hechos fuera: si el archivo ya no es el que leíste, no se pisa
          let cur = null; try { cur = Math.round((await fsp.stat(abs)).mtimeMs); } catch { cur = 0; }
          if (cur !== 0 && cur !== Number(expect)) return fail(res, 409, 'el archivo cambió en el disco');
        }
        await fsp.mkdir(path.dirname(abs), { recursive: true });
        const tmp = path.join(path.dirname(abs), `.atelieroot-tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
        await fsp.writeFile(tmp, body.text, 'utf8'); await fsp.rename(tmp, abs);   // escritura atómica
        const st = await fsp.stat(abs); return json(res, 200, { m: Math.round(st.mtimeMs), s: st.size });
      }
      if (req.method === 'DELETE') {
        if (!writable(parts)) return fail(res, 403, 'solo se borran .md y .atelieroot/');
        try { await fsp.rm(abs, { force: true, recursive: q('recursive') === '1' }); return json(res, 200, {}); } catch (e) { return fail(res, 500, e.message); }
      }
    }
    if (route === 'mkdir' && req.method === 'POST') {
      const parts = safeRel(q('p')); if (!parts || !writableDir(parts)) return fail(res, 400, 'ruta no válida');
      const abs = absOf(parts); if (!insideRoot(abs) || !(await realInside(abs))) return fail(res, 403, 'fuera de la carpeta');
      await fsp.mkdir(abs, { recursive: true }); return json(res, 200, {});
    }
    if (route === 'move' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const a = safeRel(body.from), b = safeRel(body.to); if (!a || !b) return fail(res, 400, 'ruta no válida');
      const aa = absOf(a), bb = absOf(b);
      if (!insideRoot(aa) || !insideRoot(bb) || !(await realInside(aa)) || !(await realInside(bb))) return fail(res, 403, 'fuera de la carpeta');
      let isDir = false; try { isDir = (await fsp.stat(aa)).isDirectory(); } catch { return fail(res, 404, 'no existe'); }
      const fromTrash = a[0] === '.atelieroot' && a[1] === 'trash', safeDest = !b.some(x => x.startsWith('.')) && b[0] !== '.atelieroot';
      const restorable = fromTrash && safeDest && !isDir && RESTORE_EXT.test(b[b.length - 1]);          // devolver de la papelera una imagen, un PDF… (nunca scripts ni ejecutables)
      if (isDir ? !(writableDir(a) && writableDir(b)) : !((writable(a) && writable(b)) || restorable)) return fail(res, 403, 'movimiento no permitido');
      try { await fsp.access(bb); return fail(res, 409, 'el destino ya existe'); } catch { /* libre */ }
      await fsp.mkdir(path.dirname(bb), { recursive: true }); await fsp.rename(aa, bb); return json(res, 200, {});
    }
    return fail(res, 404, 'ruta desconocida');
  }

  async function serveStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
    const abs = path.join(appDir, path.normalize(rel));
    if (!abs.startsWith(appDir + path.sep) || /(^|[\\/])server([\\/]|$)/.test(path.relative(appDir, abs))) return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
    try {
      const st = await fsp.stat(abs); if (!st.isFile()) throw new Error('no es archivo');
      let data = await fsp.readFile(abs);
      if (path.basename(abs) === 'index.html') {
        data = Buffer.from(data.toString('utf8').replace('</head>', `<meta name="atelieroot-token" content="${token}">\n<meta name="atelieroot-server" content="1">\n</head>`));
      }
      return send(res, 200, data, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    } catch { return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' }); }
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (!hostOk(req)) return fail(res, 403, 'Host no permitido');
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname.startsWith('/api/')) {
        if (!tokenOk(req, url)) return fail(res, 401, 'falta el token');
        return await api(req, res, url);
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'método no permitido');
      return await serveStatic(req, res, url);
    } catch (e) {
      if (!res.headersSent) return fail(res, e.code === 413 ? 413 : e instanceof SyntaxError ? 400 : 500, e.code === 413 ? 'cuerpo demasiado grande' : e instanceof SyntaxError ? 'JSON no válido' : 'error interno');
    }
  });
  const startPolling = () => {
    pollTimer = setInterval(async () => {
      if (!sseClients.size) return;
      const sig = sigOf(await listAll(true));
      if (lastSig !== null && sig !== lastSig) for (const c of sseClients) c.write('data: change\n\n');
      lastSig = sig;
    }, POLL_MS);
    pollTimer.unref();
  };
  return {
    server, root, appDir, get token() { return token; },
    listen: () => new Promise(resolve => server.listen(port, '127.0.0.1', () => { port = server.address().port; startPolling(); resolve(port); })),
    close: () => new Promise(resolve => { clearInterval(pollTimer); for (const c of sseClients) c.end(); server.close(() => resolve()); server.closeAllConnections && server.closeAllConnections(); }),
  };
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* sin navegador */ }
}

async function main() {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (o.help) {
    console.log('Uso: node server/atelieroot-server.js --dir <carpeta> [--port 4321] [--app <carpeta de la app>] [--open]\n  --dir   carpeta donde viven tus .md (se crea si no existe)\n  --port  puerto (por defecto 4321)\n  --app   carpeta con index.html de AtelieRoot (por defecto ../app, ../dist o ../src)\n  --open  abre el navegador');
    return;
  }
  fs.mkdirSync(path.resolve(o.dir), { recursive: true });
  const s = createServer(o);
  const port = await s.listen();
  const url = `http://localhost:${port}/`;
  console.log(`AtelieRoot listo en ${url}\nCarpeta de trabajo: ${s.root}\nPulsa Ctrl+C para salir.`);
  if (o.open) openBrowser(url);
  process.on('SIGINT', () => s.close().then(() => process.exit(0)));
}

module.exports = { createServer, parseArgs };
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
