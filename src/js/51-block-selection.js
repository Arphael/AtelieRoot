"use strict";
/* ====== 37. Selección y movimiento de bloques ====== */
const B = { sel: new Set(), anchor: null };
const blockEls = () => [...ed.children];
function clearBlockSel(){
  ed.querySelectorAll('[data-bsel]').forEach(x => x.removeAttribute('data-bsel'));
  B.sel.clear(); $('#bbar').classList.remove('show'); hide($('#convMenu'));
}
function setBlockSel(list){
  ed.querySelectorAll('[data-bsel]').forEach(x => x.removeAttribute('data-bsel'));
  B.sel = new Set(list);
  list.forEach(x => x.setAttribute('data-bsel', ''));
  if (!list.length){ $('#bbar').classList.remove('show'); return; }
  const s = getSelection(); s.removeAllRanges();
  ed.blur();
  paintBbar();
}
const selOrdered = () => withSections(blockEls().filter(x => B.sel.has(x)));
function paintBbar(){
  const list = selOrdered();
  if (!list.length){ $('#bbar').classList.remove('show'); return; }
  $('#bbN').textContent = list.length + (list.length === 1 ? ' bloque' : ' bloques');
  const bb = $('#bbar');
  bb.classList.add('show');
  const r = list[0].getBoundingClientRect(), sr = scroll.getBoundingClientRect();
  const w = bb.offsetWidth;
  bb.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  bb.style.top = Math.max(sr.top + 6, r.top - bb.offsetHeight - 8) + 'px';
}
scroll.addEventListener('scroll', () => { if (B.sel.size) paintBbar(); });
// operaciones sobre la selección
function blockOp(fn){
  const list = selOrdered();
  ed.querySelectorAll('[data-bsel]').forEach(x => x.removeAttribute('data-bsel'));
  History.mark();
  const keep = fn(list) || list;
  ensureBlocks(); after(); History.snap(true);
  const alive = keep.filter(x => x.isConnected);
  if (alive.length) setBlockSel(alive);
  else {
    clearBlockSel();
    if (afterDel && afterDel.isConnected){ ed.focus({ preventScroll: true }); caretInto(afterDel, true); }
    else { ed.focus({ preventScroll: true }); caretInto(ed.firstElementChild); }
    afterDel = null;
  }
}
function moveBlocks(list, dir){
  if (!list.length) return;
  if (dir < 0){
    let prev = list[0].previousElementSibling;
    while (prev && prev.hasAttribute('data-hid')) prev = prev.previousElementSibling;
    if (prev) prev.before(...list);
  } else {
    const next = list[list.length - 1].nextElementSibling;
    if (next) sectionEnd(next).after(...list);
  }
}
function copyBlocks(list){
  const host = document.createElement('div');
  list.forEach(x => { const c = x.cloneNode(true); c.removeAttribute('data-bsel'); host.appendChild(c); });
  copyText(withFills(tidyMd(mdFromDom(host))));
}
let afterDel = null;
function deleteBlocks(list){
  const next = list[list.length - 1].nextElementSibling || list[0].previousElementSibling;
  afterDel = next;
  list.forEach(x => x.remove());
  if (!ed.children.length) ed.innerHTML = '<p><br></p>';
  return [];
}
function convertBlocks(list, kind){
  if (kind === 'ul' || kind === 'ol' || kind === 'task'){
    const r = document.createRange();
    r.setStartBefore(list[0].firstChild || list[0]); r.setEndAfter(list[list.length - 1].lastChild || list[list.length - 1]);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    toggleList(kind); return [];
  }
  list.forEach(x => {
    let inner;
    if (x.tagName === 'UL' || x.tagName === 'OL') inner = [...x.querySelectorAll('li')].map(li => { const c = li.cloneNode(true); c.querySelectorAll('ul,ol').forEach(u => u.remove()); return c.innerHTML; }).join('<br>');
    else if (x.classList.contains('cb')) inner = esc((x.querySelector(SRC) || x).innerText.replace(/\n+$/, '')).replace(/\n/g, '<br>');
    else if (x.tagName === 'TABLE' || x.tagName === 'HR') return;
    else inner = x.innerHTML || '<br>';
    const tag = kind === 'quote' ? 'p' : kind;
    const el = document.createElement(tag);
    if (kind === 'quote') el.setAttribute('data-quote', '');
    el.innerHTML = inner;
    x.replaceWith(el);
  });
  return [];
}
$('#bbar').addEventListener('mousedown', e => e.preventDefault());
$('#bbar').addEventListener('click', e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  e.stopPropagation();
  const a = b.dataset.b;
  if (a === 'up') blockOp(l => { moveBlocks(l, -1); });
  if (a === 'down') blockOp(l => { moveBlocks(l, 1); });
  if (a === 'dup') blockOp(l => { const c = l.map(x => { const k = x.cloneNode(true); k.removeAttribute('data-bsel'); return k; }); l[l.length - 1].after(...c); return c; });
  if (a === 'copy'){ copyBlocks(selOrdered()); toast('Bloques copiados en Markdown'); }
  if (a === 'del'){ blockOp(deleteBlocks); toast('Bloques eliminados · Ctrl+Z para deshacer'); }
  if (a === 'conv') popup($('#convMenu'), b);
});
$('#convMenu').addEventListener('mousedown', e => e.preventDefault());
$('#convMenu').addEventListener('click', e => {
  e.stopPropagation();
  const c = e.target.closest('[data-c]'); if (!c) return;
  hide($('#convMenu'));
  blockOp(l => convertBlocks(l, c.dataset.c));
  clearBlockSel();
});
document.addEventListener('keydown', e => {
  if (!B.sel.size || veil.classList.contains('show')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape'){ e.preventDefault(); clearBlockSel(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); blockOp(deleteBlocks); return; }
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){ e.preventDefault(); blockOp(l => { moveBlocks(l, e.key === 'ArrowUp' ? -1 : 1); }); return; }
  if (mod && e.key.toLowerCase() === 'c'){ e.preventDefault(); copyBlocks(selOrdered()); toast('Bloques copiados en Markdown'); return; }
  if (mod && e.key.toLowerCase() === 'x'){ e.preventDefault(); copyBlocks(selOrdered()); blockOp(deleteBlocks); toast('Bloques cortados'); return; }
  if (mod && e.key.toLowerCase() === 'd'){ e.preventDefault(); $('#bbar [data-b="dup"]').click(); return; }
  if (e.key === 'Enter'){ e.preventDefault(); const l = selOrdered(); clearBlockSel(); ed.focus({ preventScroll: true }); caretInto(l[l.length - 1], true); return; }
  // moverse por la página no deshace la selección: las flechas y Av Pág/Re Pág desplazan; con Mayús + ↑/↓ la selección crece
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){ e.preventDefault(); if (e.shiftKey) extendBlockSel(e.key === 'ArrowUp' ? -1 : 1); else scroll.scrollBy({ top: (e.key === 'ArrowUp' ? -1 : 1) * 70 }); return; }
  if (e.key === 'PageUp' || e.key === 'PageDown'){ e.preventDefault(); scroll.scrollBy({ top: (e.key === 'PageUp' ? -1 : 1) * scroll.clientHeight * 0.9 }); return; }
  if (e.key === 'Home' || e.key === 'End'){ e.preventDefault(); scroll.scrollTo({ top: e.key === 'Home' ? 0 : scroll.scrollHeight }); return; }
  if (e.key.startsWith('Arrow') || e.key.length === 1) clearBlockSel();
}, true);
// Alt+↑/↓ con el cursor: mueve la línea, el punto de lista o el bloque donde está el cursor
ed.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tableRect()){ e.preventDefault(); tableAction(e.key === 'ArrowLeft' ? 'mvL' : 'mvR'); return; }   // dentro de una tabla, mueve columnas
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  moveCaretUnit(e.key === 'ArrowUp' ? -1 : 1);
});
// selección con rectángulo desde el margen. El punto de partida se ancla al DOCUMENTO, no a la pantalla: se puede desplazar la página
// durante el arrastre (con la rueda o llevando el ratón al borde) y los bloques de antes siguen seleccionados.
const band = $('#band');
let bandStart = null, bandRaf = 0;
scroll.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('.ed') || e.target.closest('#tableBar,#findBar,#bhandle,#fbtn,.menu,.pane-head')) return;
  if (!(e.target === scroll || e.target.classList.contains('wrapc'))) return;
  if (e.offsetX > scroll.clientWidth) return; // barra de desplazamiento
  e.preventDefault();
  bandStart = { x: e.clientX, y: e.clientY, st: scroll.scrollTop, mx: e.clientX, my: e.clientY, moved: false };
});
function bandUpdate(){
  if (!bandStart || !bandStart.moved) return;
  const sr = scroll.getBoundingClientRect();
  const startY = bandStart.y - (scroll.scrollTop - bandStart.st);          // dónde está ahora, en pantalla, el punto donde empezó el arrastre
  const x1 = Math.min(bandStart.x, bandStart.mx), x2 = Math.max(bandStart.x, bandStart.mx);
  const y1 = Math.min(startY, bandStart.my), y2 = Math.max(startY, bandStart.my);
  const dy1 = Math.max(y1, sr.top), dy2 = Math.min(y2, sr.bottom);
  Object.assign(band.style, { display: 'block', left: x1 + 'px', top: dy1 + 'px', width: (x2 - x1) + 'px', height: Math.max(0, dy2 - dy1) + 'px' });
  const hit = blockEls().filter(b => { const r = b.getBoundingClientRect(); return r.height > 0 && r.bottom >= y1 && r.top <= y2; });
  ed.querySelectorAll('[data-bsel]').forEach(x => x.removeAttribute('data-bsel'));
  hit.forEach(x => x.setAttribute('data-bsel', ''));
  B.sel = new Set(hit);
}
function bandAuto(){                                                        // se desplaza sola al acercar el ratón al borde de arriba o de abajo
  if (bandRaf || !bandStart) return;
  const step = () => {
    bandRaf = 0;
    if (!bandStart || !bandStart.moved) return;
    const sr = scroll.getBoundingClientRect(), y = bandStart.my, zone = 48;
    let v = 0;
    if (y < sr.top + zone) v = -Math.ceil((sr.top + zone - y) / 4);
    else if (y > sr.bottom - zone) v = Math.ceil((y - (sr.bottom - zone)) / 4);
    if (v){ scroll.scrollTop += v; bandUpdate(); }
    bandRaf = requestAnimationFrame(step);
  };
  bandRaf = requestAnimationFrame(step);
}
addEventListener('mousemove', e => {
  if (!bandStart) return;
  bandStart.mx = e.clientX; bandStart.my = e.clientY;
  if (!bandStart.moved && Math.abs(e.clientX - bandStart.x) + Math.abs(e.clientY - bandStart.y) < 6) return;
  bandStart.moved = true;
  bandUpdate(); bandAuto();
});
scroll.addEventListener('scroll', () => { if (bandStart && bandStart.moved) bandUpdate(); });
function bandEnd(){
  if (!bandStart) return;
  const moved = bandStart.moved;
  bandStart = null; band.style.display = 'none'; cancelAnimationFrame(bandRaf); bandRaf = 0;
  if (moved && B.sel.size) setBlockSel(selOrdered());
  else if (!moved){ clearBlockSel(); }
}
addEventListener('mouseup', bandEnd);
addEventListener('blur', bandEnd);
ed.addEventListener('mousedown', () => { if (B.sel.size) clearBlockSel(); });
// asa ⋮⋮: aparece junto al bloque bajo el ratón
const handle = $('#bhandle'), bline = $('#bline');
let hBlock = null, drag = null;
function blockAtY(y){
  const list = blockEls();
  for (const b of list){ if (b.hasAttribute('data-hid')) continue; const r = b.getBoundingClientRect(); if (y >= r.top - 6 && y <= r.bottom + 6) return b; }
  return null;
}
function placeHandle(b){
  const r = b.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
  const lh = parseFloat(getComputedStyle(b).lineHeight) || 24;
  handle.style.left = (r.left - sr.left + scroll.scrollLeft - 26) + 'px';
  handle.style.top = (r.top - sr.top + scroll.scrollTop + Math.max(0, (Math.min(lh, r.height) - 24) / 2)) + 'px';
  handle.classList.add('show');
}
scroll.addEventListener('mousemove', e => {
  if (drag || bandStart || innerWidth <= 600) return;
  if (e.target === handle) return;
  const er = ed.getBoundingClientRect();
  if (e.clientX < er.left - 60 || e.clientX > er.right + 20){ handle.classList.remove('show'); hBlock = null; return; }
  const b = blockAtY(e.clientY);
  if (!b){ handle.classList.remove('show'); hBlock = null; return; }
  if (b !== hBlock){ hBlock = b; placeHandle(b); }
});
scroll.addEventListener('mouseleave', () => { if (!drag) handle.classList.remove('show'); });
handle.addEventListener('mousedown', e => {
  if (!hBlock) return;
  e.preventDefault(); e.stopPropagation();
  drag = { y: e.clientY, moved: false, blocks: B.sel.has(hBlock) ? selOrdered() : withSections([hBlock]), target: undefined, shift: e.shiftKey };
});
addEventListener('mousemove', e => {
  if (!drag) return;
  if (!drag.moved && Math.abs(e.clientY - drag.y) < 5) return;
  if (!drag.moved){ drag.moved = true; document.body.classList.add('bdrag'); drag.blocks.forEach(x => x.style.opacity = '.45'); }
  const list = blockEls().filter(x => !drag.blocks.includes(x) && !x.hasAttribute('data-hid'));
  let before = null;
  for (const b of list){ const r = b.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2){ before = b; break; } }
  drag.target = before;
  const sr = scroll.getBoundingClientRect(), er = ed.getBoundingClientRect();
  let y;
  if (before) y = before.getBoundingClientRect().top - 7;
  else { const last = list[list.length - 1]; y = last ? last.getBoundingClientRect().bottom + 5 : er.top; }
  Object.assign(bline.style, { display: 'block', left: (er.left - sr.left + scroll.scrollLeft) + 'px', width: er.width + 'px', top: (y - sr.top + scroll.scrollTop) + 'px' });
  if (e.clientY < sr.top + 40) scroll.scrollTop -= 12;
  else if (e.clientY > sr.bottom - 40) scroll.scrollTop += 12;
});
addEventListener('mouseup', () => {
  if (!drag) return;
  const d = drag; drag = null;
  document.body.classList.remove('bdrag'); bline.style.display = 'none';
  d.blocks.forEach(x => x.style.opacity = '');
  if (!d.moved){
    // clic en el asa: selecciona el bloque; con Shift amplía la selección
    if (d.shift && B.anchor && B.anchor.isConnected){
      const all = blockEls(), a = all.indexOf(B.anchor), b = all.indexOf(hBlock);
      setBlockSel(all.slice(Math.min(a, b), Math.max(a, b) + 1));
    } else { B.anchor = hBlock; setBlockSel([hBlock]); }
    return;
  }
  ed.querySelectorAll('[data-bsel]').forEach(x => x.removeAttribute('data-bsel'));
  History.mark();
  if (d.target) d.blocks.forEach(x => d.target.before(x));
  else d.blocks.forEach(x => ed.appendChild(x));
  after(); History.snap(true);
  setBlockSel(d.blocks);
  if (hBlock) placeHandle(hBlock);
});

