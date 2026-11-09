"use strict";
/* ====== 44. Mover líneas con Alt+↑/↓ (como en VS Code) ====== */
const savePts = r => ({ sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset });
function restorePts(p, fallback){
  const s = getSelection();
  try {
    if (!p.sc.isConnected || !p.ec.isConnected) throw 0;
    const rr = document.createRange(); rr.setStart(p.sc, p.so); rr.setEnd(p.ec, p.eo);
    s.removeAllRanges(); s.addRange(rr);
  } catch(_){ if (fallback) caretInto(fallback, true); }
}
function moveCaretUnit(dir){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  const r = s.getRangeAt(0);
  if (tableRect()) return tableAction(dir < 0 ? 'mvUp' : 'mvDn');         // dentro de una tabla se mueven las filas
  if (!s.isCollapsed){                                           // selección que abarca varios bloques: se mueven todos juntos
    const tops = touchedTops();
    if (tops.length > 1) return moveTopBlocks(tops, dir);
  }
  const src = closestFrom(r.startContainer, SRC);
  if (src) return moveCodeLines(src, dir);
  const li = closestFrom(r.startContainer, 'li');
  if (li) return moveListItems(li, dir);
  const b = currentBlock(); if (!b) return;
  if (b.tagName === 'P' && paraInfo(b).lines.length > 1) return moveParaLines(b, dir);
  moveWholeBlock(b, dir);
}
function moveWholeBlock(b, dir){
  const s = getSelection();
  let off = 0;
  if (s.rangeCount){ const r = document.createRange(); r.selectNodeContents(b); try { r.setEnd(s.anchorNode, s.anchorOffset); off = r.toString().length; } catch(_){} }
  const pt = s.rangeCount && !s.isCollapsed ? capSel() : null;       // con texto seleccionado, la selección entera se conserva
  History.mark();
  moveBlocks(withSections([b]), dir);
  let count = 0, done = false;
  const go = node => {
    if (done) return;
    if (node.nodeType === 3){
      if (count + node.length >= off){ const r = document.createRange(); r.setStart(node, off - count); r.collapse(true); s.removeAllRanges(); s.addRange(r); done = true; }
      else count += node.length;
    } else node.childNodes.forEach(go);
  };
  if (pt) restoreMapped(pt, new Map()); else { go(b); if (!done) caretInto(b, true); }
  after(); History.snap(true); ensureCaretVisible();
}
function moveListItems(li, dir){
  const s = getSelection(), r = s.getRangeAt(0), pts = savePts(r);
  const list = li.parentElement;
  let z = closestFrom(r.endContainer, 'li');
  while (z && z.parentElement !== list) z = z.parentElement && z.parentElement.closest ? z.parentElement.closest('li') : null;
  if (!z) z = li;
  const kids = [...list.children];
  let a = kids.indexOf(li), b = kids.indexOf(z);
  if (b < a) [a, b] = [b, a];
  const items = kids.slice(a, b + 1).filter(x => x.tagName === 'LI');
  const nested = list.parentElement && list.parentElement.tagName === 'LI';
  if (!nested && items.length === kids.length) return moveWholeBlock(list, dir);   // lista de un solo punto: se mueve el bloque
  const near = dir < 0 ? items[0].previousElementSibling : items[items.length - 1].nextElementSibling;
  if (!near){ toast(dir < 0 ? 'Es el primer punto de la lista' : 'Es el último punto de la lista'); return; }
  History.mark();
  if (dir < 0) near.before(...items); else near.after(...items);
  restorePts(pts, items[0]);
  after(); History.snap(true); ensureCaretVisible();
}
// un párrafo es una pila de líneas separadas por <br>; el <br> final solo mantiene visible una línea vacía
function paraInfo(b){
  const kids = [...b.childNodes];
  let trail = null;
  if (kids.length && kids[kids.length - 1].nodeName === 'BR') trail = kids.pop();
  const lines = [[]], brs = [];
  kids.forEach(k => { if (k.nodeName === 'BR'){ brs.push(k); lines.push([]); } else lines[lines.length - 1].push(k); });
  return { lines, brs, trail };
}
function lineAt(b, c, o, info){
  const kids = [...b.childNodes];
  let idx;
  if (c === b) idx = o; else { let n = c; while (n && n.parentNode !== b) n = n.parentNode; idx = n ? kids.indexOf(n) : 0; }
  let k = 0;
  for (let i = 0; i < idx && i < kids.length; i++) if (info.brs.includes(kids[i])) k++;
  return k;
}
function ptOfLine(b, info, j, atEnd){
  const kids = [...b.childNodes], nodes = info.lines[j] || [];
  if (nodes.length) return atEnd ? kids.indexOf(nodes[nodes.length - 1]) + 1 : kids.indexOf(nodes[0]);
  if (j < info.lines.length - 1) return kids.indexOf(info.brs[j]);
  return info.trail ? kids.indexOf(info.trail) : kids.length;
}
function moveParaLines(b, dir){
  const s = getSelection(), r = s.getRangeAt(0), pts = savePts(r);
  const info = paraInfo(b);
  const ls = lineAt(b, r.startContainer, r.startOffset, info), le = lineAt(b, r.endContainer, r.endOffset, info);
  const i0 = Math.min(ls, le), i1 = Math.max(ls, le), n = info.lines.length;
  if (dir < 0 ? i0 === 0 : i1 === n - 1){ toast(dir < 0 ? 'Es la primera línea del párrafo' : 'Es la última línea del párrafo'); return; }
  History.mark();
  const seg = info.lines.splice(i0, i1 - i0 + 1);
  if (dir < 0) info.lines.splice(i0 - 1, 0, ...seg); else info.lines.splice(i0 + 1, 0, ...seg);
  while (b.firstChild) b.removeChild(b.firstChild);
  info.lines.forEach((nodes, k) => { nodes.forEach(x => b.appendChild(x)); if (k < info.lines.length - 1) b.appendChild(info.brs[k]); });
  if (info.trail) b.appendChild(info.trail);
  const info2 = paraInfo(b), delta = dir < 0 ? -1 : 1;
  const fix = (c, o, line, atEnd) => c === b ? [b, ptOfLine(b, info2, line + delta, atEnd)] : [c, o];
  const sp = fix(pts.sc, pts.so, ls, false), ep = fix(pts.ec, pts.eo, le, true);
  try { const rr = document.createRange(); rr.setStart(sp[0], sp[1]); rr.setEnd(ep[0], ep[1]); s.removeAllRanges(); s.addRange(rr); }
  catch(_){ caretInto(b, true); }
  after(); History.snap(true); ensureCaretVisible();
}
function moveCodeLines(src, dir){
  const s = getSelection(), r = s.getRangeAt(0);
  const text = src.textContent;
  const off = (c, o) => { const t = document.createRange(); t.selectNodeContents(src); t.setEnd(c, o); return t.toString().length; };
  let a = off(r.startContainer, r.startOffset), z = off(r.endContainer, r.endOffset);
  if (z < a) [a, z] = [z, a];
  const lines = text.split('\n'), starts = [];
  let acc = 0; lines.forEach(l => { starts.push(acc); acc += l.length + 1; });
  const idxOf = pos => { let k = 0; for (let i = 0; i < lines.length; i++) if (starts[i] <= pos) k = i; return k; };
  const i0 = idxOf(a);
  let i1 = idxOf(z);
  if (z > a && z === starts[i1] && i1 > i0) i1--;          // si la selección termina al inicio de una línea, esa no cuenta
  if (dir < 0 ? i0 === 0 : i1 === lines.length - 1){ toast(dir < 0 ? 'Es la primera línea del código' : 'Es la última línea del código'); return; }
  History.mark();
  const seg = lines.splice(i0, i1 - i0 + 1);
  let delta;
  if (dir < 0){ const prev = lines[i0 - 1]; lines.splice(i0 - 1, 0, ...seg); delta = -(prev.length + 1); }
  else { const next = lines[i0]; lines.splice(i0 + 1, 0, ...seg); delta = next.length + 1; }
  src.textContent = lines.join('\n');
  const node = src.firstChild;
  if (node){ const rr = document.createRange(); rr.setStart(node, Math.min(node.length, a + delta)); rr.setEnd(node, Math.min(node.length, z + delta)); s.removeAllRanges(); s.addRange(rr); }
  const cb = src.closest('.cb'); if (cb) hlBlock(cb, true);
  after(); History.snap(true); ensureCaretVisible();
}

