"use strict";
/* ====== 67. Tablas: tamaño al insertar, números a la derecha, ancho de columnas, conversión y alcance de la alineación ====== */

/* ---- 1. elegir filas × columnas al insertar una tabla ---- */
function askTableSize(ok){
  const R = 8, C = 10;
  card.innerHTML = '<h2>' + esc(T('ts.title')) + '</h2>' +
    '<div id="tsPick" style="display:grid;grid-template-columns:repeat(' + C + ',22px);gap:3px;justify-content:center"></div>' +
    '<div id="tsLab" style="text-align:center;font-size:12px;color:var(--ink-dim);min-height:16px"></div>' +
    '<div style="display:flex;gap:14px;justify-content:center">' +
      '<div style="display:flex;flex-direction:column;gap:5px"><label for="ts_r" style="font-size:11px;color:var(--ink-faint)">' + esc(T('ts.rows')) + '</label><input id="ts_r" type="number" min="1" max="60" value="3" style="width:150px"></div>' +
      '<div style="display:flex;flex-direction:column;gap:5px"><label for="ts_c" style="font-size:11px;color:var(--ink-faint)">' + esc(T('ts.cols')) + '</label><input id="ts_c" type="number" min="1" max="12" value="3" style="width:110px"></div>' +
    '</div>' +
    '<div class="btns"><button class="btn" data-no>' + esc(T('btn.cancel')) + '</button><button class="btn primary" data-yes>' + esc(T('ts.insert')) + '</button></div>';
  const pick = card.querySelector('#tsPick'), lab = card.querySelector('#tsLab'), ir = card.querySelector('#ts_r'), ic = card.querySelector('#ts_c');
  const sq = [];
  for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ts-sq'; b.dataset.r = r; b.dataset.c = c; b.setAttribute('aria-label', T('ts.size', { r: T(r === 1 ? 'tm.row1' : 'tm.rows', { n: r }), c: T(c === 1 ? 'tm.col1' : 'tm.cols', { n: c }) }));
    pick.appendChild(b); sq.push(b);
  }
  const paint = (r, c) => { sq.forEach(b => b.classList.toggle('on', +b.dataset.r <= r && +b.dataset.c <= c)); lab.textContent = T('ts.size', { r: T(r === 1 ? 'tm.row1' : 'tm.rows', { n: r }), c: T(c === 1 ? 'tm.col1' : 'tm.cols', { n: c }) }); };
  const clampV = () => [Math.min(60, Math.max(1, parseInt(ir.value) || 1)), Math.min(12, Math.max(1, parseInt(ic.value) || 1))];
  const close = () => veil.classList.remove('show');
  pick.onmouseover = e => { const b = e.target.closest('.ts-sq'); if (b){ ir.value = b.dataset.r; ic.value = b.dataset.c; paint(+b.dataset.r, +b.dataset.c); } };
  pick.onclick = e => { const b = e.target.closest('.ts-sq'); if (b){ close(); ok(+b.dataset.r, +b.dataset.c); } };
  const sync = () => { const [r, c] = clampV(); paint(r, c); };
  ir.oninput = ic.oninput = sync;
  const done = () => { const [r, c] = clampV(); close(); ok(r, c); };
  card.querySelector('[data-yes]').onclick = done;
  card.querySelector('[data-no]').onclick = close;
  card.querySelectorAll('input').forEach(inp => inp.onkeydown = ev => { if (ev.key === 'Enter'){ ev.preventDefault(); done(); } if (ev.key === 'Escape') close(); });
  paint(3, 3); veil.classList.add('show'); ir.focus(); ir.select();
}
function insertSizedTable(block, rows, cols, keep, had){
  if (!block.isConnected) return;
  History.mark();
  const head = Array.from({ length: cols }, (_, i) => 'Columna ' + (i + 1));
  const body = Array.from({ length: Math.max(0, rows - 1) }, () => Array(cols).fill(''));
  const nodes = replaceBlock(block, tableHtml(head, Array(cols).fill('left'), body) + (had ? '<p>' + keep + '</p>' : '<p><br></p>'));
  ed.focus({ preventScroll: true }); caretInto(nodes[0]);
  after(); History.snap(true); refreshBar();
}

/* ---- 2. columnas numéricas ---- */
// Un número con, como mucho, signo, moneda, miles/decimales y una unidad corta (2, 1,5, 10 %, 500 ms, $12.50)
const NUM_CELL = /^[-+]?[$€£]?\d[\d.,]*\s?(%|[A-Za-zµ°]{1,4})?$/;
function numericVals(vals){ const v = vals.map(x => x.replace(/\u200b/g, '').trim()).filter(Boolean); return v.length > 0 && v.every(x => NUM_CELL.test(x)); }
function numericColDom(tbl, c){ return numericVals([...tbl.rows].slice(1).map(tr => tr.children[c] ? tr.children[c].textContent : '')); }

