"use strict";
/* ====== 91. Atajos que se pueden cambiar ====== */
// One place runs the app's commands from the keyboard: KM_ACTIONS (default keys) plus the person's changes
// (Ui.data.keys, { id: 'Alt+R' }). The shortcut list (78-shortcuts.js) changes them. Basic editing (copy, paste,
// undo, bold, arrows...) stays fixed, and system or browser shortcuts (KM_RESERVED) are never taken, now or later:
// a test checks every default against that list.
const KM_ACTIONS = [
  { id: 'search-all', t: 'kb.search-all', def: 'Ctrl+Shift+F', run: () => openSearchAll() },
  { id: 'rename', t: 'kb.rename', def: 'F2', run: () => renameAtCaret() },
  { id: 'goto', t: 'kb.goto', def: 'Ctrl+P', run: () => openSwitcher() },
  { id: 'palette', t: 'kb.palette', def: 'Ctrl+Shift+P', run: () => openPalette() },
  { id: 'find', t: 'kb.find', def: 'Ctrl+F', run: () => openFind(false) },
  { id: 'replace', t: 'kb.replace', def: 'Ctrl+H', run: () => openFind(true) },
  { id: 'focus', t: 'kb.focus', def: 'Ctrl+K Z', ed: true, run: () => toggleFocus() },
  { id: 'reading', t: 'kb.reading', def: 'Ctrl+K R', ed: true, run: () => toggleReading() },
  { id: 'no-copy', t: 'kb.no-copy', def: 'Ctrl+K N', ed: true, run: () => toggleNoCopyRange() },
  { id: 'cmt-toggle', t: 'kb.cmt-toggle', def: 'Ctrl+/', ed: true, run: () => addComment() },
  { id: 'cmt-add', t: 'kb.cmt-add', def: 'Ctrl+K Ctrl+C', ed: true, run: () => addComment() },
  { id: 'cmt-remove', t: 'kb.cmt-remove', def: 'Ctrl+K Ctrl+U', ed: true, run: () => removeComment() },
  { id: 'keys', t: 'kb.keys', def: 'Ctrl+K Ctrl+S', ed: true, run: () => openKeys() },
  { id: 'breaks', t: 'kb.breaks', def: 'Ctrl+Shift+8', run: () => setBreaks(!state.breaks) },
  { id: 'wrap', t: 'kb.wrap', def: 'Alt+Z', ed: true, run: () => { const on = !codeWrapOn(); setCodeWrap(on); toast(T(on ? 'msg.wrap-on' : 'msg.wrap-off')); } },
  { id: 'select-line', t: 'kb.select-line', def: 'Ctrl+L', ed: true, run: () => selectLineUnit() },
  { id: 'fold', t: 'kb.fold', def: 'Ctrl+.', ed: true, run: () => { const b = currentBlock(); toggleFold(b && sectionHeadOf(b)); } },
];
// taken by Windows or the browser (a page cannot or should not use them); Ctrl+Alt is AltGr on many keyboards
const KM_RESERVED = new Set(['Ctrl+Shift+V', 'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+R', 'Ctrl+O', 'Ctrl+J', 'Ctrl+U', 'Ctrl+Shift+R', 'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Ctrl+Shift+W',
  'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+Shift+C', 'Ctrl+Shift+B', 'Ctrl+Shift+Delete', 'Ctrl+Shift+Escape', 'Ctrl+Tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp', 'Ctrl+PageDown',
  'Ctrl+=', 'Ctrl++', 'Ctrl+-', 'Ctrl+0', 'Ctrl+F4', 'Ctrl+F5', 'Alt+F4', 'Alt+Tab', 'Alt+Space', 'Alt+D', 'Alt+Home', 'Alt+ArrowLeft', 'Alt+ArrowRight', 'Alt+Escape',
  'F1', 'F3', 'F5', 'F6', 'F7', 'F10', 'F11', 'F12', 'Shift+F10', 'PrintScreen']);
