"use strict";
/* ====== 76. Carpeta de trabajo: núcleo ====== */
// Con una carpeta abierta, los archivos del disco son la verdad:
//   · carpetas del disco = carpetas de AtelierRoot · cada «.md» = un documento · el nombre del archivo = el nombre del documento;
//   · lo que Markdown no puede guardar (orden, carpetas abiertas, anchos de columna, pliegues, valores de los marcadores, papelera)
//     va en <carpeta>/.atelierroot/state.json y lo eliminado en <carpeta>/.atelierroot/trash/;
//   · el árbol de AtelierRoot (state.tree) se SINCRONIZA con el disco de forma declarativa: después de cada cambio se compara
//     con lo último que se sabe del disco y se crean, renombran, mueven o mandan a la papelera los archivos que haga falta.
//     Así no hay que tocar cada sitio de la aplicación donde cambia el árbol.
//   · los cambios hechos fuera (VS Code, git…) se detectan y se recargan; si el mismo documento cambió en los dos
//     sitios, no se pierde nada: tu versión pasa a una copia.
const WS_META = '.atelierroot/state.json', WS_TRASH = '.atelierroot/trash';

/* ---- ayudantes: nombres, rutas, ids ---- */
const wsHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
const wsBase = p => p.slice(p.lastIndexOf('/') + 1);
const wsDir = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const wsJoin = (d, n) => d ? d + '/' + n : n;
const wsNoExt = n => n.replace(/\.(md|markdown)$/i, '');
const wsClock = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
/** Nombre válido en Windows, macOS y Linux (sin / \ : * ? " < > |, sin punto inicial ni espacios/puntos al final, sin nombres reservados). */
function wsSafeName(name, isDoc){
  let n = String(name == null ? '' : name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[. ]+$/, '');
  if (!n) n = isDoc ? 'Sin título' : 'Carpeta';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(n)) n += '_';
  return n.slice(0, 120);
}
async function wsPool(items, n, fn){ let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length){ const k = i++; await fn(items[k], k); } })); }

/* ---- .md ↔ HTML interno (con lo que Markdown no guarda: anchos de columna y pliegues) ---- */
const wsHtml = md => domFromMd(tidyMd(md));
function wsMdText(html){
  const d = document.createElement('div'); d.innerHTML = html || '<p><br></p>';
  d.querySelectorAll('.cb-hl code').forEach(c => { c.textContent = ''; });          // el color del código no es contenido
  const md = mdFromDom(d).replace(/\s+$/, '');
  return md ? md + '\n' : '';
}
const wsIsHead = el => /^H[1-6]$/.test(el.tagName);
function wsCapture(html){
  if (!/data-cw|data-fold/.test(html || '')) return null;
  const t = document.createElement('template'); t.innerHTML = html; const root = t.content;
  const tw = [...root.querySelectorAll('table')].map(tb => tb.hasAttribute('data-cw') && tb.rows[0] ? [...tb.rows[0].children].map(c => parseFloat(c.getAttribute('data-w')) || 0) : null);
  const folds = [...root.children].filter(wsIsHead).map((h, i) => h.hasAttribute('data-fold') ? i : -1).filter(i => i >= 0);
  const hasTw = tw.some(Boolean);
  return hasTw || folds.length ? Object.assign({}, hasTw ? { tw } : {}, folds.length ? { folds } : {}) : null;
}
function wsApply(html, ex){
  if (!ex) return html;
  const t = document.createElement('template'); t.innerHTML = html; const root = t.content;
  if (ex.tw){
    const tbs = [...root.querySelectorAll('table')];
    ex.tw.forEach((arr, i) => {
      const tb = tbs[i]; if (!arr || !tb || !tb.rows[0]) return;
      arr.forEach((v, j) => { const c = tb.rows[0].children[j]; if (c && v){ c.setAttribute('data-w', v.toFixed(2)); c.style.width = v.toFixed(2) + '%'; } });
      tb.setAttribute('data-cw', '');
    });
  }
  if (ex.folds){ const heads = [...root.children].filter(wsIsHead); ex.folds.forEach(i => { if (heads[i]) heads[i].setAttribute('data-fold', ''); }); }
  const d = document.createElement('div'); d.appendChild(root); return d.innerHTML;
}

