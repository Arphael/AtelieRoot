"use strict";
/* ====== 87. Texto que no se copia ====== */
// Select text and mark it «do not copy» (Ctrl+K N, right click, command palette): it stays in the document and in the
// .md, but copies leave it out (Ctrl+C with or without a selection, «Copy Markdown», «Copy formatted», the live
// Markdown's copy button). Cut and exports are not affected. Anchor: <span data-nocopy> in the internal HTML, which
// mdFromDom ignores; with a folder open wsCapture keeps it in .atelieroot/state.json (like comments).
const ncSpans = host => [...(host || ed).querySelectorAll('span[data-nocopy]')];
/** removes the marked text from a copy (a detached element) */
function stripNoCopy(host){
  const spans = ncSpans(host); if (!spans.length) return host;
  spans.forEach(sp => sp.remove());
  // what held only marked text goes too (an empty list item would still copy as "-", an empty bold as "****");
  // table cells stay, so the table keeps its shape
  const empty = el => !el.textContent.replace(/[​\s]/g, '') && !el.querySelector('img,hr,td,th');
  [...host.querySelectorAll('strong,em,b,i,s,a,code,span,li,p,h1,h2,h3,h4,h5,h6,blockquote')].reverse().forEach(el => { if (empty(el)) el.remove(); });
  host.querySelectorAll('ul,ol').forEach(l => { if (!l.querySelector('li')) l.remove(); });
  return host;
}
/** Markdown of a copy of the whole editor without the marked text */
function docMdForCopy(){ const d = document.createElement('div'); d.innerHTML = ed.innerHTML; stripNoCopy(d); return tidyMd(mdFromDom(d)); }
// the pieces of text inside a selection, of any size (several paragraphs, lists, tables, bold...): each text node
// cut to the selection; code blocks are left alone (their text is the code itself)
function ncPieces(r){
  const out = [], w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, { acceptNode: n => r.intersectsNode(n) && !closestFrom(n, '.cb') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  let n;
  while ((n = w.nextNode())){
    const s = n === r.startContainer ? r.startOffset : 0, e = n === r.endContainer ? r.endOffset : n.length;
    if (e > s && n.data.slice(s, e).replace(/​/g, '').trim()) out.push({ n, s, e });
  }
  return out;
}
const ncIn = n => closestFrom(n, 'span[data-nocopy]');
// spans of «do not copy» one after another become one (tidier HTML, the same text)
function ncMerge(){
  ncSpans().forEach(sp => { let nx; while ((nx = sp.nextSibling) && nx.nodeType === 1 && nx.matches('span[data-nocopy]')){ while (nx.firstChild) sp.appendChild(nx.firstChild); nx.remove(); } });
}
// Ctrl+K N: marks every piece of the selection that is not marked yet; if all of it is already marked, unmarks it.
// With the cursor inside a marked piece (no selection), unmarks that piece.
function toggleNoCopyRange(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast(T('msg.nc-need-sel'));
  if (s.isCollapsed){
    const sp = ncIn(s.anchorNode); if (!sp) return toast(T('msg.nc-need-sel'));
    History.mark(); sp.replaceWith(...sp.childNodes); ed.normalize(); after(); History.snap(true);
    return toast(T('msg.nc-off'));
  }
  const r = s.getRangeAt(0), pieces = ncPieces(r);
  if (!pieces.length) return toast(closestFrom(s.anchorNode, '.cb') ? T('msg.nc-in-code') : T('msg.nc-need-sel'));
  History.mark();
  const todo = pieces.filter(p => !ncIn(p.n));
  if (!todo.length){                                                     // all marked already: the marks go
    new Set(pieces.map(p => ncIn(p.n))).forEach(sp => sp.replaceWith(...sp.childNodes));
    ed.normalize(); s.removeAllRanges(); after(); History.snap(true);
    return toast(T('msg.nc-off'));
  }
  todo.forEach(p => {                                                    // each text node on its own: no formatting is split
    let t = p.n;
    if (p.e < t.length) t.splitText(p.e);
    if (p.s > 0) t = t.splitText(p.s);
    const sp = document.createElement('span'); sp.setAttribute('data-nocopy', '');
    t.replaceWith(sp); sp.appendChild(t);
  });
  ncMerge(); s.removeAllRanges(); after(); History.snap(true);
  toast(T('msg.nc-on'));
}
// right click on a selection (or on a marked text): one item, the browser menu stays for everything else
[ed1, ed2].forEach(h => h.addEventListener('contextmenu', e => {
  if (e.defaultPrevented || e.target.closest('img')) return;
  const s = getSelection(), inMark = e.target.closest && e.target.closest('span[data-nocopy]');
  if (!inMark && (s.isCollapsed || !ed.contains(s.anchorNode))) return;
  e.preventDefault(); ncMenuRange = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
  ctxTarget = null;
  ctxMenu.innerHTML = '<button data-r="nocopy">' + esc(T(inMark ? 'nc.off' : 'nc.on')) + '</button>';
  ctxMenu.classList.add('show');
  ctxMenu.style.left = Math.max(8, Math.min(innerWidth - ctxMenu.offsetWidth - 8, e.clientX)) + 'px';
  ctxMenu.style.top = Math.max(8, Math.min(innerHeight - ctxMenu.offsetHeight - 8, e.clientY)) + 'px';
}));
const ncRowAction = rowAction;
let ncMenuRange = null;
rowAction = (act, n) => {
  if (act !== 'nocopy') return ncRowAction(act, n);
  if (ncMenuRange){ const s = getSelection(); s.removeAllRanges(); s.addRange(ncMenuRange); ncMenuRange = null; }
  toggleNoCopyRange();
};
COMMANDS.push({ g: 'pal.g.copy', t: 'pal.no-copy', run: () => toggleNoCopyRange() });
