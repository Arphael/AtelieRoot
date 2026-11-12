"use strict";
/* ====== 78. Atajos estilo VS Code y su lista ====== */
// KEYS is the one list of keyboard shortcuts: the shortcut dialog (toolbar button, Ctrl+K Ctrl+S, palette) shows it.
// Multi-edit (Ctrl+D, Ctrl+Shift+L, Shift+Alt+I) lives in 79-multi-edit.js, comments (Ctrl+/) in 86-comments.js.
const KEYS = [
  { g: 'kb.g.select', k: 'Ctrl+D', t: 'kb.word-next' },
  { g: 'kb.g.select', k: 'Ctrl+Shift+L', t: 'kb.all-matches' },
  { g: 'kb.g.select', k: 'Shift+Alt+I', t: 'kb.line-ends' },
  { g: 'kb.g.select', k: 'Ctrl+L', t: 'kb.select-line' },
  { g: 'kb.g.select', k: 'Ctrl+Shift+← / →', t: 'kb.select-word' },
  { g: 'kb.g.select', k: 'Ctrl+A', t: 'kb.select-all' },
  { g: 'kb.g.edit', k: 'Alt+↑ / ↓', t: 'kb.move-line' },
  { g: 'kb.g.edit', k: 'Shift+Alt+↑ / ↓', t: 'kb.dup-line' },
  { g: 'kb.g.edit', k: 'Ctrl+Shift+K · Shift+Supr', t: 'kb.del-line' },
  { g: 'kb.g.edit', k: 'Ctrl+C · Ctrl+X', t: 'kb.cut-line' },
  { g: 'kb.g.edit', k: 'Alt+Z', t: 'kb.wrap' },
  { g: 'kb.g.edit', k: 'Ctrl+Z · Ctrl+Shift+Z', t: 'kb.undo' },
  { g: 'kb.g.edit', k: 'Ctrl+S', t: 'kb.save' },
  { g: 'kb.g.format', k: 'Ctrl+B', t: 'kb.bold' },
  { g: 'kb.g.format', k: 'Ctrl+I', t: 'kb.italic' },
  { g: 'kb.g.format', k: 'Ctrl+E', t: 'kb.code' },
  { g: 'kb.g.format', k: 'Ctrl+Shift+X', t: 'kb.strike' },
  { g: 'kb.g.format', k: 'Ctrl+K', t: 'kb.link' },
  { g: 'kb.g.format', k: 'Ctrl+.', t: 'kb.fold' },
  { g: 'kb.g.comments', k: 'Ctrl+/', t: 'kb.cmt-toggle' },
  { g: 'kb.g.comments', k: 'Ctrl+K Ctrl+C', t: 'kb.cmt-add' },
  { g: 'kb.g.comments', k: 'Ctrl+K Ctrl+U', t: 'kb.cmt-remove' },
  { g: 'kb.g.search', k: 'Ctrl+F', t: 'kb.find' },
  { g: 'kb.g.search', k: 'Ctrl+H', t: 'kb.replace' },
  { g: 'kb.g.search', k: 'Ctrl+Shift+F', t: 'kb.search-all' },
  { g: 'kb.g.search', k: 'F2', t: 'kb.rename' },
  { g: 'kb.g.nav', k: 'Ctrl+P', t: 'kb.goto' },
  { g: 'kb.g.nav', k: 'Ctrl+Shift+P', t: 'kb.palette' },
  { g: 'kb.g.nav', k: 'Ctrl+K Z', t: 'kb.focus' },
  { g: 'kb.g.nav', k: 'Ctrl+Shift+8', t: 'kb.breaks' },
  { g: 'kb.g.nav', k: 'Ctrl+K Ctrl+S', t: 'kb.keys' },
  { g: 'kb.g.nav', k: 'Esc', t: 'kb.escape' },
];

/* ---- dialog with every shortcut ---- */
function openKeys(){
  card.innerHTML = '<h2>' + esc(T('kb.title')) + '</h2><input id="kbq" autocomplete="off" placeholder="' + esc(T('kb.ph')) + '" aria-label="' + esc(T('kb.ph')) + '"><div class="sw-list kb-list" id="kbl"></div>';
  card.classList.add('wide');
  veil.classList.add('show');
  const q = card.querySelector('#kbq'), l = card.querySelector('#kbl');
  const paint = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    l.innerHTML = ''; let g = '';
    KEYS.filter(x => words.every(w => norm(T(x.g) + ' ' + x.k + ' ' + T(x.t)).includes(w))).forEach(x => {
      if (x.g !== g){ g = x.g; const h = document.createElement('div'); h.className = 'kb-g'; h.textContent = T(g); l.appendChild(h); }
      const r = document.createElement('div'); r.className = 'kb-row';
      r.innerHTML = '<kbd></kbd><span></span>';
      r.firstChild.textContent = x.k; r.lastChild.textContent = T(x.t);
      l.appendChild(r);
    });
    if (!l.children.length) l.innerHTML = '<div class="ol-empty">' + esc(T('pal.empty')) + '</div>';
  };
  q.oninput = paint;
  q.onkeydown = e => { if (e.key === 'Escape'){ closeCard(); } };
  paint(); q.focus();
}
function closeCard(){ veil.classList.remove('show'); card.classList.remove('wide'); ed.focus({ preventScroll: true }); }
$('#kbBtn').addEventListener('mousedown', e => e.preventDefault());
$('#kbBtn').onclick = openKeys;

