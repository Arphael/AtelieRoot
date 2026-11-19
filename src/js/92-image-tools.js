"use strict";
/* ====== 92. Herramientas de imagen ====== */
// Clicking an image shows a small bar: size (25/50/75/100 %, or drag the corner), alignment, rotate 90°, flip and
// crop. Size and alignment go in the Markdown as <img src width align> (GitHub and VS Code show them too); rotate,
// flip and crop write a new image file (the old one stays, so Ctrl+Z brings it back), so the change is the same
// everywhere the image is seen.
const IM = { im: null, crop: null };
const imIcon = d => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const imBar = document.createElement('div');
imBar.id = 'imgBar'; imBar.setAttribute('role', 'toolbar');
imBar.innerHTML =
  '<span class="im-main">' +
  ['w25', 'w50', 'w75', 'w100'].map(k => '<button class="tb im-w" data-im="' + k + '">' + k.slice(1) + '%</button>').join('') +
  '<span class="rd-sep"></span>' +
  '<button class="tb" data-im="left">' + imIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="18" x2="17" y2="18"/>') + '</button>' +
  '<button class="tb" data-im="center">' + imIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/>') + '</button>' +
  '<button class="tb" data-im="right">' + imIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="11" y1="12" x2="21" y2="12"/><line x1="7" y1="18" x2="21" y2="18"/>') + '</button>' +
  '<span class="rd-sep"></span>' +
  '<button class="tb" data-im="rot-l">' + imIcon('<path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/>') + '</button>' +
  '<button class="tb" data-im="rot-r">' + imIcon('<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>') + '</button>' +
  '<button class="tb" data-im="flip-h">' + imIcon('<line x1="12" y1="3" x2="12" y2="21"/><polygon points="9 7 4 12 9 17"/><polygon points="15 7 20 12 15 17"/>') + '</button>' +
  '<button class="tb" data-im="flip-v">' + imIcon('<line x1="3" y1="12" x2="21" y2="12"/><polygon points="7 9 12 4 17 9"/><polygon points="7 15 12 20 17 15"/>') + '</button>' +
  '<button class="tb" data-im="crop">' + imIcon('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>') + '</button>' +
  '</span><span class="im-crop">' +
  '<span class="im-hint"></span><button class="btn primary" data-im="crop-ok"></button><button class="btn" data-im="crop-no"></button>' +
  '</span>';
document.body.appendChild(imBar);
const imGrip = document.createElement('div'); imGrip.id = 'imgGrip'; document.body.appendChild(imGrip);
const imCropLayer = document.createElement('div'); imCropLayer.id = 'imgCrop'; imCropLayer.innerHTML = '<i></i>'; document.body.appendChild(imCropLayer);

