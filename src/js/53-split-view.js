"use strict";
/* ====== 39. Vista dividida ====== */
const panes = [
  { el: $('#pane1'), ed: ed1, scroll: scroll1, doc: null, hist: null },
  { el: $('#pane2'), ed: ed2, scroll: scroll2, doc: null, hist: null }
];
let active = 0, split = false;
function activate(i, force){
  if (i === active && !force) return;
  if (!split && !force) return;
  const cur = panes[active];
  stash();
  cur.doc = state.current;
  cur.hist = { past: History.past, future: History.future, last: History.last, caretBefore: History.caretBefore };
  clearBlockSel();
  active = i;
  const p = panes[i];
  ed = p.ed; scroll = p.scroll;
  state.current = p.doc;
  if (p.hist){ History.past = p.hist.past; History.future = p.hist.future; History.last = p.hist.last; History.caretBefore = p.hist.caretBefore; }
  else History.init();
  // los controles flotantes viven en el panel activo
  [$('#tableBar'), $('#linkChip'), $('#bhandle'), $('#bline'), fbtn].forEach(x => scroll.appendChild(x));
  $('#linkChip').classList.remove('show'); $('#tableBar').classList.remove('show'); fbtn.classList.remove('show'); $('#bhandle').classList.remove('show');
  panes.forEach((x, k) => x.el.classList.toggle('active', k === i));
  renderTree(); setPath(); counts(); paintPreview(); sideRefresh(); refreshBar();
  if (F.open) runFind();
}
function paintPaneNames(){
  if (!split) return;
  panes.forEach((p, k) => {
    const id = k === active ? state.current : p.doc;
    const n = id ? findNode(id) : null;
    $(k === 0 ? '#p1name' : '#p2name').textContent = n ? pathOf(n.id) : T('split.no-doc');
  });
  state.split = { doc2: active === 1 ? state.current : panes[1].doc };
}
// si el documento ya está abierto en el otro panel, se salta a ese panel en vez de duplicarlo
function splitGuard(id){
  if (!split) return false;
  const other = 1 - active;
  const otherDoc = panes[other].doc;
  if (otherDoc === id){ activate(other); ed.focus({ preventScroll: true }); return true; }
  return false;
}
function enableSplit(docId, focusIt){
  if (!docId) return;
  if (docId === state.current) return toast(T('msg.already-open'));
  split = true;
  $('#edcol').classList.add('split');
  $('#splitBtn').classList.add('on');
  panes[0].doc = active === 0 ? state.current : panes[0].doc;
  activate(1, true);
  openDoc(docId);
  if (!focusIt) activate(0);
  paintPaneNames(); save(); scheduleFit();
}
function closeSplit(){
  if (!split) return;
  if (active === 1) activate(0);
  split = false;
  $('#edcol').classList.remove('split');
  $('#splitBtn').classList.remove('on');
  panes[1].doc = null; panes[1].hist = null;
  ed2.innerHTML = '';
  state.split = null; save(); scheduleFit();
}
function splitCheck(){
  if (!split) return;
  const other = panes[1 - active];
  if (other.doc && !findNode(other.doc)){ if (active === 1) activate(0); closeSplit(); }
}
function restoreSplit(){
  const d = state.split && state.split.doc2;
  if (d && state.docs[d] !== undefined && findNode(d) && d !== state.current) enableSplit(d, false);
  else state.split = null;
}
document.addEventListener('pointerdown', e => {
  if (!split) return;
  if (panes[1].el.contains(e.target)) activate(1);
  else if (panes[0].el.contains(e.target)) activate(0);
}, true);
document.addEventListener('focusin', e => {
  if (!split) return;
  if (ed2.contains(e.target)) activate(1);
  else if (ed1.contains(e.target)) activate(0);
});
$('#splitBtn').onclick = () => {
  if (split) return closeSplit();
  openSwitcher(id => enableSplit(id, true), T('msg.open-beside'));
};
$('#p2close').onclick = e => { e.stopPropagation(); closeSplit(); };
$('#p2pick').onclick = e => { e.stopPropagation(); activate(1); openSwitcher(id => { activate(1); openDoc(id); paintPaneNames(); }, T('split.open-here')); };

