"use strict";
/* ====== 30. Cierre automático de pares ====== */
const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);
function charsAround(sel){
  const n = sel.anchorNode, o = sel.anchorOffset;
  if (!n) return { prev: '', next: '' };
  if (n.nodeType === 3) return { prev: n.nodeValue[o - 1] || '', next: n.nodeValue[o] || '' };
  const txt = x => (x && x.nodeName !== 'BR' && x.nodeName !== 'IMG' ? x.textContent : '').replace(/\u200b/g, '');
  return { prev: txt(n.childNodes[o - 1]).slice(-1), next: txt(n.childNodes[o]).charAt(0) };
}
function autoPair(e, sel){
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || !sel.rangeCount) return false;
  const k = e.key;
  if (k === 'Backspace'){
    if (!sel.isCollapsed) return false;
    const { prev, next } = charsAround(sel);
    if (PAIRS[prev] && PAIRS[prev] === next){
      e.preventDefault(); History.mark();
      const n = sel.anchorNode, o = sel.anchorOffset;
      const r = document.createRange();
      r.setStart(n, o - 1); r.setEnd(n, o + 1); r.deleteContents();
      const c = document.createRange(); c.setStart(n, o - 1); c.collapse(true);
      sel.removeAllRanges(); sel.addRange(c);
      after(); History.snap(true);
      return true;
    }
    return false;
  }
  if (k.length !== 1) return false;
  const { prev, next } = charsAround(sel);
  if (CLOSERS.has(k) && sel.isCollapsed && next === k){
    e.preventDefault();
    sel.modify('move', 'forward', 'character');
    if (k === ')' || k === '`' || k === ']') runInline();
    return true;
  }
  if (!PAIRS[k]) return false;
  if (!sel.isCollapsed){
    const t = sel.toString();
    if (!t || /\n/.test(t)) return false;
    e.preventDefault();
    document.execCommand('insertText', false, k + t + PAIRS[k]);
    return true;
  }
  // tras una letra, ' y " son apóstrofo o comilla de cierre, no se emparejan
  if ((k === '"' || k === '`' || k === "'") && (/[\wÀ-ÿ]/.test(prev) || prev === k)) return false;
  if (next && !/[\s)\]}.,;:!?\u200b]/.test(next)) return false;
  e.preventDefault();
  document.execCommand('insertText', false, k + PAIRS[k]);
  sel.modify('move', 'backward', 'character');
  return true;
}

/* ====== 31. Atajos globales ====== */
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey){
    const k = e.key.toLowerCase();
    if (k === 'p' && !e.shiftKey){ e.preventDefault(); openSwitcher(); return; }
    if (k === 'f' && !e.shiftKey){ e.preventDefault(); openFind(false); return; }   // Ctrl+Shift+F: search all documents (78-shortcuts.js)
    if (k === 'h'){ e.preventDefault(); openFind(true); return; }
    // deshacer fuera del editor (por ejemplo, con bloques seleccionados)
    const ae = document.activeElement;
    const inField = ae && (ae === ed || ed.contains(ae) || /^(INPUT|TEXTAREA)$/.test(ae.tagName));
    if (!inField && (k === 'z' || k === 'y')){ e.preventDefault(); (k === 'y' || e.shiftKey) ? History.redo() : History.undo(); return; }
  }
  if (e.key === 'Escape' && !veil.classList.contains('show') && !slash.open){
    if (F.open){ closeFind(); return; }
    if (document.body.classList.contains('focus')) toggleFocus(false);
  }
}, true);

