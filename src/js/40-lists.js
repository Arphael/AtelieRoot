"use strict";
/* ====== 20. Listas: interruptor y salida ====== */
function isKind(li, kind){
  if (kind === 'task') return li.hasAttribute('data-task');
  return !li.hasAttribute('data-task') && li.parentElement.tagName === (kind === 'ol' ? 'OL' : 'UL');
}
// saca un elemento de primer nivel como párrafo, partiendo la lista en ese punto
function splitOut(li){
  const L = li.parentElement;
  const nested = [...li.children].filter(c => c.tagName === 'UL' || c.tagName === 'OL');
  nested.forEach(n => n.remove());
  const p = document.createElement('p');
  p.innerHTML = li.textContent.replace(/\u200b/g, '').trim() || li.querySelector('img') ? li.innerHTML : '<br>';
  const rest = [];
  let n = li.nextElementSibling;
  while (n){ rest.push(n); n = n.nextElementSibling; }
  li.remove();
  let ref = L;
  const ins = el => { ref.parentNode.insertBefore(el, ref.nextSibling); ref = el; };
  ins(p);
  nested.forEach(ins);
  if (rest.length){
    const L2 = L.cloneNode(false); rest.forEach(x => L2.appendChild(x));
    if (L2.tagName === 'OL' && L.children.length) L2.setAttribute('data-cont', '');     // lo que queda debajo sigue la numeración de la parte de arriba
    ins(L2);
  }
  if (!L.children.length) L.remove();
  return p;
}
function unlistItem(li){
  let guard = 0;
  while (li.parentElement && li.parentElement.parentElement && li.parentElement.parentElement.tagName === 'LI' && guard++ < 12) outdent(li);
  return splitOut(li);
}
function toggleList(kind){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast('Pon el cursor en el texto');
  const r = s.getRangeAt(0);
  const startLi = closestFrom(r.startContainer, 'li'), endLi = closestFrom(r.endContainer, 'li');
  let lis;
  if (s.isCollapsed) lis = startLi ? [startLi] : [];
  else {
    lis = [...ed.querySelectorAll('li')].filter(li => r.intersectsNode(li));
    lis = lis.filter(li => !lis.some(o => o !== li && li.contains(o)) || li === startLi || li === endLi);
  }
  if (lis.length){
    if (lis.every(li => isKind(li, kind))){
      const made = [];
      [...lis].reverse().forEach(li => { if (li.isConnected) made.push(unlistItem(li)); });
      // los elementos que salen juntos quedan como líneas de un mismo párrafo
      const set = new Set(made);
      const ordered = made.filter(p => p.isConnected)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      let target = null;
      ordered.forEach(p => {
        const prev = p.previousElementSibling;
        if (prev && set.has(prev)){
          if (prev.innerHTML === '<br>') prev.innerHTML = ''; else prev.appendChild(document.createElement('br'));
          while (p.firstChild) prev.appendChild(p.firstChild);
          p.remove(); set.delete(p); target = prev;
        } else target = p;
      });
      if (target) caretInto(target, true);
      return;
    }
    const lists = [...new Set(lis.map(li => li.parentElement))];
    lists.forEach(list => {
      const nl = document.createElement(kind === 'ol' ? 'ol' : 'ul');
      if (kind === 'task') nl.setAttribute('data-task', '');
      while (list.firstChild) nl.appendChild(list.firstChild);
      [...nl.children].forEach(x => {
        if (kind === 'task') x.setAttribute('data-task', x.getAttribute('data-task') || '0');
        else x.removeAttribute('data-task');
      });
      list.replaceWith(nl);
      if (kind === 'ol' && nl.parentElement === ed) continueOl(nl);
    });
    caretInto(lis[lis.length - 1], true);
    return;
  }
  const blocks = (s.isCollapsed ? [currentBlock()] : [...ed.children].filter(b => r.intersectsNode(b)))
    .filter(b => b && /^(P|H[1-6]|BLOCKQUOTE)$/.test(b.tagName));
  if (!blocks.length) return toast('Ese bloque no puede convertirse en lista');
  const list = document.createElement(kind === 'ol' ? 'ol' : 'ul');
  if (kind === 'task') list.setAttribute('data-task', '');
  blocks.forEach(b => {
    // cada línea de un párrafo se convierte en un elemento
    const parts = b.innerHTML.split(/<br\s*\/?>/i).filter(h => h.replace(/<[^>]*>|&nbsp;|\u200b/g, '').trim());
    (parts.length ? parts : ['<br>']).forEach(h => {
      const li = document.createElement('li');
      if (kind === 'task') li.setAttribute('data-task', '0');
      li.innerHTML = h;
      list.appendChild(li);
    });
  });
  blocks[0].parentNode.insertBefore(list, blocks[0]);
  blocks.forEach(b => b.remove());
  if (kind === 'ol' && list.parentElement === ed) continueOl(list);
  caretInto(list.lastElementChild, true);
}

