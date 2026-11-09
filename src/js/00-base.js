
"use strict";
const $ = s => document.querySelector(s);
let ed = $('#ed'), scroll = $('#scroll');
const treeEl = $('#tree');
// Vista dividida: un solo motor de edición que se mueve al panel activo.
// Cada escucha se registra en ambos paneles, pero solo actúa en el que está activo.
const ed1 = ed, ed2 = $('#ed2'), scroll1 = scroll, scroll2 = $('#scroll2');
function dualListen(a, b, getActive){
  a.addEventListener = (t, f, o) => {
    EventTarget.prototype.addEventListener.call(a, t, ev => { if (getActive() === a) f(ev); }, o);
    EventTarget.prototype.addEventListener.call(b, t, ev => { if (getActive() === b) f(ev); }, o);
  };
}
dualListen(ed1, ed2, () => ed);
dualListen(scroll1, scroll2, () => scroll);
const LANGS = ['typescript','javascript','jsx','tsx','python','bash','shell','sql','json','yaml','html','css','java','kotlin','swift','c','c++','c#','go','rust','php','ruby','dart','r','xml','diff','markdown','text'];
const SRC = 'pre[contenteditable="true"]';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch(_){}
const closestFrom = (node, sel) => {
  let n = node;
  while (n && n !== ed){ if (n.nodeType === 1 && n.matches && n.matches(sel)) return n; n = n.parentNode; }
  return null;
};

