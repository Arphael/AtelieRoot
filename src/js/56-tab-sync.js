"use strict";
/* ====== 42. Guardado seguro entre pestañas ====== */
// Cada documento se guarda por separado y con un número de versión. Si otra pestaña cambió algo mientras tanto,
// los cambios se fusionan; si las dos tocaron el mismo documento a la vez, se conservan las dos versiones.
const Ui = {
  data: {},
  read(){ try { this.data = JSON.parse(localStorage.getItem('atelieroot.ui') || '{}') || {}; } catch(_){ this.data = {}; } },
  write(){
    try {
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem('atelieroot.ui') || '{}') || {}; } catch(_){}
      this.data.scroll = Object.assign({}, cur.scroll, this.data.scroll);
      localStorage.setItem('atelieroot.ui', JSON.stringify(this.data));
    } catch(_){}
  }
};
const Dirty = new Set();                                  // documentos tocados en esta pestaña
const Sync = { ready: false, meta: null, docs: {}, q: Promise.resolve(), del: new Set(), bc: null };

const IDB = {
  allDocs(){
    return DB.open().then(db => new Promise((res, rej) => {
      const r = db.transaction('kv', 'readonly').objectStore('kv').getAll(IDBKeyRange.bound('doc:', 'doc:\uffff'));
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    }));
  },
  putDoc(id, html, mod, baseRev){
    return DB.open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), s = t.objectStore('kv'), key = 'doc:' + id;
      let out;
      const g = s.get(key);
      g.onsuccess = () => {
        const remote = g.result;
        if (!remote || remote.rev === baseRev){
          const rev = (remote ? remote.rev : 0) + 1;
          s.put({ id, html, mod, rev }, key);
          out = { ok: true, rev };
        } else out = { ok: false, remote };
      };
      t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error || new Error('tx'));
    }));
  },
  delDoc(id, baseRev){
    return DB.open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), s = t.objectStore('kv'), key = 'doc:' + id;
      const g = s.get(key);
      g.onsuccess = () => { const remote = g.result; if (!remote || remote.rev === baseRev) s.delete(key); };
      t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error || new Error('tx'));
    }));
  },
  addIfAbsent(items){
    return DB.open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), s = t.objectStore('kv');
      items.forEach(([key, value]) => { const g = s.get(key); g.onsuccess = () => { if (g.result === undefined) s.put(value, key); }; });
      t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error || new Error('tx'));
    }));
  },
  mergeMeta(fn){
    return DB.open().then(db => new Promise((res, rej) => {
      const t = db.transaction('kv', 'readwrite'), s = t.objectStore('kv');
      let out;
      const g = s.get('meta');
      g.onsuccess = () => { out = fn(g.result || null); s.put(out, 'meta'); };
      t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error || new Error('tx'));
    }));
  }
};

