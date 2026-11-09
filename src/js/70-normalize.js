"use strict";
/* ====== 61. Encabezados de una sola línea ====== */
// Lo que va después de un salto de línea escrito dentro de un encabezado deja de ser encabezado: pasa a un párrafo justo debajo
// (igual que en Markdown). Así el texto de debajo de una marca ↵ nunca hereda el formato del encabezado.
function splitHeadingBreaks(){
  const heads = [...ed.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.parentElement === ed && h.querySelector('br'));
  if (!heads.length) return;
  const s = getSelection();
  const pt = s.rangeCount && ed.contains(s.anchorNode) ? capSel() : null;
  let changed = false;
  heads.forEach(h => {
    for (let guard = 0; guard < 50; guard++){
      let at = null;
      for (const br of h.querySelectorAll('br')){
        const r = document.createRange(); r.setStartAfter(br); r.setEnd(h, h.childNodes.length);
        const probe = document.createElement('div'); probe.appendChild(r.cloneContents());
        if (edgeLeaf(probe, false)){ at = br; break; }              // hay contenido detrás: es un salto real, no el de relleno final
      }
      if (!at) break;
      const tail = document.createRange(); tail.setStartAfter(at); tail.setEnd(h, h.childNodes.length);
      const frag = tail.extractContents();
      at.remove();
      let c;
      while ((c = h.lastChild) && (c.nodeName === 'BR' || isBlankNode(c))) c.remove();                // la línea en blanco de en medio
      while (frag.firstChild && (frag.firstChild.nodeName === 'BR' || isBlankNode(frag.firstChild))) frag.removeChild(frag.firstChild);
      const p = document.createElement('p');
      p.appendChild(frag);
      if (!edgeLeaf(p, false)) p.innerHTML = '<br>';
      if (!edgeLeaf(h, false)) h.innerHTML = '<br>';
      h.after(p);
      changed = true;
    }
  });
  if (changed && pt) restoreMapped(pt, new Map());
}
// Shift+Enter en un encabezado: lo que queda después del cursor pasa a un párrafo nuevo debajo, y el cursor va ahí
function splitHeadingAtCaret(h, sel){
  if (!sel.isCollapsed) sel.getRangeAt(0).deleteContents();
  const r = sel.getRangeAt(0);
  const tail = document.createRange(); tail.selectNodeContents(h); tail.setStart(r.startContainer, r.startOffset);
  const frag = tail.extractContents();
  while (frag.firstChild && (frag.firstChild.nodeName === 'BR' || isBlankNode(frag.firstChild))) frag.removeChild(frag.firstChild);
  const p = document.createElement('p');
  p.appendChild(frag);
  if (!edgeLeaf(p, false)) p.innerHTML = '<br>';
  if (!edgeLeaf(h, false)) h.innerHTML = '<br>';
  h.after(p);
  caretInto(p, false);
}

/* ====== 62. Las listas seguidas del mismo tipo son una sola lista ====== */
// Al borrar un punto, un párrafo o una línea que separaba dos listas, estas quedan juntas: se unen en una sola
// (si no, el Markdown llevaría una línea en blanco entre ellas). Las numeradas solo se unen si una continúa a la otra.
function mergeAdjacentLists(){
  const s = getSelection();
  const pt = s.rangeCount && ed.contains(s.anchorNode) ? capSel() : null;
  let any = false;
  ed.querySelectorAll('ul,ol').forEach(el => {
    if (!el.isConnected || el.closest('.cb')) return;
    let nx = el.nextElementSibling;
    while (nx && nx.tagName === el.tagName && el.hasAttribute('data-task') === nx.hasAttribute('data-task') &&
           (el.tagName === 'UL' || nx.hasAttribute('data-cont') || (Number.isFinite(nx.start) ? nx.start : 1) === olLast(el) + 1)){
      while (nx.firstChild) el.appendChild(nx.firstChild);
      nx.remove(); any = true; nx = el.nextElementSibling;
    }
  });
  if (any && pt) restoreMapped(pt, new Map());
}
// cursor al final / al inicio del texto propio de un punto (sin entrar en sus sublistas)
function caretEndOwn(li){
  const leaf = lastOwnLeaf(li), r = document.createRange(), s = getSelection();
  if (!leaf){ r.selectNodeContents(li); r.collapse(false); }
  else if (leaf.nodeType === 3){ r.setStart(leaf, leaf.length); r.collapse(true); }
  else { r.setStartBefore(leaf); r.collapse(true); }
  s.removeAllRanges(); s.addRange(r);
}
function caretStartOwn(li){ const r = document.createRange(), s = getSelection(); r.setStart(li, 0); r.collapse(true); s.removeAllRanges(); s.addRange(r); }