/* ---- estado de la carpeta abierta ---- */
const Workspace = {
  active: false, be: null, kind: '', name: '', startId: null,
  known: {},         // ruta → { t:'f'|'d', m, s }  lo último que sabemos del disco
  text: {},          // ruta → texto del .md tal como está en el disco (si no cambió, no se reescribe)
  saved: {},         // id → html con el que coincide el disco
  extras: {},        // id → { tw, folds }
  nodes: new Map(),  // id → { path, type, parentId, node }  árbol de la última sincronización
  trashIds: new Set(), trashInfo: new Map(), idUsed: new Set(),     // trashInfo: entrada → { nodeId, type, base } (para devolver lo que no es .md al restaurar)
  metaJson: '', q: Promise.resolve(), stopWatch: null, refreshT: 0,
  status: 'off', msg: '', lastOk: 0, errT: 0, lastToast: {},
};
const WS_LABEL = { off: 'Modo temporal', ok: 'Carpeta ✓', saving: 'Guardando…', error: 'Error al guardar', denied: 'Sin permiso', offline: 'Sin servidor' };
function wsStatus(s, msg){
  const W = Workspace; W.status = s; W.msg = msg || '';
  const text = s === 'ok' && W.name ? '📁 ' + W.name + ' ✓' : (s === 'off' ? '' : '📁 ') + WS_LABEL[s];
  const title = msg || (s === 'ok' ? 'Tus documentos se guardan solos en la carpeta «' + W.name + '». Clic para ver opciones.' : s === 'off' ? 'Tus documentos solo están en este navegador. Clic para guardarlos en una carpeta.' : 'Clic para ver opciones');
  document.querySelectorAll('.ws-chip').forEach(el => { el.textContent = text; el.dataset.ws = s; el.title = title; });
}
function wsToastOnce(key, text){ const W = Workspace, now = Date.now(); if (W.lastToast[key] && now - W.lastToast[key] < 60000) return; W.lastToast[key] = now; toast(text); }
function wsFail(e){
  const W = Workspace, code = (e && e.code) || 'io';
  console.error('carpeta:', e);
  if (code === 'denied'){ wsStatus('denied', 'El navegador ya no tiene permiso para escribir en la carpeta. Clic para volver a darlo.'); wsToastOnce('denied', 'AtelierRoot perdió el permiso sobre la carpeta. Pulsa «📁» abajo para volver a darlo.'); return; }
  if (code === 'offline'){ wsStatus('offline', 'No hay conexión con el servidor de AtelierRoot. Se reintenta solo.'); wsToastOnce('offline', 'No hay conexión con el servidor de AtelierRoot. Tus cambios se guardarán al volver.'); }
  else { wsStatus('error', (e && e.message) || 'No se pudo guardar'); wsToastOnce('error', 'No se pudo guardar en la carpeta: ' + ((e && e.message) || code)); }
  clearTimeout(W.errT); W.errT = setTimeout(() => wsSchedule(true), 5000);                  // se reintenta
}

/* ---- carga: del disco al estado de AtelierRoot ---- */
const wsIdFor = p => { const W = Workspace; let id = 'w' + wsHash(p); while (W.idUsed.has(id)) id += 'x'; W.idUsed.add(id); return id; };
async function wsReadMeta(be){
  try { const r = await be.read(WS_META, true); if (!r) return {}; const j = JSON.parse(r.text); Workspace.metaJson = r.text; return (j && typeof j === 'object') ? j : {}; }
  catch(e){ if (e && e.code && e.code !== 'missing') console.warn('No se pudo leer .atelierroot/state.json:', e.message); return {}; }
}
const wsLite = n => { const o = { id: n.id, type: n.type, name: n.name }; if (n.children) o.children = n.children.map(wsLite); return o; };
const wsRevive = o => { const n = { id: o.id, type: o.type, name: o.name }; if (o.type === 'folder'){ n.children = (o.children || []).map(wsRevive); n.open = false; } return n; };

