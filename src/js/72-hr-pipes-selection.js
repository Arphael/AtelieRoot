"use strict";
/* ====== 64. «---» + Enter sobre cualquier formato: la línea divisoria va debajo ====== */
// En un punto de lista, un encabezado o una cita, «---» + Enter no crea otro punto ni otra línea: se quita ese «---»
// y la línea divisoria se pone debajo de todo el formato (lista entera, encabezado o cita), con un párrafo debajo.
function outermostChild(el){ let n = el; while (n && n.parentElement !== ed) n = n.parentElement; return n; }
function hrBelowFormat(sel){
  if (!sel.isCollapsed || !sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  if (closestFrom(r.startContainer, SRC) || closestFrom(r.startContainer, 'td,th')) return false;
  const norm = t => t.replace(/[\u200b\u00a0\s]/g, '').replace(/[\u2014\u2013]/g, '--');
  const li = closestFrom(r.startContainer, 'li');
  let block = null, kind = '', lineIdx = 0, info = null;
  if (li){
    if (li.querySelector('ul,ol') || !HR_LINE.test(norm(li.textContent))) return false;
    kind = 'li';
  } else {
    block = currentBlock();
    if (!block) return false;
    if (/^H[1-6]$/.test(block.tagName)){ if (!HR_LINE.test(norm(block.textContent))) return false; kind = 'h'; }
    else if (block.tagName === 'P' && block.hasAttribute('data-quote')){
      info = paraInfo(block); lineIdx = lineAt(block, r.startContainer, r.startOffset, info);
      if (!HR_LINE.test(norm((info.lines[lineIdx] || []).map(n => n.textContent).join('')))) return false;
      kind = 'q';
    } else return false;
  }
  History.mark();
  let nextSib;
  if (kind === 'li'){
    const top = outermostChild(li), list = li.parentElement;
    nextSib = top.nextElementSibling;
    li.remove();
    if (!list.children.length) list.remove();
    if (top.isConnected && /^(UL|OL)$/.test(top.tagName) && !top.querySelector('li')) top.remove();
  } else if (kind === 'h'){ nextSib = block.nextElementSibling; block.remove(); }
  else {
    nextSib = block.nextElementSibling;
    const n = info.lines.length;
    if (n === 1) block.remove();
    else {
      const lines = info.lines.slice(), brs = info.brs.slice();
      lines.splice(lineIdx, 1);
      if (lineIdx < n - 1) brs.splice(lineIdx, 1); else brs.splice(lineIdx - 1, 1);
      while (block.firstChild) block.removeChild(block.firstChild);
      lines.forEach((nodes, k) => { nodes.forEach(x => block.appendChild(x)); if (k < lines.length - 1) block.appendChild(brs[k]); });
      if (info.trail) block.appendChild(info.trail);
    }
  }
  const hr = document.createElement('hr');
  if (nextSib) nextSib.before(hr); else ed.appendChild(hr);
  let target = hr.nextElementSibling;
  if (!(target && target.tagName === 'P' && isBlankHtml(target.innerHTML) && !target.querySelector('img'))){
    target = document.createElement('p'); target.innerHTML = '<br>'; hr.after(target);
  }
  caretInto(target, false);
  return true;
}

/* ====== 65. Filas con | separadas por líneas en blanco ====== */
// Markdown como el que dan algunos asistentes: una fila por línea con líneas en blanco entre ellas y sin la fila de guiones.
// Se reconoce como una sola tabla (primera fila = encabezado) al pegar, importar u ordenar.
const isPipeRow = l => /^ {0,3}\|/.test(l) && (l.match(/(?<!\\)\|/g) || []).length >= 3;
function pipeRowsToTables(md){
  const L = md.replace(/\r\n?/g, '\n').split('\n'), out = [];
  let i = 0, fence = false;
  while (i < L.length){
    if (/^\s*```/.test(L[i])){ fence = !fence; out.push(L[i++]); continue; }
    if (fence || !isPipeRow(L[i])){ out.push(L[i++]); continue; }
    const rows = []; let j = i, gaps = false;
    while (j < L.length){
      if (isPipeRow(L[j]) || (/^ {0,3}\|/.test(L[j]) && isSepRow(L[j]))){ rows.push(L[j]); j++; }
      else if (!L[j].trim()){
        let k = j; while (k < L.length && !L[k].trim()) k++;
        if (k < L.length && (isPipeRow(L[k]) || (/^ {0,3}\|/.test(L[k]) && isSepRow(L[k])))){ gaps = true; j = k; } else break;
      } else break;
    }
    const sepAt = rows.findIndex(r => isSepRow(r)), data = rows.filter(r => !isSepRow(r));
    if ((!gaps && sepAt === 1) || data.length < 2){ for (let k = i; k < j; k++) out.push(L[k]); i = j; continue; }   // ya es una tabla válida, o una sola fila
    const cells = data.map(splitRow), cols = Math.max(...cells.map(r => r.length));
    const sepCells = sepAt >= 0 ? splitRow(rows[sepAt]) : [];
    const aligns = Array.from({ length: cols }, (_, c) => { const t = (sepCells[c] || '').trim(); return /^:-*:$/.test(t) ? ':---:' : /-:$/.test(t) ? '---:' : /^:/.test(t) ? ':---' : '---'; });
    const line = r => '| ' + Array.from({ length: cols }, (_, c) => (r[c] || '').trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
    out.push(line(cells[0]), '| ' + aligns.join(' | ') + ' |', ...cells.slice(1).map(line));
    i = j;
  }
  return out.join('\n');
}

/* ====== 66. Selección por bloques: no se pierde al desplazarse ====== */
function extendBlockSel(dir){
  const all = blockEls().filter(b => b.getBoundingClientRect().height > 0);
  const cur = all.filter(b => B.sel.has(b));
  if (!cur.length) return;
  const nb = all[dir < 0 ? all.indexOf(cur[0]) - 1 : all.indexOf(cur[cur.length - 1]) + 1];
  if (!nb) return;
  setBlockSel(withSections([...cur, nb]));
  nb.scrollIntoView({ block: 'nearest' });
}

