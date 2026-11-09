"use strict";
/* ====== 57. Mover toda la selección con Alt+↑/↓ ====== */
function moveTopBlocks(tops, dir){
  const group = withSections(tops);
  const ref = dir < 0 ? group[0].previousElementSibling : group[group.length - 1].nextElementSibling;
  if (!ref) return toast(dir < 0 ? 'Ya está arriba del todo' : 'Ya está abajo del todo');
  const pt = capSel();
  History.mark();
  moveBlocks(group, dir);
  restoreMapped(pt, new Map());
  after(); History.snap(true); ensureCaretVisible();
}

/* ====== 58. Ordenar ====== */
// texto con forma de tabla (líneas con | o tabulaciones, aunque no lleven fila separadora) → tabla
const isTableLineBlock = b => b.tagName === 'P' && !b.hasAttribute('data-quote') && /[|\t]/.test(b.textContent);
function tablesFromText(){
  let count = 0;
  const kids = [...ed.children];
  let i = 0;
  while (i < kids.length){
    if (!isTableLineBlock(kids[i])){ i++; continue; }
    const run = [];
    let j = i;
    while (j < kids.length && isTableLineBlock(kids[j])){ run.push(kids[j]); j++; }
    const lines = linesOfBlocks(run);
    const t = lines.length >= 2 ? detectTable(lines, true) : null;
    if (t){
      const built = tableMdFromDetected(t);
      const nodes = [...document.createRange().createContextualFragment(domFromMd(built.md)).childNodes];
      nodes.forEach(n => run[0].before(n));
      run.forEach(b => b.remove());
      if (!nodes[nodes.length - 1].nextElementSibling){ const p = document.createElement('p'); p.innerHTML = '<br>'; nodes[nodes.length - 1].after(p); }
      count++;
    }
    i = j;
  }
  return count;
}
function tidyDocument(){
  History.mark(); History.snap(true);
  const y = scroll.scrollTop;
  const tables = tablesFromText();                                   // antes del paso por Markdown: así no se pierden tabulaciones ni columnas vacías
  ed.innerHTML = domFromMd(docMd());                                 // espaciado, viñetas (también •), numeración y tablas de Markdown
  mergeAdjacentLists();
  renumberLists(true);
  scroll.scrollTop = y;
  after(); History.snap(true);
  toast(tables ? 'Documento ordenado · ' + tables + (tables === 1 ? ' tabla creada' : ' tablas creadas') : 'Documento ordenado');
}

/* ====== 59. Subniveles de la enumeración en Markdown (1. · a. · i. · A.) ====== */
function toAlpha(n){ let s = ''; while (n > 0){ n--; s = String.fromCharCode(97 + n % 26) + s; n = Math.floor(n / 26); } return s; }
function fromAlpha(s){ let n = 0; for (const ch of s.toLowerCase()) n = n * 26 + (ch.charCodeAt(0) - 96); return n; }
function toRoman(n){
  const m = [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
  let s = ''; for (const [v, r] of m){ while (n >= v){ s += r; n -= v; } } return s;
}
function fromRoman(s){
  const v = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }; let n = 0; s = s.toLowerCase();
  for (let i = 0; i < s.length; i++){ const a = v[s[i]], b = v[s[i + 1]] || 0; n += a < b ? -a : a; }
  return n;
}
// nivel de estilo de una lista numerada: cuenta las numeradas que la contienen (0 = 1,2,3 · 1 = a,b,c · 2 = i,ii,iii · 3 = A,B,C · y vuelta a empezar)
function olLevelOf(list){ let n = 0; for (let p = list.parentElement; p; p = p.parentElement) if (p.tagName === 'OL') n++; return n % 4; }
function olMarker(level, n){
  if (n < 1) return n + '.';
  if (level === 1) return toAlpha(n) + '.';
  if (level === 2) return toRoman(n) + '.';
  if (level === 3) return toAlpha(n).toUpperCase() + '.';
  return n + '.';
}

