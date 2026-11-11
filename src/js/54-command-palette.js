"use strict";
/* ====== 40. Paleta de comandos ====== */
const clickSel = sel => () => { const el = document.querySelector(sel); if (el) el.click(); };
const COMMANDS = [
  // documento
  { g:'pal.g.document', t:'pal.new-document', run: clickSel('#newDoc') },
  { g:'pal.g.document', t:'pal.new-folder', run: clickSel('#newFolder') },
  { g:'pal.g.document', t:'pal.go-to-document', k:'Ctrl+P', run: () => openSwitcher() },
  { g:'pal.g.document', t:'pal.rename-current-document', run: () => { const n = findNode(state.current); if (n) renameNode(n); } },
  { g:'pal.g.document', t:'pal.move-current-document-to', run: () => { const n = findNode(state.current); if (n) moveToDialog(n); } },
  { g:'pal.g.document', t:'pal.move-current-document-to-the-trash', run: () => { const n = findNode(state.current); if (n) moveToTrash(n); } },
  { g:'pal.g.document', t:'pal.open-trash', run: () => openTrash() },
  { g:'pal.g.document', t:'pal.import-md-files', run: () => $('#mdFile').click() },
  // copiar y exportar
  { g:'pal.g.copy', t:'pal.copy-markdown', run: clickSel('#copyMd') },
  { g:'pal.g.copy', t:'pal.copy-with-formatting', run: clickSel('#copyRich') },
  { g:'pal.g.export', t:'pal.export-as-markdown-md', run: () => exportMenu.querySelector('[data-x="md"]').click() },
  { g:'pal.g.export', t:'pal.export-as-plain-text-txt', run: () => exportMenu.querySelector('[data-x="txt"]').click() },
  { g:'pal.g.export', t:'pal.export-as-html-html', run: () => exportMenu.querySelector('[data-x="html"]').click() },
  { g:'pal.g.export', t:'pal.export-full-backup-json', run: () => backup() },
  { g:'pal.g.export', t:'pal.download-the-automatic-copy-made-before', run: () => downloadPreviousCopy() },
  { g:'pal.g.export', t:'pal.restore-from-backup', run: () => $('#file').click() },
  // edición
  { g:'pal.g.edit', t:'pal.undo', k:'Ctrl+Z', run: () => History.undo() },
  { g:'pal.g.edit', t:'pal.redo', k:'Ctrl+Shift+Z', run: () => History.redo() },
  { g:'pal.g.edit', t:'pal.find', k:'Ctrl+F', run: () => openFind(false) },
  { g:'pal.g.edit', t:'pal.find-and-replace', k:'Ctrl+H', run: () => openFind(true) },
  { g:'pal.g.edit', t:'pal.tidy-document', run: clickSel('#tidyBtn') },
  { g:'pal.g.edit', t:'pal.delete-the-line', k:'Shift+Supr', run: () => deleteCaretUnit() },
  { g:'pal.g.edit', t:'pal.fill-in-placeholders', run: clickSel('#phBtn') },
  // formato
  { g:'pal.g.format', t:'pal.paragraph', run: () => setBlockLevel(0) },
  ...[1,2,3,4,5,6].map(n => ({ g:'pal.g.format', t: () => T('pal.heading', { n }), run: () => setBlockLevel(n) })),
  { g:'pal.g.format', t:'pal.bold', k:'Ctrl+B', run: () => toggleWrap('strong') },
  { g:'pal.g.format', t:'pal.italic', k:'Ctrl+I', run: () => toggleWrap('em') },
  { g:'pal.g.format', t:'pal.strikethrough', k:'Ctrl+Shift+X', run: () => toggleWrap('s') },
  { g:'pal.g.format', t:'pal.inline-code', k:'Ctrl+E', run: () => toggleWrap('code') },
  { g:'pal.g.format', t:'pal.clear-formatting', run: () => clearFormat() },
  { g:'pal.g.insert', t:'pal.bulleted-list', run: () => insertBlock('ul') },
  { g:'pal.g.insert', t:'pal.numbered-list', run: () => insertBlock('ol') },
  { g:'pal.g.insert', t:'pal.change-the-list-item-number', run: () => {
      const li = closestFrom(getSelection().anchorNode, 'li');
      if (!li || !li.parentElement || li.parentElement.tagName !== 'OL') return toast(T('msg.put-the-cursor-on-an-item-of-a-numbered'));
      editItemNumber(li);
  } },
  { g:'pal.g.insert', t:'pal.task-list', run: () => insertBlock('task') },
  { g:'pal.g.insert', t:'pal.quote', run: () => insertBlock('quote') },
  { g:'pal.g.insert', t:'pal.code-block', run: () => insertBlock('pre') },
  { g:'pal.g.insert', t:'pal.table', run: () => insertBlock('table') },
  { g:'pal.g.insert', t:'pal.divider', run: () => insertBlock('hr') },
  { g:'pal.g.insert', t:'pal.link', k:'Ctrl+K', run: clickSel('#linkBtn') },
  { g:'pal.g.insert', t:'pal.image', run: clickSel('#imgBtn') },
  // secciones
  { g:'pal.g.sections', t:'pal.fold-or-unfold-the-current-section', k:'Ctrl+.', run: () => { const b = currentBlock(); toggleFold(b && sectionHeadOf(b)); } },
  { g:'pal.g.sections', t:'pal.fold-all-sections', run: () => foldAll(true) },
  { g:'pal.g.sections', t:'pal.unfold-all-sections', run: () => foldAll(false) },
  // vista
  { g:'pal.g.view', t:'pal.open-split-view', when: () => !split, run: () => openSwitcher(id => enableSplit(id, true), T('msg.open-beside')) },
  { g:'pal.g.view', t:'pal.close-split-view', when: () => split, run: () => closeSplit() },
  { g:'pal.g.view', t:'pal.switch-pane', when: () => split, run: () => { activate(1 - active); ed.focus({ preventScroll: true }); } },
  { g:'pal.g.view', t:'pal.show-or-hide-the-sidebar', run: () => toggleSide() },
  { g:'pal.g.view', t:'pal.show-or-hide-the-outline', run: clickSel('#olBtn') },
  { g:'pal.g.view', t:'pal.show-or-hide-the-live-markdown', run: clickSel('#pvBtn') },
  { g:'pal.g.view', t:'pal.focus-mode', k:'Ctrl+Shift+F', run: () => toggleFocus() },
  { g:'pal.g.view', t:'pal.show-or-hide-line-breaks', k:'Ctrl+Shift+8', run: () => setBreaks(!state.breaks) },
  { g:'pal.g.view', t:'pal.switch-between-light-and-dark-theme', run: clickSel('#themeBtn') },
  { g:'pal.g.view', t:'pal.lang', run: () => I18n.set(I18n.lang === 'es' ? 'en' : 'es') }
];
// command texts are i18n keys (or a function for texts with a value)
const palLabel = c => typeof c.t === 'function' ? c.t() : T(c.t);
function setBlockLevel(lvl){ applyBlockType(lvl); }
function openPalette(){
  // se guarda la selección para que los comandos de formato actúen sobre ella
  const s = getSelection();
  const saved = s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  card.innerHTML = '<h2>' + esc(T('pal.title')) + '</h2><input id="palq" placeholder="' + esc(T('pal.ph')) + '" autocomplete="off" aria-label="' + esc(T('pal.aria')) + '"><div class="sw-list" id="pall"></div>';
  veil.classList.add('show');
  const q = card.querySelector('#palq'), l = card.querySelector('#pall');
  let sel = 0, res = [];
  const run = c => {
    veil.classList.remove('show');
    ed.focus({ preventScroll: true });
    if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); }
    setTimeout(() => c.run(), 0);
  };
  const paint = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    res = COMMANDS.filter(c => (!c.when || c.when()) && words.every(w => norm(T(c.g) + ' ' + palLabel(c)).includes(w)));
    sel = Math.min(sel, Math.max(0, res.length - 1));
    l.innerHTML = '';
    if (!res.length){ l.innerHTML = '<div class="ol-empty">' + esc(T('pal.empty')) + '</div>'; return; }
    res.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'pal-item' + (i === sel ? ' on' : '');
      b.innerHTML = '<span class="pg"></span><span class="pt"></span><span class="pk"></span>';
      b.querySelector('.pg').textContent = T(c.g);
      b.querySelector('.pt').textContent = palLabel(c);
      b.querySelector('.pk').textContent = c.k || '';
      b.onclick = () => run(c);
      l.appendChild(b);
    });
    const on = l.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  q.oninput = () => { sel = 0; paint(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (res[sel]) run(res[sel]); }
    else if (e.key === 'Escape'){ veil.classList.remove('show'); ed.focus({ preventScroll: true }); if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); } }
  };
  paint(); q.focus();
}
$('#palBtn').addEventListener('mousedown', e => e.preventDefault());
$('#palBtn').onclick = openPalette;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p'){ e.preventDefault(); e.stopPropagation(); openPalette(); }
}, true);


