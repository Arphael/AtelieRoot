"use strict";
/* ====== 7. Documento ====== */
function save(now){ saveUi(); schedulePersist(now); }
function flag(t){ $('#saved').innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' + t; }
function openDoc(id){
  if (id && splitGuard(id)) return;
  if (!id){ ed.innerHTML = '<p><br></p>'; History.init(); return; }
  rememberScroll(active);                       // posición de lectura del documento que se deja
  if (state.current && state.current !== id) stash();
  state.current = id;
  ed.innerHTML = state.docs[id] || '<p><br></p>';
  autolinkTree(ed);                             // direcciones que estaban como texto: se ven como enlaces (sin tocar lo guardado)
  ensureBlocks(); applyFolds(); renumberLists(true); History.init();
  const pos = (Ui.data.scroll || {})[id];       // vuelve donde se quedó
  scroll.scrollTop = pos ? pos.y : 0;
  renderTree(); setPath(); counts(); paintPreview(); save();
  if (!matchMedia('(hover: none)').matches) ed.focus({ preventScroll: true });
  hlAll(true); sideRefresh();
  if (pos && pos.c != null) History.restoreCaret(pos.c);
  requestAnimationFrame(() => { scroll.scrollTop = pos ? pos.y : 0; });
}
// solo se guarda desde el editor lo que esta pestaña tocó; el resto queda como está en disco
function stash(){
  const id = state.current;
  if (!id || !Dirty.has(id)) return;
  renumberLists();
  state.docs[id] = ed.innerHTML
    .replace(/ data-cur=""| data-bsel=""| data-hid=""/g, '')
    .replace(/(<pre class="cb-hl"[^>]*><code[^>]*>)[\s\S]*?(<\/code><\/pre>)/g, '$1$2');   // el color del código se recalcula al abrir
}
function setPath(){ const p = pathOf(state.current); $('#path').textContent = p; const n = findNode(state.current); $('#mTitle').textContent = n ? n.name : ''; $('#mSub').textContent = p; paintPaneNames(); }
function counts(){
  const t = ed.innerText.replace(/\s+/g,' ').trim();
  $('#wc').textContent = (t ? t.split(' ').length : 0) + ' palabras';
  $('#cc').textContent = ed.innerText.length + ' caracteres';
}
function ensureBlocks(){
  if (!ed.firstChild){ ed.innerHTML = '<p><br></p>'; return; }
  [...ed.childNodes].forEach(n => {
    if (n.nodeType === 3){
      if (!n.nodeValue.trim()) return n.remove();
      const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n);
    } else if (n.nodeType === 1 && n.tagName === 'DIV' && !n.classList.contains('cb')){
      const p = document.createElement('p'); p.innerHTML = n.innerHTML || '<br>'; n.replaceWith(p);
    } else if (n.nodeType === 1 && n.tagName === 'BLOCKQUOTE'){
      const p = document.createElement('p'); p.setAttribute('data-quote', ''); p.innerHTML = n.innerHTML || '<br>'; n.replaceWith(p);
    } else if (n.nodeType === 1 && /^(B|I|EM|STRONG|CODE|A|S|SPAN|IMG|BR|FONT|U)$/.test(n.tagName)){
      const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n);
    }
  });
  if (!ed.firstChild) ed.innerHTML = '<p><br></p>';
  cleanInlineStyles();
  splitHeadingBreaks();
  mergeAdjacentLists();
  upgradeCodeBlocks();
}
ed.addEventListener('beforeinput', () => History.mark());
ed.addEventListener('input', e => {
  ensureBlocks();
  if (e.data && /[*_~`)\]]/.test(e.data)) runInline();
  Dirty.add(state.current); History.snap(); stash(); counts(); paintPreview(); save(); sideRefresh();
});