/* ---- search in all documents (Ctrl+Shift+F) ---- */
// plain text of a document's HTML; blocks are separated so words of two blocks never join
const docText = html => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<\/(p|li|h[1-6]|td|th|pre|blockquote|div)>|<br\s*\/?>/gi, '$&\n'); d.querySelectorAll('.cb-head,.cb-hl').forEach(x => x.remove()); return d.textContent; };
function openSearchAll(){
  stash();
  const s = getSelection(), pre = s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode) && s.toString().length < 80 ? s.toString() : '';
  card.innerHTML = '<h2>' + esc(T('gs.title')) + '</h2><input id="gsq" autocomplete="off" placeholder="' + esc(T('gs.ph')) + '" aria-label="' + esc(T('gs.ph')) + '"><div class="gs-count" id="gsc"></div><div class="sw-list" id="gsl"></div>';
  card.classList.add('wide');
  veil.classList.add('show');
  const q = card.querySelector('#gsq'), l = card.querySelector('#gsl'), c = card.querySelector('#gsc');
  const docs = []; walk(state.tree, n => { if (n.type === 'doc') docs.push(n); });
  const texts = new Map();
  let res = [], sel = 0, t = 0;
  const open = r => {
    closeCard();
    if (state.current !== r.id) openDoc(r.id);
    $('#fq').value = q.value; openFind(false);
    if (F.ranges.length){ F.i = Math.min(r.k, F.ranges.length - 1); paintFind(true); }   // the match that was clicked
  };
  const paint = () => {
    const needle = q.value.trim(), nq = needle.toLowerCase();
    l.innerHTML = ''; res = [];
    if (needle.length < 2){ c.textContent = T('gs.hint'); return; }
    let total = 0, nd = 0;
    for (const n of docs){
      if (!texts.has(n.id)) texts.set(n.id, docText(state.docs[n.id]).replace(/\s+/g, ' '));
      const txt = texts.get(n.id), low = txt.toLowerCase();
      let i = low.indexOf(nq), k = 0;
      if (i >= 0) nd++;
      while (i >= 0){
        total++;
        if (k < 5) res.push({ id: n.id, name: n.name, path: pathOf(n.id), k, before: txt.slice(Math.max(0, i - 40), i), hit: txt.slice(i, i + needle.length), afterT: txt.slice(i + needle.length, i + needle.length + 60) });
        k++; i = low.indexOf(nq, i + nq.length);
      }
      if (res.length >= 300) break;
    }
    c.textContent = total ? T('gs.count', { n: total, d: nd }) : T('gs.empty');
    sel = Math.min(sel, Math.max(0, res.length - 1));
    res.forEach((r, i) => {
      const b = document.createElement('button'); b.className = 'pal-item gs-item' + (i === sel ? ' on' : '');
      b.innerHTML = '<span class="pg"></span><span class="pt"><span></span><mark></mark><span></span></span>';
      b.querySelector('.pg').textContent = r.name;
      const p = b.querySelector('.pt').children; p[0].textContent = (r.before.length >= 40 ? '…' : '') + r.before; p[1].textContent = r.hit; p[2].textContent = r.afterT;
      b.title = r.path;
      b.onclick = () => open(r);
      l.appendChild(b);
    });
    const on = l.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  q.oninput = () => { clearTimeout(t); sel = 0; t = setTimeout(paint, 120); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (res[sel]) open(res[sel]); }
    else if (e.key === 'Escape') closeCard();
  };
  q.value = pre; paint(); q.focus(); q.select();
}

/* ---- F2: rename the document (or the one a [[link]] points to) and update its links ---- */
function renameAtCaret(){
  const s = getSelection();
  if (s.rangeCount && ed.contains(s.anchorNode) && s.anchorNode.nodeType === 3){
    const t = s.anchorNode.nodeValue, o = s.anchorOffset;
    const a = t.lastIndexOf('[[', o), b = t.indexOf(']]', a);
    if (a >= 0 && b >= o - 2 && b > a && t.lastIndexOf(']]', o - 1) < a){
      const name = t.slice(a + 2, b), n = docByName(name);
      if (!n) return toast(T('msg.f2-missing', { name }));
      return renameNode(n);
    }
  }
  const n = findNode(state.current);
  if (!n) return toast(T('msg.f2-none'));
  renameNode(n);
}

