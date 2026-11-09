"use strict";
/* ====== 43. Posición de lectura de cada documento ====== */
function docOfPane(i){ return split ? (i === active ? state.current : panes[i].doc) : (i === 0 ? state.current : null); }
function rememberScroll(i){
  const id = docOfPane(i); if (!id) return;
  const sc = i === 0 ? scroll1 : scroll2;
  const m = (Ui.data.scroll = Ui.data.scroll || {});
  let c = (m[id] || {}).c;
  if (i === active && document.activeElement === (i === 0 ? ed1 : ed2)){ const k = History.caret(); if (k != null) c = k; }
  m[id] = { y: Math.round(sc.scrollTop), c };
}
let scrollSaveT = 0;
[[scroll1, 0], [scroll2, 1]].forEach(([sc, i]) => EventTarget.prototype.addEventListener.call(sc, 'scroll', () => {
  rememberScroll(i); clearTimeout(scrollSaveT); scrollSaveT = setTimeout(() => Ui.write(), 500);
}, { passive: true }));
// el cursor se queda a la vista solo si salió de ella: no se mueve el documento por gusto
function ensureCaretVisible(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  let rc = s.getRangeAt(0).getBoundingClientRect();
  if (!rc.height && !rc.width){ const b = currentBlock(); if (!b) return; rc = b.getBoundingClientRect(); }
  const sr = scroll.getBoundingClientRect();
  if (rc.top < sr.top + 40) scroll.scrollTop += rc.top - sr.top - 80;
  else if (rc.bottom > sr.bottom - 40) scroll.scrollTop += rc.bottom - sr.bottom + 80;
}