/* ---- estructura (árbol, papelera, marcadores) ---- */
const emptyMeta = () => ({ v: 2, nodes: {}, trash: [], fills: {}, lastBackup: 0 });
const eqNode = (a, b) => (!a && !b) ? true : (!a || !b) ? false : a.type === b.type && a.name === b.name && a.parent === b.parent && a.ord === b.ord;
// orden con números intercalables: mover un elemento solo cambia ese elemento
function assignOrders(arr){
  let prev = -Infinity;
  for (let i = 0; i < arr.length; i++){
    const n = arr[i];
    if (typeof n.ord !== 'number' || !(n.ord > prev)){
      let next = Infinity;
      for (let j = i + 1; j < arr.length; j++){ if (typeof arr[j].ord === 'number' && arr[j].ord > prev){ next = arr[j].ord; break; } }
      n.ord = prev === -Infinity ? (next === Infinity ? 0 : next - 1) : (next === Infinity ? prev + 1 : (prev + next) / 2);
    }
    prev = n.ord;
  }
}
function assignAllOrders(){ assignOrders(state.tree); walk(state.tree, n => { if (n.children) assignOrders(n.children); }); }
function buildMeta(){
  assignAllOrders();
  const nodes = {};
  const rec = (arr, parent) => arr.forEach(n => { nodes[n.id] = { id: n.id, type: n.type, name: n.name, parent, ord: n.ord }; if (n.children) rec(n.children, n.id); });
  rec(state.tree, null);
  return { v: 2, nodes,
    trash: (state.trash || []).map(t => ({ id: t.id, node: t.node, parentId: t.parentId, at: t.at, docIds: t.docIds || [] })),
    fills: state.fills || {}, lastBackup: state.lastBackup || 0 };
}
function metaSig(m){
  if (!m) return '';
  return JSON.stringify([
    Object.keys(m.nodes).sort().map(k => { const n = m.nodes[k]; return [n.id, n.type, n.name, n.parent, n.ord]; }),
    (m.trash || []).map(t => t.id).sort(),
    Object.keys(m.fills || {}).sort().map(k => [k, Object.entries(m.fills[k] || {}).sort()]),
    m.lastBackup || 0
  ]);
}
// fusión de tres vías: base = lo último que esta pestaña vio en disco, ours = lo de esta pestaña, remote = lo que hay ahora
function merge3(base, ours, remote){
  base = base || emptyMeta(); remote = remote || emptyMeta();
  const out = { v: 2, nodes: {}, trash: [], fills: {}, lastBackup: Math.max(ours.lastBackup || 0, remote.lastBackup || 0) };
  const by = (arr, id) => (arr || []).find(t => t.id === id);
  const tids = new Set([...(base.trash || []), ...(ours.trash || []), ...(remote.trash || [])].map(t => t.id));
  tids.forEach(id => {
    const b = by(base.trash, id), o = by(ours.trash, id), r = by(remote.trash, id);
    if (o && r) out.trash.push(o);
    else if (o && !b) out.trash.push(o);        // lo añadimos aquí
    else if (r && !b) out.trash.push(r);        // lo añadieron en otra pestaña
  });                                           // lo demás lo quitó alguno de los dos lados
  out.trash.sort((x, y) => y.at - x.at);
  const inTrash = new Set();
  const collect = n => { inTrash.add(n.id); (n.children || []).forEach(collect); };
  out.trash.forEach(t => collect(t.node));
  const nids = new Set([...Object.keys(base.nodes), ...Object.keys(ours.nodes), ...Object.keys(remote.nodes)]);
  nids.forEach(id => {
    const b = base.nodes[id], o = ours.nodes[id], r = remote.nodes[id];
    const oc = !eqNode(o, b), rc = !eqNode(r, b);
    const pick = !oc ? r : (!rc ? o : o);       // si nadie más lo tocó, lo nuestro; si solo lo tocaron ellos, lo suyo
    if (pick && !inTrash.has(id)) out.nodes[id] = pick;
  });
  Object.keys(out.nodes).forEach(id => { const n = out.nodes[id]; if (n.parent && !out.nodes[n.parent]) out.nodes[id] = Object.assign({}, n, { parent: null }); });
  const feq = (a, b) => JSON.stringify(Object.entries(a || {}).sort()) === JSON.stringify(Object.entries(b || {}).sort());
  const fk = new Set([...Object.keys(base.fills || {}), ...Object.keys(ours.fills || {}), ...Object.keys(remote.fills || {})]);
  fk.forEach(k => { const pick = feq((ours.fills || {})[k], (base.fills || {})[k]) ? (remote.fills || {})[k] : ours.fills[k]; if (pick && Object.keys(pick).length) out.fills[k] = pick; });
  return out;
}
function applyMeta(m){
  const old = new Map(); walk(state.tree, n => old.set(n.id, n));
  const open = new Set(Ui.data.open || []);
  const kids = {};
  Object.values(m.nodes).forEach(r => { const k = r.parent || '#'; (kids[k] = kids[k] || []).push(r); });
  const build = key => (kids[key] || []).slice().sort((a, b) => (a.ord - b.ord) || (a.id < b.id ? -1 : 1)).map(r => {
    const n = old.get(r.id) || { id: r.id, open: open.has(r.id) };
    n.type = r.type; n.name = r.name; n.ord = r.ord;
    if (r.type === 'folder'){ n.children = build(r.id); if (n.open === undefined) n.open = false; } else delete n.children;
    if (r.type === 'doc' && Sync.docs[n.id] && Sync.docs[n.id].mod) n.mod = Sync.docs[n.id].mod;
    return n;
  });
  state.tree = build('#');
  state.trash = (m.trash || []).map(t => ({ id: t.id, node: t.node, parentId: t.parentId, at: t.at, docIds: t.docIds || [] }));
  state.fills = m.fills || {};
  state.lastBackup = Math.max(state.lastBackup || 0, m.lastBackup || 0);
}
function afterTreeChange(){
  renderTree(); updateTrashN(); updateBackupNote();
  if (state.current && !findNode(state.current)){
    const f = lastModifiedDoc() || firstDoc();
    if (f) openDoc(f); else { state.current = null; ed.innerHTML = '<p><br></p>'; }
  }
  splitCheck(); setPath();
}
function lastModifiedDoc(){
  let best = null;
  walk(state.tree, n => { if (n.type === 'doc' && n.mod && n.id in state.docs && (!best || n.mod > best.mod)) best = n; });
  return best ? best.id : null;
}
function purgeDocs(ids){ (ids || []).forEach(id => { delete state.docs[id]; Dirty.delete(id); Sync.del.add(id); }); }

