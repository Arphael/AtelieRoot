"use strict";
/* ====== 68. Esquema: marca el encabezado donde estás ====== */
// Si el cursor está en el documento y a la vista, vale el encabezado de su sección; si no, el de la parte que estás viendo.
let olHeads = [], olBtns = [], olCur = -2, olRaf = 0, olHold = 0;
function curHeadingIdx(){
  if (!olHeads.length) return -1;
  const sr = scroll.getBoundingClientRect(), s = getSelection();
  if (document.activeElement === ed && s.rangeCount && ed.contains(s.anchorNode)){
    let blk = s.anchorNode;
    while (blk && blk.parentElement !== ed) blk = blk.parentElement;
    if (blk && blk.nodeType === 1){
      const r = blk.getBoundingClientRect();
      if (r.bottom > sr.top && r.top < sr.bottom){
        let idx = -1;
        olHeads.forEach((h, k) => { if (h === blk || (h.compareDocumentPosition(blk) & Node.DOCUMENT_POSITION_FOLLOWING)) idx = k; });
        return idx;
      }
    }
  }
  const line = sr.top + Math.min(120, sr.height * 0.25);
  let idx = -1;
  olHeads.forEach((h, k) => { if (!h.hasAttribute('data-hid') && h.getBoundingClientRect().top <= line) idx = k; });
  return idx;
}
function setOutlineCur(i){
  olCur = i;
  olBtns.forEach((b, k) => { b.classList.toggle('cur', k === i); k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); });
  const b = olBtns[i], box = $('#olList');
  if (b && box){                                                           // que el marcado se vea sin mover el resto de la página
    if (b.offsetTop < box.scrollTop + 4) box.scrollTop = Math.max(0, b.offsetTop - 8);
    else if (b.offsetTop + b.offsetHeight > box.scrollTop + box.clientHeight - 4) box.scrollTop = b.offsetTop + b.offsetHeight - box.clientHeight + 8;
  }
}
function markOutline(){
  olRaf = 0;
  if (!state.outline || !olBtns.length || Date.now() < olHold) return;
  const i = curHeadingIdx();
  if (i !== olCur) setOutlineCur(i);
}
const markOutlineSoon = () => { if (state.outline && !olRaf) olRaf = requestAnimationFrame(markOutline); };
document.addEventListener('selectionchange', markOutlineSoon);
[scroll1, scroll2].forEach(sc => sc.addEventListener('scroll', () => { if (sc === scroll) markOutlineSoon(); }, { passive: true }));