async function wsLoad(be){
  const W = Workspace;
  Object.assign(W, { be, kind: be.kind, name: be.name || 'Carpeta', known: {}, text: {}, saved: {}, extras: {}, nodes: new Map(), trashIds: new Set(), trashInfo: new Map(), idUsed: new Set(), metaJson: '', startId: null });
  const entries = (await be.list(false)).filter(e => e.t === 'd' || wsIsMd(e.p));
  entries.sort((a, b) => a.p.localeCompare(b.p, 'es', { numeric: true, sensitivity: 'base' }));
  const meta = await wsReadMeta(be);
  // contenido de todos los documentos (de 8 en 8)
  const reads = {};
  await wsPool(entries.filter(e => e.t === 'f'), 8, async e => { try { reads[e.p] = await be.read(e.p); } catch(err){ console.warn('No se pudo leer', e.p, err.message); } });
  const ok = entries.filter(e => e.t === 'd' || reads[e.p]);
  // árbol
  const idOf = {}, pathOf = {};
  ok.forEach(e => { const id = wsIdFor(e.p); idOf[e.p] = id; pathOf[id] = e.p; });
  const orderIdx = {}; Object.keys(meta.order || {}).forEach(dir => (meta.order[dir] || []).forEach((name, i) => { orderIdx[wsJoin(dir, name)] = i; }));
  let tail = 1e6; const nodes = {};
  ok.forEach(e => {
    const isDir = e.t === 'd', id = idOf[e.p], parentPath = wsDir(e.p);
    nodes[id] = { id, type: isDir ? 'folder' : 'doc', name: isDir ? wsBase(e.p) : wsNoExt(wsBase(e.p)), parent: parentPath ? (idOf[parentPath] || null) : null, ord: orderIdx[e.p] !== undefined ? orderIdx[e.p] : ++tail };
  });
  state.tree = []; state.docs = {}; state.trash = []; state.fills = {}; state.current = null; Dirty.clear();
  applyMeta({ v: 2, nodes, trash: [], fills: {}, lastBackup: 0 });
  const openSet = new Set(meta.open || []);
  walk(state.tree, n => { n.path = pathOf[n.id]; if (n.type === 'folder'){ n.open = openSet.has(n.path); W.known[n.path] = { t: 'd', m: 0, s: 0 }; } });
  // documentos
  walk(state.tree, n => {
    if (n.type !== 'doc') return;
    const r = reads[n.path]; let html = wsHtml(r.text); const ex = meta.extras && meta.extras[n.path];
    if (ex){ html = wsApply(html, ex); W.extras[n.id] = ex; }
    state.docs[n.id] = html; W.saved[n.id] = html; W.text[n.path] = r.text; W.known[n.path] = { t: 'f', m: r.m, s: r.s }; n.mod = r.m;
    if (meta.fills && meta.fills[n.path]) state.fills[n.id] = meta.fills[n.path];
  });
  // papelera (lo eliminado vive en .atelierroot/trash)
  for (const t of (meta.trash || [])){
    if (!t || !t.node) continue;
    const docPaths = t.docPaths || {};
    for (const docId of (t.docIds || [])){
      try { const r = await be.read(WS_TRASH + '/' + t.id + '/' + docPaths[docId]); state.docs[docId] = wsHtml(r.text); W.saved[docId] = state.docs[docId]; }
      catch(_){ state.docs[docId] = '<p><br></p>'; W.saved[docId] = state.docs[docId]; }
    }
    state.trash.push({ id: t.id, node: wsRevive(t.node), docIds: t.docIds || [], docPaths, parentId: t.parentPath !== undefined && t.parentPath !== null && idOf[t.parentPath] ? idOf[t.parentPath] : null, at: t.at || Date.now() });
    W.trashIds.add(t.id); W.trashInfo.set(t.id, { nodeId: t.node.id, type: t.node.type, base: t.base || wsSafeName(t.node.name, t.node.type === 'doc') });
  }
  const td = trashDaysPlan();
  if (td){ const old = state.trash.filter(t => Date.now() - t.at >= td * 86400000); old.forEach(t => purgeDocs(t.docIds)); state.trash = state.trash.filter(t => !old.includes(t)); }
  // documento con el que se empieza
  const cur = meta.current && ok.some(e => e.p === meta.current) ? idOf[meta.current] : null;
  W.startId = cur || lastModifiedDoc() || firstDoc();
  if (!W.startId){                                                        // carpeta vacía: un primer documento para empezar a escribir
    const d = { id: uid(), type: 'doc', name: 'Primer documento', mod: Date.now() };
    state.tree.push(d); state.docs[d.id] = SEED_HTML; W.startId = d.id;
  }
  wsSnapshot();
}
/** Devuelve true si pudo mover de vuelta todo lo que no es .md de una carpeta restaurada (entonces la copia de la papelera ya no hace falta). */
async function wsRestoreExtras(entryId, base, destRoot){
  const be = Workspace.be, root = WS_TRASH + '/' + entryId + '/' + base + '/'; let ok = true;
  try {
    const all = (await be.list(true)).filter(e => e.t === 'f' && e.p.startsWith(root) && !wsIsMd(e.p));
    for (const e of all){
      const rel = e.p.slice(root.length), target = destRoot + '/' + rel;
      try { await be.move(e.p, target); } catch(err){ if (err.code !== 'exists') ok = false; }
    }
  } catch(_){ ok = false; }
  return ok;
}
function wsSnapshot(){
  const m = new Map(); walk(state.tree, (n, p) => m.set(n.id, { path: n.path, type: n.type, parentId: p ? p.id : null, node: n }));
  Workspace.nodes = m;
}
function wsForget(path){ for (const map of [Workspace.known, Workspace.text]) Object.keys(map).forEach(k => { if (k === path || k.startsWith(path + '/')) delete map[k]; }); }
function wsRebase(from, to, node){
  const re = k => k === from ? to : (k.startsWith(from + '/') ? to + k.slice(from.length) : null);
  for (const map of [Workspace.known, Workspace.text]){
    const moves = Object.keys(map).map(k => [k, re(k)]).filter(x => x[1] !== null), vals = moves.map(([k]) => map[k]);
    moves.forEach(([k]) => delete map[k]); moves.forEach(([, nk], i) => { map[nk] = vals[i]; });
  }
  const fix = x => { if (x.path){ const nk = re(x.path); if (nk !== null) x.path = nk; } (x.children || []).forEach(fix); };
  fix(node); node.path = to;
}

