"use strict";
/* ====== 79. Edición múltiple (Ctrl+D, Ctrl+Shift+L, Shift+Alt+I) ====== */
// A rich text editor in the browser has one cursor. Multi-edit emulates VS Code's cursors: a list of places
// (a text node, an offset and a selected length); what you type, delete or paste is applied in all of them
// at once, as one undo step. The places are painted with the CSS Highlight API. Esc, a click, arrows or
// leaving the document ends it.
const ME = { on: false, items: [], marked: false };   // marked: typing in a row is one undo step
const meNodes = () => textNodes().filter(n => !closestFrom(n, '.cb-head,.cb-hl,[contenteditable="false"]'));
function mePaint(){
  if (!(window.CSS && CSS.highlights)) return;
  if (!ME.on){ CSS.highlights.delete('multi'); CSS.highlights.delete('multi-caret'); return; }
  const sel = [], car = [];
  ME.items.forEach(it => {
    if (!it.node.isConnected) return;
    const r = document.createRange(); r.setStart(it.node, it.start); r.setEnd(it.node, it.start + it.len);
    (it.len ? sel : car).push(r);
    if (!it.len){ const r2 = document.createRange(); const e = Math.min(it.node.length, it.start + 1), b = Math.max(0, e - 1); r2.setStart(it.node, b); r2.setEnd(it.node, e); car.push(r2); }
  });
  CSS.highlights.set('multi', new Highlight(...sel));
  CSS.highlights.set('multi-caret', new Highlight(...car));
}
function meStart(items){
  ME.items = items; ME.on = items.length > 0;
  mePlaceCaret(); mePaint();
  if (ME.on) toast(T('msg.multi', { n: items.length }));
}
function meStop(){ if (!ME.on) return; ME.on = false; ME.items = []; mePaint(); if (ME.marked){ History.snap(true); ME.marked = false; } }
// the real caret/selection follows the last place added
function mePlaceCaret(){
  const it = ME.items[ME.items.length - 1]; if (!it || !it.node.isConnected) return;
  const r = document.createRange(); r.setStart(it.node, it.start); r.setEnd(it.node, it.start + it.len);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const el = it.node.parentElement; if (el) el.scrollIntoView({ block: 'nearest' });
}
// apply an edit to every place: insert text (replacing the selected part) or delete one character backward/forward
function meApply(kind, text){
  if (!ME.marked){ History.mark(); ME.marked = true; }
  const byNode = new Map();
  ME.items.forEach(it => { if (it.node.isConnected){ if (!byNode.has(it.node)) byNode.set(it.node, []); byNode.get(it.node).push(it); } });
  byNode.forEach(list => {
    list.sort((a, b) => a.start - b.start);
    let shift = 0;
    list.forEach(it => {
      it.start += shift;
      const d = it.node.data; let from = it.start, to = it.start + it.len, ins = '';
      if (kind === 'insert') ins = text;
      else if (!it.len){ if (kind === 'back' && from > 0) from--; else if (kind === 'fwd' && to < d.length) to++; }
      it.node.data = d.slice(0, from) + ins + d.slice(to);
      shift += ins.length - (to - from);
      it.start = from + ins.length; it.len = 0;
    });
  });
  mePlaceCaret(); mePaint();
  after(); History.snap();                                         // debounced: a burst of typing becomes one step
  clearTimeout(ME.t); ME.t = setTimeout(() => { ME.marked = false; }, 300);
}
// the word around the caret
function wordAtCaret(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const n = s.anchorNode; if (n.nodeType !== 3) return null;
  const t = n.data, o = s.anchorOffset, isW = c => /[\p{L}\p{N}_]/u.test(c);
  let a = o, b = o; while (a > 0 && isW(t[a - 1])) a--; while (b < t.length && isW(t[b])) b++;
  return a < b ? { node: n, start: a, len: b - a } : null;
}
// places of the current selection (inside one text node), or of the word at the caret
function meSeed(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0);
  if (!r.collapsed && r.startContainer === r.endContainer && r.startContainer.nodeType === 3) return { node: r.startContainer, start: r.startOffset, len: r.endOffset - r.startOffset };
  if (r.collapsed) return wordAtCaret();
  return null;
}
function meAllMatches(needle){
  const out = [];
  meNodes().forEach(n => { let i = n.data.indexOf(needle); while (i >= 0){ out.push({ node: n, start: i, len: needle.length }); i = n.data.indexOf(needle, i + needle.length); } });
  return out;
}
const meText = it => it.node.data.substr(it.start, it.len);
const meSame = (a, b) => a.node === b.node && a.start === b.start;
// Ctrl+D: first the word, then each next match (wrapping around)
function multiNext(){
  if (!ME.on){
    const s = getSelection(), seed = meSeed(); if (!seed) return;
    if (s.isCollapsed){ const r = document.createRange(); r.setStart(seed.node, seed.start); r.setEnd(seed.node, seed.start + seed.len); s.removeAllRanges(); s.addRange(r); return; }
    ME.items = [seed]; ME.on = true;
  }
  const needle = meText(ME.items[0]); if (!needle) return;
  const all = meAllMatches(needle); if (!all.length) return;
  const last = ME.items[ME.items.length - 1], nodes = meNodes();
  const pos = it => nodes.indexOf(it.node) * 1e7 + it.start;
  const after1 = all.filter(m => pos(m) > pos(last)).concat(all.filter(m => pos(m) <= pos(last)));
  const next = after1.find(m => !ME.items.some(it => meSame(it, m)));
  if (!next){ toast(T('msg.no-more-matches')); mePaint(); return; }
  ME.items.push(next); mePlaceCaret(); mePaint();
  toast(T('msg.multi', { n: ME.items.length }));
}
// Ctrl+Shift+L: every match of the selection (or of the word at the caret)
function multiAll(){
  const seed = ME.on ? ME.items[0] : meSeed(); if (!seed) return;
  const needle = meText(seed); if (!needle) return;
  meStart(meAllMatches(needle));
}
// Shift+Alt+I: a cursor at the end of each selected line (block, list item or line of a paragraph)
function multiLineEnds(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode) || s.isCollapsed) return;
  const r = s.getRangeAt(0), nodes = meNodes().filter(n => n.data.length && r.intersectsNode(n));
  // a line ends at the last text before a <br>, or at the last text of its block / list item
  const unitOf = n => closestFrom(n, 'li') || topBlockOf(n);
  const ends = nodes.filter((n, i) => {
    let x = n; while (x.parentNode && x.parentNode !== unitOf(n) && !x.nextSibling) x = x.parentNode;
    const nx = x.nextSibling;
    return (nx && nx.nodeName === 'BR') || !nodes[i + 1] || unitOf(nodes[i + 1]) !== unitOf(n);
  });
  const items = ends.map(n => ({ node: n, start: n.data.length, len: 0 }));
  if (items.length) meStart(items);
}

