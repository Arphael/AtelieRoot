"use strict";
/* ====== 90. Imágenes ====== */
// Pasting, dropping or choosing an image saves it as a file in .atelieroot/assets/ (in the same folders as the
// document: notas/ideas.md -> .atelieroot/assets/notas/) and writes ![](../.atelieroot/assets/notas/name.png): the
// Markdown stays standard and other editors show it too. Images of v2.1 (assets/ next to the document) move there
// when the folder is opened. In temporary mode the image
// lives in this browser (IndexedDB). In the editor the <img> keeps that path in data-md-src and shows a blob: URL;
// copies and exports carry the image itself (a data: URL), so a chat such as Claude or Codex receives it.
const IMG_MAX = 10 * 1024 * 1024;
const IMG_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const Img = { cache: new Map() };                // full path -> { url (blob:), data (data:) }
const imgIsLocal = s => !!s && !/^(data:|blob:|https?:|mailto:)/i.test(s);
const ImgStore = window.__IMG_STORE || {           // temporary mode
  db(){ return new Promise((res, rej) => { const r = indexedDB.open('atelieroot-img', 1); r.onupgradeneeded = () => r.result.createObjectStore('b'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  // bytes + type, not a Blob: some engines (WebKit) cannot keep a Blob in IndexedDB
  async put(k, blob){ const v = { type: blob.type, buf: await blob.arrayBuffer() }, db = await this.db(); return new Promise((res, rej) => { const t = db.transaction('b', 'readwrite'); t.objectStore('b').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error || new Error('IndexedDB')); }); },
  async get(k){ const db = await this.db(); return new Promise((res, rej) => { const r = db.transaction('b').objectStore('b').get(k); r.onsuccess = () => { const v = r.result; res(v ? (v instanceof Blob ? v : new Blob([v.buf], { type: v.type })) : null); }; r.onerror = () => rej(r.error || new Error('IndexedDB')); }); },
};
// path of an image written in a document, from the folder of that document ("../x.png" works; leaving the folder does not)
function imgFullPath(src, docId){
  const n = findNode(docId), base = Workspace.active && n && n.path ? wsDir(n.path) : '';
  const out = base ? base.split('/') : [];
  for (const part of decodeURIComponent(src).split('/')){
    if (!part || part === '.') continue;
    if (part === '..'){ if (!out.length) return null; out.pop(); } else out.push(part);
  }
  return out.join('/');
}
const imgDataUrl = blob => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(blob); });
async function imgLoad(full){
  if (Img.cache.has(full)) return Img.cache.get(full);
  const ext = (full.match(/\.(\w+)$/) || [])[1], type = IMG_MIME[(ext || '').toLowerCase()];
  if (!type) return null;
  let blob = null;
  if (Workspace.active){ if (!Workspace.be.readBin) return null; blob = new Blob([await Workspace.be.readBin(full)], { type }); }
  else { const b = await ImgStore.get(full); if (b) blob = b; }
  if (!blob) return null;
  const v = { url: URL.createObjectURL(blob), data: await imgDataUrl(blob), blob };
  Img.cache.set(full, v); return v;
}
// shows the local images of an editor (run whenever images appear in it)
async function imgResolve(host, docId){
  const imgs = [...host.querySelectorAll('img')].filter(im => !im.hasAttribute('data-md-src') && imgIsLocal(im.getAttribute('src')));
  if (!imgs.length) return;
  const wasClean = host === ed && ed.innerHTML === History.last && !Dirty.has(docId);
  for (const im of imgs){
    const src = im.getAttribute('src'), full = imgFullPath(src, docId);
    im.setAttribute('data-md-src', src);
    im.removeAttribute('src');
    if (!full) continue;
    let v = null; try { v = await imgLoad(full); } catch(_){}
    if (v) im.src = v.url; else im.setAttribute('data-img-missing', '');
  }
  if (wasClean && host === ed && !Dirty.has(docId)) History.last = ed.innerHTML;     // showing an image is not an edit
}
// stored HTML keeps only the path (blob: URLs end with the session)
function imgUnresolve(html){
  if (!html || html.indexOf('data-md-src') < 0) return html;
  return html.replace(/<img\b[^>]*>/g, tag => {
    const m = tag.match(/ data-md-src="([^"]*)"/); if (!m) return tag;
    return tag.replace(/ src="[^"]*"/, '').replace(/ data-img-missing=""/, '').replace(m[0], ' src="' + m[1] + '"');
  });
}
const imgDocOf = host => host === ed ? state.current : (panes.find(p => p && p.ed === host) || {}).doc;
[ed1, ed2].forEach(host => new MutationObserver(() => {
  if (host.querySelector('img:not([data-md-src])')) imgResolve(host, imgDocOf(host));
}).observe(host, { childList: true, subtree: true }));
// copies and exports: the image itself
const imgOutside = forOutsideHtml;
forOutsideHtml = host => {
  host.querySelectorAll('img[data-md-src]').forEach(im => {
    const full = imgFullPath(im.getAttribute('data-md-src'), state.current), v = full && Img.cache.get(full);
    if (v && v.data) im.setAttribute('src', v.data); else im.setAttribute('src', im.getAttribute('data-md-src'));
    im.removeAttribute('data-md-src'); im.removeAttribute('data-img-missing');
  });
  return imgOutside(host);
};
const imgStash = stash;
stash = () => { imgStash(); const id = state.current; if (id && state.docs[id] !== undefined && Dirty.has(id)){ const h = imgUnresolve(state.docs[id]); if (h !== state.docs[id]) state.docs[id] = h; } };

