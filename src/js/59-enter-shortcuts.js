"use strict";
/* ====== 45. Atajos al pulsar Enter: línea divisoria y cita ====== */
const HR_LINE = /^(-{3,}|\*{3,}|_{3,})$/;
const QUOTE_ONLY = /^"$/;
const SHORTCUT_LINE = /^(#{1,6}|[-*+•●◦▪‣∙\uF0B7]|\d+[.)]|\[[ xX]?\]|>|")$/;
const isBlankHtml = h => !String(h).replace(/<[^>]*>|\u200b|&nbsp;/g, '').trim();
// convierte el bloque y deja el cursor donde estaba: al inicio del texto que ya existía
function shortcutBlock(block, html){
  const nodes = replaceBlock(block, html);
  caretInto(nodes[0], false);
  return nodes;
}
// «---» (o «***», «___») + Enter: la línea se convierte en una línea divisoria y el cursor pasa a un párrafo nuevo debajo
function hrOnEnter(block, sel){
  if (!sel.isCollapsed || !sel.rangeCount || !block || block.tagName !== 'P') return false;
  const r = sel.getRangeAt(0), info = paraInfo(block);
  const li = lineAt(block, r.startContainer, r.startOffset, info);
  const txt = (info.lines[li] || []).map(n => n.textContent).join('').replace(/[\u200b\u00a0\s]/g, '').replace(/[\u2014\u2013]/g, '--');
  if (!HR_LINE.test(txt)) return false;
  History.mark();
  const n = info.lines.length;
  const mk = (from, to) => {
    const p = document.createElement('p');
    for (let j = from; j <= to; j++){ info.lines[j].forEach(x => p.appendChild(x)); if (j < to) p.appendChild(info.brs[j]); }
    return p;
  };
  const seq = [];
  if (li > 0){                                                   // las líneas de arriba siguen siendo su párrafo
    const before = mk(0, li - 1);
    if (edgeLeaf(before, true)){ [...block.attributes].forEach(a => before.setAttribute(a.name, a.value)); seq.push(before); }
  }
  seq.push(document.createElement('hr'));
  let target = li < n - 1 ? mk(li + 1, n - 1) : null;            // las de abajo pasan a un párrafo propio
  if (target && !edgeLeaf(target, false)) target = null;
  if (target) seq.push(target);
  else {
    const nx = block.nextElementSibling;
    if (nx && nx.tagName === 'P' && isBlankHtml(nx.innerHTML) && !nx.querySelector('img')) target = nx;   // ya hay un párrafo vacío debajo
    else { target = document.createElement('p'); target.innerHTML = '<br>'; seq.push(target); }
  }
  block.replaceWith(...seq);
  caretInto(target, false);
  return true;
}
// «"» + Enter al inicio de un párrafo (con texto o vacío): todo el párrafo pasa a ser una cita
function quoteOnEnter(sel){
  if (!sel.isCollapsed || !sel.rangeCount) return false;
  const b0 = currentBlock();
  if (!b0 || b0.tagName !== 'P') return false;
  liftLineShortcut(sel, null, QUOTE_ONLY);                       // si la comilla está en una línea posterior, esa línea se separa
  const block = currentBlock();
  if (!block || block.tagName !== 'P') return false;
  const r = sel.getRangeAt(0);
  const pre = document.createRange(); pre.selectNodeContents(block); pre.setEnd(r.startContainer, r.startOffset);
  if (pre.toString().replace(/\u200b/g, '') !== '"') return false;
  const post = document.createRange(); post.selectNodeContents(block); post.setStart(r.startContainer, r.startOffset);
  const pt = post.toString().replace(/\u200b/g, '');
  const d = document.createElement('div'); d.appendChild(post.cloneContents());
  let rest = d.innerHTML.replace(/^(?:<br\s*\/?>)+/i, '');
  if (pt[0] === '"' && (pt.length === 1 || /[\s)\]}.,;:!?]/.test(pt[1]))) rest = rest.replace(/^"/, '');   // la comilla de cierre que se añadió sola
  History.mark();
  shortcutBlock(block, '<p data-quote="">' + (isBlankHtml(rest) ? '<br>' : rest) + '</p>');
  return true;
}

/* ====== 46. Formato en línea: quitarlo con el mismo comando y salir con dos espacios ====== */
const FMT_SEL = { strong: 'strong,b', em: 'em,i', s: 's,del,strike', code: 'span[data-code],code' };
const BTN_TAG = { bold: 'strong', italic: 'em', strike: 's', code: 'code' };
function caretAtEnd(el, r){
  const t = document.createRange();
  try { t.setStart(r.startContainer, r.startOffset); t.setEnd(el, el.childNodes.length); } catch(_){ return false; }
  return !t.toString().replace(/\u200b/g, '');
}
// sale del formato: el cursor pasa justo después del elemento y lo ya escrito no cambia
function exitFormat(el){
  const s = getSelection();
  let z = el.nextSibling;
  if (!(z && z.nodeType === 3 && z.nodeValue.startsWith('\u200b'))){ z = document.createTextNode('\u200b'); el.after(z); }
  const rr = document.createRange(); rr.setStart(z, 1); rr.collapse(true);
  s.removeAllRanges(); s.addRange(rr);
  if (!el.textContent.replace(/\u200b/g, '')) el.remove();
}
function unwrapKeepingCaret(el, r){
  const s = getSelection(), parent = el.parentNode;
  const base = [...parent.childNodes].indexOf(el);
  let c = r.startContainer, o = r.startOffset;
  if (c === el){ c = parent; o = base + o; }
  el.replaceWith(...el.childNodes);
  try { const rr = document.createRange(); rr.setStart(c, o); rr.collapse(true); s.removeAllRanges(); s.addRange(rr); } catch(_){}
}
function rangeAllInside(r, sel){
  const root = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n, any = false;
  while ((n = w.nextNode())){
    if (!r.intersectsNode(n)) continue;
    const a = n === r.startContainer ? r.startOffset : 0;
    const z = n === r.endContainer ? r.endOffset : n.nodeValue.length;
    if (z <= a || !n.nodeValue.slice(a, z).replace(/\u200b/g, '')) continue;
    any = true;
    if (!closestFrom(n, sel)) return false;
  }
  return any;
}
function selectBetween(first, last){
  if (!first || !last || !first.isConnected || !last.isConnected) return;
  const rr = document.createRange(); rr.setStartBefore(first); rr.setEndAfter(last);
  const s = getSelection(); s.removeAllRanges(); s.addRange(rr);
}
// quita el formato solo de lo seleccionado; si la selección está en medio de un elemento, lo parte en dos
// dos espacios seguidos al final de un código en línea: se sale del código y queda un solo espacio normal
function codeDoubleSpace(sel){
  const r = sel.getRangeAt(0);
  const code = closestFrom(r.startContainer, 'span[data-code],code');
  if (!code || closestFrom(r.startContainer, '.cb') || !caretAtEnd(code, r)) return false;
  const raw = code.textContent.replace(/\u200b/g, '');
  if (!raw.trim() || !/[ \u00a0]$/.test(raw)) return false;
  History.mark();
  const w = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let t, lastT = null;
  while ((t = w.nextNode())) if (t.nodeValue.replace(/\u200b/g, '')) lastT = t;
  if (lastT) lastT.nodeValue = lastT.nodeValue.replace(/[ \u00a0\u200b]+$/, '');
  exitFormat(code);
  document.execCommand('insertText', false, ' ');
  return true;
}

