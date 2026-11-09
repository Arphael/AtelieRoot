"use strict";
/* ====== 63. Tablas ====== */
// Modelo de selección: se trabaja con un RECTÁNGULO de celdas (la celda donde empieza la selección y la donde termina),
// como en una hoja de cálculo. Con el cursor sin seleccionar, es la celda donde está. Todas las acciones usan ese rectángulo.
const cellAlign = c => c.getAttribute('data-a') || 'left';
const cellAt = (tbl, r, c) => { const row = tbl.rows[r]; return row ? row.children[c] || null : null; };
function posOf(cell){ const tr = cell.parentElement, tbl = cell.closest('table'); return { r: [...tbl.rows].indexOf(tr), c: [...tr.children].indexOf(cell) }; }
function mkCell(tag, align, html){
  const c = document.createElement(tag);
  c.setAttribute('data-a', align); c.style.textAlign = align;
  c.innerHTML = html || '<br>';
  return c;
}
function setCellAlign(c, a){ c.setAttribute('data-a', a); c.style.textAlign = a; }
const colAligns = tbl => [...(tbl.rows[0] ? tbl.rows[0].children : [])].map(cellAlign);
function tableRect(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  let a = closestFrom(r.startContainer, 'td,th'), z = closestFrom(r.endContainer, 'td,th'), tbl;
  if (a && z){
    tbl = a.closest('table');
    if (tbl !== z.closest('table')) return null;
  } else {
    const ca = r.commonAncestorContainer, host = ca.nodeType === 1 ? ca : ca.parentElement;
    tbl = host && host.closest ? host.closest('table') : null;                  // p. ej. una selección que envuelve la tabla entera
    if (!tbl || !ed.contains(tbl)) return null;
    const inside = [...tbl.querySelectorAll('th,td')].filter(c => r.intersectsNode(c));
    if (!inside.length) return null;
    a = inside[0]; z = inside[inside.length - 1];
  }
  const pa = posOf(a), pz = posOf(z);
  const r0 = Math.min(pa.r, pz.r), r1 = Math.max(pa.r, pz.r), c0 = Math.min(pa.c, pz.c), c1 = Math.max(pa.c, pz.c);
  const cells = [];
  for (let i = r0; i <= r1; i++) for (let j = c0; j <= c1; j++){ const c = cellAt(tbl, i, j); if (c) cells.push(c); }
  const lastR = tbl.rows.length - 1, lastC = (tbl.rows[0] ? tbl.rows[0].children.length : 1) - 1;
  return { tbl, r0, r1, c0, c1, cells, lastR, lastC, caret: s.isCollapsed,
           multi: a !== z && cells.length > 1, whole: r0 === 0 && r1 === lastR && c0 === 0 && c1 === lastC };
}
function selectCells(tbl, r0, c0, r1, c1){
  const a = cellAt(tbl, r0, c0), z = cellAt(tbl, r1, c1);
  if (!a || !z) return;
  const rg = document.createRange(); rg.setStart(a, 0); rg.setEnd(z, z.childNodes.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
}
// cuadro de color sobre las celdas seleccionadas (fuera del documento, no se guarda ni se copia)
const TSL = [{ sc: scroll1, ed: ed1, layer: null }, { sc: scroll2, ed: ed2, layer: null }];
TSL.forEach(p => { const l = document.createElement('div'); l.className = 'tsel-layer'; l.setAttribute('aria-hidden', 'true'); p.sc.appendChild(l); p.layer = l; });
function paintTableSel(){
  TSL.forEach(p => { p.layer.replaceChildren(); p.ed.classList.remove('tsel'); });
  const tr = tableRect();
  if (!tr || !tr.multi) return;
  const p = TSL.find(x => x.ed === ed); if (!p) return;
  const sr = p.sc.getBoundingClientRect(), frag = document.createDocumentFragment();
  tr.cells.forEach(c => {
    const r = c.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'tsel-box';
    Object.assign(d.style, { left: (r.left - sr.left + p.sc.scrollLeft) + 'px', top: (r.top - sr.top + p.sc.scrollTop) + 'px', width: r.width + 'px', height: r.height + 'px' });
    frag.appendChild(d);
  });
  p.layer.appendChild(frag); p.ed.classList.add('tsel');
}

/* ---- operaciones sobre la estructura ---- */
function uniqueColNames(tbl, n){
  const used = new Set([...(tbl.rows[0] ? tbl.rows[0].children : [])].map(c => c.textContent.trim())), out = [];
  let k = (tbl.rows[0] ? tbl.rows[0].children.length : 0) + 1;
  while (out.length < n){ const nm = 'Columna ' + k++; if (!used.has(nm)){ used.add(nm); out.push(nm); } }
  return out;
}
function insertRows(tbl, at, n){
  const aligns = colAligns(tbl);
  const body = tbl.tBodies[0] || tbl.appendChild(document.createElement('tbody'));
  const ref = tbl.rows[at] && tbl.rows[at].parentElement === body ? tbl.rows[at] : null, out = [];
  for (let k = 0; k < n; k++){
    const tr = document.createElement('tr');
    aligns.forEach(a => tr.appendChild(mkCell('td', a)));
    ref ? body.insertBefore(tr, ref) : body.appendChild(tr);
    out.push(tr);
  }
  return out;
}
// las celdas nuevas heredan la alineación de la columna de al lado (no se centran solas)
function insertCols(tbl, at, n, align){
  const names = uniqueColNames(tbl, n);
  [...tbl.rows].forEach((tr, ri) => {
    for (let k = 0; k < n; k++) tr.insertBefore(mkCell(ri === 0 ? 'th' : 'td', align || 'left', ri === 0 ? esc(names[k]) : ''), tr.children[at + k] || null);
  });
}
function moveRowsBy(tbl, r0, r1, dir){
  r0 = Math.max(1, r0);
  if (r1 < r0) return false;
  const rows = [...tbl.rows].slice(r0, r1 + 1);
  if (dir < 0){ if (r0 - 1 < 1) return false; const ref = tbl.rows[r0 - 1]; rows.forEach(tr => ref.before(tr)); }
  else { const ref = tbl.rows[r1 + 1]; if (!ref) return false; rows.reverse().forEach(tr => ref.after(tr)); }
  return true;
}
function moveColsBy(tbl, c0, c1, dir){
  const n = tbl.rows[0].children.length;
  if ((dir < 0 && c0 === 0) || (dir > 0 && c1 >= n - 1)) return false;
  [...tbl.rows].forEach(tr => {
    const cs = [...tr.children].slice(c0, c1 + 1);
    if (dir < 0){ const ref = tr.children[c0 - 1]; cs.forEach(c => ref.before(c)); }
    else { const ref = tr.children[c1 + 1]; cs.reverse().forEach(c => ref.after(c)); }
  });
  return true;
}
function sortByCol(tbl, c, dir){
  const body = tbl.tBodies[0];
  if (!body || body.rows.length < 2) return false;
  const rows = [...body.rows];
  const vals = rows.map(tr => (tr.children[c] ? tr.children[c].textContent.replace(/\u200b/g, '').trim() : ''));
  const filled = vals.filter(v => v !== '');
  const num = v => parseFloat(v.replace(/\s/g, '').replace(',', '.'));
  const numeric = filled.length > 0 && filled.every(v => /^[-+]?[\d.,]/.test(v.replace(/\s/g, '')) && isFinite(num(v)));
  const idx = rows.map((_, i) => i);
  idx.sort((i, j) => {
    const a = vals[i], b = vals[j];
    if (a === '' && b !== '') return 1;                                          // las celdas vacías van siempre al final
    if (b === '' && a !== '') return -1;
    let r = numeric ? num(a) - num(b) : a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
    if (dir === 'desc') r = -r;
    return r || i - j;
  });
  idx.forEach(i => body.appendChild(rows[i]));
  return true;
}
const clearCells = cells => cells.forEach(c => { c.innerHTML = '<br>'; });
function gridText(tr, kind){
  const scope = tr.multi ? tr : { tbl: tr.tbl, r0: 0, r1: tr.lastR, c0: 0, c1: tr.lastC };
  const rows = [];
  for (let i = scope.r0; i <= scope.r1; i++){
    const row = [];
    for (let j = scope.c0; j <= scope.c1; j++){ const c = cellAt(scope.tbl, i, j); row.push(c ? c.innerText.replace(/\u200b/g, '').trim() : ''); }
    rows.push(row);
  }
  if (kind === 'tsv') return rows.map(r => r.map(v => v.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  const q = v => /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  return rows.map(r => r.map(q).join(',')).join('\n');
}
// las celdas seleccionadas como una tabla propia (la primera fila pasa a ser el encabezado)
function tableClipFor(tr){
  const tmp = document.createElement('table'), th = document.createElement('thead'), tb = document.createElement('tbody');
  for (let i = tr.r0; i <= tr.r1; i++){
    const row = document.createElement('tr');
    for (let j = tr.c0; j <= tr.c1; j++){
      const src = cellAt(tr.tbl, i, j); if (!src) continue;
      const c = document.createElement(i === tr.r0 ? 'th' : 'td');
      setCellAlign(c, cellAlign(src)); c.innerHTML = src.innerHTML;
      row.appendChild(c);
    }
    (i === tr.r0 ? th : tb).appendChild(row);
  }
  tmp.append(th, tb);
  return tmp;
}
function writeTableClip(e, tr){
  const tmp = tableClipFor(tr), host = document.createElement('div');
  e.clipboardData.setData('text/plain', withFills(tableMd(tmp)));
  host.appendChild(tmp); forOutsideHtml(host);
  e.clipboardData.setData('text/html', host.innerHTML);
}
// pegar texto de una hoja de cálculo (columnas con tabulaciones) en una celda: se reparte por las celdas
function pasteGrid(txt){
  const s = getSelection(), cell = s.rangeCount ? closestFrom(s.getRangeAt(0).startContainer, 'td,th') : null;
  if (!cell) return false;
  const tbl = cell.closest('table'), pos = posOf(cell);
  const rows = txt.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map(r => r.split('\t'));
  const nCols = Math.max(...rows.map(r => r.length));
  History.mark();
  const needRows = pos.r + rows.length - tbl.rows.length;
  if (needRows > 0) insertRows(tbl, tbl.rows.length, needRows);
  const width = tbl.rows[0].children.length, needCols = pos.c + nCols - width;
  if (needCols > 0){ insertCols(tbl, width, needCols, 'left'); normWidths(tbl); }
  rows.forEach((r, i) => r.forEach((v, j) => { const c = cellAt(tbl, pos.r + i, pos.c + j); if (c) c.innerHTML = inlineHtml(v.trim()) || '<br>'; }));
  selectCells(tbl, pos.r, pos.c, pos.r + rows.length - 1, pos.c + nCols - 1);
  after(); History.snap(true);
  return true;
}

/* ---- acciones (barra, menú y teclado) ---- */
function tableAction(act){
  const tr = tableRect();
  if (!tr){ toast('Pon el cursor en una tabla'); return; }
  const { tbl, r0, r1, c0, c1, lastR, lastC } = tr;
  const nR = r1 - r0 + 1, nC = c1 - c0 + 1, multi = tr.multi;
  const done = () => { after(); History.snap(true); refreshTableBar(); };
  if (act === 'selrow') return selectCells(tbl, r0, 0, r1, lastC), refreshTableBar();
  if (act === 'selcol') return selectCells(tbl, 0, c0, lastR, c1), refreshTableBar();
  if (act === 'seltbl') return selectCells(tbl, 0, 0, lastR, lastC), refreshTableBar();
  if (act === 'copyCsv' || act === 'copyTsv'){
    const txt = gridText(tr, act === 'copyCsv' ? 'csv' : 'tsv');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Tabla copiada como ' + (act === 'copyCsv' ? 'CSV' : 'TSV')), () => toast('No se pudo copiar'));
    return;
  }
  History.mark();
  if (act === 'tAlL' || act === 'tAlC' || act === 'tAlR'){
    const a = act === 'tAlL' ? 'left' : act === 'tAlC' ? 'center' : 'right';
    [...tbl.rows].forEach(row => [...row.children].forEach(c => setCellAlign(c, a)));
    return done();
  }
  if (act === 'alNum'){
    let n = 0;
    for (let j = 0; j <= lastC; j++) if (numericColDom(tbl, j)){ n++; [...tbl.rows].forEach(row => row.children[j] && setCellAlign(row.children[j], 'right')); }
    if (!n) return toast('No hay columnas de números');
    return done();
  }
  if (act === 'cwReset'){ clearColWidths(tbl); return done(); }
  if (act === 'toList' || act === 'toText' || act === 'toBars'){ convertTable(tbl, act); after(); History.snap(true); refreshTableBar(); return; }
  if (act === 'rowup' || act === 'rowdn'){
    const at = act === 'rowup' ? Math.max(1, r0) : r1 + 1;
    const made = insertRows(tbl, at, nR);
    caretInto(made[0].firstElementChild, false); return done();
  }
  if (act === 'colL' || act === 'colR'){
    const at = act === 'colL' ? c0 : c1 + 1;
    const align = cellAlign(cellAt(tbl, 0, act === 'colL' ? c0 : c1) || tbl.rows[0].children[0]);
    insertCols(tbl, at, nC, align); normWidths(tbl);
    caretInto(cellAt(tbl, Math.max(r0, 0), at), false); return done();
  }
  if (act === 'dupRow'){
    const rows = [...tbl.rows].slice(Math.max(1, r0), r1 + 1);
    if (!rows.length) return toast('El encabezado no se duplica');
    let ref = tbl.rows[r1];
    const copies = rows.map(tr0 => tr0.cloneNode(true));
    copies.forEach(cp => { ref.after(cp); ref = cp; });
    caretInto(copies[0].firstElementChild, false); return done();
  }
  if (act === 'dupCol'){
    [...tbl.rows].forEach(row => {
      let ref = row.children[c1];
      [...row.children].slice(c0, c1 + 1).forEach(c => { const cp = c.cloneNode(true); ref.after(cp); ref = cp; });
    });
    normWidths(tbl); caretInto(cellAt(tbl, r0, c1 + 1), false); return done();
  }
  if (act === 'mvUp' || act === 'mvDn'){
    if (!moveRowsBy(tbl, r0, r1, act === 'mvUp' ? -1 : 1)) return toast(r1 === 0 ? 'El encabezado no se mueve' : act === 'mvUp' ? 'Ya está arriba del todo' : 'Ya está abajo del todo');
    const d = act === 'mvUp' ? -1 : 1, nr0 = Math.max(1, r0) + d, nr1 = r1 + d;
    multi ? selectCells(tbl, nr0, c0, nr1, c1) : caretInto(cellAt(tbl, nr0, c0), true);
    return done();
  }
  if (act === 'mvL' || act === 'mvR'){
    if (!moveColsBy(tbl, c0, c1, act === 'mvL' ? -1 : 1)) return toast(act === 'mvL' ? 'Ya está a la izquierda del todo' : 'Ya está a la derecha del todo');
    const d = act === 'mvL' ? -1 : 1;
    multi ? selectCells(tbl, r0, c0 + d, r1, c1 + d) : caretInto(cellAt(tbl, r0, c0 + d), true);
    return done();
  }
  if (act === 'sortA' || act === 'sortZ'){
    const keep = tr.cells[0];
    if (!sortByCol(tbl, c0, act === 'sortA' ? 'asc' : 'desc')) return toast('No hay filas que ordenar');
    multi ? selectCells(tbl, 1, c0, lastR, c1) : caretInto(keep, true);          // mover las filas suelta el cursor: se devuelve a su celda
    return done();
  }
  if (act === 'alL' || act === 'alC' || act === 'alR'){
    const a = act === 'alL' ? 'left' : act === 'alC' ? 'center' : 'right';
    [...tbl.rows].forEach(row => { for (let j = c0; j <= c1; j++){ const c = row.children[j]; if (c) setCellAlign(c, a); } });
    return done();
  }
  if (act === 'clear'){ clearCells(tr.cells); return done(); }
  if (act === 'delRow'){
    const rows = [...tbl.rows].slice(Math.max(1, r0), r1 + 1);
    if (!rows.length) return toast('No se puede quitar el encabezado');
    const near = tbl.rows[r1 + 1] || tbl.rows[Math.max(1, r0) - 1];
    rows.forEach(row => row.remove());
    if (near && near.isConnected) caretInto(near.children[Math.min(c0, near.children.length - 1)], false);
    return done();
  }
  if (act === 'delCol'){
    if (nC >= tbl.rows[0].children.length) return toast('La tabla necesita al menos una columna');
    [...tbl.rows].forEach(row => [...row.children].slice(c0, c1 + 1).forEach(c => c.remove()));
    normWidths(tbl); caretInto(cellAt(tbl, r0, Math.min(c0, lastC - nC)), false);
    return done();
  }
  if (act === 'delTbl'){
    const nx = tbl.nextElementSibling, pv = tbl.previousElementSibling;
    tbl.remove();
    if (!ed.children.length) ed.innerHTML = '<p><br></p>';
    const t = nx || pv || ed.firstElementChild;
    t && t.nodeType === 1 ? caretInto(t, !nx) : 0;
    return done();
  }
}

/* ---- barra y menú ---- */
const tableBar = $('#tableBar'), tblMenu = $('#tblMenu');
let tblCell = null;
function refreshTableBar(){
  const tr = tableRect();
  if (!tr){ tableBar.classList.remove('show'); tblCell = null; paintTableSel(); return; }
  tblCell = tr.cells[0] || null;
  const trb = tr.tbl.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
  tableBar.style.left = (trb.left - sr.left + scroll.scrollLeft) + 'px';
  tableBar.style.top = Math.max(0, trb.top - sr.top + scroll.scrollTop - 34) + 'px';
  tableBar.classList.add('show');
  paintScopeBtn();
  paintTableSel();
}
scroll.addEventListener('scroll', () => { if (tblCell) refreshTableBar(); });
function addRow(tbl){ const made = insertRows(tbl, tbl.rows.length, 1); after(); return made[0]; }
tableBar.addEventListener('mousedown', e => e.preventDefault());
tableBar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ta){ const al = b.dataset.ta === 'left' ? 'L' : b.dataset.ta === 'center' ? 'C' : 'R'; tableAction((alignScope() === 'table' ? 'tAl' : 'al') + al); return; }
  const t = b.dataset.tt;
  if (t === 'scope'){ Ui.data.alignScope = alignScope() === 'table' ? 'col' : 'table'; Ui.write(); paintScopeBtn(); toast(alignScope() === 'table' ? 'La alineación se aplicará a toda la tabla' : 'La alineación se aplicará solo a la columna'); return; }
  if (t === 'more'){ e.stopPropagation(); const r = b.getBoundingClientRect(); openTblMenu(r.left, r.bottom + 4); return; }
  const map = { tblSel: 'seltbl', colAdd: 'colR', rowAdd: 'rowdn', colDel: 'delCol', rowDel: 'delRow', tblDel: 'delTbl' };
  if (map[t]) tableAction(map[t]);
});
function openTblMenu(x, y){
  const tr = tableRect(); if (!tr) return;
  const nR = tr.r1 - tr.r0 + 1, nC = tr.c1 - tr.c0 + 1;
  const rowsT = n => n === 1 ? 'fila' : n + ' filas', colsT = n => n === 1 ? 'columna' : n + ' columnas';
  const items = [
    ['selrow', 'Seleccionar ' + (nR > 1 ? 'filas' : 'fila')], ['selcol', 'Seleccionar ' + (nC > 1 ? 'columnas' : 'columna')], ['seltbl', 'Seleccionar toda la tabla', 'Ctrl+A'], '-',
    ['rowup', 'Insertar ' + rowsT(nR) + ' arriba'], ['rowdn', 'Insertar ' + rowsT(nR) + ' abajo'],
    ['colL', 'Insertar ' + colsT(nC) + ' a la izquierda'], ['colR', 'Insertar ' + colsT(nC) + ' a la derecha'], '-',
    ['dupRow', 'Duplicar ' + rowsT(nR)], ['dupCol', 'Duplicar ' + colsT(nC)], '-',
    ['mvUp', 'Mover ' + rowsT(nR) + ' arriba', 'Alt+↑'], ['mvDn', 'Mover ' + rowsT(nR) + ' abajo', 'Alt+↓'],
    ['mvL', 'Mover ' + colsT(nC) + ' a la izquierda', 'Alt+←'], ['mvR', 'Mover ' + colsT(nC) + ' a la derecha', 'Alt+→'], '-',
    ['sortA', 'Ordenar por la columna  A → Z'], ['sortZ', 'Ordenar por la columna  Z → A'], '-',
    ['alL', 'Columna: alinear a la izquierda'], ['alC', 'Columna: centrar'], ['alR', 'Columna: alinear a la derecha'],
    ['tAlL', 'Toda la tabla: a la izquierda'], ['tAlC', 'Toda la tabla: centrada'], ['tAlR', 'Toda la tabla: a la derecha'],
    ['alNum', 'Números a la derecha (columnas de números)'], '-',
    ['clear', 'Vaciar celdas'], ['copyCsv', 'Copiar como CSV'], ['copyTsv', 'Copiar como TSV (hoja de cálculo)'], '-',
    ['cwReset', 'Restablecer el ancho de columnas'],
    ['toList', 'Convertir en lista'], ['toText', 'Convertir en texto (una línea por fila)'], ['toBars', 'Convertir en texto con barras «| a | b |»'], '-',
    ['delRow', 'Eliminar ' + rowsT(nR)], ['delCol', 'Eliminar ' + colsT(nC)], ['delTbl', 'Eliminar tabla', '', true]];
  document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
  tblMenu.innerHTML = items.map(it => it === '-' ? '<div class="hr"></div>'
    : '<button data-t="' + it[0] + '"' + (it[3] ? ' style="color:var(--danger)"' : '') + '><span>' + it[1] + '</span>' + (it[2] ? '<span class="k">' + it[2] + '</span>' : '') + '</button>').join('');
  tblMenu.classList.add('show');
  const w = tblMenu.offsetWidth, h = tblMenu.offsetHeight;
  tblMenu.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  tblMenu.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
}
tblMenu.addEventListener('mousedown', e => e.preventDefault());
tblMenu.addEventListener('contextmenu', e => e.preventDefault());
tblMenu.addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('[data-t]'); if (!b) return;
  tblMenu.classList.remove('show');
  tableAction(b.dataset.t);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && tblMenu.classList.contains('show')){ e.stopPropagation(); tblMenu.classList.remove('show'); } }, true);