/* ---- documentos ---- */
function refreshEditorsFor(id){
  const html = state.docs[id] || '<p><br></p>';
  const targets = [];
  if (state.current === id) targets.push({ el: ed, sc: scroll, act: true });
  if (split && panes[1 - active] && panes[1 - active].doc === id){ const p = panes[1 - active]; targets.push({ el: p.ed, sc: p.scroll, act: false }); }
  targets.forEach(t => {
    const y = t.sc.scrollTop;
    const caret = t.act && document.activeElement === t.el ? History.caret() : null;
    t.el.innerHTML = html;
    if (t.act){ ensureBlocks(); applyFolds(); renumberLists(true); History.init(); hlAll(true); if (caret != null) History.restoreCaret(caret); counts(); paintPreview(); sideRefresh(); }
    else t.el.querySelectorAll('.cb').forEach(cb => hlBlock(cb, true));
    t.sc.scrollTop = y;
  });
}
function adoptDoc(id, rec){
  state.docs[id] = rec.html;
  Sync.docs[id] = { html: rec.html, rev: rec.rev, mod: rec.mod || 0 };
  Dirty.delete(id);
  const n = findNode(id); if (n && rec.mod) n.mod = rec.mod;
  refreshEditorsFor(id);
}
function resolveDocConflict(id, remote){
  const ours = state.docs[id], base = Sync.docs[id];
  if (remote.html === ours){ Sync.docs[id] = { html: ours, rev: remote.rev, mod: remote.mod || 0 }; return; }
  if (base && base.html === ours){ adoptDoc(id, remote); return; }
  // las dos pestañas cambiaron el mismo documento: no se pierde nada, tu versión pasa a una copia
  const node = findNode(id);
  const cid = uid(), d = new Date();
  const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  state.docs[cid] = ours;
  placeNode({ id: cid, type: 'doc', name: (node ? node.name : 'Documento') + ' (conflicto ' + hh + ')', mod: Date.now() }, node, 'after');
  adoptDoc(id, remote);
  renderTree();
  toast(T('msg.tab-conflict', { name: node ? node.name : T('sync.the-doc') }));
}

