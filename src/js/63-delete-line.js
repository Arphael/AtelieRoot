"use strict";
/* ====== 50. Borrar la línea (Shift+Supr) ====== */
// «línea» = lo mismo que mueve Alt+↑/↓: línea de código, punto de lista, línea de un párrafo o bloque entero
function pickTarget(next, prev){
  const ok = x => x && !x.hasAttribute('data-hid') && x.tagName !== 'HR';
  return ok(next) ? [next, false] : ok(prev) ? [prev, true] : [null, false];
}
function deleteTopBlocks(list){
  if (!list.length) return;
  History.mark();
  const next = list[list.length - 1].nextElementSibling, prev = list[0].previousElementSibling;
  list.forEach(x => x.remove());
  let [t, atEnd] = pickTarget(next, prev);
  if (!t){
    t = document.createElement('p'); t.innerHTML = '<br>';
    if (next) next.before(t); else if (prev) prev.after(t); else ed.appendChild(t);
  }
  caretInto(t, atEnd);
  after(); History.snap(true); ensureCaretVisible();
}
function deleteCodeLines(src){
  const s = getSelection(), r = s.getRangeAt(0);
  const off = (c, o) => { const t = document.createRange(); t.selectNodeContents(src); t.setEnd(c, o); return t.toString().length; };
  let a = off(r.startContainer, r.startOffset), z = off(r.endContainer, r.endOffset);
  if (z < a) [a, z] = [z, a];
  const lines = src.textContent.split('\n'), starts = [];
  let acc = 0; lines.forEach(l => { starts.push(acc); acc += l.length + 1; });
  const idxOf = pos => { let k = 0; for (let i = 0; i < lines.length; i++) if (starts[i] <= pos) k = i; return k; };
  const i0 = idxOf(a);
  let i1 = idxOf(z);
  if (z > a && z === starts[i1] && i1 > i0) i1--;
  History.mark();
  lines.splice(i0, i1 - i0 + 1);
  const text = lines.join('\n');
  src.textContent = text;
  const pos = i0 < lines.length ? lines.slice(0, i0).join('\n').length + (i0 > 0 ? 1 : 0) : text.length;
  const node = src.firstChild, rr = document.createRange();
  if (node) rr.setStart(node, Math.min(node.length, pos)); else rr.setStart(src, 0);
  rr.collapse(true); s.removeAllRanges(); s.addRange(rr);
  const cb = src.closest('.cb'); if (cb) hlBlock(cb, true);
  after(); History.snap(true); ensureCaretVisible();
}
function deleteListItems(li){
  const s = getSelection(), r = s.getRangeAt(0);
  const list = li.parentElement;
  let z = closestFrom(r.endContainer, 'li');
  while (z && z.parentElement !== list) z = z.parentElement && z.parentElement.closest ? z.parentElement.closest('li') : null;
  if (!z) z = li;
  const kids = [...list.children];
  let a = kids.indexOf(li), b = kids.indexOf(z);
  if (b < a) [a, b] = [b, a];
  const items = kids.slice(a, b + 1).filter(x => x.tagName === 'LI');
  if (items.length === kids.length && list.parentElement === ed) return deleteTopBlocks([list]);     // era toda la lista
  History.mark();
  const next = items[items.length - 1].nextElementSibling, prev = items[0].previousElementSibling;
  items.forEach(x => x.remove());
  if (!list.children.length){                                  // lista anidada vacía: se quita y el cursor vuelve al punto de arriba
    const host = list.parentElement; list.remove();
    if (host && host.tagName === 'LI') caretInto(host, true);
  } else if (next) caretInto(next, false); else caretInto(prev, true);
  after(); History.snap(true); ensureCaretVisible();
}
function deleteParaLines(b){
  const s = getSelection(), r = s.getRangeAt(0);
  const info = paraInfo(b), n = info.lines.length;
  const ls = lineAt(b, r.startContainer, r.startOffset, info), le = lineAt(b, r.endContainer, r.endOffset, info);
  const i0 = Math.min(ls, le), i1 = Math.max(ls, le);
  if (i0 === 0 && i1 === n - 1) return deleteTopBlocks(withSections([b]));
  History.mark();
  const lines = info.lines.slice(), brs = info.brs.slice(), cnt = i1 - i0 + 1;
  if (i1 < n - 1){ lines.splice(i0, cnt); brs.splice(i0, cnt); }      // se va con el salto de después
  else { lines.splice(i0, cnt); brs.splice(i0 - 1, cnt); }              // era el final: se va con el salto de antes
  while (b.firstChild) b.removeChild(b.firstChild);
  lines.forEach((nodes, k) => { nodes.forEach(x => b.appendChild(x)); if (k < lines.length - 1) b.appendChild(brs[k]); });
  if (info.trail) b.appendChild(info.trail);
  const info2 = paraInfo(b);
  const pos = i0 < info2.lines.length ? ptOfLine(b, info2, i0, false) : ptOfLine(b, info2, info2.lines.length - 1, true);
  const rr = document.createRange(); rr.setStart(b, pos); rr.collapse(true); s.removeAllRanges(); s.addRange(rr);
  after(); History.snap(true); ensureCaretVisible();
}
function deleteTableRow(cell){
  const tr = cell.closest('tr'), tbl = cell.closest('table');
  if (tr.parentElement.tagName === 'THEAD') return toast('No se puede borrar el encabezado de la tabla');
  History.mark();
  const next = tr.nextElementSibling, prev = tr.previousElementSibling;
  tr.remove();
  const t = next || prev;
  caretInto(t ? t.firstElementChild : tbl.querySelector('th'), false);
  after(); History.snap(true);
}
function deleteCaretUnit(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  const r = s.getRangeAt(0);
  if (!s.isCollapsed){                                           // varios bloques seleccionados: se borran enteros
    const tops = touchedTops();
    if (tops.length > 1) return deleteTopBlocks(withSections(tops));
  }
  const src = closestFrom(r.startContainer, SRC);
  if (src) return deleteCodeLines(src);
  const li = closestFrom(r.startContainer, 'li');
  if (li) return deleteListItems(li);
  const cell = closestFrom(r.startContainer, 'td,th');
  if (cell) return tableAction('delRow');
  const b = currentBlock(); if (!b) return;
  if (b.tagName === 'P' && paraInfo(b).lines.length > 1) return deleteParaLines(b);
  deleteTopBlocks(withSections([b]));
}
ed.addEventListener('keydown', e => {
  if (e.key !== 'Delete' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  deleteCaretUnit();
});

/* ====== 51. Estilos que mete el navegador al unir bloques ====== */
// Al unir dos bloques (Retroceso al inicio de un párrafo, Supr al final de un encabezado) el navegador envuelve el texto unido en
// <span style="font-size…; font-family…"> con el aspecto del bloque de origen: el texto se queda «sin el formato del encabezado».
// Esos estilos no pertenecen al documento (el aspecto lo da el tipo de bloque): se quitan.
