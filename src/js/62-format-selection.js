"use strict";
/* ====== 49. Formato sobre toda la selección ====== */
// Cada acción de formato se aplica bloque a bloque: párrafos, encabezados, citas, puntos de lista y celdas que toque la selección.
const TEXT_BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,td,th';
const INLINE_ALL = 'strong,b,em,i,s,del,strike,code,a,span,font,u,mark';
// contenido propio de un bloque: un punto de lista no incluye sus sublistas
function ownRange(el){
  const rg = document.createRange(); rg.selectNodeContents(el);
  if (el.tagName === 'LI'){ const sub = [...el.children].find(c => c.tagName === 'UL' || c.tagName === 'OL'); if (sub) rg.setEndBefore(sub); }
  return rg;
}
// partes de la selección que caen en cada bloque de texto
function selectedTextBlocks(r){
  const out = [];
  ed.querySelectorAll(TEXT_BLOCKS).forEach(el => {
    if (el.closest('.cb') || !r.intersectsNode(el)) return;
    const own = ownRange(el);
    if (r.compareBoundaryPoints(Range.START_TO_START, own) > 0) own.setStart(r.startContainer, r.startOffset);
    if (r.compareBoundaryPoints(Range.END_TO_END, own) < 0) own.setEnd(r.endContainer, r.endOffset);
    out.push({ el, range: own });
  });
  const tr = tableRect();
  if (tr && tr.multi){                                           // varias celdas: el formato va a todas las del rectángulo
    const keep = out.filter(x => !/^T[DH]$/.test(x.el.tagName) || !tr.tbl.contains(x.el));
    tr.cells.forEach(c => keep.push({ el: c, range: ownRange(c) }));
    keep.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    return keep;
  }
  return out;
}
const rangeHasText = rg => !rg.collapsed && !!rg.toString().replace(/\u200b/g, '').trim();
// bloques de primer nivel que toca la selección (uno solo si no hay selección). Si la selección termina justo al inicio de un bloque, ese no cuenta.
function touchedTops(){
  const s = getSelection();
  if (!s.rangeCount) return [];
  const r = s.getRangeAt(0);
  if (s.isCollapsed){ const b = currentBlock(); return b ? [b] : []; }
  return [...ed.children].filter(b => {
    if (!r.intersectsNode(b)) return false;
    const rg = document.createRange(); rg.selectNodeContents(b);
    if (r.compareBoundaryPoints(Range.START_TO_START, rg) > 0) rg.setStart(r.startContainer, r.startOffset);
    if (r.compareBoundaryPoints(Range.END_TO_END, rg) < 0) rg.setEnd(r.endContainer, r.endOffset);
    if (rg.toString().replace(/\u200b/g, '')) return true;
    return !!rg.cloneContents().querySelector('br,img,hr,table');           // un bloque vacío o con imagen sí cuenta si queda dentro
  });
}
// cambia el tipo de un bloque moviendo su contenido: no se pierde ningún nodo ni la selección
function retag(el, tag, keep){
  const n = document.createElement(tag);
  (keep || []).forEach(a => { if (el.hasAttribute(a)) n.setAttribute(a, el.getAttribute(a)); });
  while (el.firstChild) n.appendChild(el.firstChild);
  if (!n.firstChild) n.innerHTML = '<br>';
  el.replaceWith(n);
  return n;
}
const capSel = () => { const s = getSelection(); if (!s.rangeCount) return null; const r = s.getRangeAt(0); return { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset }; };
function restoreMapped(pt, map){
  if (!pt) return;
  const m = (c, o) => map.has(c) ? [map.get(c), o] : [c, o];
  const [sc, so] = m(pt.sc, pt.so), [ec, eo] = m(pt.ec, pt.eo);
  try { const rr = document.createRange(); rr.setStart(sc, so); rr.setEnd(ec, eo); const s = getSelection(); s.removeAllRanges(); s.addRange(rr); } catch(_){}
}
function textOffsetIn(el, node, off){
  const r = document.createRange(); r.selectNodeContents(el);
  try { r.setEnd(node, off); } catch(_){ return 0; }
  return r.toString().length;
}
function setCaretByOffset(el, off){
  let count = 0, done = false; const s = getSelection();
  const walk = n => {
    if (done) return;
    if (n.nodeType === 3){
      if (count + n.length >= off){ const r = document.createRange(); r.setStart(n, off - count); r.collapse(true); s.removeAllRanges(); s.addRange(r); done = true; }
      else count += n.length;
    } else n.childNodes.forEach(walk);
  };
  walk(el);
  if (!done) caretInto(el, true);
}

