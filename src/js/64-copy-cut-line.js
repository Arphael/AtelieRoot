"use strict";
/* ====== 52. Copiar y cortar la línea sin seleccionarla (como VS Code) ====== */
// Sin selección, Ctrl+C copia y Ctrl+X corta la «línea» donde está el cursor (la misma que borra Shift+Supr).
// Al pegar esa línea con el cursor sin seleccionar, entra ENCIMA de la línea actual, igual que en VS Code.
let lineClip = null;
function lineUnit(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  const src = closestFrom(r.startContainer, SRC);
  if (src){
    const lines = src.textContent.split('\n');
    const off = textOffsetIn(src, r.startContainer, r.startOffset);
    let acc = 0, idx = lines.length - 1;
    for (let i = 0; i < lines.length; i++){ if (off <= acc + lines[i].length){ idx = i; break; } acc += lines[i].length + 1; }
    return { kind: 'code', raw: lines[idx] };
  }
  const li = closestFrom(r.startContainer, 'li');
  if (li){
    const list = li.parentElement, items = [...list.children].filter(x => x.tagName === 'LI');
    const wrap = document.createElement(list.tagName.toLowerCase());
    if (list.tagName === 'OL') setOlStart(wrap, (Number.isFinite(list.start) ? list.start : 1) + items.indexOf(li));
    if (list.hasAttribute('data-task')) wrap.setAttribute('data-task', '');
    wrap.appendChild(li.cloneNode(true));
    const host = document.createElement('div'); host.appendChild(wrap);
    const liMd = tidyMd(mdFromDom(host)).trim(); forOutsideHtml(host);
    return { kind: 'li', md: liMd, html: host.innerHTML };
  }
  const cell = closestFrom(r.startContainer, 'td,th');
  if (cell){
    const tr = cell.closest('tr');
    return { kind: 'row', md: '| ' + [...tr.children].map(c => inlineMd(c).trim().replace(/\s*\n\s*/g, '<br>').replace(/\|/g, '\\|')).join(' | ') + ' |' };
  }
  const b = currentBlock(); if (!b) return null;
  if (b.tagName === 'P'){
    const info = paraInfo(b);
    if (info.lines.length > 1){
      const i = lineAt(b, r.startContainer, r.startOffset, info);
      const host = document.createElement('div'); info.lines[i].forEach(n => host.appendChild(n.cloneNode(true)));
      const lnMd = inlineMd(host).trim(); forOutsideHtml(host);
      return { kind: 'line', md: lnMd, html: host.innerHTML };
    }
  }
  const host = document.createElement('div');
  withSections([b]).forEach(x => host.appendChild(x.cloneNode(true)));
  host.querySelectorAll('.cb-head,.cb-hl').forEach(h => h.remove());
  host.querySelectorAll('[data-hid]').forEach(h => h.removeAttribute('data-hid'));
  const md = tidyMd(mdFromDom(host)).trim();
  forOutsideHtml(host);
  return { kind: 'block', md, html: host.innerHTML };
}
function setLineClipboard(e){
  const u = lineUnit(); if (!u) return false;
  const body = u.kind === 'code' ? u.raw : (u.kind === 'row' ? u.md : withFills(u.md));
  const text = body + '\n';                                          // como VS Code: la línea completa, con su salto
  e.clipboardData.setData('text/plain', text);
  if (u.html) e.clipboardData.setData('text/html', u.html);
  lineClip = Object.assign({ text }, u);
  return true;
}
ed.addEventListener('cut', e => {
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  const trx = tableRect();
  if (trx && trx.multi){ e.preventDefault(); lineClip = null; writeTableClip(e, trx); History.mark(); clearCells(trx.cells); after(); History.snap(true); return; }
  if (s.isCollapsed){
    if (!setLineClipboard(e)) return;
    e.preventDefault(); deleteCaretUnit(); toast('Línea cortada'); return;
  }
  if (closestFrom(s.anchorNode, '.cb')) return;                      // dentro de un bloque de código lo corta el propio navegador
  const md = selectionMd(); if (md === null) return;
  const host = document.createElement('div');
  host.appendChild(s.getRangeAt(0).cloneContents());
  forOutsideHtml(host);
  e.clipboardData.setData('text/plain', withFills(md));
  e.clipboardData.setData('text/html', host.innerHTML);
  e.preventDefault(); lineClip = null;
  History.mark(); document.execCommand('delete'); after(); History.snap(true);
});
// pega una línea copiada sin selección: entra encima de la línea donde está el cursor, y el cursor se queda en su línea
function pasteLine(c){
  if (c.kind === 'row') return false;
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return false;
  const r = s.getRangeAt(0);
  const toNodes = html => [...document.createRange().createContextualFragment(html).childNodes];
  const blocksFor = () => c.kind === 'code' ? toNodes('<p>' + esc(c.raw) + '</p>') : c.kind === 'line' ? toNodes('<p>' + c.html + '</p>') : toNodes(domFromMd(c.md));
  const done = () => { renumberLists(true); after(); History.snap(true); return true; };
  History.mark();
  // dentro de un bloque de código: una línea nueva encima de la actual
  const src = closestFrom(r.startContainer, SRC);
  if (src){
    const text = c.kind === 'code' ? c.raw : c.md;
    const full = src.textContent, off = textOffsetIn(src, r.startContainer, r.startOffset);
    const ls = off === 0 ? 0 : full.lastIndexOf('\n', off - 1) + 1;
    src.textContent = full.slice(0, ls) + text + '\n' + full.slice(ls);
    const rr = document.createRange(); rr.setStart(src.firstChild, off + text.length + 1); rr.collapse(true); s.removeAllRanges(); s.addRange(rr);
    const cb = src.closest('.cb'); if (cb) hlBlock(cb, true);
    return done();
  }
  // en una lista: un punto nuevo encima del actual (o el bloque, partiendo la lista)
  const li = closestFrom(r.startContainer, 'li');
  if (li){
    if (c.kind === 'li'){
      const tmp = document.createElement('div'); tmp.innerHTML = c.html;
      const item = tmp.querySelector(':scope > ul > li, :scope > ol > li');
      if (!item) return false;
      li.before(item);
    } else if (c.kind === 'line' || c.kind === 'code'){
      const nli = document.createElement('li'); nli.innerHTML = c.kind === 'code' ? esc(c.raw) : c.html; li.before(nli);
    } else {
      const list = li.parentElement;
      if (list.parentElement !== ed) return false;
      const items = [...list.children].filter(x => x.tagName === 'LI'), nodes = blocksFor();
      if (items[0] === li) nodes.forEach(n => list.before(n));
      else {
        const L2 = list.cloneNode(false);
        items.slice(items.indexOf(li)).forEach(x => L2.appendChild(x));
        if (L2.tagName === 'OL') L2.setAttribute('data-cont', '');
        list.after(L2); nodes.forEach(n => L2.before(n));
      }
    }
    return done();
  }
  const b = currentBlock(); if (!b) return false;
  if (b.tagName === 'P'){
    const info = paraInfo(b);
    if (info.lines.length > 1){
      const i = lineAt(b, r.startContainer, r.startOffset, info);
      if (c.kind === 'line' || c.kind === 'code'){                    // otra línea encima, dentro del mismo párrafo
        const frag = document.createDocumentFragment();
        if (c.kind === 'code') frag.appendChild(document.createTextNode(c.raw)); else frag.appendChild(document.createRange().createContextualFragment(c.html));
        frag.appendChild(document.createElement('br'));
        const ref = info.lines[i][0] || info.brs[i] || null;
        ref ? b.insertBefore(frag, ref) : b.appendChild(frag);
        return done();
      }
      if (i > 0){                                                      // un bloque: se parte el párrafo justo antes de la línea actual
        const pos = textOffsetIn(b, r.startContainer, r.startOffset);
        const mk = (from, to) => {
          const p = document.createElement('p'); [...b.attributes].forEach(a => p.setAttribute(a.name, a.value));
          for (let j = from; j <= to; j++){ info.lines[j].forEach(x => p.appendChild(x)); if (j < to) p.appendChild(info.brs[j]); }
          return p;
        };
        const head = mk(0, i - 1), tail = mk(i, info.lines.length - 1);
        if (info.trail) tail.appendChild(info.trail);
        const headLen = head.textContent.length;
        b.replaceWith(head, ...blocksFor(), tail);
        setCaretByOffset(tail, Math.max(0, pos - headLen));
        return done();
      }
    }
  }
  blocksFor().forEach(n => b.before(n));                               // en cualquier otro caso: encima del bloque actual
  return done();
}

