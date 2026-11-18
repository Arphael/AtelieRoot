"use strict";
/* ====== 90. Imágenes ====== */
// Pasting, dropping or choosing an image saves it as a file in assets/ next to the document and writes
// ![](assets/name.png): the Markdown stays standard and other editors show it too. In temporary mode the image
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
  const rel = 'assets/' + imgSlug(n.name) + '-' + imgStamp() + '-' + Math.random().toString(36).slice(2, 5) + '.' + ext;
  const full = imgFullPath(rel, n.id), blob = file.slice(0, file.size, file.type);
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
// right click on an image: copy the image itself (a chat receives it as an attachment)
async function copyImage(im){
  let blob = null; const full = im.getAttribute('data-md-src') ? imgFullPath(im.getAttribute('data-md-src'), state.current) : null;
  if (full && Img.cache.has(full)) blob = Img.cache.get(full).blob;
  try {
    if (!blob) blob = await (await fetch(im.src)).blob();
    if (blob.type !== 'image/png'){                                          // the clipboard only takes PNG
      const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0); blob = await new Promise(r => c.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(T('msg.img-copied'));
  } catch(e){ toast(T('msg.copy-failed')); }
}
let imgCtx = null;
[ed1, ed2].forEach(h => h.addEventListener('contextmenu', e => {
  const im = e.target.closest && e.target.closest('img'); if (!im) return;
  e.preventDefault(); imgCtx = im;
  document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
  ctxTarget = null;
  ctxMenu.innerHTML = '<button data-r="copyimg">' + esc(T('img.copy')) + '</button>';
  ctxMenu.classList.add('show');
  ctxMenu.style.left = Math.max(8, Math.min(innerWidth - ctxMenu.offsetWidth - 8, e.clientX)) + 'px';
  ctxMenu.style.top = Math.max(8, Math.min(innerHeight - ctxMenu.offsetHeight - 8, e.clientY)) + 'px';
}));
const imgRowAction = rowAction;
rowAction = (act, n) => { if (act === 'copyimg'){ if (imgCtx) copyImage(imgCtx); imgCtx = null; return; } return imgRowAction(act, n); };