/* ---- guardar ---- */
async function doPersist(){
  if (!Sync.ready) return;
  stash();
  for (let pass = 0; pass < 4; pass++){
    let again = false;
    for (const id of Object.keys(state.docs)){
      const html = state.docs[id], base = Sync.docs[id];
      if (html === undefined || (base && base.html === html)) continue;
      const node = findNode(id);
      const mod = node && node.mod !== undefined ? node.mod : (base ? base.mod : Date.now());
      if (node && node.mod === undefined) node.mod = mod;
      const r = await IDB.putDoc(id, html, mod, base ? base.rev : 0);
      if (r.ok) Sync.docs[id] = { html, rev: r.rev, mod };
      else { resolveDocConflict(id, r.remote); again = true; }
    }
    for (const id of [...Sync.del]){
      const base = Sync.docs[id];
      await IDB.delDoc(id, base ? base.rev : 0);
      delete Sync.docs[id]; Sync.del.delete(id);
    }
    const ours = buildMeta();
    if (metaSig(ours) !== metaSig(Sync.meta)){
      const merged = await IDB.mergeMeta(remote => merge3(Sync.meta, ours, remote));
      Sync.meta = merged;
      if (metaSig(merged) !== metaSig(ours)){ applyMeta(merged); afterTreeChange(); again = true; }
    }
    if (!again) break;
  }
  if (Sync.bc) { try { Sync.bc.postMessage(1); } catch(_){} }
  journalClear();
}
// Diario de seguridad: al ocultar o cerrar la pestaña se anota de forma síncrona lo que aún no llegó a disco.
// Si la pestaña desaparece antes de terminar de escribir, la próxima vez que se abra AtelieRoot se recupera.
const TAB_ID = Math.random().toString(36).slice(2, 8), JKEY = 'atelieroot.j.' + TAB_ID;
const anyDirty = () => Object.keys(state.docs).some(id => { const b = Sync.docs[id]; return state.docs[id] !== undefined && !(b && b.html === state.docs[id]); });
function journalWrite(){
  try {
    const j = {};
    Object.keys(state.docs).forEach(id => {
      const base = Sync.docs[id], html = state.docs[id];
      if (html === undefined || (base && base.html === html) || html.length > 1500000) return;
      j[id] = { html, rev: base ? base.rev : 0 };
    });
    if (Object.keys(j).length) localStorage.setItem(JKEY, JSON.stringify(j)); else localStorage.removeItem(JKEY);
  } catch(_){}
}
function journalClear(){ try { if (!anyDirty()) localStorage.removeItem(JKEY); } catch(_){} }
function recoverJournals(){
  let n = 0;
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (k && k.startsWith('atelieroot.j.') && k !== JKEY) keys.push(k); }
    keys.forEach(k => {
      let j = {}; try { j = JSON.parse(localStorage.getItem(k) || '{}'); } catch(_){}
      Object.keys(j).forEach(id => {
        const e = j[id], rec = Sync.docs[id];
        if (!rec || rec.html === e.html) return;
        if (rec.rev === e.rev){ state.docs[id] = e.html; n++; }
        else {                                   // otra pestaña escribió después: la versión anotada pasa a una copia
          const node = findNode(id), cid = uid();
          state.docs[cid] = e.html;
          placeNode({ id: cid, type: 'doc', name: (node ? node.name : 'Documento') + ' (recuperado)', mod: Date.now() }, node, 'after');
          n++;
        }
      });
      localStorage.removeItem(k);
    });
  } catch(_){}
  return n;
}
// al ocultar o cerrar la pestaña las escrituras se inician en ese mismo instante, antes de que el navegador la descarte
function flushNow(){
  if (Workspace.active){ wsFlush(); return; }
  if (!Sync.ready) return;
  stash(); saveUi(); journalWrite();
  Object.keys(state.docs).forEach(id => {
    const html = state.docs[id], base = Sync.docs[id];
    if (html === undefined || (base && base.html === html)) return;
    const node = findNode(id);
    const mod = node && node.mod !== undefined ? node.mod : (base ? base.mod : Date.now());
    IDB.putDoc(id, html, mod, base ? base.rev : 0).then(r => { if (r.ok) Sync.docs[id] = { html, rev: r.rev, mod }; journalClear(); }).catch(() => {});
  });
  const ours = buildMeta();
  if (metaSig(ours) !== metaSig(Sync.meta)) IDB.mergeMeta(remote => merge3(Sync.meta, ours, remote)).then(m => { Sync.meta = m; }).catch(() => {});
}
let persistT = 0, persistFirst = 0;
function schedulePersist(now){
  const t = Date.now(); if (!persistFirst) persistFirst = t;
  clearTimeout(persistT);
  persistT = setTimeout(runPersist, now ? 0 : Math.max(0, Math.min(300, 2500 - (t - persistFirst))));
}
function runPersist(){
  persistFirst = 0;
  if (Workspace.active){ wsSchedule(true); return; }          // con una carpeta abierta se guarda en ella (82-ws-core.js)
  if (!Sync.ready) return;
  Sync.q = Sync.q.then(doPersist).then(() => flag(T('msg.saved'))).catch(e => { console.error(e); flag(T('msg.save-error')); });
}
function saveUi(){
  const d = Ui.data;
  d.theme = state.theme; d.breaks = !!state.breaks; d.preview = !!state.preview; d.outline = !!state.outline; d.current = state.current; d.split = state.split || null;
  const open = []; walk(state.tree, n => { if (n.type === 'folder' && n.open) open.push(n.id); }); d.open = open;
  try { rememberScroll(active); } catch(_){}
  Ui.write();
}

/* ---- recibir cambios de otras pestañas ---- */
async function syncFromDb(){
  if (!Sync.ready) return;
  const [meta, docs] = await Promise.all([DB.get('meta'), IDB.allDocs()]);
  for (const rd of docs){
    if (Sync.del.has(rd.id)) continue;
    const base = Sync.docs[rd.id];
    if (base && base.rev === rd.rev) continue;
    const ours = state.docs[rd.id];
    if (ours === undefined || (base && ours === base.html)) adoptDoc(rd.id, rd);
    else if (ours === rd.html) Sync.docs[rd.id] = { html: ours, rev: rd.rev, mod: rd.mod || 0 };
    else resolveDocConflict(rd.id, rd);
  }
  if (meta && metaSig(meta) !== metaSig(Sync.meta)){
    const merged = merge3(Sync.meta, buildMeta(), meta);
    Sync.meta = meta;
    applyMeta(merged);
    afterTreeChange();
    if (metaSig(merged) !== metaSig(meta)) schedulePersist(true);
  }
}
let syncT = 0;
function queueSync(){ clearTimeout(syncT); syncT = setTimeout(() => { Sync.q = Sync.q.then(syncFromDb).catch(e => console.error(e)); }, 150); }
function startSync(){
  try { Sync.bc = new BroadcastChannel('atelieroot-sync'); Sync.bc.onmessage = queueSync; } catch(_){}
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushNow(); else queueSync();
  });
  addEventListener('pagehide', flushNow);
  addEventListener('focus', queueSync);
  schedulePersist(true);
}

