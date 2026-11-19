"use strict";
/* ====== 88. Modo lectura ====== */
// Ctrl+K R (can be changed; Ctrl+Shift+V is the system's paste as plain text). The document cannot be edited (the file is not touched) and
// the panels hide, as in focus mode. It uses the editor's own scroll: it starts where you are and you stay where
// you stopped. A word guide marks one word after another at a speed in words per minute (Space starts and pauses
// it) and the page follows it slowly so the word stays at the reading height; scrolling by hand moves the guide to
// the word at that height. A floating panel (it hides by itself) has: speed, whole document / one paragraph at a
// time, text size and column width, progress with the time left.
const Rd = { on: false, play: false, words: [], idx: 0, timer: 0, raf: 0, hand: 0, hideT: 0, prevEditable: 'true' };
const RD_DEF = { wpm: 200, para: false, size: 18, width: 760, guide: true };
const rdPrefs = () => { Ui.read(); return Object.assign({}, RD_DEF, Ui.data.reading || {}); };
function rdSave(patch){ const v = Object.assign(rdPrefs(), patch); Ui.data.reading = v; Ui.write(); }   // rdPrefs() re-reads Ui.data: take the value first
const rdIcon = d => '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const RD_BOOK = '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"></path><path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"></path>';

const rdPanel = document.createElement('div');
rdPanel.id = 'readPanel'; rdPanel.setAttribute('role', 'toolbar');
rdPanel.innerHTML =
  '<button class="tb" data-rd="words"></button>' +
  '<button class="tb" data-rd="play"></button>' +
  '<label class="rd-speed"><span data-rd-t="read.speed"></span><input type="range" min="60" max="600" step="10" data-rd="speed"><span class="rd-wpm"></span></label>' +
  '<button class="tb" data-rd="para"></button>' +
  '<span class="rd-sep"></span>' +
  '<button class="tb" data-rd="size-"><small>A</small>−</button><button class="tb" data-rd="size+">A+</button>' +
  '<button class="tb" data-rd="width-">⇥⇤</button><button class="tb" data-rd="width+">⇤⇥</button>' +
  '<span class="rd-sep"></span>' +
  '<span class="rd-prog"><span class="rd-bar"><i></i></span><span class="rd-left"></span></span>' +
  '<button class="tb" data-rd="exit"></button>';
document.body.appendChild(rdPanel);

// toolbar button, right after focus mode
const rdBtn = document.createElement('button');
rdBtn.className = 'tb'; rdBtn.id = 'readBtn'; rdBtn.innerHTML = rdIcon(RD_BOOK);
$('#focusBtn').after(rdBtn);
rdBtn.onclick = () => toggleReading(true);

function rdLabels(){
  const p = rdPrefs(), set = (k, label, title) => { const b = rdPanel.querySelector('[data-rd="' + k + '"]'); if (label !== null) b.innerHTML = label; b.title = title; b.setAttribute('aria-label', title); };
  set('play', Rd.play ? rdIcon('<rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect>') : rdIcon('<polygon points="6 4 20 12 6 20 6 4"></polygon>'), T(Rd.play ? 'read.pause' : 'read.play'));
  set('para', esc(T(p.para ? 'read.para' : 'read.full')), T('read.mode-title'));
  set('words', esc(T('read.guide')), T(p.guide ? 'read.guide-off' : 'read.guide-on'));
  rdPanel.querySelector('[data-rd="words"]').classList.toggle('on', p.guide);
  rdPanel.classList.toggle('no-guide', !p.guide);
  set('size-', null, T('read.smaller')); set('size+', null, T('read.bigger'));
  set('width-', null, T('read.narrower')); set('width+', null, T('read.wider'));
  rdPanel.querySelector('[data-rd="para"]').classList.toggle('on', p.para);
  set('exit', rdIcon('<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>'), T('read.exit'));
  rdPanel.querySelector('[data-rd-t]').textContent = T('read.speed');
  const sp = rdPanel.querySelector('[data-rd="speed"]'); sp.value = p.wpm; sp.title = T('read.speed-title', { n: p.wpm });
  rdPanel.querySelector('.rd-wpm').textContent = T('read.wpm', { n: p.wpm });
  const rk = typeof KM_READY !== 'undefined' && KM_READY ? kmKeyOf('reading') : 'Ctrl+K R', bt = T('read.btn') + (rk ? ' (' + rk + ')' : '');
  rdBtn.title = bt; rdBtn.setAttribute('aria-label', bt);
}
function rdApply(){
  const p = rdPrefs();
  document.body.style.setProperty('--rd-size', p.size + 'px');
  document.body.style.setProperty('--rd-width', p.width + 'px');
  document.body.classList.toggle('rd-para', p.para);
  rdLabels(); rdPaint();
}