// clic derecho dentro de una tabla: menú de tabla (en el resto del documento se conserva el menú normal del navegador)
ed.addEventListener('contextmenu', e => {
  const cell = e.target.closest ? e.target.closest('td,th') : null;
  if (!cell || !ed.contains(cell)) return;
  e.preventDefault();
  const tr = tableRect();
  if (!(tr && tr.multi && tr.cells.includes(cell))){                         // si se pulsa fuera de lo seleccionado, el cursor pasa a esa celda
    const rg = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
    if (rg && cell.contains(rg.startContainer)){ const s = getSelection(); s.removeAllRanges(); s.addRange(rg); } else caretInto(cell, true);
    refreshTableBar();
  }
  openTblMenu(e.clientX, e.clientY);
});

/* ---- teclado dentro de la tabla ---- */
// Flecha arriba/abajo: pasa a la celda de arriba o de abajo (el navegador saltaba a la de al lado)
// ¿hay otra línea (separada por un salto escrito) por encima o por debajo del cursor dentro de la celda?
function moreLinesInCell(cell, r, dir){
  const rg = document.createRange(); rg.selectNodeContents(cell);
  try { dir > 0 ? rg.setStart(r.startContainer, r.startOffset) : rg.setEnd(r.startContainer, r.startOffset); } catch(_){ return false; }
  const d = document.createElement('div'); d.appendChild(rg.cloneContents());
  const h = d.innerHTML.replace(/\u200b/g, '');
  if (dir < 0) return /<br\s*\/?>/i.test(h);
  const i = h.search(/<br\s*\/?>/i);
  if (i < 0) return false;
  const rest = h.slice(i).replace(/^<br\s*\/?>/i, '');
  return /<br\s*\/?>/i.test(rest) || rest.replace(/<[^>]*>/g, '').trim() !== '';
}
function cellVerticalNav(dir){
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0), cell = closestFrom(r.startContainer, 'td,th');
  if (!cell) return false;
  const tbl = cell.closest('table'), pos = posOf(cell);
  const c0 = r.cloneRange(); c0.collapse(true);
  const rs = c0.getClientRects(), cr = rs.length ? rs[0] : c0.getBoundingClientRect();
  const box = cell.getBoundingClientRect(), cs = getComputedStyle(cell);
  const top = box.top + parseFloat(cs.paddingTop), bottom = box.bottom - parseFloat(cs.paddingBottom), lh = cr.height || 18;
  if (moreLinesInCell(cell, r, dir)) return false;                                      // hay otra línea (salto escrito) dentro de la celda: baja por dentro
  if (cr.height && (dir < 0 ? cr.top - top >= lh * 0.8 : bottom - cr.bottom >= lh * 0.8)) return false;   // o el texto ocupa varias líneas por su anchura
  const row = tbl.rows[pos.r + dir];
  if (!row){                                                               // salida de la tabla por arriba o por abajo
    const sib = dir < 0 ? tbl.previousElementSibling : tbl.nextElementSibling;
    if (!sib) return false;
    caretInto(sib, dir < 0); return true;
  }
  const target = row.children[Math.min(pos.c, row.children.length - 1)], tb = target.getBoundingClientRect();
  const x = cr.height ? cr.left : box.left + 6;
  const rg = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, tb.top + tb.height / 2) : null;
  if (rg && target.contains(rg.startContainer)){ s.removeAllRanges(); s.addRange(rg); } else caretInto(target, false);
  return true;
}
function tableKeys(e, sel){
  const tr = tableRect();
  if (!tr) return false;
  const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
  if (tr.multi && plain && (e.key === 'Delete' || e.key === 'Backspace')){            // vaciar las celdas sin romper la tabla
    e.preventDefault(); History.mark(); clearCells(tr.cells); after(); History.snap(true); return true;
  }
  if (tr.multi && plain && e.key.length === 1){                                       // escribir sobre varias celdas: se vacían y se escribe en la primera
    History.mark(); clearCells(tr.cells); caretInto(tr.cells[0], false); return false;
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'a' && !tr.whole){
    e.preventDefault(); selectCells(tr.tbl, 0, 0, tr.lastR, tr.lastC); refreshTableBar(); return true;   // Ctrl+A: primero la tabla; otra vez, todo el documento
  }
  if (plain && !e.shiftKey && sel.isCollapsed && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && cellVerticalNav(e.key === 'ArrowUp' ? -1 : 1)){
    e.preventDefault(); return true;
  }
  return false;
}