/* ---- sincronización del árbol con el disco ---- */
async function wsSyncTree(){
  const W = Workspace, be = W.be, cur = new Map(); walk(state.tree, n => cur.set(n.id, n)); const cur2 = id => cur.get(id) || null;
  // 1) lo que desapareció del árbol (eliminado) pasa a .atelierroot/trash: así nada se borra de verdad
  const gone = [...W.nodes].filter(([id]) => !cur.has(id)), goneSet = new Set(gone.map(g => g[0]));
  for (const [id, rec] of gone){ if (rec.parentId && goneSet.has(rec.parentId)) continue; await wsTrashOnDisk(id, rec); }
  // 2) crear, renombrar y mover lo demás
  W.renamed = false;
  await wsPlace(state.tree, '');
  if (W.renamed){ renderTree(); setPath(); W.renamed = false; }
  // 3) copias de la papelera que ya no hacen falta (restauradas o borradas para siempre)
  const live = new Set((state.trash || []).map(t => t.id));
  for (const id of [...W.trashIds]){
    if (live.has(id)) continue;
    const info = W.trashInfo.get(id), back = info && info.type === 'folder' ? cur2(info.nodeId) : null;
    let keep = false;
    if (back && back.path) keep = !(await wsRestoreExtras(id, info.base, back.path));       // restaurada: lo que AtelierRoot no muestra (imágenes, PDF…) vuelve con ella
    if (keep) continue;
    try { await be.remove(WS_TRASH + '/' + id, true); } catch(e){ if (e.code !== 'missing') throw e; }
    W.trashIds.delete(id); W.trashInfo.delete(id);
  }
  wsSnapshot();
}
async function wsTrashOnDisk(id, rec){
  const W = Workspace, be = W.be, entry = (state.trash || []).find(t => t.node && t.node.id === id);
  const entryId = entry ? entry.id : 'x' + uid(), top = rec.path;
  const docPaths = {}, prefix = top ? wsDir(top) : '';
  walk([rec.node], x => { if (x.type === 'doc') docPaths[x.id] = x.path ? (prefix ? x.path.slice(prefix.length + 1) : x.path) : x.id + '.md'; });
  if (top && W.known[top] !== undefined){
    try { await be.move(top, WS_TRASH + '/' + entryId + '/' + wsBase(top)); }
    catch(e){ if (e.code !== 'missing') throw e; }
    wsForget(top);
  }
  for (const docId of Object.keys(docPaths)){                                          // el contenido más reciente (lo que aún no estaba en el disco)
    if (state.docs[docId] === undefined) continue;
    await be.write(WS_TRASH + '/' + entryId + '/' + docPaths[docId], wsMdText(state.docs[docId]));
  }
  if (entry) entry.docPaths = docPaths;
  W.trashIds.add(entryId); W.trashInfo.set(entryId, { nodeId: id, type: rec.type, base: top ? wsBase(top) : wsSafeName(rec.node.name, rec.type === 'doc') });
  walk([rec.node], x => { delete x.path; });
}
async function wsPlace(nodes, parentDir){
  const W = Workspace, be = W.be, taken = new Set();
  const nameOf = n => wsSafeName(n.name, n.type === 'doc') + (n.type === 'doc' ? '.md' : '');
  const stays = n => n.path && wsDir(n.path) === parentDir && wsBase(n.path) === nameOf(n);
  const ordered = [...nodes].sort((a, b) => (stays(b) ? 1 : 0) - (stays(a) ? 1 : 0));    // los que ya tienen su nombre en el disco conservan su sitio
  for (const n of ordered){
    const isDoc = n.type === 'doc', ext = isDoc ? '.md' : '', base = wsSafeName(n.name, isDoc);
    const busy = c => taken.has(c.toLowerCase()) || (W.known[wsJoin(parentDir, c)] !== undefined && wsJoin(parentDir, c) !== n.path);
    let cand = base + ext, k = 2;
    while (busy(cand)) cand = base + ' (' + (k++) + ')' + ext;
    let dest = wsJoin(parentDir, cand);
    if (cand !== nameOf(n) || base !== n.name){ n.name = cand.slice(0, cand.length - ext.length); W.renamed = true; }
    taken.add(cand.toLowerCase());
    if (!n.path) await wsCreate(n, dest);
    else if (n.path !== dest){
      for (let tries = 0; ; tries++){
        try { await wsMoveNode(n, dest); break; }
        catch(e){ if (e.code !== 'exists' || tries > 20) throw e; cand = base + ' (' + (k++) + ')' + ext; n.name = cand.slice(0, cand.length - ext.length); W.renamed = true; dest = wsJoin(parentDir, cand); taken.add(cand.toLowerCase()); }
      }
    }
    if (n.type === 'folder') await wsPlace(n.children || [], n.path);
  }
}
async function wsCreate(n, dest){
  const W = Workspace;
  if (n.type === 'folder'){ await W.be.mkdir(dest); W.known[dest] = { t: 'd', m: 0, s: 0 }; }
  else {
    const html = state.docs[n.id] !== undefined ? state.docs[n.id] : '<p><br></p>', md = wsMdText(html), r = await W.be.write(dest, md);
    W.known[dest] = { t: 'f', m: r.m, s: r.s }; W.text[dest] = md; W.saved[n.id] = html; const ex = wsCapture(html); if (ex) W.extras[n.id] = ex; else delete W.extras[n.id];
    if (state.docs[n.id] === undefined) state.docs[n.id] = html;
  }
  n.path = dest;
}
async function wsMoveNode(n, dest){
  const from = n.path, be = Workspace.be;
  try { await be.move(from, dest); }
  catch(e){
    if (e.code === 'exists' && from.toLowerCase() === dest.toLowerCase()){            // solo cambia mayúsculas/minúsculas en un sistema que no distingue: se pasa por un nombre temporal
      const tmp = wsJoin(wsDir(dest), '__atelierroot_tmp_' + uid() + (n.type === 'doc' ? '.md' : ''));
      await be.move(from, tmp); await be.move(tmp, dest);
    } else throw e;
  }
  wsRebase(from, dest, n);
}

