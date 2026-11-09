"use strict";
/* ====== 21. Resaltado de sintaxis (Prism) ====== */
// dentro del código se inserta texto crudo: el navegador convertiría cada \n en un párrafo
function insertCodeText(sel, text){
  if (!sel.rangeCount) return;
  History.mark();
  const r = sel.getRangeAt(0);
  const src = closestFrom(r.startContainer, SRC);
  if (!src) return;
  r.deleteContents();
  const t = document.createTextNode(text);
  r.insertNode(t);
  const c = document.createRange();
  c.setStartAfter(t); c.collapse(true);
  sel.removeAllRanges(); sel.addRange(c);
  // un salto al final no se ve si no hay algo detrás: se añade un salto centinela
  const tail = document.createRange();
  tail.selectNodeContents(src); tail.setStart(c.startContainer, c.startOffset);
  if (text.endsWith('\n') && !tail.toString().length) src.appendChild(document.createTextNode('\n'));
  hlBlock(src.closest('.cb')); stash(); paintPreview(); save(); History.snap();
}
const LANG_ALIAS = { 'c++':'cpp', 'c#':'csharp', 'shell':'bash', 'sh':'bash', 'zsh':'bash', 'html':'markup', 'xml':'markup', 'svg':'markup',
  'text':'', 'txt':'', 'js':'javascript', 'ts':'typescript', 'py':'python', 'yml':'yaml', 'md':'markdown', 'ps1':'powershell' };
const prismLang = l => { l = (l || '').toLowerCase(); return Object.prototype.hasOwnProperty.call(LANG_ALIAS, l) ? LANG_ALIAS[l] : l; };
try {
  if (window.Prism && Prism.plugins && Prism.plugins.autoloader)
    Prism.plugins.autoloader.languages_path = 'vendor/prism/components/';
} catch(_){}
const hlCache = new WeakMap();
// El resaltado también puede terminar más tarde: el cargador de Prism trae el lenguaje la primera vez que se usa y entonces vuelve a resaltar.
// Ese retoque tampoco es una edición: si el documento estaba «limpio» (igual a lo último registrado) antes de resaltar, lo registrado se actualiza.
let hlCleanHint = null;                       // durante hlAll ya se sabe si está limpio (así no se serializa el documento una vez por bloque)
try {
  if (window.Prism && Prism.hooks){
    Prism.hooks.add('before-highlight', env => { if (env.element) env.element.__atClean = hlCleanHint !== null ? hlCleanHint : ed.innerHTML === History.last; });
    Prism.hooks.add('complete', env => { if (env.element && env.element.__atClean){ env.element.__atClean = false; if (ed.contains(env.element)) History.last = ed.innerHTML; } });
  }
} catch(_){}
function upgradeCodeBlocks(){
  ed.querySelectorAll('.cb').forEach(cb => {
    const cp = cb.querySelector('.cb-copy');
    if (cp && !cb.querySelector('.cb-del')){
      const d = document.createElement('button');
      d.className = 'mini cb-del'; d.title = 'Eliminar este bloque'; d.setAttribute('aria-label', 'Eliminar este bloque');
      d.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6"></polyline><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path></svg>';
      cp.parentNode.insertBefore(d, cp);
    }
    if (cb.querySelector('.cb-body')) return;
    const old = cb.querySelector('pre');
    const text = old ? old.innerText : '';
    const body = document.createElement('div');
    body.className = 'cb-body';
    body.innerHTML = '<pre class="cb-hl" aria-hidden="true"><code></code></pre><pre class="cb-src" contenteditable="true" spellcheck="false"></pre>';
    body.querySelector('.cb-src').textContent = text;
    if (old) old.replaceWith(body); else cb.appendChild(body);
  });
}
function hlBlock(cb, force){
  const src = cb.querySelector(SRC), code = cb.querySelector('.cb-hl code');
  if (!src || !code) return;
  const text = src.innerText.replace(/\n$/, '');
  const lang = prismLang(cb.getAttribute('data-lang'));
  const key = lang + '\u0000' + text;
  if (!force && hlCache.get(cb) === key) return;
  hlCache.set(cb, key);
  code.className = lang ? 'language-' + lang : '';
  code.textContent = text + '\n';
  if (lang && window.Prism && Prism.highlightElement){ try { Prism.highlightElement(code); } catch(_){} }
}
// El resaltado cambia el HTML del bloque después de la edición. Si el documento estaba «limpio» (igual a lo último registrado), eso no cuenta como un cambio:
// si no, Ctrl+Z solo quitaba el resaltado (que se volvía a poner solo) y nunca llegaba a deshacer la conversión.
function hlAll(force){
  const clean = ed.innerHTML === History.last; hlCleanHint = clean;
  try { ed.querySelectorAll('.cb').forEach(cb => hlBlock(cb, force)); } finally { hlCleanHint = null; }
  if (clean) History.last = ed.innerHTML;
}

/* ====== 22. Utilidades de texto ====== */
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function textNodes(){
  const out = [];
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement && n.parentElement.closest('.cb-head,.cb-hl') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  let n;
  while ((n = w.nextNode())) out.push(n);
  return out;
}
let sideT;
function sideRefresh(){
  clearTimeout(sideT);
  sideT = setTimeout(() => { hlAll(); paintOutline(); updatePh(); paintLinks(); if (F.open) runFind(true); }, 180);
}