/* ---- Ctrl+L: select the line (again: add the next one) ---- */
function selectLineUnit(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  const r = s.getRangeAt(0);
  const unitOf = node => closestFrom(node, 'li') || topBlockOf(node);
  const startU = unitOf(r.startContainer); if (!startU) return;
  const covers = u => { const rr = document.createRange(); rr.selectNodeContents(u); return r.compareBoundaryPoints(Range.START_TO_START, rr) <= 0 && r.compareBoundaryPoints(Range.END_TO_END, rr) >= 0; };
  let endU = unitOf(r.endContainer) || startU;
  if (!s.isCollapsed && covers(endU)){                             // the line is already selected: add the next one
    const nextOf = u => {
      if (u.tagName === 'LI' && u.nextElementSibling) return u.nextElementSibling;
      let t = topBlockOf(u); t = t && t.nextElementSibling;
      while (t && t.hasAttribute('data-hid')) t = t.nextElementSibling;
      return t && /^(UL|OL)$/.test(t.tagName) ? (t.querySelector('li') || t) : t;
    };
    endU = nextOf(endU) || endU;
  }
  const nr = document.createRange(); nr.setStart(startU, 0); nr.setEnd(endU, endU.childNodes.length);
  s.removeAllRanges(); s.addRange(nr);
}
function topBlockOf(node){ let n = node && (node.nodeType === 3 ? node.parentNode : node); while (n && n.parentNode !== ed) n = n.parentNode; return n && n.parentNode === ed ? n : null; }

/* ---- Shift+Alt+Up/Down: duplicate the line or block ---- */
function duplicateUnit(dir){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  if (!s.isCollapsed){
    const tops = touchedTops();
    if (tops.length > 1){
      History.mark();
      const last = tops[tops.length - 1]; let ref = last;
      tops.forEach(b => { const c = b.cloneNode(true); ref.after(c); ref = c; });
      if (dir < 0) caretInto(tops[0], false); else caretInto(ref, true);
      renumberLists(true); after(); History.snap(true); return;
    }
    s.collapseToStart();
  }
  const u = lineUnit(); if (!u) return;
  if (!pasteLine(Object.assign({}, u))) return;                      // the copy goes above; the cursor stays on the original (below)
  if (dir < 0) moveCaretUnit(-1);                                    // Up: the cursor ends on the upper copy (the two lines are equal)
  ensureCaretVisible();
}

/* ---- Alt+Z: word wrap in code blocks and the live Markdown (on by default; off = horizontal scroll) ---- */
function setCodeWrap(on){
  document.body.classList.toggle('no-wrap', !on);
  Ui.data.noWrap = !on; Ui.write();
}
const codeWrapOn = () => !document.body.classList.contains('no-wrap');
Ui.read(); if (Ui.data.noWrap) document.body.classList.add('no-wrap');

/* ---- Ctrl+K as a prefix (like VS Code): C comment, U remove comment, Z focus, S shortcuts; alone -> link ---- */
const Chord = { on: false, t: 0, range: null };
function startChord(){
  const s = getSelection();
  Chord.on = true; Chord.range = s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  clearTimeout(Chord.t);
  Chord.t = setTimeout(() => { if (!Chord.on) return; Chord.on = false; restoreChordSel(); $('#linkBtn').click(); }, 900);
}
function restoreChordSel(){ if (Chord.range){ const s = getSelection(); s.removeAllRanges(); s.addRange(Chord.range); } }
function endChord(k){
  Chord.on = false; clearTimeout(Chord.t); restoreChordSel();
  if (k === 'c') return addComment();
  if (k === 'u') return removeComment();
  if (k === 'z') return toggleFocus();
  if (k === 's') return openKeys();
  if (k === 'k'){ $('#linkBtn').click(); return; }
}

document.addEventListener('keydown', e => {
  if (veil.classList.contains('show')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (Chord.on){
    if (['control', 'meta', 'shift', 'alt'].includes(k)) return;
    e.preventDefault(); e.stopImmediatePropagation(); endChord(k); return;
  }
  const inEd = document.activeElement === ed || ed.contains(document.activeElement);
  if (mod && !e.altKey && !e.shiftKey && k === 'k' && inEd){ e.preventDefault(); e.stopImmediatePropagation(); startChord(); return; }
  if (mod && e.shiftKey && !e.altKey && k === 'f'){ e.preventDefault(); e.stopImmediatePropagation(); openSearchAll(); return; }
  if (e.key === 'F2' && !mod && !e.altKey){ e.preventDefault(); renameAtCaret(); return; }
  if (!inEd) return;
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (mod && !e.altKey && !e.shiftKey && k === 'l'){ stop(); selectLineUnit(); return; }
  if (mod && e.shiftKey && !e.altKey && k === 'k'){ stop(); deleteCaretUnit(); return; }
  if (e.altKey && e.shiftKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){ e.preventDefault(); e.stopImmediatePropagation(); duplicateUnit(e.key === 'ArrowUp' ? -1 : 1); return; }
  if (e.altKey && !e.shiftKey && !mod && (k === 'z' || e.code === 'KeyZ')){ stop(); const on = !codeWrapOn(); setCodeWrap(on); toast(T(on ? 'msg.wrap-on' : 'msg.wrap-off')); return; }
}, true);