/* ---- documentos: del editor al disco ---- */
function wsAdoptDisk(n, disk){
  const W = Workspace, html = wsApply(wsHtml(disk.text), W.extras[n.id]);
  state.docs[n.id] = html; W.saved[n.id] = html; W.text[n.path] = disk.text; W.known[n.path] = { t: 'f', m: disk.m, s: disk.s }; Dirty.delete(n.id); n.mod = disk.m;
  refreshEditorsFor(n.id);
}
function wsCopyNode(n, html, label){                       // una copia al lado, para que ninguna versión se pierda
  const cid = uid(); state.docs[cid] = html;
  placeNode({ id: cid, type: 'doc', name: n.name + ' (' + label + ' ' + wsClock() + ')', mod: Date.now() }, n, 'after');
  renderTree(); return cid;
}
async function wsFlushDocs(){
  const W = Workspace, be = W.be; let again = false; const docs = [];
  walk(state.tree, n => { if (n.type === 'doc' && n.path) docs.push(n); });
  for (const n of docs){
    const html = state.docs[n.id];
    if (html === undefined || html === W.saved[n.id]) continue;
    const md = wsMdText(html);
    if (md === wsMdText(W.saved[n.id])){ W.saved[n.id] = html; continue; }                // cambió el HTML pero no el Markdown: no hay nada que escribir
    try {
      const k = W.known[n.path], r = await be.write(n.path, md, k && k.m);
      W.known[n.path] = { t: 'f', m: r.m, s: r.s }; W.text[n.path] = md; W.saved[n.id] = html;
      const ex = wsCapture(html); if (ex) W.extras[n.id] = ex; else delete W.extras[n.id];
      n.mod = r.m;
    } catch(e){
      if (e.code === 'missing'){ delete W.known[n.path]; n.path = undefined; again = true; continue; }       // lo borraron fuera: se vuelve a crear en la siguiente vuelta
      if (e.code !== 'conflict') throw e;
      let disk; try { disk = await be.read(n.path); } catch(e2){ if (e2.code === 'missing'){ n.path = undefined; again = true; continue; } throw e2; }
      if (disk.text === md){ W.known[n.path] = { t: 'f', m: disk.m, s: disk.s }; W.text[n.path] = md; W.saved[n.id] = html; continue; }
      wsCopyNode(n, html, 'mi versión'); wsAdoptDisk(n, disk); again = true;
      toast('«' + n.name + '» cambió en el disco a la vez. Tu versión quedó en una copia.');
    }
  }
  return again;
}
function wsTreeMeta(){
  const order = {}, open = []; const rec = (nodes, dir) => { order[dir] = nodes.filter(n => n.path).map(n => wsBase(n.path)); nodes.forEach(n => { if (n.type === 'folder' && n.path){ if (n.open) open.push(n.path); rec(n.children || [], n.path); } }); };
  rec(state.tree, '');
  const W = Workspace, fills = {}, extras = {};
  walk(state.tree, n => { if (n.type !== 'doc' || !n.path) return; if (state.fills && state.fills[n.id] && Object.keys(state.fills[n.id]).length) fills[n.path] = state.fills[n.id]; if (W.extras[n.id]) extras[n.path] = W.extras[n.id]; });
  const trash = (state.trash || []).map(t => { const pn = t.parentId ? findNode(t.parentId) : null; return { id: t.id, at: t.at, parentPath: pn && pn.path ? pn.path : null, node: wsLite(t.node), docIds: t.docIds || [], docPaths: t.docPaths || {}, base: (Workspace.trashInfo.get(t.id) || {}).base }; });
  const cn = state.current ? findNode(state.current) : null;
  return { v: 1, order, open, fills, extras, trash, current: cn && cn.path ? cn.path : null };
}
async function wsWriteMeta(){
  const W = Workspace, json = JSON.stringify(wsTreeMeta(), null, 1) + '\n';
  if (json === W.metaJson) return;
  if (!W.metaJson){ try { await W.be.write('.atelierroot/.gitignore', 'trash/\n'); } catch(_){} }     // lo eliminado no debe acabar en git
  await W.be.write(WS_META, json); W.metaJson = json;
}

