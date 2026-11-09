"use strict";
/* ====== 25. Menú de barra ====== */
const SLASH_ITEMS = [
  { k:'p',     t:'Texto',             a:'parrafo texto normal p' },
  { k:'h1',    t:'Encabezado 1',      a:'titulo h1 heading' },
  { k:'h2',    t:'Encabezado 2',      a:'titulo h2 heading subtitulo' },
  { k:'h3',    t:'Encabezado 3',      a:'titulo h3 heading' },
  { k:'h4',    t:'Encabezado 4',      a:'titulo h4 heading' },
  { k:'h5',    t:'Encabezado 5',      a:'titulo h5 heading' },
  { k:'h6',    t:'Encabezado 6',      a:'titulo h6 heading' },
  { k:'ul',    t:'Lista con viñetas', a:'vinetas lista bullet ul' },
  { k:'ol',    t:'Lista numerada',    a:'numerada ordenada numeros ol' },
  { k:'task',  t:'Lista de tareas',   a:'tareas todo checkbox casilla' },
  { k:'quote', t:'Cita',              a:'cita quote blockquote' },
  { k:'pre',   t:'Bloque de código',  a:'codigo code pre bloque' },
  { k:'table', t:'Tabla',             a:'tabla table' },
  { k:'hr',    t:'Línea divisoria',   a:'linea divisoria separador hr' },
  { k:'link',  t:'Enlace',            a:'enlace link url' },
  { k:'img',   t:'Imagen',            a:'imagen image foto' }
];
const slashMenu = $('#slashMenu');
const slash = { open: false, node: null, off: 0, items: [], i: 0 };
ed.addEventListener('input', e => {
  if (e.data === '/' && !slash.open){
    const s = getSelection(), n = s.anchorNode;
    if (n && n.nodeType === 3 && !closestFrom(n, '.cb,td,th')){
      const off = s.anchorOffset - 1;
      const prev = off > 0 ? n.nodeValue[off - 1] : '';
      if (!prev || /[\s\u200b]/.test(prev)){
        slash.open = true; slash.node = n; slash.off = off; slash.i = 0;
        paintSlash('');
        return;
      }
    }
  }
  if (slash.open){
    const q = slashQuery();
    if (q === null) return closeSlash();
    slash.i = 0; paintSlash(q);
  }
});
function slashQuery(){
  const s = getSelection();
  if (!s.rangeCount || s.anchorNode !== slash.node || s.anchorOffset <= slash.off) return null;
  const t = slash.node.nodeValue;
  if (t[slash.off] !== '/') return null;
  const q = t.slice(slash.off + 1, s.anchorOffset);
  if (/\s/.test(q) || q.length > 24) return null;
  return q;
}
function paintSlash(q){
  const nq = norm(q);
  slash.items = SLASH_ITEMS.filter(x => !nq || norm(x.t + ' ' + x.a).includes(nq));
  if (!slash.items.length){ slashMenu.classList.remove('show'); return; }
  slash.i = Math.min(slash.i, slash.items.length - 1);
  slashMenu.innerHTML = '';
  slash.items.forEach((x, i) => {
    const b = document.createElement('button');
    b.textContent = x.t;
    if (i === slash.i) b.className = 'on';
    b.onmousedown = ev => { ev.preventDefault(); slash.i = i; applySlash(); };
    slashMenu.appendChild(b);
  });
  const s = getSelection();
  let rc = s.rangeCount ? s.getRangeAt(0).getBoundingClientRect() : null;
  if (!rc || (!rc.width && !rc.height)){ const b = currentBlock(); rc = b ? b.getBoundingClientRect() : { left: 100, top: 100, bottom: 120 }; }
  slashMenu.classList.add('show');
  slashMenu.style.left = Math.max(8, Math.min(innerWidth - slashMenu.offsetWidth - 8, rc.left)) + 'px';
  const h = slashMenu.offsetHeight;
  slashMenu.style.top = (rc.bottom + 6 + h > innerHeight ? Math.max(8, rc.top - h - 6) : rc.bottom + 6) + 'px';
  const on = slashMenu.querySelector('.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}
function closeSlash(){ slash.open = false; slashMenu.classList.remove('show'); }
function applySlash(){
  const item = slash.items[slash.i], q = slashQuery();
  closeSlash();
  if (!item || q === null) return;
  const s = getSelection();
  const r = document.createRange();
  r.setStart(slash.node, slash.off); r.setEnd(slash.node, slash.off + 1 + q.length);
  r.deleteContents();
  const r2 = document.createRange();
  r2.setStart(slash.node, slash.off); r2.collapse(true);
  s.removeAllRanges(); s.addRange(r2);
  const k = item.k;
  if (k === 'p' || /^h\d$/.test(k)){
    History.mark();
    const b = currentBlock();
    if (!b) return;
    const inner = (b.innerHTML && b.innerHTML !== '<br>' && b.textContent.replace(/\u200b/g,'').trim()) ? b.innerHTML : '<br>';
    replaceBlock(b, '<' + k + '>' + inner + '</' + k + '>');
    after(); History.snap(true); refreshBar();
  }
  else if (k === 'link') $('#linkBtn').click();
  else if (k === 'img') $('#imgBtn').click();
  else insertBlock(k);
}
document.addEventListener('mousedown', e => { if (slash.open && !e.target.closest('#slashMenu')) closeSlash(); });

