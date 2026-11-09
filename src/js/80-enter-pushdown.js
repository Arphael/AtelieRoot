"use strict";
/* ====== 74. Enter al inicio de un formato: lo empuja hacia abajo ====== */
// Con el cursor al principio de un encabezado, una cita, un punto de lista o una tarea, Enter deja arriba una línea de párrafo normal
// y el formato baja con su texto. (Un formato vacío, el medio y el final del texto se comportan como siempre.)
function pushDownItem(li){
  const L = li.parentElement, items = [...L.children], idx = items.indexOf(li);
  const p = document.createElement('p'); p.innerHTML = '<br>';
  if (idx === 0){ L.before(p); return; }
  const L2 = L.cloneNode(false); items.slice(idx).forEach(x => L2.appendChild(x));          // la lista se parte: arriba lo anterior, abajo este punto y los siguientes
  if (L2.tagName === 'OL'){ L2.removeAttribute('start'); L2.setAttribute('data-cont', ''); }   // y la numeración continúa
  L.after(p); p.after(L2);
}
function pushDownFormat(sel){
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = sel.getRangeAt(0);
  if (closestFrom(r.startContainer, SRC) || closestFrom(r.startContainer, 'td,th')) return false;
  const atStart = host => { const pre = document.createRange(); pre.selectNodeContents(host); pre.setEnd(r.startContainer, r.startOffset); const tmp = document.createElement('div'); tmp.appendChild(pre.cloneContents()); return tmp.textContent.replace(/\u200b/g, '') === '' && !tmp.querySelector('br,img,ul,ol'); };
  const keepCaret = () => { const rg = document.createRange(); rg.setStart(sc, so); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg); };    // mover nodos suelta el cursor: se devuelve a su sitio
  const sc = r.startContainer, so = r.startOffset;
  const li = closestFrom(sc, 'li');
  if (li){
    const L = li.parentElement;
    if (!L || L.parentElement !== ed) return false;                                           // solo listas de primer nivel (en una sublista, Enter sigue creando un punto)
    const own = li.cloneNode(true); own.querySelectorAll('ul,ol').forEach(x => x.remove());
    if (!own.textContent.replace(/\u200b/g, '').trim() || !atStart(li)) return false;       // punto vacío: sale de la lista como siempre
    History.mark(); pushDownItem(li); keepCaret();
    return true;
  }
  const b = currentBlock();
  if (!b || b.parentElement !== ed) return false;
  const isH = /^H[1-6]$/.test(b.tagName), isQ = b.tagName === 'P' && b.hasAttribute('data-quote');
  if (!isH && !isQ) return false;
  if (!b.textContent.replace(/\u200b/g, '').trim() || !atStart(b)) return false;             // un formato vacío se comporta como siempre
  History.mark();
  const p = document.createElement('p'); p.innerHTML = '<br>';
  b.before(p); keepCaret();                                                                   // el cursor se queda con el texto
  return true;
}

