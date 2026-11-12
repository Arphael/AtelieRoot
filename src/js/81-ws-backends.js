"use strict";
/* ====== 75. Carpeta de trabajo: backends ====== */
// Un «backend» sabe leer y escribir los archivos de UNA carpeta. Hay dos y ofrecen exactamente lo mismo, así que el resto de AtelierRoot no sabe cuál usa:
//   HttpBackend  habla con server/atelierroot-server.js (cualquier navegador; sin permisos que aceptar).
//   FsBackend    usa la API de carpetas del navegador (File System Access; solo Chrome y Edge).
//
//   list(hidden)           → [{ p, t:'d'|'f', s, m }]   rutas con «/», tamaño y fecha de modificación (ms). Solo .md y carpetas visibles;
//                            con hidden=true también lo que hay dentro de .atelierroot/
//   read(p, optional)      → { text, m, s }   (con optional=true, si no existe devuelve null en vez de fallar)
//   write(p, text, expect) → { m, s }   (si se pasa expect y el archivo cambió fuera desde esa fecha: error 'conflict' y NO se pisa)
//   mkdir(p) · move(a, b) · remove(p, recursive)
//   watch(cb)              → empieza a avisar de cambios (devuelve una función para parar)
// Los errores son WsError con un code: 'conflict' | 'exists' | 'missing' | 'denied' | 'offline' | 'io'.
// known codes are shown in the interface language (the backend text stays in .detail); 'io' keeps the backend text
class WsError extends Error { constructor(code, msg){ const k = 'ws.err.' + code; super(code !== 'io' && STR[k] ? T(k) : (msg || code)); this.code = code; this.detail = msg; } }
const wsIsMd = n => /\.(md|markdown)$/i.test(n);