// where the images of a document go: { full: path in the folder, rel: the same seen from the document }
// (with several folders open the first part of a path is the folder's label: each folder has its own .atelieroot/)
function imgAssetsOf(docPath, be){
  let label = '', p = docPath || '';
  if (p && be && be.multi){ const i = p.indexOf('/'); label = p.slice(0, i); p = p.slice(i + 1); }
  const dir = p ? wsDir(p) : '', sub = dir ? dir + '/' : '';
  return { full: (label ? label + '/' : '') + '.atelieroot/assets/' + sub, rel: '../'.repeat(dir ? dir.split('/').length : 0) + '.atelieroot/assets/' + sub };
}

/* ---- adding images ---- */
const imgSlug = s => (String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'imagen').slice(0, 40);
const imgStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
async function imgSave(file){
  const ext = IMG_EXT[file.type];
  if (!ext){ toast(T('msg.img-type')); return null; }
  if (file.size > IMG_MAX){ toast(T('msg.img-big', { n: 10 })); return null; }
  const W = Workspace;
  let n = findNode(state.current); if (!n) return null;
  if (W.active && !n.path){ stash(); await wsSchedule(true); n = findNode(state.current); if (!n || !n.path){ toast(T('ws.save-failed')); return null; } }
  if (W.active && !W.be.writeBin){ toast(T('msg.img-no-backend')); return null; }
  const name = imgSlug(n.name) + '-' + imgStamp() + '-' + Math.random().toString(36).slice(2, 5) + '.' + ext, at = imgAssetsOf(W.active ? n.path : '', W.be);
  const rel = at.rel + name, full = at.full + name, blob = file.slice(0, file.size, file.type);
  try {
    if (W.active) await W.be.writeBin(full, new Uint8Array(await blob.arrayBuffer()));
    else await ImgStore.put(full, blob);
  } catch(e){ toast(T('msg.img-failed', { why: (e && e.message) || String(e) })); return null; }
  const v = { url: URL.createObjectURL(blob), data: await imgDataUrl(blob), blob };
  Img.cache.set(full, v);
  return { rel, url: v.url };
}
async function insertImages(files, range){
  const list = [...files].filter(f => /^image\//.test(f.type)); if (!list.length) return false;
  if (Rd.on) return true;
  const saved = [];
  for (const f of list){ const r = await imgSave(f); if (r) saved.push(r); }
  if (!saved.length) return true;
  ed.focus({ preventScroll: true });
  if (range){ const s = getSelection(); s.removeAllRanges(); s.addRange(range); }
  History.mark();
  document.execCommand('insertHTML', false, saved.map(r => '<img alt="" data-md-src="' + esc(r.rel) + '" src="' + r.url + '">').join(''));
  after(); History.snap(true);
  toast(T(saved.length === 1 ? 'msg.img-added' : 'msg.img-added-n', { n: saved.length }));
  return true;
}
// a screenshot or a copied image: the clipboard has the image and no text (Word and web pages also send text: that paste stays as it was)
[ed1, ed2].forEach(h => h.addEventListener('paste', e => {
  const cd = e.clipboardData; if (!cd || !cd.files || !cd.files.length) return;
  if ((cd.getData('text/plain') || '').trim()) return;
  if (![...cd.files].some(f => /^image\//.test(f.type))) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const s = getSelection(), r = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  insertImages(cd.files, r);
}, true));
[ed1, ed2].forEach(h => h.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.items || []].some(i => i.kind === 'file')) e.preventDefault(); }));
[ed1, ed2].forEach(h => h.addEventListener('drop', e => {
  const files = e.dataTransfer && e.dataTransfer.files; if (!files || !files.length || ![...files].some(f => /^image\//.test(f.type))) return;
  e.preventDefault(); e.stopImmediatePropagation();
  let r = null;
  if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY);
  else if (document.caretPositionFromPoint){ const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p){ r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
  insertImages(files, r && ed.contains(r.startContainer) ? r : null);
}, true));
// the image button: a file from the computer, or an address as before
const imgPick = document.createElement('input'); imgPick.type = 'file'; imgPick.accept = 'image/png,image/jpeg,image/gif,image/webp'; imgPick.multiple = true; imgPick.hidden = true; document.body.appendChild(imgPick);
let imgPickRange = null;
imgPick.onchange = () => { const f = imgPick.files; if (f && f.length) insertImages(f, imgPickRange); imgPick.value = ''; };
const imgUrlBtn = $('#imgBtn').onclick;
$('#imgBtn').onclick = () => {
  const s = getSelection(); imgPickRange = ed.contains(s.anchorNode) && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  card.innerHTML = '<h2></h2><div class="btns" style="flex-direction:column;align-items:stretch;gap:8px"><button class="btn primary" data-f></button><button class="btn" data-u></button><button class="btn" data-no></button></div>';
  card.querySelector('h2').textContent = T('dlg.insert-image');
  card.querySelector('[data-f]').textContent = T('img.from-file');
  card.querySelector('[data-u]').textContent = T('img.from-url');
  card.querySelector('[data-no]').textContent = T('btn.cancel');
  card.querySelector('[data-f]').onclick = () => { veil.classList.remove('show'); imgPick.click(); };
  card.querySelector('[data-u]').onclick = () => { veil.classList.remove('show'); if (imgPickRange){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(imgPickRange); } imgUrlBtn(); };
  card.querySelector('[data-no]').onclick = () => veil.classList.remove('show');
  veil.classList.add('show');
};
// the clipboard only takes PNG
async function imgPng(blob){
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0); return new Promise(r => c.toBlob(r, 'image/png'));
}
async function imgBlobOf(src, docId){
  const full = imgIsLocal(src) ? imgFullPath(src, docId) : null;
  if (full){ const v = Img.cache.get(full) || await imgLoad(full).catch(() => null); if (v) return v.blob; }
  return null;
}
// right click on an image: copy the image itself (a chat receives it as an attachment)
async function copyImage(im){
  try {
    const blob = (im.getAttribute('data-md-src') && await imgBlobOf(im.getAttribute('data-md-src'), state.current)) || await (await fetch(im.src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await imgPng(blob) })]);
    toast(T('msg.img-copied'));
  } catch(e){ toast(T('msg.copy-failed')); }
}
// A copy of Markdown stays text only (a chat such as Claude in VS Code keeps only the image when the clipboard has
// both). With a folder open each local image gets its full path on the disk instead, so Claude Code opens the
// images itself: ![](<C:\\...\\.atelieroot\\assets\\notas\\x.png>). The document keeps its relative links.
const IMG_REF = /(!\[[^\]]*\]\()([^)\s]+)(\))|(<img\b[^>]*?\ssrc=")([^"]+)(")/g;
async function imgAbsText(text){
  const W = Workspace; if (!W.active || !W.be.absPath || !/!\[|<img\b/.test(text)) return text;
  const abs = new Map(); let out = '', last = 0, m;
  const re = new RegExp(IMG_REF.source, 'g');
  while ((m = re.exec(text))){
    const src = m[2] || m[5], full = imgIsLocal(src) ? imgFullPath(src, state.current) : null;
    let a = null;
    if (full){ if (!abs.has(full)) abs.set(full, await W.be.absPath(full)); a = abs.get(full); }
    out += text.slice(last, m.index) + (!a ? m[0] : m[2] ? m[1] + '<' + a + '>' + m[3] : m[4] + a + m[6]); last = re.lastIndex;
  }
  return out + text.slice(last);
}
const imgCopyText = copyText;
copyText = t => { if (!Workspace.active || !/!\[|<img\b/.test(t)) return imgCopyText(t); imgAbsText(t).then(x => imgCopyText(x), () => imgCopyText(t)); };
// Ctrl+C: 35-copy-sort-md.js fills the clipboard; its Markdown text is written again with the full paths
[ed1, ed2].forEach(h => h.addEventListener('copy', e => {
  if (!e.defaultPrevented || !e.clipboardData || !Workspace.active) return;
  const t = e.clipboardData.getData('text/plain'), html = e.clipboardData.getData('text/html');
  if (!t || !/!\[|<img\b/.test(t)) return;
  imgAbsText(t).then(x => {
    if (x === t || !navigator.clipboard || !window.ClipboardItem) return;
    const item = { 'text/plain': new Blob([x], { type: 'text/plain' }) };
    if (html) item['text/html'] = new Blob(['<meta charset="utf-8">' + html], { type: 'text/html' });
    return navigator.clipboard.write([new ClipboardItem(item)]);
  }).catch(() => {});
}));

/* ---- v2.1 -> v2.2: assets/ next to the documents moves to .atelieroot/assets/ ---- */
// Only the documents in a folder that has an assets/ folder are read; each local image they show from assets/ moves
// (never copied twice, never deleted) and its link is rewritten; the text of the document does not change. An
// assets/ folder left empty is removed (with anything else inside it stays).
async function imgMigrate(be){
  if (!be.readBin || !be.move) return;
  const list = await be.list(false);
  const assetDirs = list.filter(e => e.t === 'd' && e.p.split('/').pop() === 'assets');
  if (!assetDirs.length) return;
  const dirs = new Set(assetDirs.map(e => wsDir(e.p))), moved = new Map();
  for (const f of list.filter(e => e.t === 'f' && wsIsMd(e.p) && dirs.has(wsDir(e.p)))){
    let r; try { r = await be.read(f.p); } catch(_){ continue; }
    const dir = wsDir(f.p), at = imgAssetsOf(f.p, be);
    const fix = async src => {
      const clean = src.replace(/^\.\//, '');
      if (!/^assets\//.test(clean)) return src;
      const rest = decodeURIComponent(clean.slice(7)), from = (dir ? dir + '/' : '') + 'assets/' + rest;
      if (!moved.has(from)){
        try { await be.move(from, at.full + rest); moved.set(from, true); }
        catch(e){ if (e && e.code === 'exists') moved.set(from, true); else { moved.set(from, false); } }
      }
      return moved.get(from) ? at.rel + clean.slice(7) : src;
    };
    let text = r.text, out = '', last = 0;
    const re = /(!\[[^\]]*\]\()([^)\s]+)(\))|(<img\b[^>]*?\ssrc=")([^"]+)(")/g; let m;
    while ((m = re.exec(text))){
      const src = m[2] || m[5], nsrc = await fix(src);
      out += text.slice(last, m.index) + (m[2] ? m[1] + nsrc + m[3] : m[4] + nsrc + m[6]); last = re.lastIndex;
    }
    out += text.slice(last);
    if (out !== text){ try { await be.write(f.p, out, r.m); } catch(e){ console.warn('images: could not update', f.p, e); } }
  }
  for (const d of assetDirs){ try { await be.remove(d.p, false); } catch(_){ /* not empty: stays */ } }
}
const imgWsLoad = wsLoad;
wsLoad = async be => {
  if (be.migrateHidden){ try { await be.migrateHidden(); } catch(_){} }       // .atelierroot/ (v1) first, as wsLoad does
  try { await imgMigrate(be); } catch(e){ console.warn('images: migration', e); }
  return imgWsLoad(be);
};

/* ---- images no document uses go to the trash ---- */
// A few seconds after a save, every file in .atelieroot/assets/ that no document uses (in any open folder, in the
// open editors or in the undo steps of the document being edited) moves to .atelieroot/trash/images/ as
// name~<time>.ext; after the trash days (30 unless changed) it is deleted. Nothing outside .atelieroot/assets/
// is ever touched. If Ctrl+Z brings an image back later, it comes back from the trash.
const IMG_TRASH = '.atelieroot/trash/images/';
const imgIsImage = p => /\.(png|jpe?g|gif|webp)$/i.test(p);
// '.atelieroot/assets/notas/x.png' (or 'Label/.atelieroot/assets/...') -> [prefix, 'notas/x.png']
function imgAssetSplit(full){ const i = full.indexOf('.atelieroot/assets/'); return i < 0 ? null : [full.slice(0, i), full.slice(i + 19)]; }
function imgUsed(){
  const W = Workspace, used = new Set();
  const scan = (html, docId) => { const re = new RegExp(IMG_REF.source, 'g'); let m; while ((m = re.exec(html))){ const src = m[2] || m[5]; if (imgIsLocal(src)){ const f = imgFullPath(src, docId); if (f) used.add(f); } } };
  const htmlScan = (html, docId) => { const re = /<img\b[^>]*?\s(?:data-md-src|src)="([^"]+)"/g; let m; while ((m = re.exec(html))) if (imgIsLocal(m[1])){ const f = imgFullPath(m[1], docId); if (f) used.add(f); } };
  for (const id of Object.keys(state.docs)){ const h = state.docs[id]; if (typeof h === 'string'){ htmlScan(h, id); scan(h, id); } }
  htmlScan(ed1.innerHTML, imgDocOf(ed1)); htmlScan(ed2.innerHTML, imgDocOf(ed2));
  try { htmlScan(JSON.stringify([History.past, History.future]).replace(/\\"/g, '"'), state.current); } catch(_){}
  void W;
  return used;
}
async function imgSweep(){
  const W = Workspace; if (!W.active || !W.be.move || (W.lazy && W.lazy.size)) return;    // not while documents are still loading
  const list = await W.be.list(true), used = imgUsed(), now = Date.now(), days = trashDaysPlan();
  for (const e of list){
    if (e.t !== 'f' || !imgIsImage(e.p)) continue;
    const sp = imgAssetSplit(e.p);
    if (sp && !used.has(e.p)){
      const name = sp[1].replace(/(\.\w+)$/, '~' + now + '$1');
      try { await W.be.move(e.p, sp[0] + IMG_TRASH + name); Img.cache.delete(e.p); if (typeof imgTrashed !== 'undefined') imgTrashed.add(e.p); } catch(err){ console.warn('images: could not move to the trash', e.p, err); }
      continue;
    }
    const t = e.p.indexOf(IMG_TRASH), ts = t >= 0 ? +(e.p.match(/~(\d{10,})\.\w+$/) || [])[1] : 0;
    if (ts && days && now - ts >= days * 86400000){ try { await W.be.remove(e.p, false); } catch(_){} }
  }
}
let imgSweepT = 0;
const imgPersist = wsPersist;
wsPersist = async () => { await imgPersist(); clearTimeout(imgSweepT); imgSweepT = setTimeout(() => { Workspace.q = Workspace.q.then(imgSweep).catch(e => console.warn('images: sweep', e)); }, 4000); };
// an image that is missing (Ctrl+Z after it went to the trash): the newest copy in the trash comes back
async function imgFromTrash(full){
  const W = Workspace, sp = imgAssetSplit(full); if (!W.active || !sp || !W.be.move) return false;
  const base = sp[0] + IMG_TRASH + sp[1].replace(/(\.\w+)$/, ''), ext = (full.match(/\.\w+$/) || [''])[0];
  const hits = (await W.be.list(true)).filter(e => e.t === 'f' && e.p.startsWith(base + '~') && e.p.endsWith(ext) && /^~\d+$/.test(e.p.slice(base.length, e.p.length - ext.length)));
  if (!hits.length) return false;
  hits.sort((a, b) => b.p.localeCompare(a.p));
  try { await W.be.move(hits[0].p, full); return true; } catch(_){ return false; }
}
const imgLoad0 = imgLoad;
imgLoad = async full => {
  try { const v = await imgLoad0(full); if (v) return v; } catch(e){ if (!(await imgFromTrash(full))) throw e; return imgLoad0(full); }
  return (await imgFromTrash(full)) ? imgLoad0(full) : null;
};
// Ctrl+Z puts back an <img> whose file went to the trash in this session: the file comes back too
const imgTrashed = new Set();
[ed1, ed2].forEach(host => new MutationObserver(() => {
  if (!imgTrashed.size) return;
  host.querySelectorAll('img[data-md-src]').forEach(im => {
    const full = imgFullPath(im.getAttribute('data-md-src'), imgDocOf(host));
    if (full && imgTrashed.has(full)){ imgTrashed.delete(full); imgFromTrash(full).catch(() => {}); }
  });
}).observe(host, { childList: true, subtree: true }));