function imLabels(){
  const t = { w25: 'img.w', w50: 'img.w', w75: 'img.w', w100: 'img.w-full', left: 'img.left', center: 'img.center', right: 'img.right', 'rot-l': 'img.rot-l', 'rot-r': 'img.rot-r', 'flip-h': 'img.flip-h', 'flip-v': 'img.flip-v', crop: 'img.crop' };
  imBar.querySelectorAll('[data-im]').forEach(b => { const k = b.dataset.im; if (t[k]){ const s = T(t[k], { n: k.slice(1) }); b.title = s; b.setAttribute('aria-label', s); } });
  imBar.querySelector('[data-im="crop-ok"]').textContent = T('img.crop-ok');
  imBar.querySelector('[data-im="crop-no"]').textContent = T('btn.cancel');
  imBar.querySelector('.im-hint').textContent = T('img.crop-hint');
  imGrip.title = T('img.drag');
}
function imPlace(){
  const im = IM.im;
  if (!im || !im.isConnected){ imHide(); return; }
  const r = im.getBoundingClientRect();
  imBar.classList.add('show');
  const top = r.top - imBar.offsetHeight - 8 > 8 ? r.top - imBar.offsetHeight - 8 : Math.min(innerHeight - imBar.offsetHeight - 8, r.bottom + 8);
  imBar.style.left = Math.max(8, Math.min(innerWidth - imBar.offsetWidth - 8, r.left)) + 'px';
  imBar.style.top = Math.max(8, top) + 'px';
  imGrip.classList.toggle('show', !IM.crop);
  imGrip.style.left = (r.right - 6) + 'px'; imGrip.style.top = (r.bottom - 6) + 'px';
  if (IM.crop){ Object.assign(imCropLayer.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
  ['left', 'center', 'right'].forEach(k => imBar.querySelector('[data-im="' + k + '"]').classList.toggle('on', (im.getAttribute('align') || 'left') === k));
}
function imShow(im){ IM.im = im; imCropEnd(); imLabels(); imPlace(); }
function imHide(){ IM.im = null; imCropEnd(); imBar.classList.remove('show'); imGrip.classList.remove('show'); }
const imHost = im => im && (ed1.contains(im) ? ed1 : ed2.contains(im) ? ed2 : null);

// size and alignment: attributes of the <img> (the Markdown writes them as HTML)
function imAttr(fn){
  const im = IM.im; if (!im) return;
  History.mark(); fn(im); after(); History.snap(true); imPlace();
}
function imWidth(pct){
  imAttr(im => { if (pct >= 100) im.removeAttribute('width'); else im.setAttribute('width', String(Math.max(1, Math.round((im.naturalWidth || im.width) * pct / 100)))); });
}
function imAlign(a){ imAttr(im => { if (a === 'left') im.removeAttribute('align'); else im.setAttribute('align', a); }); }

// rotate, flip, crop: a new file, the <img> points to it
async function imTransform(kind, box){
  const im = IM.im; if (!im) return;
  const docId = imgDocOf(imHost(im)), src = im.getAttribute('data-md-src');
  let blob = src ? await imgBlobOf(src, docId) : null;
  try { if (!blob) blob = await (await fetch(im.src)).blob(); } catch(_){ toast(T('msg.img-edit-failed')); return; }
  const bmp = await createImageBitmap(blob), w0 = bmp.width, h0 = bmp.height;
  const c = document.createElement('canvas'), x = c.getContext('2d');
  if (kind === 'rot-r' || kind === 'rot-l'){
    c.width = h0; c.height = w0;
    if (kind === 'rot-r'){ x.translate(h0, 0); x.rotate(Math.PI / 2); } else { x.translate(0, w0); x.rotate(-Math.PI / 2); }
    x.drawImage(bmp, 0, 0);
  } else if (kind === 'flip-h' || kind === 'flip-v'){
    c.width = w0; c.height = h0;
    if (kind === 'flip-h'){ x.translate(w0, 0); x.scale(-1, 1); } else { x.translate(0, h0); x.scale(1, -1); }
    x.drawImage(bmp, 0, 0);
  } else {                                                          // crop: box in 0..1 of the image
    const sx = Math.round(box.x * w0), sy = Math.round(box.y * h0), sw = Math.max(1, Math.round(box.w * w0)), sh = Math.max(1, Math.round(box.h * h0));
    c.width = sw; c.height = sh; x.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  const type = /^image\/(png|jpeg|webp)$/.test(blob.type) ? blob.type : 'image/png';
  const out = await new Promise(r => c.toBlob(r, type, 0.95));
  if (!out){ toast(T('msg.img-edit-failed')); return; }
  const prevDoc = state.current;
  if (docId && docId !== state.current) return;                     // the image tools work in the active editor
  const saved = await imgSave(new File([out], 'x.' + (IMG_EXT[type] || 'png'), { type }));
  if (!saved || state.current !== prevDoc || !im.isConnected) return;
  const ratio = im.getAttribute('width') ? +im.getAttribute('width') / w0 : 0;
  imAttr(i => {
    i.setAttribute('data-md-src', saved.rel); i.src = saved.url; i.removeAttribute('data-img-missing');
    if (ratio) i.setAttribute('width', String(Math.max(1, Math.round(ratio * c.width))));
  });
}

/* ---- crop: draw a box on the image ---- */
function imCropStart(){ if (!IM.im) return; IM.crop = { x: 0, y: 0, w: 1, h: 1, drag: null }; imBar.classList.add('cropping'); imCropLayer.classList.add('show'); imCropPaint(); imPlace(); }
function imCropEnd(){ IM.crop = null; imBar.classList.remove('cropping'); imCropLayer.classList.remove('show'); }
function imCropPaint(){ const b = IM.crop, i = imCropLayer.firstChild; Object.assign(i.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%' }); }
imCropLayer.addEventListener('pointerdown', e => {
  if (!IM.crop) return; e.preventDefault();
  const r = imCropLayer.getBoundingClientRect(), at = ev => [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))];
  const [x0, y0] = at(e);
  const move = ev => { const [x1, y1] = at(ev); Object.assign(IM.crop, { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }); imCropPaint(); };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
});

/* ---- size: drag the corner ---- */
imGrip.addEventListener('pointerdown', e => {
  const im = IM.im; if (!im) return; e.preventDefault();
  const r = im.getBoundingClientRect(), max = (im.closest('.ed') || ed).clientWidth;
  History.mark();
  const move = ev => { im.setAttribute('width', String(Math.round(Math.max(24, Math.min(max, r.width + ev.clientX - e.clientX))))); imPlace(); };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); after(); History.snap(true); imPlace(); };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
});

imBar.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
imBar.addEventListener('click', e => {
  const b = e.target.closest('[data-im]'); if (!b || !IM.im) return;
  const k = b.dataset.im;
  if (/^w\d+$/.test(k)) imWidth(+k.slice(1));
  else if (k === 'left' || k === 'center' || k === 'right') imAlign(k);
  else if (k === 'crop') imCropStart();
  else if (k === 'crop-no'){ imCropEnd(); imPlace(); }
  else if (k === 'crop-ok'){ const box = IM.crop; imCropEnd(); if (box && box.w > 0.01 && box.h > 0.01 && !(box.w > 0.99 && box.h > 0.99)) imTransform('crop', box).then(imPlace); else imPlace(); }
  else imTransform(k).then(imPlace);
});
[ed1, ed2].forEach(h => h.addEventListener('click', e => {
  const im = e.target.closest && e.target.closest('img');
  if (im && !Rd.on && h.getAttribute('contenteditable') !== 'false') imShow(im);
}));
document.addEventListener('mousedown', e => {
  if (!IM.im || e.target.closest('#imgBar,#imgGrip,#imgCrop')) return;
  if (e.target.closest && e.target.closest('img') === IM.im) return;
  imHide();
}, true);
document.addEventListener('keydown', e => {
  if (!IM.im) return;
  if (e.key === 'Escape'){ if (IM.crop){ imCropEnd(); imPlace(); } else imHide(); return; }
  if (e.key === 'Enter' && IM.crop){ e.preventDefault(); imBar.querySelector('[data-im="crop-ok"]').click(); return; }
  if (!/^(Control|Shift|Alt|Meta)$/.test(e.key)) imHide();
}, true);
[scroll1, scroll2].forEach(sc => sc.addEventListener('scroll', () => { if (IM.im) imPlace(); }, { passive: true }));
addEventListener('resize', () => { if (IM.im) imPlace(); });
document.addEventListener('langchange', imLabels);
const imOpenDoc = openDoc;
openDoc = id => { imHide(); return imOpenDoc(id); };
