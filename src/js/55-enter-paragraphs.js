"use strict";
/* ====== 41. Enter en párrafos ====== */
// Un párrafo puede contener varias líneas (saltos <br>). Enter sobre una línea con texto añade un salto;
// Enter sobre una línea vacía, o al inicio de una línea, parte el párrafo en dos en ese punto.
const blankText = t => !String(t).replace(/[\u200b\u00a0\s]/g, '');
const isBlankNode = n => n.nodeType === 3 ? blankText(n.nodeValue)
  : n.nodeType === 1 && n.nodeName !== 'BR' && n.nodeName !== 'IMG' && blankText(n.textContent) && !n.querySelector('img,br');
// último (o primer) elemento con contenido de un fragmento: un texto, una imagen o un salto de línea
function edgeLeaf(root, atEnd){
  let n = root;
  for (let g = 0; g < 60; g++){
    const kids = [...n.childNodes].filter(k => !isBlankNode(k));
    if (!kids.length) return n === root ? null : n;
    n = atEnd ? kids[kids.length - 1] : kids[0];
    if (n.nodeName === 'BR' || n.nodeName === 'IMG' || n.nodeType === 3) return n;
  }
  return null;
}
function trimEdge(div, atEnd){
  for (let g = 0; g < 60; g++){
    let e;
    while ((e = atEnd ? div.lastChild : div.firstChild) && isBlankNode(e)) e.remove();   // restos vacíos del corte
    const leaf = edgeLeaf(div, atEnd);
    if (!leaf || leaf.nodeName !== 'BR') break;
    let p = leaf.parentNode; leaf.remove();
    while (p && p !== div && isBlankNode(p) && !p.querySelector('br,img')){ const up = p.parentNode; p.remove(); p = up; }
  }
  const w = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  let t, edge = null;
  while ((t = w.nextNode())){ if (!blankText(t.nodeValue)){ edge = t; if (!atEnd) break; } }
  if (edge) edge.nodeValue = atEnd ? edge.nodeValue.replace(/[ \u00a0\u200b]+$/, '') : edge.nodeValue.replace(/^[ \u00a0\u200b]+/, '');
}
// salto de línea dentro del párrafo, siempre a nivel del bloque (aunque el cursor esté dentro de negrita o cursiva)
function insertBreak(block, sel){
  let r = sel.getRangeAt(0);
  if (!sel.isCollapsed){ r.deleteContents(); r = sel.getRangeAt(0); }
  const tailR = document.createRange(); tailR.selectNodeContents(block); tailR.setStart(r.startContainer, r.startOffset);
  const frag = tailR.extractContents();
  // las copias vacías de negrita, cursiva o código que deja el corte se descartan: no deben arrastrar su formato a la línea nueva
  while (frag.firstChild && isBlankNode(frag.firstChild)) frag.removeChild(frag.firstChild);
  const probe = document.createElement('div'); probe.appendChild(frag.cloneNode(true));
  const atLineEnd = !edgeLeaf(probe, false);                     // no queda nada después del cursor
  const br = document.createElement('br');
  block.appendChild(br);
  if (!atLineEnd) block.appendChild(frag);
  let n = br.nextSibling;
  while (n && isBlankNode(n)) n = n.nextSibling;
  if (!n) block.appendChild(document.createElement('br'));       // sin esto la línea nueva, vacía, no se vería
  const c = document.createRange();
  if (atLineEnd){
    // fin de línea: la línea nueva empieza SIN formato, en un texto propio fuera de cualquier negrita, cursiva o código
    const z = document.createTextNode('\u200b');
    br.after(z);
    c.setStart(z, 1);
  } else {
    // en medio de un texto: el cursor queda al inicio de lo que sigue, con el formato que ese texto ya tenía
    const w = document.createTreeWalker(block, NodeFilter.SHOW_ALL);
    w.currentNode = br;
    let target = null, m;
    while ((m = w.nextNode())){
      if (m.nodeName === 'BR' || m.nodeName === 'IMG') break;
      if (m.nodeType === 3 && m.nodeValue.length){ target = m; break; }
    }
    if (target) c.setStart(target, 0); else c.setStartAfter(br);
  }
  c.collapse(true);
  sel.removeAllRanges(); sel.addRange(c);
}
// tras un Enter normal del navegador (puntos de lista, encabezados): si la línea nueva está vacía, se deja sin formato
function plainEmptyBlock(){
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed || !ed.contains(s.anchorNode)) return;
  const host = closestFrom(s.anchorNode, 'li') || currentBlock();
  if (!host || !/^(P|LI|H[1-6])$/.test(host.tagName)) return;
  if (host.querySelector('img,ul,ol,table,.cb')) return;
  const leaf = edgeLeaf(host, false);
  if (leaf && leaf.nodeName !== 'BR') return;                    // ya tiene texto: no se toca
  if (!host.querySelector('strong,b,em,i,s,del,strike,code,u,a,mark,font,span')) return;
  host.innerHTML = '<br>';
  caretInto(host);
}
function paraEnter(block, sel){
  History.mark();
  let r = sel.getRangeAt(0);
  if (!sel.isCollapsed){ r.deleteContents(); r = sel.getRangeAt(0); }
  const preR = document.createRange(); preR.selectNodeContents(block); preR.setEnd(r.startContainer, r.startOffset);
  const postR = document.createRange(); postR.selectNodeContents(block); postR.setStart(r.startContainer, r.startOffset);
  const preD = document.createElement('div'); preD.appendChild(preR.cloneContents());
  const postD = document.createElement('div'); postD.appendChild(postR.cloneContents());
  const preLeaf = edgeLeaf(preD, true), postLeaf = edgeLeaf(postD, false);
  const preEmpty = !preLeaf || preLeaf.nodeName === 'BR';     // sin texto antes, en esta línea
  const postEmpty = !postLeaf || postLeaf.nodeName === 'BR';  // sin texto después, en esta línea
  if (!preEmpty){ insertBreak(block, sel); return; }
  if (!preLeaf && !postEmpty){                                // inicio del párrafo: se abre uno vacío encima
    const p = document.createElement('p'); p.innerHTML = '<br>';
    block.parentNode.insertBefore(p, block);
    return;
  }
  trimEdge(preD, true); trimEdge(postD, false);               // se parte el párrafo aquí
  if (edgeLeaf(preD, true)) block.replaceChildren(...preD.childNodes); else block.innerHTML = '<br>';
  const p2 = document.createElement('p');
  if (edgeLeaf(postD, false)) p2.append(...postD.childNodes); else p2.innerHTML = '<br>';
  block.parentNode.insertBefore(p2, block.nextSibling);
  caretInto(p2);
  p2.scrollIntoView({ block: 'nearest' });
}
// atajos de bloque (#, -, 1., >, [ ]) escritos al inicio de una línea que no es la primera del párrafo:
// primero se parte el párrafo ahí, para que el atajo funcione como al inicio de un párrafo
function liftLineShortcut(sel, li, re){
  if (li) return;
  const block = currentBlock();
  if (!block || block.tagName !== 'P' || !sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const pre = document.createRange(); pre.selectNodeContents(block); pre.setEnd(r.startContainer, r.startOffset);
  const kids = [...pre.cloneContents().childNodes];
  let line = '', k = kids.length - 1;
  for (; k >= 0 && kids[k].nodeName !== 'BR'; k--) line = kids[k].textContent + line;
  line = line.replace(/\u200b/g, '').replace(/^[ \u00a0\t]+/, '');
  if (k < 0 || !(re || SHORTCUT_LINE).test(line)) return;
  const br = block.childNodes[k];
  if (!br || br.nodeName !== 'BR') return;
  const cn = r.startContainer, co = r.startOffset;
  const p2 = document.createElement('p');
  while (br.nextSibling) p2.appendChild(br.nextSibling);
  br.remove();
  const d = document.createElement('div'); d.append(...block.childNodes);
  trimEdge(d, true);
  if (edgeLeaf(d, true)) block.append(...d.childNodes); else block.innerHTML = '<br>';
  block.parentNode.insertBefore(p2, block.nextSibling);
  const rr = document.createRange();
  if (cn === block) rr.setStart(p2, Math.max(0, co - (k + 1))); else rr.setStart(cn, co);
  rr.collapse(true);
  sel.removeAllRanges(); sel.addRange(rr);
}
// teclados de móvil: no envían la tecla Enter, envían «insertar párrafo»
ed.addEventListener('beforeinput', e => {
  if (e.inputType !== 'insertParagraph' || !e.cancelable) return;
  const s = getSelection();
  if (s.rangeCount && s.isCollapsed && !closestFrom(s.anchorNode, '.cb,td,th') && hrBelowFormat(s)){ e.preventDefault(); after(); History.snap(true); refreshBar(); return; }
  if (!s.rangeCount || closestFrom(s.anchorNode, '.cb,li,td,th')) return;
  const b = currentBlock();
  if (!b || b.tagName !== 'P') return;
  e.preventDefault();
  if (hrOnEnter(b, s) || quoteOnEnter(s)){ after(); History.snap(true); refreshBar(); return; }
  paraEnter(b, s); after(); History.snap(true); refreshBar();
});