/* ---- formato en línea sobre varios bloques ---- */
// quita el formato solo de lo seleccionado; si la selección está dentro de uno o varios elementos con ese formato, los parte
function removeFormat(r, sel){
  const edges = [closestFrom(r.startContainer, sel), closestFrom(r.endContainer, sel)].filter(Boolean);   // pueden quedar vacíos tras sacar el texto
  const frag = r.extractContents();
  frag.querySelectorAll(sel).forEach(el => el.replaceWith(...el.childNodes));
  const first = frag.firstChild, last = frag.lastChild;
  let c = r.startContainer, o = r.startOffset, anc;
  const made = [];
  while ((anc = closestFrom(c, sel))){
    const tail = document.createRange(); tail.setStart(c, o); tail.setEnd(anc, anc.childNodes.length);
    const clone = anc.cloneNode(false); clone.appendChild(tail.extractContents());
    anc.after(clone); made.push(anc, clone);
    c = anc.parentNode; o = [...c.childNodes].indexOf(anc) + 1;
  }
  const ins = document.createRange(); ins.setStart(c, o); ins.collapse(true); ins.insertNode(frag);
  [...made, ...edges].forEach(x => { if (x.isConnected && isBlankNode(x)) x.remove(); });
  selectBetween(first, last);
  return [first, last];
}
function applyFormat(r, tag, sel){
  const frag = r.extractContents();
  frag.querySelectorAll(sel).forEach(x => x.replaceWith(...x.childNodes));     // un solo formato, sin anidar
  let first, last;
  if (closestFrom(r.startContainer, sel)){                                    // empezó dentro de uno igual: se une a él
    first = frag.firstChild; last = frag.lastChild;
    r.insertNode(frag);
  } else {
    const el = makeFmtEl(tag);
    el.appendChild(frag);
    first = el.firstChild; last = el.lastChild;
    r.insertNode(el);
    // si queda pegado a otro elemento con el mismo formato, se unen en uno solo
    const prev = el.previousSibling, next = el.nextSibling;
    if (prev && prev.nodeType === 1 && prev.matches(sel)){ while (el.firstChild) prev.appendChild(el.firstChild); el.remove(); }
    const host = prev && prev.nodeType === 1 && prev.matches(sel) ? prev : el;
    if (next && next.nodeType === 1 && next.matches(sel) && host.isConnected){ while (next.firstChild) host.appendChild(next.firstChild); next.remove(); }
  }
  selectBetween(first, last);
  return [first, last];
}
function toggleWrap(tag){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast(T('msg.select-first'));
  const sel = FMT_SEL[tag] || tag, r = s.getRangeAt(0);
  if (s.isCollapsed){
    const el = closestFrom(r.startContainer, sel);
    if (!el || closestFrom(r.startContainer, '.cb')) return toast(T('msg.select-first'));
    History.mark();
    if (caretAtEnd(el, r)) exitFormat(el); else unwrapKeepingCaret(el, r);   // al final: se sale; en medio: se quita
    after(); History.snap(true); refreshBar(); return;
  }
  const parts = selectedTextBlocks(r).filter(x => rangeHasText(x.range));
  if (!parts.length) return toast(T('msg.select-first'));
  History.mark();
  // si todo lo seleccionado ya lo tiene, se quita en todas partes; si no, se aplica a todo
  const allIn = parts.every(x => rangeAllInside(x.range, sel));
  let first = null, last = null;
  parts.forEach(x => {
    try {
      const res = allIn ? removeFormat(x.range, sel) : applyFormat(x.range, tag, sel);
      if (res){ if (!first) first = res[0]; last = res[1] || last; }
    } catch(_){ toast(T('msg.cannot-apply')); }
  });
  selectBetween(first, last);
  after(); History.snap(true); refreshBar();
}
// quita todo el formato: los formatos en línea de lo seleccionado y, en cada bloque tocado, el tipo (encabezado o cita → párrafo)
function clearFormat(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast(T('msg.select-first'));
  const tops = touchedTops();
  if (!tops.length) return toast(T('msg.select-first'));
  History.mark();
  const r = s.getRangeAt(0), collapsed = s.isCollapsed;
  const caretOff = collapsed ? textOffsetIn(tops[0], r.startContainer, r.startOffset) : 0;
  let parts;
  if (collapsed){ const el = closestFrom(r.startContainer, TEXT_BLOCKS) || tops[0]; parts = [{ el, range: ownRange(el) }]; }
  else parts = selectedTextBlocks(r);
  let first = null, last = null;
  parts.forEach(x => {
    if (!rangeHasText(x.range)) return;
    try { const res = removeFormat(x.range, INLINE_ALL); if (res){ if (!first) first = res[0]; last = res[1] || last; } } catch(_){}
  });
  const map = new Map();
  tops.forEach(b => {
    if (/^H[1-6]$/.test(b.tagName) || (b.tagName === 'P' && b.hasAttribute('data-quote'))) map.set(b, retag(b, 'p'));
  });
  if (collapsed) setCaretByOffset(map.get(tops[0]) || tops[0], caretOff);
  else if (first && last) selectBetween(first, last);
  after(); History.snap(true); refreshBar(); toast(T('msg.format-cleared'));
}

