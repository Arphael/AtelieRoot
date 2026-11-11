"use strict";
/* ====== 47. Numeración conectada ====== */
// Una lista numerada puede «continuar» a la anterior (data-cont): su número inicial se recalcula solo cada vez que cambia
// la lista de arriba. Si no hay ninguna lista anterior que seguir, empieza en uno.
const olLast = ol => (Number.isFinite(ol.start) ? ol.start : 1) + [...ol.children].filter(x => x.tagName === 'LI').length - 1;
function setOlStart(ol, n){ if (n === 1) ol.removeAttribute('start'); else ol.setAttribute('start', n); }
// lista numerada anterior de primer nivel; los encabezados y las líneas divisorias cortan la secuencia
function prevOlInScope(el){
  let p = el.previousElementSibling;
  while (p){
    if (p.tagName === 'OL') return p;
    if (/^H[1-6]$/.test(p.tagName) || p.tagName === 'HR') return null;
    p = p.previousElementSibling;
  }
  return null;
}
function continueOl(ol){
  const prev = prevOlInScope(ol);
  if (prev && olLast(prev) + 1 !== 1){ setOlStart(ol, olLast(prev) + 1); ol.setAttribute('data-cont', ''); }
  else { setOlStart(ol, 1); ol.removeAttribute('data-cont'); }
}
function renumberLists(infer){
  let prev = null;
  for (const el of [...ed.children]){
    if (/^H[1-6]$/.test(el.tagName) || el.tagName === 'HR'){ prev = null; continue; }
    if (el.tagName !== 'OL') continue;
    if (el.hasAttribute('data-cont')){
      if (prev) setOlStart(el, olLast(prev) + 1);
      else { el.removeAttribute('data-cont'); setOlStart(el, 1); }     // nada que seguir: empieza en uno
    } else if (infer && prev && (Number.isFinite(el.start) ? el.start : 1) === olLast(prev) + 1 && olLast(prev) + 1 !== 1){
      el.setAttribute('data-cont', '');                               // texto ya existente que continúa a la lista anterior
    }
    prev = el;
  }
}
// cambia el número de un punto: ese punto y los siguientes continúan desde él, y las listas conectadas debajo los siguen
function setItemNumber(li, n){
  const list = li.parentElement;
  if (!list || list.tagName !== 'OL') return;
  const items = [...list.children].filter(x => x.tagName === 'LI');
  const idx = items.indexOf(li);
  if (n === (Number.isFinite(list.start) ? list.start : 1) + idx) return toast(T('msg.same-number'));
  History.mark();
  let target = list;
  if (idx > 0){
    target = list.cloneNode(false); target.removeAttribute('data-cont');
    items.slice(idx).forEach(x => target.appendChild(x));
    list.after(target);
  }
  setOlStart(target, n);
  const prev = target.parentElement === ed ? prevOlInScope(target) : null;
  if (prev && n !== 1 && n === olLast(prev) + 1) target.setAttribute('data-cont', ''); else target.removeAttribute('data-cont');
  after(); History.snap(true);
}
function editItemNumber(li){
  const list = li.parentElement, idx = [...list.children].indexOf(li);
  const cur = (Number.isFinite(list.start) ? list.start : 1) + idx;
  dialog(T('num.title'), [{ id: 'n', label: T('num.label'), value: String(cur) }], v => {
    const n = parseInt(v.n, 10);
    if (!(n >= 0)) return toast(T('msg.integer'));
    ed.focus({ preventScroll: true }); setItemNumber(li, n);
  });
}
// doble clic sobre el número de un punto: permite cambiarlo
ed.addEventListener('dblclick', e => {
  let li = e.target && e.target.closest ? e.target.closest('li') : null;
  if (!li && e.target && e.target.tagName === 'OL')                                // el hueco a la izquierda del número
    li = [...e.target.children].find(x => { const b = x.getBoundingClientRect(); return e.clientY >= b.top && e.clientY <= b.bottom; }) || null;
  if (!li || !ed.contains(li) || !li.parentElement || li.parentElement.tagName !== 'OL' || li.hasAttribute('data-task')) return;
  if (e.clientX >= li.getBoundingClientRect().left) return;                        // solo si se hace sobre el número
  e.preventDefault();
  editItemNumber(li);
});

