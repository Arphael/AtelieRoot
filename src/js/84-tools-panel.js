"use strict";
/* ====== 86. Panel de herramientas (derecha) ====== */
// When the right-hand toolbar group does not fit (48-responsive-ui.js), its tools live here, together with the
// view tools and, on phones, the status bar. Each row clicks the real toolbar button, so behavior stays in one place.
const TOOLS_VIEW = [['#pvBtn', 'pvBtn.aria'], ['#olBtn', 'olBtn.title'], ['#splitBtn', 'splitBtn.title'], ['#focusBtn', 'focusBtn.aria', 'Ctrl+Shift+F'],
  ['#findBtn', 'findBtn.aria', 'Ctrl+F'], ['#swBtn', 'swBtn.aria', 'Ctrl+P']];
const TOOLS_DOC = [['#phBtn', 'phBtn.aria'], ['#tidyBtn', 'pal.tidy-document'], ['#copyMd', 'copyMd'], ['#copyRich', 'pal.copy-with-formatting'], ['#exportBtn', 'tools.export']];
const toolsEl = $('#tools'), toolsBody = $('#toolsBody');
function toolsRow(sel, key, k){
  const src = $(sel), b = document.createElement('button');
  b.type = 'button'; b.className = 'tl-row' + (src && src.classList.contains('on') ? ' on' : ''); b.dataset.src = sel;
  b.innerHTML = '<span class="tl-ico"></span><span class="tl-t"></span>' + (k ? '<span class="tl-k"></span>' : '');
  const ico = src && (src.querySelector('svg') || src.querySelector('span'));
  if (ico) b.firstChild.appendChild(ico.cloneNode(true));
  else b.firstChild.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
  b.querySelector('.tl-t').textContent = T(key);
  if (k) b.querySelector('.tl-k').textContent = k;
  b.onclick = e => {
    e.stopPropagation();
    if (sel === '#exportBtn'){ popup(exportMenu, b, true); return; }      // the menu opens next to this row (the toolbar button is hidden)
    closeTools(); if (src) src.click();
  };
  return b;
}
function toolsSeg(label, opts, cur, pick){
  const row = document.createElement('div'); row.className = 'tl-pref';
  row.innerHTML = '<span></span><span class="tl-seg" role="group"></span>';
  row.firstChild.textContent = label; row.lastChild.setAttribute('aria-label', label);
  opts.forEach(([v, text, aria]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.dataset.v = v;
    if (aria) b.setAttribute('aria-label', aria);
    b.setAttribute('aria-pressed', String(v === cur));
    b.onclick = e => { e.stopPropagation(); if (v !== cur) pick(v); paintTools(); };
    row.lastChild.appendChild(b);
  });
  return row;
}
function paintTools(){
  toolsBody.innerHTML = '';
  const sec = key => { const h = document.createElement('div'); h.className = 'tl-sec'; h.textContent = T(key); toolsBody.appendChild(h); };
  sec('tools.view'); TOOLS_VIEW.forEach(([s, k, sc]) => { if (!(s === '#splitBtn' && innerWidth <= 600)) toolsBody.appendChild(toolsRow(s, k, sc)); });
  sec('tools.document'); TOOLS_DOC.forEach(([s, k]) => toolsBody.appendChild(toolsRow(s, k)));
  sec('tools.prefs');
  toolsBody.appendChild(toolsSeg(T('tools.language'), [['es', 'ES', 'Español'], ['en', 'EN', 'English']], I18n.lang, v => I18n.set(v)));
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  toolsBody.appendChild(toolsSeg(T('tools.theme'), [['light', '☀', T('tools.light')], ['dark', '☾', T('tools.dark')]], dark ? 'dark' : 'light', () => $('#themeBtn').click()));
  const foot = $('#toolsFoot'); foot.innerHTML = '';
  ['#wc', '#cc', '#saved', '#wsState'].forEach(s => { const el = $(s), t = el && el.textContent.trim(); if (t){ const x = document.createElement('span'); x.textContent = t; foot.appendChild(x); } });
}
function openTools(){
  document.querySelectorAll('.menu.show').forEach(hide);
  document.body.classList.remove('side-open');
  paintTools(); document.body.classList.add('tools-open');
  const first = toolsBody.querySelector('button'); if (first) first.focus({ preventScroll: true });
}
function closeTools(){ if (document.body.classList.contains('tools-open')){ document.body.classList.remove('tools-open'); hide(exportMenu); } }
['#toolsBtn', '#mTools'].forEach(s => { const b = $(s); b.addEventListener('mousedown', e => e.preventDefault()); b.onclick = e => { e.stopPropagation(); document.body.classList.contains('tools-open') ? closeTools() : openTools(); }; });
$('#toolsClose').onclick = () => closeTools();
$('#scrim').addEventListener('click', closeTools);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('tools-open')){ e.preventDefault(); closeTools(); } });
exportMenu.addEventListener('click', () => closeTools());
document.addEventListener('langchange', () => { if (document.body.classList.contains('tools-open')) paintTools(); });