/* ---- the words of the document ---- */
// [{ n: text node, s, e }] in reading order (the colour layer of code blocks is not text)
function rdCollect(){
  const out = [], w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('.cb-head,.cb-hl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = w.nextNode())){ const re = /[^\s​]+/g; let m; while ((m = re.exec(n.data))) out.push({ n, s: m.index, e: m.index + m[0].length }); }
  Rd.words = out;
}
function rdWordRange(i){ const x = Rd.words[i]; if (!x) return null; const r = document.createRange(); r.setStart(x.n, x.s); r.setEnd(x.n, x.e); return r; }
const rdTop = i => { const r = rdWordRange(i); return r ? r.getBoundingClientRect().top : 0; };
// what is being read sits in the middle of the screen (the blank page above and below lets the first and last lines get there)
const rdLine = () => { const r = scroll.getBoundingClientRect(); return r.top + r.height * 0.5; };
// the first word whose line reaches the reading height (words go down the page in order: binary search)
function rdAtLine(){
  const n = Rd.words.length; if (!n) return 0;
  const y = rdLine(); let lo = 0, hi = n - 1;
  while (lo < hi){ const mid = (lo + hi) >> 1, r = rdWordRange(mid).getBoundingClientRect(); if (r.bottom < y) lo = mid + 1; else hi = mid; }
  return lo;
}
function rdPaint(){
  if (!Rd.on) return;
  const r = rdWordRange(Rd.idx);
  if (window.CSS && CSS.highlights){ if (r && rdPrefs().guide) CSS.highlights.set('rd-word', new Highlight(r)); else CSS.highlights.delete('rd-word'); }
  let blk = r ? r.startContainer : null; while (blk && blk.parentNode !== ed) blk = blk.parentNode;
  ed.querySelectorAll('[data-rd-cur]').forEach(x => { if (x !== blk) x.removeAttribute('data-rd-cur'); });
  if (blk && blk.setAttribute) blk.setAttribute('data-rd-cur', '');
  // progress and time left: the words still to read at the speed
  const p = rdPrefs(), n = Math.max(1, Rd.words.length), done = Math.min(1, Rd.idx / Math.max(1, n - 1)), min = Math.ceil((n - Rd.idx) / p.wpm);
  rdPanel.querySelector('.rd-bar i').style.width = (done * 100).toFixed(1) + '%';
  rdPanel.querySelector('.rd-left').textContent = Math.round(done * 100) + '% · ' + T(min <= 1 ? 'read.left-1' : 'read.left', { n: Math.max(0, min) });
}
/* ---- the guide: one word after another, the page follows slowly ---- */
function rdTick(){
  clearTimeout(Rd.timer); Rd.timer = 0;
  if (!Rd.on || !Rd.play) return;
  if (Rd.idx >= Rd.words.length - 1){ rdPlay(false); return; }
  Rd.idx++; rdPaint();
  Rd.timer = setTimeout(rdTick, 60000 / rdPrefs().wpm);
}
function rdFollow(){
  Rd.raf = 0; if (!Rd.on || !Rd.play) return;
  if (Date.now() - Rd.hand > 400){                                   // not while the person is scrolling
    const d = rdTop(Rd.idx) - rdLine();
    if (Math.abs(d) > 2) scroll.scrollTop += Math.sign(d) * Math.max(0.4, Math.abs(d) * 0.04);   // a few px per frame: slow and smooth
  }
  Rd.raf = requestAnimationFrame(rdFollow);
}
function rdPlay(on){
  Rd.play = on; clearTimeout(Rd.timer); cancelAnimationFrame(Rd.raf); Rd.timer = 0; Rd.raf = 0;
  if (on){ Rd.timer = setTimeout(rdTick, 60000 / rdPrefs().wpm); Rd.raf = requestAnimationFrame(rdFollow); }
  rdLabels(); rdShowPanel();
}
function rdShowPanel(){
  rdPanel.classList.add('show'); clearTimeout(Rd.hideT);
  Rd.hideT = setTimeout(() => { if (!rdPanel.matches(':hover') && !rdPanel.contains(document.activeElement)) rdPanel.classList.remove('show'); }, 2500);
}
function rdStart(){ rdCollect(); Rd.idx = rdAtLine(); rdPaint(); }
// The same place of the document in both modes: reading mode changes the text size, the column width and the top
// margin, so the scroll in pixels would point somewhere else. The block at the top of the view (and how far into it)
// is kept instead.
const RD_BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,tr,hr,.cb,img';
function rdKeepPlace(change){
  const sr = scroll.getBoundingClientRect(), y = sr.top + 8;
  let el = null, frac = 0;
  for (const b of ed.querySelectorAll(RD_BLOCKS)){
    const r = b.getBoundingClientRect();
    if (r.height && r.bottom > y){ el = b; frac = Math.max(0, (y - r.top) / r.height); break; }
  }
  change();
  if (!el || !ed.contains(el)) return;
  const r = el.getBoundingClientRect();
  scroll.scrollTop += (r.top + frac * r.height) - (scroll.getBoundingClientRect().top + 8);
}
function toggleReading(force){
  const on = force === undefined ? !Rd.on : !!force;
  if (on === Rd.on) return;
  if (on){
    if (document.body.classList.contains('focus')) toggleFocus(false);
    stash();
    Rd.on = true; Rd.prevEditable = ed.getAttribute('contenteditable') || 'true';
    ed.setAttribute('contenteditable', 'false');
    rdKeepPlace(() => { document.body.classList.add('reading'); rdApply(); });       // the same place as in the editor
    rdStart();
    rdShowPanel(); toast(T('msg.reading-on'));
  } else {
    rdPlay(false);
    Rd.on = false;
    if (window.CSS && CSS.highlights) CSS.highlights.delete('rd-word');
    ed.querySelectorAll('[data-rd-cur]').forEach(x => x.removeAttribute('data-rd-cur'));
    rdPanel.classList.remove('show');
    // you stay where you were reading (WebKit scrolls to the cursor on focus even with preventScroll: it goes inside too)
    rdKeepPlace(() => { document.body.classList.remove('reading', 'rd-para'); ed.setAttribute('contenteditable', Rd.prevEditable); ed.focus({ preventScroll: true }); });
  }
}
rdPanel.addEventListener('click', e => {
  const b = e.target.closest('[data-rd]'); if (!b || b.tagName === 'INPUT') return;
  const k = b.dataset.rd, p = rdPrefs();
  if (k === 'play') rdPlay(!Rd.play);
  else if (k === 'words'){ rdSave({ guide: !p.guide }); rdPaint(); }          // only the mark: the page keeps scrolling
  else if (k === 'para') rdSave({ para: !p.para });
  else if (k === 'size-' || k === 'size+') rdSave({ size: Math.max(13, Math.min(30, p.size + (k === 'size+' ? 1 : -1))) });
  else if (k === 'width-' || k === 'width+') rdSave({ width: Math.max(420, Math.min(1400, p.width + (k === 'width+' ? 60 : -60))) });
  else if (k === 'exit') return toggleReading(false);
  rdKeepPlace(rdApply); rdShowPanel();
});
rdPanel.querySelector('[data-rd="speed"]').addEventListener('input', e => { rdSave({ wpm: +e.target.value }); rdLabels(); rdPaint(); rdShowPanel(); });
// scrolling by hand (wheel, touch, scroll bar, keys): the guide goes to the word at the reading height
let rdHandT = 0;
const rdByHand = () => {
  if (!Rd.on) return;
  Rd.hand = Date.now(); clearTimeout(rdHandT);
  rdHandT = setTimeout(() => { if (Rd.on){ Rd.idx = rdAtLine(); rdPaint(); } }, 150);
};
[scroll1, scroll2].forEach(sc => {
  sc.addEventListener('wheel', rdByHand, { passive: true });
  sc.addEventListener('touchmove', rdByHand, { passive: true });
  sc.addEventListener('mousedown', e => { if (e.offsetX > sc.clientWidth) rdByHand(); });
  sc.addEventListener('scroll', () => { if (Rd.on && Date.now() - Rd.hand < 400) rdByHand(); }, { passive: true });
});
addEventListener('resize', () => { if (Rd.on) rdPaint(); });
addEventListener('mousemove', e => { if (Rd.on && e.clientY > innerHeight - 140) rdShowPanel(); }, { passive: true });
addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!Rd.on || veil.classList.contains('show') || e.target.closest('input,textarea,select')) return;
  if (e.key === ' ' && !mod){ e.preventDefault(); e.stopImmediatePropagation(); rdPlay(!Rd.play); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); toggleReading(false); }
  else if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End)$/.test(e.key)) rdByHand();
  else if (!mod && !e.altKey && e.key.length === 1) e.preventDefault();   // nothing is typed while reading
}, true);
// nothing changes the text while reading: paste, drop and the input of extensions are refused
['beforeinput', 'paste', 'drop'].forEach(t => [ed1, ed2].forEach(h => h.addEventListener(t, e => { if (Rd.on){ e.preventDefault(); e.stopImmediatePropagation(); } }, true)));
const rdOpenDoc = openDoc;
openDoc = id => {
  if (Rd.on){ rdPlay(false); ed.setAttribute('contenteditable', Rd.prevEditable); }
  rdOpenDoc(id);
  if (Rd.on){ ed.setAttribute('contenteditable', 'false'); requestAnimationFrame(rdStart); }
};
document.addEventListener('langchange', () => { rdLabels(); rdPaint(); });
rdLabels();
COMMANDS.push({ g: 'pal.g.view', t: 'pal.reading', run: () => toggleReading() });
