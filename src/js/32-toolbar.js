"use strict";
/* ====== 10. Formato en línea ====== */
/* ====== 11. Barra ====== */
$('#bar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
$('#bar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const { cmd, fmt, block } = b.dataset;
  if (cmd === 'undo') return History.undo();
  if (cmd === 'redo') return History.redo();
  if (fmt){
    if (fmt === 'bold') toggleWrap('strong');
    else if (fmt === 'italic') toggleWrap('em');
    else if (fmt === 'strike') toggleWrap('s');
    else if (fmt === 'code') toggleWrap('code');
    else if (fmt === 'clear') clearFormat();
    return;
  }
  if (block) insertBlock(block);
});
$('#inBtn').onclick = () => { const li = closestFrom(getSelection().anchorNode, 'li'); if (li){ History.mark(); indent(li); after(); History.snap(true);} else toast('Pon el cursor en una lista'); };
$('#outBtn').onclick = () => { const li = closestFrom(getSelection().anchorNode, 'li'); if (li){ History.mark(); outdent(li); after(); History.snap(true);} else toast('Pon el cursor en una lista'); };
$('#sideBtn').onclick = () => $('#side').classList.toggle('off');

function insertBlock(kind){
  History.mark();
  if (kind === 'ul' || kind === 'ol' || kind === 'task'){
    toggleList(kind); after(); History.snap(true); refreshBar(); return;
  }
  if (kind === 'quote'){ toggleQuoteSelection(); after(); History.snap(true); refreshBar(); return; }
  const b = currentBlock();
  if (!b) return;
  const keep = (b.innerHTML && b.innerHTML !== '<br>') ? b.innerHTML : '<br>';
  if (kind === 'ul') replaceBlock(b, '<ul><li>' + keep + '</li></ul>');
  else if (kind === 'ol'){ const ns = replaceBlock(b, '<ol><li>' + keep + '</li></ol>'); if (ns[0].parentElement === ed) continueOl(ns[0]); }
  else if (kind === 'task') replaceBlock(b, '<ul data-task=""><li data-task="0">' + keep + '</li></ul>');
  else if (kind === 'quote'){
    // interruptor: sobre una cita, la quita
    if (b.tagName === 'P'){ b.hasAttribute('data-quote') ? b.removeAttribute('data-quote') : b.setAttribute('data-quote', ''); caretInto(b, true); }
    else replaceBlock(b, '<p data-quote="">' + keep + '</p>');
  }
  else if (kind === 'pre') selectionToCodeBlock(b);
  else if (kind === 'hr') replaceBlock(b, '<hr><p>' + keep + '</p>');
  else if (kind === 'table' && tableFromSelection()){ /* el texto seleccionado ya es la tabla */ }
  else if (kind === 'table'){
    const had = b.textContent.trim();
    askTableSize((r, c) => insertSizedTable(b, r, c, keep, had));            // se elige cuántas filas y columnas
  }
  after(); History.snap(true); refreshBar();
}
const hMenu = $('#hMenu');
hMenu.innerHTML = ['Párrafo','Encabezado 1','Encabezado 2','Encabezado 3','Encabezado 4','Encabezado 5','Encabezado 6']
  .map((t,i) => '<button data-h="'+i+'">'+t+'</button>').join('');
$('#hBtn').onclick = e => { e.stopPropagation(); popup(hMenu, $('#hBtn')); };
hMenu.addEventListener('mousedown', e => e.preventDefault());
hMenu.onclick = e => {
  e.stopPropagation();
  const h = e.target.closest('[data-h]'); if (!h) return;
  hide(hMenu);
  applyBlockType(+h.dataset.h);
};
function refreshBar(){
  const b = currentBlock();
  const t = (b && b.tagName) || 'P';
  $('#hBtn').firstChild.nodeValue = /^H[1-6]$/.test(t) ? 'Encabezado ' + t[1] : 'Párrafo';
  // los botones de formato se iluminan cuando el cursor está dentro de ese formato
  const an = getSelection().anchorNode, inEd = !!an && ed.contains(an);
  document.querySelectorAll('[data-fmt]').forEach(btn => {
    const sel = FMT_SEL[BTN_TAG[btn.dataset.fmt]];
    if (sel) btn.classList.toggle('on', inEd && !!closestFrom(an, sel));
  });
}
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return;
  refreshBar(); refreshTableBar();
  if (document.body.classList.contains('focus')) markCur();
});

