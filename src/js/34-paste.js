"use strict";
/* ====== 14. Pegar ====== */
const looksMarkdown = t => /(^|\n)\s*(#{1,6}\s|[-*+•●◦▪‣∙\uF0B7]\s|\d+[.)]\s|>\s|```|\|)/.test(t) || /\n/.test(t) && /\|/.test(t);
ed.addEventListener('paste', e => {
  if (lineClip && getSelection().isCollapsed && e.clipboardData.getData('text/plain') === lineClip.text && pasteLine(lineClip)){ e.preventDefault(); return; }
  { const trp = tableRect();
    if (trp){
      const txtp = e.clipboardData.getData('text/plain');
      if (trp.multi){ History.mark(); clearCells(trp.cells); caretInto(trp.cells[0], false); }
      if (/\t/.test(txtp) && pasteGrid(txtp)){ e.preventDefault(); return; }      // columnas de una hoja de cálculo: se reparten por las celdas
    } }
  if (closestFrom(getSelection().anchorNode, '.cb')){ e.preventDefault(); insertCodeText(getSelection(), e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n')); return; }
  { const sp = getSelection(), tx = e.clipboardData.getData('text/plain').trim();                       // una dirección pegada sobre texto seleccionado: ese texto pasa a ser el enlace
    if (sp.rangeCount && !sp.isCollapsed && !/\s/.test(tx) && isUrl(tx) && ed.contains(sp.anchorNode) && !closestFrom(sp.anchorNode, 'a,[data-code],.cb')){
      const r = sp.getRangeAt(0), B = 'p,li,h1,h2,h3,h4,h5,h6,td,th';
      if (closestFrom(r.startContainer, B) === closestFrom(r.endContainer, B)){
        e.preventDefault(); History.mark();
        const a = document.createElement('a'); a.setAttribute('href', hrefOf(tx));
        try { a.appendChild(r.extractContents()); r.insertNode(a); } catch(_){ return; }
        const tn = document.createTextNode('\u200b'); a.after(tn); const rr = document.createRange(); rr.setStart(tn, 1); rr.collapse(true); sp.removeAllRanges(); sp.addRange(rr);
        after(); History.snap(true); return;
      }
    } }
  e.preventDefault(); History.mark();
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  let md;
  if (text && looksMarkdown(text)) md = text;
  else if (html){
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,meta,link,title,noscript').forEach(n => n.remove());
    const host = document.createElement('div');
    host.innerHTML = doc.body.innerHTML;
    normalizeForeign(host);
    md = mdFromDom(host);
  } else md = text || '';
  md = tidyMd(md);
  if (!md){ return; }

  const nodes = [...document.createRange().createContextualFragment(domFromMd(md)).childNodes];
  const s = getSelection();
  if (!(s.rangeCount && closestFrom(s.anchorNode, '[data-code],a,.cb'))){            // comandos y rutas pegados → código en línea
    const one = nodes.length === 1 && nodes[0].tagName === 'P';
    let gl = false, gr = false;
    if (one && s.rangeCount){                                                          // pegado pegado a otra palabra: esa palabra no se toca
      const r0 = s.getRangeAt(0), bk = closestFrom(r0.startContainer, 'p,li,h1,h2,h3,h4,h5,h6,td,th') || ed;
      const pr = document.createRange(); pr.selectNodeContents(bk); pr.setEnd(r0.startContainer, r0.startOffset);
      const nr = document.createRange(); nr.selectNodeContents(bk); nr.setStart(r0.endContainer, r0.endOffset);
      gl = /\S$/.test(pr.toString().replace(/\u200b/g, '')); gr = /^\S/.test(nr.toString().replace(/\u200b/g, ''));
    }
    nodes.forEach(n => { if (n.nodeType === 1) codeifyNode(n, one && gl, one && gr); });
  }
  if (s.rangeCount) s.getRangeAt(0).deleteContents();
  const block = currentBlock();
  if (nodes.length === 1 && nodes[0].tagName === 'P' && block && s.rangeCount){
    const r = s.getRangeAt(0);
    const inner = document.createDocumentFragment();
    [...nodes[0].childNodes].forEach(n => inner.appendChild(n));
    const lastNode = inner.lastChild;
    r.insertNode(inner);
    if (lastNode){ const rr = document.createRange();
      if (lastNode.nodeType === 1 && /^(SPAN|A|STRONG|EM|S|CODE)$/.test(lastNode.tagName)){ const tn = document.createTextNode('\u200b'); lastNode.after(tn); rr.setStart(tn, 1); }   // el cursor queda fuera del código o enlace pegado
      else rr.setStartAfter(lastNode);
      rr.collapse(true); s.removeAllRanges(); s.addRange(rr); }
  } else {
    let ref = block;
    nodes.forEach(n => { ref.parentNode.insertBefore(n, ref.nextSibling); ref = n; });
    if (block && !block.textContent.trim() && block.tagName !== 'HR' && !(block.querySelector && block.querySelector('img'))) block.remove();
    caretInto(nodes[nodes.length - 1], true); caretOutOfInline(nodes[nodes.length - 1]);
  }
  mergeAdjacentLists();
  renumberLists(true);
  after(); History.snap(true);
});
function normalizeForeign(host){
  host.querySelectorAll('span[data-code]').forEach(sp => { const c = document.createElement('code'); c.innerHTML = sp.innerHTML; sp.replaceWith(c); });
  host.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
  host.querySelectorAll('*').forEach(el => {
    el.removeAttribute('style'); el.removeAttribute('class'); el.removeAttribute('id');
    const t = el.tagName;
    if (/^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|FIGURE)$/.test(t)){
      const p = document.createElement('p'); p.innerHTML = el.innerHTML; el.replaceWith(p);
    } else if (/^(SPAN|FONT|U|MARK|SMALL|LABEL|ABBR)$/.test(t)) el.replaceWith(...el.childNodes);
  });
  host.querySelectorAll('p').forEach(p => {
    if (p.querySelector('p,ul,ol,table,pre,h1,h2,h3,h4,h5,h6,blockquote')) p.replaceWith(...p.childNodes);
  });
  [...host.childNodes].forEach(n => {
    if (n.nodeType === 3){
      if (!n.nodeValue.trim()) return n.remove();
      const p = document.createElement('p'); p.textContent = n.nodeValue; n.replaceWith(p);
    }
  });
}