/* ---- guardar: cola, reintentos y diario de seguridad ---- */
async function wsPersistOnce(){ await wsSyncTree(); const again = await wsFlushDocs(); await wsWriteMeta(); return again; }
async function wsPersist(){
  const W = Workspace; if (!W.active) return;
  try {
    stash(); wsStatus('saving');
    for (let pass = 0; pass < 4; pass++){ if (!(await wsPersistOnce())) break; }
    wsStatus('ok'); W.lastOk = Date.now(); flag('Guardado'); wsJournalClear();
  } catch(e){ wsFail(e); }
}
function wsSchedule(now){ const W = Workspace; if (!W.active) return Promise.resolve(); W.q = W.q.then(wsPersist); return W.q; }
const wsJKey = () => 'atelierroot.wj.' + wsHash(Workspace.kind + '|' + Workspace.name);
const wsUnsaved = () => { const out = []; walk(state.tree, n => { if (n.type === 'doc' && n.path){ const h = state.docs[n.id]; if (h !== undefined && h !== Workspace.saved[n.id]) out.push(n); } }); return out; };
function wsJournalWrite(){                                  // al cerrar u ocultar la pestaña: lo que aún no llegó al disco se anota de forma síncrona
  try {
    const j = {}; wsUnsaved().forEach(n => { const h = state.docs[n.id]; if (h.length < 1500000) j[n.path] = { md: wsMdText(h), base: wsHash(Workspace.text[n.path] || '') }; });
    if (Object.keys(j).length) localStorage.setItem(wsJKey(), JSON.stringify(j)); else localStorage.removeItem(wsJKey());
  } catch(_){}
}
function wsJournalClear(){ try { if (!wsUnsaved().length) localStorage.removeItem(wsJKey()); } catch(_){} }
function wsRecover(){                                       // si la pestaña se cerró antes de guardar, se recupera lo anotado
  let n = 0;
  try {
    const j = JSON.parse(localStorage.getItem(wsJKey()) || '{}'); localStorage.removeItem(wsJKey());
    Object.keys(j).forEach(p => {
      let node = null; walk(state.tree, x => { if (x.path === p) node = x; });
      if (!node) return;
      const html = wsHtml(j[p].md);
      if (wsHash(Workspace.text[p] || '') === j[p].base){ state.docs[node.id] = html; Dirty.add(node.id); }       // el disco no cambió desde entonces: es lo más nuevo
      else wsCopyNode(node, html, 'recuperado');
      n++;
    });
  } catch(_){}
  if (n){ setTimeout(() => toast('Se recuperó lo último que escribiste antes de cerrar la pestaña'), 700); wsSchedule(true); }
}
async function wsSaveNow(){ clearTimeout(persistT); await wsSchedule(true); }                // «Guardar ahora»
function wsFlush(){ if (!Workspace.active) return; stash(); saveUi(); wsJournalWrite(); wsSchedule(true); }