class HttpBackend {
  constructor(token){ this.kind = 'http'; this.token = token; this.name = ''; }
  async api(method, path, body){
    let r;
    try { r = await fetch('/api/' + path, { method, headers: { 'X-AtelierRoot-Token': this.token, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch(_){ throw new WsError('offline', T('ws.err.offline')); }
    let j = {}; try { j = await r.json(); } catch(_){}
    if (r.ok) return j;
    const code = r.status === 409 ? (/destino/.test(j.error || '') ? 'exists' : 'conflict') : r.status === 404 ? 'missing' : (r.status === 401 || r.status === 403) ? 'denied' : 'io';
    throw new WsError(code, j.error || ('HTTP ' + r.status));
  }
  async init(){ const j = await this.api('GET', 'ping'); this.name = j.name; return this; }
  list(hidden){ return this.api('GET', 'list' + (hidden ? '?hidden=1' : '')).then(j => j.entries); }
  read(p, optional){ return this.api('GET', 'file?p=' + encodeURIComponent(p) + (optional ? '&optional=1' : '')).then(r => r.missing ? null : r); }
  readMany(paths){ return this.api('POST', 'files', { paths }).then(j => j.files); }   // [{ text, m, s } | { error }], same order
  write(p, text, expect){ return this.api('PUT', 'file?p=' + encodeURIComponent(p) + (expect ? '&expect=' + expect : ''), { text }); }
  mkdir(p){ return this.api('POST', 'mkdir?p=' + encodeURIComponent(p)); }
  move(a, b){ return this.api('POST', 'move', { from: a, to: b }); }
  remove(p, recursive){ return this.api('DELETE', 'file?p=' + encodeURIComponent(p) + (recursive ? '&recursive=1' : '')); }
  watch(cb){                                                   // el servidor avisa por eventos; si se corta, el navegador reconecta solo
    let es = null; try { es = new EventSource('/api/events?token=' + encodeURIComponent(this.token)); es.onmessage = () => cb(); } catch(_){}
    return () => { if (es) es.close(); };
  }
}

const fsErr = e => {
  const n = e && e.name;
  if (n === 'NotFoundError' || n === 'TypeMismatchError') return new WsError('missing', e.message);
  if (n === 'NotAllowedError' || n === 'SecurityError') return new WsError('denied', e.message);
  if (n === 'InvalidModificationError') return new WsError('exists', e.message);
  return new WsError('io', (e && e.message) || String(e));
};

class FsBackend {
  constructor(root){ this.kind = 'fs'; this.root = root; this.name = root.name; }
  async dir(parts, create){
    let d = this.root;
    for (const part of parts){ try { d = await d.getDirectoryHandle(part, { create: !!create }); } catch(e){ throw fsErr(e); } }
    return d;
  }
  async fileH(p, create){
    const parts = p.split('/'), name = parts.pop(), d = await this.dir(parts, create);
    try { return await d.getFileHandle(name, { create: !!create }); } catch(e){ throw fsErr(e); }
  }
  /** { h, kind:'file'|'dir' } o null si no existe */
  async handleOf(p){
    const parts = p.split('/'), name = parts.pop();
    let d; try { d = await this.dir(parts, false); } catch(_){ return null; }
    try { return { h: await d.getFileHandle(name), kind: 'file' }; } catch(_){}
    try { return { h: await d.getDirectoryHandle(name), kind: 'dir' }; } catch(_){}
    return null;
  }
  async list(hidden){
    const out = [];
    const walkDir = async (dir, rel) => {
      const inMeta = rel === '.atelierroot' || rel.startsWith('.atelierroot/'), files = [];
      for await (const [name, h] of dir.entries()){
        if (name.startsWith('.') && !(hidden && ((rel === '' && name === '.atelierroot') || inMeta))) continue;
        if (name === 'node_modules') continue;
        const p = rel ? rel + '/' + name : name;
        if (h.kind === 'directory'){ out.push({ p, t: 'd', s: 0, m: 0 }); await walkDir(h, p); }
        else if (wsIsMd(name) || (hidden && inMeta)) files.push([p, h]);
      }
      for (let i = 0; i < files.length; i += 16)                                  // de 16 en 16: leer la fecha de cada archivo es lo más lento
        await Promise.all(files.slice(i, i + 16).map(async ([p, h]) => { try { const f = await h.getFile(); out.push({ p, t: 'f', s: f.size, m: f.lastModified }); } catch(_){} }));
    };
    try { await walkDir(this.root, ''); } catch(e){ throw fsErr(e); }
    return out;
  }
  async read(p, optional){
    let h; try { h = await this.fileH(p); } catch(e){ if (optional && e.code === 'missing') return null; throw e; }
    const f = await h.getFile(); return { text: await f.text(), m: f.lastModified, s: f.size };
  }
  async write(p, text, expect){
    if (expect){                                                                    // ¿sigue siendo el archivo que leímos?
      let cur = 0; try { cur = (await (await this.fileH(p, false)).getFile()).lastModified; } catch(_){}
      if (cur && cur !== Number(expect)) throw new WsError('conflict', T('ws.err.conflict'));
    }
    const h = await this.fileH(p, true);
    try { const w = await h.createWritable(); await w.write(text); await w.close(); } catch(e){ throw fsErr(e); }   // el navegador escribe en un temporal y lo sustituye al cerrar
    const f = await h.getFile(); return { m: f.lastModified, s: f.size };
  }
  async mkdir(p){ await this.dir(p.split('/'), true); return {}; }
  async remove(p, recursive){
    const parts = p.split('/'), name = parts.pop(), d = await this.dir(parts, false);
    try { await d.removeEntry(name, { recursive: !!recursive }); } catch(e){ throw fsErr(e); }
    return {};
  }
  async copyDir(srcDir, destPath){
    await this.mkdir(destPath);
    for await (const [name, h] of srcDir.entries()){
      const to = destPath + '/' + name;
      if (h.kind === 'directory') await this.copyDir(h, to);
      else { const buf = await (await h.getFile()).arrayBuffer(); const w = await (await this.fileH(to, true)).createWritable(); await w.write(buf); await w.close(); }
    }
  }
  async move(a, b){
    if (await this.handleOf(b)) throw new WsError('exists', T('ws.err.exists'));
    const src = await this.handleOf(a); if (!src) throw new WsError('missing', T('ws.err.missing'));
    try {                                                                           // el navegador no tiene «mover» fiable para carpetas locales: se copia y se borra el original
      if (src.kind === 'file'){ const buf = await (await src.h.getFile()).arrayBuffer(); const w = await (await this.fileH(b, true)).createWritable(); await w.write(buf); await w.close(); await this.remove(a, false); }
      else { await this.copyDir(src.h, b); await this.remove(a, true); }
    } catch(e){ throw e instanceof WsError ? e : fsErr(e); }
    return {};
  }
  watch(cb){ const t = setInterval(() => { if (!document.hidden) cb(); }, window.__WS_POLL_MS || 3000); return () => clearInterval(t); }   // el navegador no avisa de cambios: se mira cada 3 s
}

// TauriBackend: the desktop app (src-tauri/). Same interface; the Rust side applies the rules of docs/CONTRACT.md.
// Rust errors arrive as "code:message".
const wsTauri = () => window.__TAURI__ && window.__TAURI__.core;
class TauriBackend {
  constructor(name){ this.kind = 'tauri'; this.name = name || ''; }
  async call(cmd, args){
    try { return await wsTauri().invoke(cmd, args); }
    catch(e){ const s = String(e && e.message || e), i = s.indexOf(':'), code = i > 0 ? s.slice(0, i) : 'io'; throw new WsError(['conflict', 'exists', 'missing', 'denied', 'offline', 'io'].includes(code) ? code : 'io', i > 0 ? s.slice(i + 1) : s); }
  }
  list(hidden){ return this.call('ws_list', { hidden: !!hidden }); }
  read(p, optional){ return this.call('ws_read', { p, optional: !!optional }); }
  readMany(paths){ return this.call('ws_read_many', { paths }); }                 // [{ text, m, s } | { error }], same order
  write(p, text, expect){ return this.call('ws_write', { p, text, expect: expect ? Number(expect) : null }); }
  mkdir(p){ return this.call('ws_mkdir', { p }).then(() => ({})); }
  move(a, b){ return this.call('ws_move', { from: a, to: b }).then(() => ({})); }
  remove(p, recursive){ return this.call('ws_remove', { p, recursive: !!recursive }).then(() => ({})); }
  watch(cb){                                                     // the Rust side polls the folder and emits "ws-changed"
    let off = null, stopped = false;
    window.__TAURI__.event.listen('ws-changed', () => cb()).then(u => { if (stopped) u(); else off = u; });
    return () => { stopped = true; if (off) off(); };
  }
}

// La carpeta elegida se recuerda (IndexedDB guarda el «handle»), pero en cada sesión el navegador vuelve a pedir permiso.
// (las pruebas automáticas pueden poner su propio almacén en window.__WS_HANDLES: en el Chromium sin interfaz, leer un handle de IndexedDB cierra la página)
const WsHandles = window.__WS_HANDLES || {
  db(){ return new Promise((res, rej) => { const r = indexedDB.open('atelierroot-ws', 1); r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async put(k, v){ const db = await this.db(); return new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async get(k){ const db = await this.db(); return new Promise((res, rej) => { const r = db.transaction('h').objectStore('h').get(k); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); },
  async del(k){ const db = await this.db(); return new Promise((res, rej) => { const t = db.transaction('h', 'readwrite'); t.objectStore('h').delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
};
/** ¿Tenemos permiso de escritura sobre la carpeta? Con request=true (solo desde un clic) el navegador pregunta al usuario. */
async function wsPermission(handle, request){
  const opt = { mode: 'readwrite' };
  try { if ((await handle.queryPermission(opt)) === 'granted') return true; if (request && (await handle.requestPermission(opt)) === 'granted') return true; } catch(_){}
  return false;
}