/* ---- carga y migración ---- */
async function migrateLegacy(){
  const legacy = await DB.get('state');
  if (!legacy || !legacy.tree) return false;
  const nodes = {};
  const openIds = [];
  const rec = (arr, parent) => arr.forEach((n, i) => {
    nodes[n.id] = { id: n.id, type: n.type, name: n.name, parent, ord: i };
    if (n.type === 'folder' && n.open) openIds.push(n.id);
    if (n.children) rec(n.children, n.id);
  });
  rec(legacy.tree, null);
  const docs = Object.assign({}, legacy.docs || {});
  const trash = (legacy.trash || []).map(t => { Object.assign(docs, t.docs || {}); return { id: t.id, node: t.node, parentId: t.parentId, at: t.at, docIds: Object.keys(t.docs || {}) }; });
  const items = [['meta', { v: 2, nodes, trash, fills: legacy.fills || {}, lastBackup: legacy.lastBackup || 0 }], ['state_migrated', legacy]];
  Object.keys(docs).forEach(id => items.push(['doc:' + id, { id, html: docs[id], mod: 0, rev: 1 }]));
  await IDB.addIfAbsent(items);           // el bloque antiguo ('state') no se toca: queda como copia de seguridad
  Object.assign(Ui.data, { theme: legacy.theme, preview: !!legacy.preview, outline: !!legacy.outline, current: legacy.current, open: openIds, split: legacy.split || null });
  Ui.write();
  return true;
}
// Pestañas antiguas que siguen abiertas escriben en el formato viejo: lo que cambió después de migrar se recupera aquí
async function recoverLegacyEdits(){
  const [legacy, snap] = await Promise.all([DB.get('state'), DB.get('state_migrated')]);
  if (!legacy || !snap || !legacy.docs) return 0;
  const names = {}; walk(legacy.tree || [], n => { names[n.id] = n.name; });
  let n = 0;
  Object.keys(legacy.docs).forEach(id => {
    const now = legacy.docs[id], was = (snap.docs || {})[id];
    if (now === was) return;                                   // sin cambios desde la migración
    const rec = Sync.docs[id];
    if (rec && rec.html === now) return;
    if (rec && rec.html === was){ state.docs[id] = now; n++; }   // el disco nuevo no se tocó: se adopta lo escrito en la pestaña antigua
    else {                                                     // documento nuevo, o cambiado en los dos sitios: copia, sin pisar nada
      const cid = uid(), node = findNode(id);
      state.docs[cid] = now;
      placeNode({ id: cid, type: 'doc', name: (names[id] || 'Documento') + ' (recuperado)', mod: Date.now() }, node, node ? 'after' : 'root');
      n++;
    }
  });
  await DB.set('state_migrated', legacy);
  return n;
}
async function loadStore(){
  Ui.read();
  let meta = await DB.get('meta');
  if (!meta){ await migrateLegacy(); meta = await DB.get('meta'); }
  const docs = await IDB.allDocs();
  docs.forEach(d => { Sync.docs[d.id] = { html: d.html, rev: d.rev, mod: d.mod || 0 }; state.docs[d.id] = d.html; });
  await snapshotIfNewVersion(meta, docs);
  state.theme = Ui.data.theme || 'dark';
  state.preview = !!Ui.data.preview; state.outline = !!Ui.data.outline; state.breaks = !!Ui.data.breaks;
  state.current = null; state.split = Ui.data.split || null;     // el documento abierto lo decide el arranque, no se asume
  if (meta){
    Sync.meta = meta;
    applyMeta(meta);
    const td = trashDaysPlan(), old = td ? (state.trash || []).filter(t => Date.now() - t.at >= td * 86400000) : [];
    if (old.length){ old.forEach(t => purgeDocs(t.docIds)); state.trash = state.trash.filter(t => !old.includes(t)); }
  }
  const recovered = recoverJournals() + await recoverLegacyEdits();
  if (recovered) setTimeout(() => toast(T('msg.recovered')), 700);
  if (Ui.data.scroll){ const keep = {}; Object.keys(Ui.data.scroll).forEach(k => { if (state.docs[k] !== undefined) keep[k] = Ui.data.scroll[k]; }); Ui.data.scroll = keep; }
}

