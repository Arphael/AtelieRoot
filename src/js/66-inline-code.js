"use strict";
/* ====== 54. Código en línea sin <code> (como las citas sin <blockquote>) ====== */
// QuillBot y otros correctores tratan <code> como texto ajeno y «saltan» esa parte, con lo que la frase queda rota.
// El código en línea es un <span data-code> con aspecto de código: para el corrector es texto normal, como las citas (<p data-quote>).
function makeFmtEl(tag){
  if (tag === 'code'){ const s = document.createElement('span'); s.setAttribute('data-code', ''); return s; }
  return document.createElement(tag);
}
// HTML que sale del editor hacia otras aplicaciones: citas → <blockquote>, código en línea → <code>, sin la cabecera de los bloques de código
function forOutsideHtml(host){
  host.querySelectorAll('.cb-head,.cb-hl').forEach(h => h.remove());
  host.querySelectorAll('span[data-cmt]').forEach(sp => sp.replaceWith(...sp.childNodes));   // comments stay in the app
  host.querySelectorAll('p[data-quote]').forEach(q => { const b = document.createElement('blockquote'); b.innerHTML = q.innerHTML; q.replaceWith(b); });
  host.querySelectorAll('span[data-code]').forEach(sp => { const c = document.createElement('code'); c.innerHTML = sp.innerHTML; sp.replaceWith(c); });
  return host;
}
// Estilos que mete el navegador al unir bloques, <code> antiguos y restos vacíos
function cleanInlineStyles(){
  const els = ed.querySelectorAll('span,font,[style],code');
  if (!els.length) return;
  const s = getSelection();
  const pt = s.rangeCount && ed.contains(s.anchorNode) ? capSel() : null;
  const map = new Map();
  let changed = false;
  els.forEach(el => {
    if (!el.isConnected || el.closest('.cb')) return;               // los bloques de código llevan sus propios estilos
    const t = el.tagName;
    if (t === 'CODE'){                                               // código en línea antiguo → <span data-code>
      const n = document.createElement('span'); n.setAttribute('data-code', '');
      while (el.firstChild) n.appendChild(el.firstChild);
      el.replaceWith(n); map.set(el, n); changed = true;
    } else if (t === 'SPAN' && el.hasAttribute('data-code')){
      if (el.hasAttribute('style')){ el.removeAttribute('style'); changed = true; }
      if (isBlankNode(el)){ el.remove(); changed = true; }          // se borró todo su texto
    } else if (t === 'FONT' || (t === 'SPAN' && el.hasAttribute('style'))){
      el.replaceWith(...el.childNodes); changed = true;             // <span style="font-size…"> que deja el navegador al unir bloques
    } else if (t !== 'SPAN' && t !== 'TD' && t !== 'TH' && el.hasAttribute('style')){
      el.removeAttribute('style'); changed = true;                  // las celdas guardan su alineación
    }
  });
  if (changed && pt) restoreMapped(pt, map);
}