// basic editing: always these keys, not offered
const KM_FIXED = new Set(['Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+A', 'Ctrl+B', 'Ctrl+I', 'Ctrl+E', 'Ctrl+S', 'Ctrl+D', 'Ctrl+K',
  'Ctrl+Shift+X', 'Ctrl+Shift+L', 'Ctrl+Shift+K', 'Shift+Alt+I', 'Alt+ArrowUp', 'Alt+ArrowDown', 'Shift+Alt+ArrowUp', 'Shift+Alt+ArrowDown',
  'Ctrl+ArrowLeft', 'Ctrl+ArrowRight', 'Ctrl+Shift+ArrowLeft', 'Ctrl+Shift+ArrowRight', 'Ctrl+Home', 'Ctrl+End', 'Ctrl+Backspace', 'Ctrl+Delete', 'Ctrl+Enter', 'Shift+Delete', 'Ctrl+K K']);
const kmIsWin = /^Win/i.test(navigator.platform || '') || /Windows/.test(navigator.userAgent);
function kmReserved(c){ return !!c && (KM_RESERVED.has(c) || /(^|\+)Win\+/.test(c) || c.startsWith('Win+') || (/(^|\+)Ctrl\+/.test('+' + c) && /(^|\+)Alt\+/.test('+' + c))); }
// 'Ctrl+Shift+Alt+Key' (Shift+Alt+... keeps the order of the list: 'Shift+Alt+I')
function kmCombo(e){
  const k = e.key || '', c = e.code || '';
  if (/^(Control|Shift|Alt|Meta|AltGraph|OS)$/.test(k)) return '';
  let key, shift = e.shiftKey;
  if (k === '/' || k === '.' || c === 'NumpadDivide'){ key = c === 'NumpadDivide' ? '/' : k; shift = false; }   // '/' needs Shift on some layouts
  else if (/^Key[A-Z]$/.test(c)) key = c.slice(3);
  else if (/^Digit\d$/.test(c)) key = c.slice(5);
  else if (c === 'Slash') key = '/';
  else if (c === 'Period') key = '.';
  else if (k === ' ') key = 'Space';
  else if (k.length === 1) key = k.toUpperCase();
  else key = k;
  const p = [];
  if (e.metaKey && kmIsWin) p.push('Win');
  if (e.ctrlKey || (e.metaKey && !kmIsWin)) p.push('Ctrl');
  if (shift) p.push('Shift');
  if (e.altKey) p.push('Alt');
  return [...p, key].join('+');
}
// 'Ctrl+K Ctrl+C' and 'Ctrl+K C' are the same chord (both have always worked)
const kmCanon = s => String(s || '').replace(/^Ctrl\+K Ctrl\+/, 'Ctrl+K ');
const kmUser = () => (Ui.data && Ui.data.keys) || {};
const kmBind = a => Object.prototype.hasOwnProperty.call(kmUser(), a.id) ? kmUser()[a.id] : a.def;
const kmFind = (c, skip) => KM_ACTIONS.find(a => a.id !== skip && kmBind(a) && kmCanon(kmBind(a)) === kmCanon(c));
function kmKeyOf(id){ const a = KM_ACTIONS.find(x => x.id === id); return a ? kmBind(a) : ''; }

addEventListener('keydown', e => {
  if (KM.rec || veil.classList.contains('show')) return;
  const c = kmCombo(e); if (!c) return;
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  const inEd = document.activeElement === ed || ed.contains(document.activeElement) || document.body.classList.contains('reading');
  if (Chord.on){                                                   // the second key of Ctrl+K
    stop(); Chord.on = false; clearTimeout(Chord.t); restoreChordSel();
    if (c === 'K' || c === 'Ctrl+K'){ $('#linkBtn').click(); return; }
    const a = kmFind('Ctrl+K ' + c); if (a) a.run();
    return;
  }
  if (c === 'Ctrl+K' && inEd){ stop(); startChord(); return; }
  const a = kmFind(c);
  if (a){ if (a.ed && !inEd) return; stop(); a.run(); return; }
  if (KM_ACTIONS.some(x => kmCanon(x.def) === kmCanon(c))) stop();     // a default key the person moved away: it does nothing now
}, true);

