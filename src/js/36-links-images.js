"use strict";
/* ====== 16. Enlaces e imágenes ====== */
$('#linkBtn').onclick = () => {
  const s = getSelection();
  const inside = ed.contains(s.anchorNode);
  const sel = inside && s.rangeCount && !s.isCollapsed ? s.getRangeAt(0).toString() : '';
  const saved = inside && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  dialog('Insertar enlace', [{ id:'txt', label:'Texto', value: sel }, { id:'url', label:'Dirección', value:'https://' }], v => {
    if (!v.url) return;
    ed.focus({ preventScroll: true });
    if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); }
    History.mark();
    document.execCommand('insertHTML', false, '<a href="'+v.url.replace(/"/g,'&quot;')+'">'+esc(v.txt || v.url)+'</a>&#8203;');
    after(); History.snap(true);
  });
};
$('#unlinkBtn').onclick = () => {
  const a = closestFrom(getSelection().anchorNode, 'a');
  if (!a) return toast('Pon el cursor dentro de un enlace');
  History.mark(); a.replaceWith(...a.childNodes); after(); History.snap(true);
};
$('#imgBtn').onclick = () => {
  const s = getSelection();
  const saved = ed.contains(s.anchorNode) && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  dialog('Insertar imagen', [{ id:'alt', label:'Texto alternativo', value:'' }, { id:'url', label:'Dirección de la imagen', value:'https://' }], v => {
    if (!v.url) return;
    ed.focus({ preventScroll: true });
    if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); }
    History.mark();
    document.execCommand('insertHTML', false, '<img alt="'+esc(v.alt)+'" src="'+v.url.replace(/"/g,'&quot;')+'">');
    after(); History.snap(true);
  });
};