ed.addEventListener('beforeinput', e => {
  if (!ME.on) return;
  const t = e.inputType;
  if (t === 'insertText' || t === 'insertReplacementText'){ e.preventDefault(); meApply('insert', e.data || ''); return; }
  if (t === 'insertFromPaste'){ e.preventDefault(); const txt = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || ''; meApply('insert', txt.replace(/\r?\n/g, ' ')); return; }
  if (t === 'deleteContentBackward'){ e.preventDefault(); meApply('back'); return; }
  if (t === 'deleteContentForward'){ e.preventDefault(); meApply('fwd'); return; }
  meStop();                                                        // anything else (Enter, formatting...) ends multi-edit
});
ed.addEventListener('paste', e => {
  if (!ME.on) return;
  e.preventDefault(); e.stopImmediatePropagation();
  meApply('insert', (e.clipboardData.getData('text/plain') || '').replace(/\r?\n/g, ' '));
}, true);
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (veil.classList.contains('show') || B.sel.size) return;
  const inEd = document.activeElement === ed || ed.contains(document.activeElement);
  if (inEd && mod && !e.altKey && !e.shiftKey && k === 'd'){ e.preventDefault(); e.stopImmediatePropagation(); multiNext(); return; }
  if (inEd && mod && e.shiftKey && !e.altKey && k === 'l'){ e.preventDefault(); e.stopImmediatePropagation(); multiAll(); return; }
  if (inEd && e.shiftKey && e.altKey && !mod && (k === 'i' || e.code === 'KeyI')){ e.preventDefault(); e.stopImmediatePropagation(); multiLineEnds(); return; }
  if (!ME.on) return;
  if (e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); meStop(); return; }
  if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Enter' || e.key === 'Tab' || (mod && !['z', 'y', 'v', 'c', 'shift', 'control'].includes(k))) meStop();
  if (mod && (k === 'z' || k === 'y')) meStop();
}, true);
ed.addEventListener('mousedown', () => meStop());
ed.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ed) meStop(); }, 0));