/* ---- recording a new key in the shortcut list ---- */
const KM = { rec: null, pre: false };
function kmMsg(t, bad){ const m = card.querySelector('#kbMsg'); if (m){ m.textContent = t; m.classList.toggle('bad', !!bad); } }
function kmStartRec(id){ KM.rec = id; KM.pre = false; kmPaintRows(); kmMsg(T('kb.press')); }
function kmStopRec(){ KM.rec = null; KM.pre = false; kmPaintRows(); }
function kmSave(id, c){
  Ui.read(); const keys = Object.assign({}, Ui.data.keys || {}), a = KM_ACTIONS.find(x => x.id === id);
  if (c === null || kmCanon(c) === kmCanon(a.def)) delete keys[id]; else keys[id] = c;
  Ui.data.keys = keys; Ui.write();
  if (typeof rdLabels === 'function') rdLabels();
}
function kmTry(id, c){
  const chord = c.startsWith('Ctrl+K '), plain = !/(^|\+)(Ctrl|Alt|Win)\+/.test('+' + c) && !/^(Shift\+)?F\d+$/.test(c);
  let err = '';
  if (kmReserved(c) || (chord && kmReserved(c.slice(7)) && /(^|\+)(Alt|Win)\+/.test(c.slice(7)))) err = T('kb.err-system', { k: c });
  else if (KM_FIXED.has(kmCanon(c)) || KM_FIXED.has(c)) err = T('kb.err-fixed', { k: c });
  else if (!chord && plain) err = T('kb.err-plain', { k: c });
  else { const o = kmFind(c, id); if (o) err = T('kb.err-used', { k: c, t: T(o.t) }); }
  KM.rec = null; KM.pre = false;
  if (!err) kmSave(id, c);
  kmPaintRows(); kmMsg(err || T('kb.saved', { k: c }), !!err);
}
addEventListener('keydown', e => {
  if (!KM.rec) return;
  const c = kmCombo(e); if (!c) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (c === 'Escape' && !KM.pre){ kmStopRec(); kmMsg(''); return; }
  if (KM.pre) return kmTry(KM.rec, 'Ctrl+K ' + c);
  if (c === 'Ctrl+K'){ KM.pre = true; const r = card.querySelector('[data-km="' + KM.rec + '"] kbd'); if (r) r.textContent = 'Ctrl+K …'; return; }
  kmTry(KM.rec, c);
}, true);
// the rows of the shortcut list that can be changed (78-shortcuts.js draws them with data-km)
function kmPaintRows(){
  card.querySelectorAll('[data-km]').forEach(r => {
    const a = KM_ACTIONS.find(x => x.id === r.dataset.km); if (!a) return;
    const changed = Object.prototype.hasOwnProperty.call(kmUser(), a.id);
    r.classList.toggle('rec', KM.rec === a.id); r.classList.toggle('changed', changed);
    r.querySelector('kbd').textContent = KM.rec === a.id ? T('kb.press-short') : (kmBind(a) || T('kb.none'));
    r.querySelector('[data-km-reset]').hidden = !changed;
  });
}
function kmReset(id){
  const a = KM_ACTIONS.find(x => x.id === id), o = kmFind(a.def, id);
  if (o){ kmMsg(T('kb.err-used', { k: a.def, t: T(o.t) }), true); return; }
  kmSave(id, null); kmPaintRows(); kmMsg('');
}
function kmResetAll(){ Ui.read(); Ui.data.keys = {}; Ui.write(); if (typeof rdLabels === 'function') rdLabels(); kmPaintRows(); kmMsg(''); }
card.addEventListener('click', e => {
  const s = e.target.closest('[data-km-set]'), r = e.target.closest('[data-km-reset]');
  if (s){ e.preventDefault(); kmStartRec(s.closest('[data-km]').dataset.km); }
  else if (r){ e.preventDefault(); kmReset(r.closest('[data-km]').dataset.km); }
  else if (e.target.closest('#kbResetAll')){ e.preventDefault(); kmResetAll(); }
});
// the one HTML file (dist) is a single script: functions exist before these constants, so others ask this first
var KM_READY = true;
