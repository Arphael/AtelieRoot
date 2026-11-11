"use strict";
/* ====== 12. Bloques de código ====== */
const langMenu = $('#langMenu');
langMenu.innerHTML = LANGS.map(l => '<button data-l="'+l+'">'+l+'</button>').join('') +
  '<div class="hr"></div><label for="otroLang">'+esc(T('cb.other-lang'))+'</label><input id="otroLang" placeholder="rust" autocomplete="off">';
let langTarget = null;
langMenu.addEventListener('click', e => {
  e.stopPropagation();
  const l = e.target.closest('[data-l]'); if (!l || !langTarget) return;
  setLang(langTarget, l.dataset.l);
});
langMenu.querySelector('#otroLang').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && langTarget){ e.preventDefault(); setLang(langTarget, e.target.value.trim()); e.target.value = ''; }
});
function setLang(cb, l){
  History.mark();
  cb.setAttribute('data-lang', l === 'text' ? '' : l);
  cb.querySelector('.cb-lang').firstChild.nodeValue = (l && l !== 'text') ? l : 'texto';
  hlBlock(cb, true);
  hide(langMenu); after(); History.snap(true);
}
ed.addEventListener('mousedown', e => {
  const li = e.target.closest('li[data-task]');
  if (li && !e.target.closest('a')){
    const r = li.getBoundingClientRect();
    if (e.clientX - r.left < 24 && e.clientY - r.top < 26){
      e.preventDefault(); History.mark();
      li.setAttribute('data-task', li.getAttribute('data-task') === '1' ? '0' : '1');
      after(); History.snap(true);
    }
  }
});
ed.addEventListener('click', e => {
  const lang = e.target.closest('.cb-lang');
  if (lang){ e.stopPropagation(); langTarget = lang.closest('.cb'); popup(langMenu, lang); return; }
  const del = e.target.closest('.cb-del');
  if (del){
    e.stopPropagation(); History.mark();
    const cb = del.closest('.cb');
    const next = cb.nextElementSibling || cb.previousElementSibling;
    cb.remove();
    if (next) caretInto(next, true);
    after(); History.snap(true); toast(T('msg.block-deleted'));
    return;
  }
  const cp = e.target.closest('.cb-copy');
  if (cp){ e.stopPropagation(); copyText((cp.closest('.cb').querySelector(SRC) || cp.closest('.cb').querySelector('pre')).innerText.replace(/\n+$/, '')); toast(T('msg.block-copied')); }
});
// los <pre> viven dentro de un contenedor no editable: hay que guardar sus cambios a mano
ed.addEventListener('input', e => { const cb = e.target.closest && e.target.closest('.cb'); if (cb){ Dirty.add(state.current); hlBlock(cb); stash(); paintPreview(); save(); } }, true);

/* ====== 13. Tablas ====== */
