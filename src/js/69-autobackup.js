"use strict";
/* ====== 60. Copia automática antes de actualizar ====== */
// La primera vez que se abre una versión nueva, se guarda aparte una copia de todo lo que había (en este mismo navegador).
// Se puede bajar como respaldo con el comando «Descargar la copia automática previa a la actualización».
const APP_VERSION = '2026-11-10';
async function snapKeys(){
  const db = await DB.open();
  return new Promise(res => {
    const r = db.transaction('kv', 'readonly').objectStore('kv').getAllKeys(IDBKeyRange.bound('snap:', 'snap:\uffff'));
    r.onsuccess = () => res((r.result || []).sort()); r.onerror = () => res([]);
  });
}
async function snapshotIfNewVersion(meta, docs){
  if (!meta) return;
  try {
    const prev = await DB.get('appver');
    if (prev === APP_VERSION) return;
    await DB.set('snap:' + String(Date.now()).padStart(15, '0'), { at: Date.now(), from: prev || 'anterior', meta, docs: docs.map(d => ({ id: d.id, html: d.html })) });
    const old = (await snapKeys()).slice(0, -2);                       // se conservan las dos últimas
    if (old.length){ const db = await DB.open(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); old.forEach(k => t.objectStore('kv').delete(k)); t.oncomplete = res; t.onerror = res; }); }
    await DB.set('appver', APP_VERSION);
  } catch(e){ console.error(e); }
}
function nestedFromMeta(meta){
  const kids = {};
  Object.values(meta.nodes).forEach(r => { const k = r.parent || '#'; (kids[k] = kids[k] || []).push(r); });
  const build = key => (kids[key] || []).slice().sort((a, b) => (a.ord - b.ord) || (a.id < b.id ? -1 : 1))
    .map(r => r.type === 'folder' ? { id: r.id, type: 'folder', name: r.name, open: false, children: build(r.id) } : { id: r.id, type: 'doc', name: r.name });
  return build('#');
}
async function downloadPreviousCopy(){
  const keys = await snapKeys();
  if (!keys.length) return toast(T('msg.no-autocopy'));
  const snap = await DB.get(keys[keys.length - 1]);
  const tree = nestedFromMeta(snap.meta), docs = {};
  const byId = Object.fromEntries(snap.docs.map(d => [d.id, d.html]));
  walk(tree, n => { if (n.type === 'doc') docs[n.id] = byId[n.id] || '<p><br></p>'; });
  download('atelierroot-copia-previa-' + new Date(snap.at).toISOString().slice(0, 10) + '.json', JSON.stringify({ v: 1, at: snap.at, tree, docs }, null, 1), 'application/json');
  toast(T('msg.autocopy-downloaded'));
}

