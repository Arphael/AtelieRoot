"use strict";
/* ====== 53. Texto con forma de tabla → tabla ====== */
// Con texto seleccionado, el botón de tabla lo convierte en tabla si cada línea tiene columnas separadas por |, tabulaciones, ; , o 2+ espacios.
function csvCells(line, d){
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (q){ if (ch === '"'){ if (line[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"' && !cur.trim()) q = true;
    else if (ch === d){ out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
function splitCells(line, d){
  if (d === '|'){
    let t = line.trim();
    if (t.startsWith('|')) t = t.slice(1);
    if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1);
    return t.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  }
  if (d === '\t') return line.split('\t').map(c => c.trim());
  if (d === ';' || d === ',') return csvCells(line, d);
  return line.trim().split(/\s{2,}/).map(c => c.trim());
}
const isSepCells = r => r.length >= 1 && r.every(c => /^:?-{1,}:?$/.test(c));
function detectTable(lines, strongOnly){
  let best = null;
  for (const d of (strongOnly ? ['|', '\t'] : ['|', '\t', ';', ',', '  '])){
    const rows = lines.map(l => splitCells(l, d));
    const body = rows.filter(r => !isSepCells(r));
    if (!body.length || (body.length < 2 && d !== '|' && d !== '\t')) continue;     // con una sola línea solo valen | y tabulación
    let support;
    if (d === '|' || d === '\t'){                                                   // separadores claros: basta con que casi todas las líneas tengan 2+ columnas
      support = body.filter(r => r.length >= 2).length;
      if (support < Math.ceil(body.length * 0.6)) continue;
    } else {                                                                       // , ; y espacios: las filas deben tener el mismo número de columnas
      const freq = {};
      body.forEach(r => { freq[r.length] = (freq[r.length] || 0) + 1; });
      let modal = 0; support = 0;
      Object.keys(freq).forEach(k => { if (+k >= 2 && freq[k] > support){ modal = +k; support = freq[k]; } });
      if (!modal || support < Math.ceil(body.length * 0.6) || (body.length >= 2 && support < 2)) continue;
    }
    const score = support / body.length;
    if (!best || score > best.score + 1e-9) best = { d, rows, score };
  }
  return best;
}
function linesOfBlocks(blocks){
  const out = [];
  blocks.forEach(b => {
    if (b.classList && b.classList.contains('cb')) out.push(...b.querySelector(SRC).textContent.split('\n'));
    else if (b.tagName === 'UL' || b.tagName === 'OL'){
      b.querySelectorAll('li').forEach(li => { const c = li.cloneNode(true); c.querySelectorAll('ul,ol').forEach(x => x.remove()); out.push(inlineMd(c)); });
    } else out.push(...inlineMd(b.cloneNode(true)).split('\n'));
  });
  return out.map(l => l.replace(/[\u200b\r]/g, '').trim()).filter(Boolean);
}
function tableMdFromDetected(t){
  let rows = t.rows.filter(r => !isSepCells(r));
  const cols = Math.max(...rows.map(r => r.length));
  rows = rows.map(r => Array.from({ length: cols }, (_, i) => r[i] || ''));
  const sep = t.rows.find(isSepCells) || [];
  const aligns = Array.from({ length: cols }, (_, i) => { const c = sep[i] || ''; return /^:-*:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:/.test(c) ? 'lefte' : 'left'; });
  const head = rows[0], body = rows.slice(1).length ? rows.slice(1) : [Array(cols).fill('')];
  const cell = c => String(c).replace(/\|/g, '\\|');
  const md = ['| ' + head.map(cell).join(' | ') + ' |',
    '| ' + aligns.map(a => a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'lefte' ? ':---' : '---').join(' | ') + ' |',
    ...body.map(r => '| ' + r.map(cell).join(' | ') + ' |')].join('\n');
  return { md, rows: rows.length, cols };
}
function tableFromSelection(){
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode)) return false;
  const tops = touchedTops();
  if (!tops.length || !tops.every(b => /^(P|H[1-6]|UL|OL)$/.test(b.tagName) || b.classList.contains('cb'))) return false;
  const t = detectTable(linesOfBlocks(tops));
  if (!t) return false;
  const built = tableMdFromDetected(t);
  const needTail = !tops[tops.length - 1].nextElementSibling;           // una tabla al final necesita un párrafo debajo para poder seguir escribiendo
  const nodes = replaceBlock(tops[0], domFromMd(built.md) + (needTail ? '<p><br></p>' : ''));
  tops.slice(1).forEach(b => b.remove());
  caretInto(nodes[0]);
  toast(T('msg.table-created', { r: built.rows, c: built.cols }));
  return true;
}

