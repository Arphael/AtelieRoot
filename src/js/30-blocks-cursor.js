"use strict";
/* ====== 8. Bloques y cursor ====== */
function currentBlock(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return ed.lastElementChild;
  let n = s.anchorNode;
  if (n === ed) return ed.children[Math.min(s.anchorOffset, Math.max(0, ed.children.length - 1))] || ed.lastElementChild;
  while (n && n.parentNode !== ed) n = n.parentNode;
  if (!n) return ed.lastElementChild;
  if (n.nodeType === 3){ const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n); return p; }
  return n.nodeType === 1 ? n : ed.lastElementChild;
}
function caretInto(el, atEnd){
  if (!el) return;
  const target = el.querySelector ? (el.querySelector('td,th,li,' + SRC) || el) : el;
  const r = document.createRange(), s = getSelection();
  r.selectNodeContents(target); r.collapse(!atEnd);
  s.removeAllRanges(); s.addRange(r);
}
function replaceBlock(block, html){
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const nodes = [...tmp.childNodes];
  nodes.forEach(n => block.parentNode.insertBefore(n, block));
  block.remove();
  caretInto(nodes[0], true);
  return nodes;
}

