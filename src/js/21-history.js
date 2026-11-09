"use strict";
/* ====== 5. Deshacer propio ====== */
const History = {
  past: [], future: [], last: '', t: null, caretBefore: null,
  caret(){
    const s = getSelection();
    if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
    const cur = s.getRangeAt(0);
    const r = document.createRange();
    r.selectNodeContents(ed);
    try { r.setEnd(cur.endContainer, cur.endOffset); } catch(_){ return null; }
    return r.toString().length;
  },
  restoreCaret(n){
    if (n == null) return;
    let count = 0, done = false;
    const go = node => {
      if (done) return;
      if (node.nodeType === 3){
        if (count + node.length >= n){
          const r = document.createRange(), s = getSelection();
          r.setStart(node, Math.max(0, n - count)); r.collapse(true);
          s.removeAllRanges(); s.addRange(r); done = true;
        } else count += node.length;
      } else node.childNodes.forEach(go);
    };
    go(ed);
    return done;
  },
  // sin cursor guardado (p. ej. tras borrar bloques seleccionados): el cursor va a lo primero que cambió, sin mover la vista
  placeAtChange(sig){
    const nb = [...ed.children];
    let i = 0; while (i < nb.length && i < sig.length && nb[i].outerHTML === sig[i]) i++;
    const t = nb[Math.min(i, nb.length - 1)];
    if (t) caretInto(t, true);
  },
  mark(){ Dirty.add(state.current); this.caretBefore = this.caret(); },
  init(){ this.last = ed.innerHTML; this.past.length = 0; this.future.length = 0; this.caretBefore = null; },
  snap(immediate){
    clearTimeout(this.t);
    const go = () => {
      const html = ed.innerHTML;
      if (html === this.last) return;
      this.past.push({ html: this.last, caret: this.caretBefore });
      if (this.past.length > 120) this.past.shift();
      this.future.length = 0;
      this.last = html;
      const nd = findNode(state.current); if (nd) nd.mod = Date.now();
    };
    immediate ? go() : this.t = setTimeout(go, 300);
  },
  undo(){
    clearTimeout(this.t);
    if (ed.innerHTML !== this.last){ this.past.push({ html: this.last, caret: this.caretBefore }); this.last = ed.innerHTML; }
    const prev = this.past.pop();
    if (!prev) return toast('Nada que deshacer');
    this.future.push({ html: ed.innerHTML, caret: this.caret() });
    const y = scroll.scrollTop, sig = [...ed.children].map(c => c.outerHTML);
    ed.innerHTML = prev.html; this.last = prev.html;
    scroll.scrollTop = y;
    ed.focus({ preventScroll: true });
    const known = this.restoreCaret(prev.caret) === true;
    if (!known) this.placeAtChange(sig);
    const nd = findNode(state.current); if (nd) nd.mod = Date.now();
    after(); if (known) ensureCaretVisible();
  },
  redo(){
    const next = this.future.pop();
    if (!next) return toast('Nada que rehacer');
    this.past.push({ html: ed.innerHTML, caret: this.caret() });
    const y = scroll.scrollTop, sig = [...ed.children].map(c => c.outerHTML);
    ed.innerHTML = next.html; this.last = next.html;
    scroll.scrollTop = y;
    ed.focus({ preventScroll: true });
    const known = this.restoreCaret(next.caret) === true;
    if (!known) this.placeAtChange(sig);
    const nd = findNode(state.current); if (nd) nd.mod = Date.now();
    after(); if (known) ensureCaretVisible();
  }
};
function after(){ Dirty.add(state.current); ensureBlocks(); applyFolds(); stash(); counts(); paintPreview(); save(); sideRefresh(); }

