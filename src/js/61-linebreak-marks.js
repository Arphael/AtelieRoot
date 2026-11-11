"use strict";
/* ====== 48. Marca de los saltos de línea (↵ al final de la línea) ====== */
// Se dibuja en una capa aparte, fuera del documento: no forma parte del texto ni de lo que se copia.
const NL = [{ ed: ed1, sc: scroll1, layer: null, raf: 0 }, { ed: ed2, sc: scroll2, layer: null, raf: 0 }];
NL.forEach(p => {
  const l = document.createElement('div');
  l.className = 'nl-layer'; l.setAttribute('aria-hidden', 'true');
  p.sc.appendChild(l); p.layer = l;
});
// el <br> final de un bloque solo mantiene visible una línea vacía: no es un salto real y no se marca
function isTrailingBr(br, block){
  const r = document.createRange();
  r.setStartAfter(br); r.setEnd(block, block.childNodes.length);
  const d = document.createElement('div'); d.appendChild(r.cloneContents());
  return !edgeLeaf(d, false);
}
// posición donde termina un encabezado o una cita: tras su último carácter visible, o en la línea vacía final si la hay
// posición donde termina una hoja de texto: tras su último carácter visible, o al inicio de la línea vacía si es un <br>
function leafEndRect(leaf){
  if (!leaf) return null;
  if (leaf.nodeName === 'BR') return leaf.getBoundingClientRect();
  if (leaf.nodeName === 'IMG'){ const r = leaf.getBoundingClientRect(); return { left: r.right, top: r.top, height: r.height }; }
  let off = leaf.nodeValue.length;
  while (off > 0 && leaf.nodeValue[off - 1] === '\u200b') off--;
  if (!off) return null;
  const rg = document.createRange();
  rg.setStart(leaf, off - 1); rg.setEnd(leaf, off);
  const rects = rg.getClientRects();
  const rc = rects.length ? rects[rects.length - 1] : null;
  return rc ? { left: rc.right, top: rc.top, height: rc.height } : null;
}
const blockEndRect = blk => leafEndRect(edgeLeaf(blk, true));
// último contenido propio de un punto de lista, sin entrar en sus sublistas
function lastOwnLeaf(li){
  const kids = [...li.childNodes];
  for (let i = kids.length - 1; i >= 0; i--){
    const k = kids[i];
    if (k.nodeType === 1 && /^(UL|OL)$/.test(k.nodeName)) continue;
    if (isBlankNode(k)) continue;
    if (k.nodeType === 3 || k.nodeName === 'BR' || k.nodeName === 'IMG') return k;
    const l = edgeLeaf(k, true); if (l) return l;
  }
  return null;
}
function drawBreaks(p){
  if (!state.breaks || !p.ed.offsetParent){ p.layer.replaceChildren(); return; }
  const sr = p.sc.getBoundingClientRect();
  const frag = document.createDocumentFragment();
  const put = r => {
    if (!r || !r.height) return;                                // bloque plegado u oculto
    const m = document.createElement('span');
    m.className = 'nl-mark'; m.textContent = '↵';
    m.style.left = (r.left - sr.left + p.sc.scrollLeft + 5) + 'px';
    m.style.top = (r.top - sr.top + p.sc.scrollTop + Math.max(0, (r.height - 13) / 2)) + 'px';
    frag.appendChild(m);
  };
  // saltos de línea escritos dentro de un bloque
  p.ed.querySelectorAll('br').forEach(br => {
    if (br.closest('.cb')) return;
    const blk = br.closest('p,li,h1,h2,h3,h4,h5,h6,td,th');
    if (!blk || isTrailingBr(br, blk)) return;
    put(br.getBoundingClientRect());
  });
  // además, el final de cada encabezado y de cada cita
  p.ed.querySelectorAll('h1,h2,h3,h4,h5,h6,p[data-quote]').forEach(blk => {
    if (!blk.closest('.cb')) put(blockEndRect(blk));
  });
  // y el del último punto de cada lista (viñetas, numerada o tareas)
  p.ed.querySelectorAll('ul,ol').forEach(list => {
    if (list.closest('.cb')) return;
    const items = [...list.children].filter(x => x.tagName === 'LI');
    if (items.length) put(leafEndRect(lastOwnLeaf(items[items.length - 1])));
  });
  p.layer.replaceChildren(frag);
}
function scheduleBreaks(){
  NL.forEach(p => { cancelAnimationFrame(p.raf); p.raf = requestAnimationFrame(() => drawBreaks(p)); });
}
NL.forEach(p => {
  new MutationObserver(scheduleBreaks).observe(p.ed, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-hid', 'data-fold'] });
  if (window.ResizeObserver) new ResizeObserver(scheduleBreaks).observe(p.ed);
});
addEventListener('resize', scheduleBreaks);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleBreaks);
function setBreaks(on){
  state.breaks = !!on;
  $('#nlBtn').classList.toggle('on', state.breaks);
  scheduleBreaks(); saveUi();
  toast(T(state.breaks ? 'msg.breaks-on' : 'msg.breaks-off'));
}
$('#nlBtn').onclick = () => setBreaks(!state.breaks);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === 'Digit8' || e.key === '*')){ e.preventDefault(); setBreaks(!state.breaks); }
}, true);

