"use strict";
/* ====== 38. Plegar secciones ====== */
// Un encabezado con data-fold oculta lo que hay debajo hasta el siguiente encabezado de su nivel o superior.
// Solo cambia la vista: copiar y exportar incluyen siempre todo el texto.
const headLevel = el => { const m = /^H([1-6])$/.exec(el.tagName); return m ? +m[1] : 0; };
function applyFolds(){
  let foldLvl = 0;
  for (const el of ed.children){
    const lvl = headLevel(el);
    if (!lvl && el.hasAttribute('data-fold')) el.removeAttribute('data-fold');
    if (foldLvl && lvl && lvl <= foldLvl) foldLvl = 0;
    if (foldLvl){ el.setAttribute('data-hid', ''); continue; }
    el.removeAttribute('data-hid');
    if (lvl && el.hasAttribute('data-fold')) foldLvl = lvl;
  }
}
// bloques ocultos que pertenecen a un encabezado plegado
function sectionEnd(el){
  let end = el;
  if (el.hasAttribute('data-fold')){ let n = el.nextElementSibling; while (n && n.hasAttribute('data-hid')){ end = n; n = n.nextElementSibling; } }
  return end;
}
function withSections(list){
  const out = [];
  list.forEach(el => {
    if (!out.includes(el)) out.push(el);
    if (el.hasAttribute('data-fold')){ let n = el.nextElementSibling; while (n && n.hasAttribute('data-hid')){ if (!out.includes(n)) out.push(n); n = n.nextElementSibling; } }
  });
  return out;
}
// abre los plegados que esconden un nodo (al buscar o saltar desde el esquema)
function unfoldFor(node){
  let blk = node && node.nodeType === 3 ? node.parentElement : node;
  while (blk && blk.parentElement !== ed) blk = blk.parentElement;
  let guard = 0;
  while (blk && blk.hasAttribute('data-hid') && guard++ < 12){
    let p = blk.previousElementSibling;
    while (p && !(headLevel(p) && p.hasAttribute('data-fold') && !p.hasAttribute('data-hid'))) p = p.previousElementSibling;
    if (!p) break;
    p.removeAttribute('data-fold'); applyFolds();
  }
  stash(); save();
}
function sectionHeadOf(el){
  // encabezado que encabeza la sección donde está el bloque
  if (headLevel(el)) return el;
  let p = el.previousElementSibling;
  while (p && !headLevel(p)) p = p.previousElementSibling;
  return p;
}
function toggleFold(h, force){
  if (!h || !headLevel(h)) return;
  const on = force === undefined ? !h.hasAttribute('data-fold') : force;
  if (on) h.setAttribute('data-fold', ''); else h.removeAttribute('data-fold');
  Dirty.add(state.current); applyFolds(); stash(); save(); paintOutline();
  if (on){ const s = getSelection(); if (s.rangeCount && ed.contains(s.anchorNode)){ const b = currentBlock(); if (b && b.hasAttribute('data-hid')) caretInto(h, true); } }
  if (fHead === h) paintFbtn();
}
function foldAll(on){
  [...ed.children].forEach(h => { if (headLevel(h)){ if (on) h.setAttribute('data-fold', ''); else h.removeAttribute('data-fold'); } });
  applyFolds(); stash(); save();
  if (on){ const b = currentBlock(); if (b && b.hasAttribute('data-hid')) caretInto(sectionHeadOf(b) || ed.firstElementChild, true); }
  toast(T(on ? 'msg.all-folded' : 'msg.all-unfolded'));
}
// botón de plegado junto al encabezado bajo el ratón
const fbtn = $('#fbtn');
let fHead = null;
// táctil o ventana estrecha: no hay pasar-el-ratón, así que la flecha vive en el margen del encabezado
const foldTouch = matchMedia('(hover: none), (max-width: 600px)');
foldTouch.addEventListener('change', () => { fHead = null; fbtn.classList.remove('show'); });
function paintFbtn(){
  if (!fHead || !fHead.isConnected){ fbtn.classList.remove('show'); return; }
  const r = fHead.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(fHead).lineHeight) || 28;
  fbtn.style.left = (r.left - sr.left + scroll.scrollLeft - 48) + 'px';
  fbtn.style.top = (r.top - sr.top + scroll.scrollTop + Math.max(0, (Math.min(lh, r.height) - 24) / 2)) + 'px';
  fbtn.classList.toggle('folded', fHead.hasAttribute('data-fold'));
  fbtn.classList.add('show');
}
scroll.addEventListener('mousemove', e => {
  if (foldTouch.matches || e.target === fbtn || fbtn.contains(e.target)) return;
  const b = blockAtY(e.clientY);
  const er = ed.getBoundingClientRect();
  const h = b && headLevel(b) && e.clientX > er.left - 70 && e.clientX < er.right + 20 ? b : null;
  if (h !== fHead){ fHead = h; paintFbtn(); }
});
scroll.addEventListener('mouseleave', () => { fHead = null; fbtn.classList.remove('show'); });
fbtn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
fbtn.addEventListener('click', e => { e.stopPropagation(); if (fHead){ History.mark(); toggleFold(fHead); } });
// flecha del margen (táctil/estrecho): un toque a la izquierda del encabezado lo pliega
function gutterHeading(e){
  const h = e.target && e.target.closest ? e.target.closest('h1,h2,h3,h4,h5,h6') : null;
  return h && ed.contains(h) && e.clientX < h.getBoundingClientRect().left ? h : null;
}
ed.addEventListener('mousedown', e => { if (foldTouch.matches && gutterHeading(e)) e.preventDefault(); }, true);
ed.addEventListener('click', e => {
  if (!foldTouch.matches) return;
  const h = gutterHeading(e);
  if (h){ e.preventDefault(); History.mark(); toggleFold(h); }
});
ed.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '.'){
    e.preventDefault();
    const b = currentBlock();
    toggleFold(b && sectionHeadOf(b));
  }
});

