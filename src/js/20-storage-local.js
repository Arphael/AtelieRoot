"use strict";
/* ====== 4. Almacenamiento ====== */
const DB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('atelierroot', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('kv', mode), q = fn(t.objectStore('kv'));
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  }));
  return { open, get: k => tx('readonly', s => s.get(k)), set: (k,v) => tx('readwrite', s => s.put(v,k)) };
})();
let state = { tree: [], docs: {}, current: null, theme: 'dark', lastBackup: 0, preview: false };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