/* ---- cambios hechos fuera de AtelierRoot ---- */
async function wsRefreshOnce(){
  const W = Workspace, be = W.be; if (!W.active) return;
  stash();
  const list = (await be.list(false)).filter(e => e.t === 'd' || wsIsMd(e.p)), now = {}; list.forEach(e => { now[e.p] = e; });
  const added = list.filter(e => !W.known[e.p]).sort((a, b) => a.p.split('/').length - b.p.split('/').length || a.p.localeCompare(b.p, 'es', { numeric: true }));
  const changed = list.filter(e => e.t === 'f' && W.known[e.p] && (W.known[e.p].m !== e.m || W.known[e.p].s !== e.s));
  const removed = Object.keys(W.known).filter(p => !now[p] && (wsIsMd(p) || W.known[p].t === 'd')).sort((a, b) => a.length - b.length);
  if (!added.length && !changed.length && !removed.length) return;
  let treeChanged = false, nodeAt = p => { let r = null; walk(state.tree, n => { if (n.path === p) r = n; }); return r; };
  // 1) cambió el contenido de un documento
  for (const e of changed){
    const n = nodeAt(e.p); if (!n) continue;
    let disk; try { disk = await be.read(e.p); } catch(_){ continue; }
    if (disk.text === W.text[e.p]){ W.known[e.p] = { t: 'f', m: disk.m, s: disk.s }; continue; }
    if (state.docs[n.id] !== W.saved[n.id] && wsMdText(state.docs[n.id]) !== wsMdText(W.saved[n.id])){
      wsCopyNode(n, wsHtml(disk.text), 'versión del disco');                                  // yo también lo había cambiado: la versión del disco pasa a una copia
      W.known[e.p] = { t: 'f', m: disk.m, s: disk.s }; W.text[e.p] = disk.text; treeChanged = true;
      toast('«' + n.name + '» cambió en el disco mientras lo editabas. Su versión quedó en una copia.');
    } else { wsAdoptDisk(n, disk); }
  }
  // 2) archivos y carpetas nuevos
  for (const e of added){
    if (W.known[e.p]) continue;
    const parent = wsDir(e.p) ? nodeAt(wsDir(e.p)) : null; if (wsDir(e.p) && !parent) continue;
    const host = parent ? (parent.children = parent.children || []) : state.tree;
    if (e.t === 'd'){ host.push({ id: wsIdFor(e.p), type: 'folder', name: wsBase(e.p), open: false, children: [], path: e.p }); W.known[e.p] = { t: 'd', m: 0, s: 0 }; treeChanged = true; continue; }
    let r; try { r = await be.read(e.p); } catch(_){ continue; }
    const id = wsIdFor(e.p), html = wsHtml(r.text);
    host.push({ id, type: 'doc', name: wsNoExt(wsBase(e.p)), mod: r.m, path: e.p });
    state.docs[id] = html; W.saved[id] = html; W.text[e.p] = r.text; W.known[e.p] = { t: 'f', m: r.m, s: r.s }; treeChanged = true;
  }
  // 3) archivos y carpetas que desaparecieron
  for (const p of removed){
    if (!W.known[p]) continue;
    const n = nodeAt(p); if (!n){ wsForget(p); continue; }
    let unsaved = false; walk([n], x => { if (x.type === 'doc' && state.docs[x.id] !== undefined && state.docs[x.id] !== W.saved[x.id] && wsMdText(state.docs[x.id]) !== wsMdText(W.saved[x.id])) unsaved = true; });
    if (unsaved){ walk([n], x => { delete x.path; }); wsForget(p); treeChanged = true; continue; }       // tenía cambios sin guardar: se vuelve a crear
    const gone = removeNode(n.id); const ids = []; walk([gone], x => { if (x.type === 'doc') ids.push(x.id); }); purgeDocs(ids); wsForget(p); treeChanged = true;
  }
  if (treeChanged){ wsSnapshot(); afterTreeChange(); wsSchedule(true); }
  else wsSnapshot();
}
function wsRefreshSoon(ms){
  const W = Workspace; if (!W.active) return;
  clearTimeout(W.refreshT);
  W.refreshT = setTimeout(() => { W.q = W.q.then(() => wsRefreshOnce()).catch(e => { if (e && e.code === 'offline') wsFail(e); else console.warn('refresco:', e); }); }, ms === undefined ? 250 : ms);
}
function wsStartWatching(){
  const W = Workspace; wsStopWatching();
  const trig = () => wsRefreshSoon(200);
  const stop = W.be.watch(trig);
  const onVis = () => { if (document.hidden) wsFlush(); else trig(); };
  document.addEventListener('visibilitychange', onVis); addEventListener('focus', trig); addEventListener('pagehide', wsFlush);
  W.stopWatch = () => { stop(); document.removeEventListener('visibilitychange', onVis); removeEventListener('focus', trig); removeEventListener('pagehide', wsFlush); };
}
function wsStopWatching(){ const W = Workspace; if (W.stopWatch){ W.stopWatch(); W.stopWatch = null; } }