/* ---- tipo de bloque (párrafo, encabezados, cita, código) sobre toda la selección ---- */
function applyBlockType(lvl){
  const tops = touchedTops().filter(b => /^(P|H[1-6])$/.test(b.tagName));
  if (!tops.length) return toast(T('msg.no-headings-here'));
  const tag = lvl === 0 ? 'p' : 'h' + lvl;
  const todo = tops.filter(b => !(b.tagName.toLowerCase() === tag && !b.hasAttribute('data-quote')));
  if (!todo.length) return;
  History.mark();
  const pt = capSel(), map = new Map();
  todo.forEach(b => map.set(b, retag(b, tag, lvl ? ['data-fold'] : [])));
  restoreMapped(pt, map);
  after(); History.snap(true); refreshBar();
}
function toggleQuoteSelection(){
  const tops = touchedTops().filter(b => /^(P|H[1-6])$/.test(b.tagName));
  if (!tops.length) return toast(T('msg.no-quote-here'));
  const allQuote = tops.every(b => b.tagName === 'P' && b.hasAttribute('data-quote'));   // todo ya es cita → se quita en todo
  const pt = capSel(), map = new Map();
  tops.forEach(b => {
    if (allQuote) b.removeAttribute('data-quote');
    else if (b.tagName === 'P') b.setAttribute('data-quote', '');
    else { const n = retag(b, 'p'); n.setAttribute('data-quote', ''); map.set(b, n); }
  });
  restoreMapped(pt, map);
}
function selectionToCodeBlock(b){
  const tops = touchedTops().filter(x => /^(P|H[1-6])$/.test(x.tagName));
  const group = tops.length ? tops : [b];
  const body = group.map(x => x.innerText.replace(/\u200b/g, '').replace(/\n+$/, '')).join('\n');
  const nodes = replaceBlock(group[0], codeBlockHtml('', body.trim() ? body : '') + '<p><br></p>');
  group.slice(1).forEach(x => x.remove());
  caretInto(nodes[0].querySelector(SRC), true);
}