/* ---- 3. ancho de columnas arrastrando el borde ---- */
// Los anchos se guardan en la tabla (porcentajes en la fila de encabezado). Markdown no tiene anchos, así que solo valen dentro de AtelierRoot.
const MIN_COL = 6;
const colWidthsPct = tbl => { const w = tbl.getBoundingClientRect().width || 1; return [...tbl.rows[0].children].map(c => c.getBoundingClientRect().width / w * 100); };
function setColWidths(tbl, arr){
  arr.forEach((v, i) => { const c = tbl.rows[0].children[i]; if (c){ c.setAttribute('data-w', v.toFixed(2)); c.style.width = v.toFixed(2) + '%'; } });
  tbl.setAttribute('data-cw', '');
}
function clearColWidths(tbl){
  tbl.removeAttribute('data-cw');
  [...tbl.rows[0].children].forEach(c => { c.removeAttribute('data-w'); c.style.width = ''; });
}
function normWidths(tbl){                                                 // tras añadir o quitar columnas, los anchos vuelven a sumar 100 %
  if (!tbl.hasAttribute('data-cw')) return;
  const hs = [...tbl.rows[0].children], have = hs.map(h => parseFloat(h.getAttribute('data-w')) || 0), known = have.filter(Boolean);
  const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 100 / hs.length;
  const w = have.map(x => x || avg), sum = w.reduce((a, b) => a + b, 0);
  setColWidths(tbl, w.map(x => x / sum * 100));
}
let colDrag = null;
function colEdgeAt(e){
  const cell = e.target.closest ? e.target.closest('td,th') : null;
  if (!cell || !ed.contains(cell)) return null;
  const r = cell.getBoundingClientRect(), row = cell.parentElement, i = [...row.children].indexOf(cell), n = row.children.length;
  if (r.right - e.clientX <= 4 && i < n - 1) return { tbl: cell.closest('table'), i };
  if (e.clientX - r.left <= 4 && i > 0) return { tbl: cell.closest('table'), i: i - 1 };
  return null;
}
ed.addEventListener('mousemove', e => { if (!colDrag) ed.classList.toggle('colrs', !!colEdgeAt(e)); });
ed.addEventListener('mouseleave', () => { if (!colDrag) ed.classList.remove('colrs'); });
ed.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const h = colEdgeAt(e); if (!h) return;
  e.preventDefault();
  colDrag = { tbl: h.tbl, i: h.i, x: e.clientX, w0: colWidthsPct(h.tbl), tw: h.tbl.getBoundingClientRect().width || 1, moved: false };
  document.body.classList.add('colresizing');
});
addEventListener('mousemove', e => {
  if (!colDrag) return;
  if (!colDrag.moved){
    if (Math.abs(e.clientX - colDrag.x) < 3) return;
    colDrag.moved = true; History.mark(); setColWidths(colDrag.tbl, colDrag.w0);   // al empezar a arrastrar, se fijan los anchos actuales
  }
  const d = (e.clientX - colDrag.x) / colDrag.tw * 100, i = colDrag.i;
  let a = colDrag.w0[i] + d, b = colDrag.w0[i + 1] - d;
  if (a < MIN_COL){ b -= MIN_COL - a; a = MIN_COL; }
  if (b < MIN_COL){ a -= MIN_COL - b; b = MIN_COL; }
  const w = colDrag.w0.slice(); w[i] = a; w[i + 1] = b;
  setColWidths(colDrag.tbl, w); paintTableSel();
});
function colDragEnd(){
  if (!colDrag) return;
  const moved = colDrag.moved; colDrag = null;
  document.body.classList.remove('colresizing'); ed.classList.remove('colrs');
  if (moved){ after(); History.snap(true); refreshTableBar(); }
}
addEventListener('mouseup', colDragEnd);
addEventListener('blur', colDragEnd);
ed.addEventListener('dblclick', e => {                                    // doble clic en el borde: ancho automático otra vez
  const h = colEdgeAt(e); if (!h || !h.tbl.hasAttribute('data-cw')) return;
  e.preventDefault(); History.mark(); clearColWidths(h.tbl); after(); History.snap(true); refreshTableBar(); toast(T('msg.cw-reset'));
});

/* ---- 4. convertir una tabla en lista o en texto ---- */
function convertTable(tbl, kind){
  const clean = c => c.innerHTML.replace(/<br\s*\/?>/gi, ' ').replace(/\u200b/g, '').trim();
  const rows = [...tbl.rows].map(tr => [...tr.children].map(clean));
  const head = rows[0].map((h, j) => h || 'Columna ' + (j + 1)), body = rows.slice(1);
  let html;
  if (kind === 'toBars') html = rows.map(r => '<p>| ' + r.join(' | ') + ' |</p>').join('');
  else if (kind === 'toText'){
    html = (body.length ? body : [rows[0]]).map(r => '<p>' + (r.map((v, j) => v ? (body.length ? head[j] + ': ' : '') + v : '').filter(Boolean).join('; ') || '<br>') + '</p>').join('');
  } else {
    html = '<ul>' + (body.length ? body : [rows[0]]).map(r => {
      const first = r[0] || T('name.untitled-paren');
      const sub = body.length ? r.map((v, j) => j > 0 && v ? '<li><strong>' + head[j] + '</strong>: ' + v + '</li>' : '').join('') : '';
      return '<li>' + first + (sub ? '<ul>' + sub + '</ul>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  const nodes = replaceBlock(tbl, html);
  caretInto(nodes[0], false);
}

/* ---- 5. alineación: columna o toda la tabla ---- */
const alignScope = () => Ui.data.alignScope === 'table' ? 'table' : 'col';
const ICON_COL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><rect x="9" y="3" width="6" height="18" fill="currentColor" stroke="none" opacity=".6"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>';
const ICON_ALL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fill-opacity=".35"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>';
function paintScopeBtn(){
  const b = tableBar.querySelector('[data-tt="scope"]'); if (!b) return;
  const all = alignScope() === 'table';
  b.classList.toggle('on', all); b.innerHTML = all ? ICON_ALL : ICON_COL;
  b.title = T(all ? 'tbl.scope-all' : 'tbl.scope-col');
  b.setAttribute('aria-label', b.title);
}

