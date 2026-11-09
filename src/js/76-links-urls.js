"use strict";
/* ====== 70. URLs: enlaces de verdad ====== */
// Una dirección escrita o pegada (https://…, www.…) pasa a ser un enlace subrayado. Ctrl+clic la abre y, con el cursor encima, sale una barrita para abrirla.
const isUrl = t => t.length > 8 && /^(?:https?:\/\/[^\s\/$.?#][^\s]*|www\.[^\s.][^\s]*\.[A-Za-z]{2,}[^\s]*)$/i.test(t);
const hrefOf = t => /^www\./i.test(t) ? 'https://' + t : t;
function trimUrl(u){                                              // quita la puntuación final, respetando los paréntesis que sí forman parte de la dirección
  for (;;){
    if (/[.,;:!?'"”’»\]}]$/.test(u)){ u = u.slice(0, -1); continue; }
    if (u.endsWith(')') && (u.match(/\)/g) || []).length > (u.match(/\(/g) || []).length){ u = u.slice(0, -1); continue; }
    return u;
  }
}
function openLink(href){
  let u = (href || '').trim();
  if (/^www\./i.test(u)) u = 'https://' + u;
  if (!/^(https?:|mailto:|tel:)/i.test(u)) return toast('Este enlace no se puede abrir desde aquí');
  const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
}
const URL_SCAN = /(^|[\s(\[«"'“‘¿¡\u200b])((?:https?:\/\/|www\.)[^\s\u200b<]+)/gi;
// al abrir un documento, las direcciones que ya estaban como texto se muestran como enlaces (en la nota guardada no cambia nada hasta que edites)
function autolinkTree(root){
  const bad = n => { for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) if (p.nodeType === 1 && p.matches('a,pre,code,script,style,[data-code],.cb')) return true; return false; };
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (/(?:https?:\/\/|www\.)/i.test(n.nodeValue) && !bad(n)) nodes.push(n);
  nodes.forEach(tn => {
    const text = tn.nodeValue, frag = document.createDocumentFragment();
    let last = 0, hit = false;
    for (const m of text.matchAll(URL_SCAN)){
      const u = trimUrl(m[2]); if (!isUrl(u)) continue;
      const start = m.index + m[1].length;
      frag.appendChild(document.createTextNode(text.slice(last, start)));
      const a = document.createElement('a'); a.setAttribute('href', hrefOf(u)); a.textContent = u; frag.appendChild(a);
      last = start + u.length; hit = true;
    }
    if (!hit) return;
    frag.appendChild(document.createTextNode(text.slice(last)));
    tn.replaceWith(frag);
  });
}
ed.addEventListener('click', e => {
  const a = e.target.closest ? e.target.closest('a') : null;
  if (!a || !ed.contains(a) || a.closest('.cb')) return;
  if (e.ctrlKey || e.metaKey){ e.preventDefault(); openLink(a.getAttribute('href')); }
});
// barrita del enlace: aparece con el cursor dentro de un enlace
const lkChip = $('#linkChip');
let lkA = null, lkRaf = 0;
function refreshLinkChip(){
  lkRaf = 0;
  const s = getSelection();
  let a = null;
  if (s.rangeCount && ed.contains(s.anchorNode) && document.activeElement === ed){
    a = closestFrom(s.anchorNode, 'a');
    if (a && (a.closest('.cb') || !a.getAttribute('href') || (!s.isCollapsed && closestFrom(s.focusNode, 'a') !== a))) a = null;
  }
  if (!a){ lkChip.classList.remove('show'); lkA = null; return; }
  lkA = a;
  lkChip.querySelector('.lk-url').textContent = a.getAttribute('href') || '';
  const r0 = s.getRangeAt(0).getBoundingClientRect(), rc = r0.height ? r0 : a.getBoundingClientRect(), sr = scroll.getBoundingClientRect();
  lkChip.classList.add('show');
  lkChip.style.left = Math.max(0, Math.min(rc.left - sr.left + scroll.scrollLeft, scroll.clientWidth - lkChip.offsetWidth - 8)) + 'px';
  lkChip.style.top = (rc.bottom - sr.top + scroll.scrollTop + 4) + 'px';
}
const linkChipSoon = () => { if (!lkRaf) lkRaf = requestAnimationFrame(refreshLinkChip); };
document.addEventListener('selectionchange', linkChipSoon);
ed.addEventListener('blur', linkChipSoon);                               // al perder el foco el documento, la barrita se va
[scroll1, scroll2].forEach(sc => sc.addEventListener('scroll', () => { if (sc === scroll && lkA) linkChipSoon(); }, { passive: true }));
lkChip.addEventListener('mousedown', e => e.preventDefault());
lkChip.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !lkA) return;
  const href = lkA.getAttribute('href') || '', k = b.dataset.lk;
  if (k === 'open') openLink(href);
  else if (k === 'copy'){ copyText(href); toast('Enlace copiado'); }
  else if (k === 'unlink'){ $('#unlinkBtn').click(); lkChip.classList.remove('show'); }
});

