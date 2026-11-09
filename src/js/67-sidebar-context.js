"use strict";
/* ====== 55. Menú contextual del panel lateral (clic derecho) ====== */
const ctxMenu = $('#ctxMenu');
let ctxTarget = null, ctxRowEl = null;
function ctxItems(n){
  if (!n) return [['newdoc', 'Nuevo documento'], ['newfolder', 'Nueva carpeta']];
  const head = n.type === 'folder'
    ? [['newdoc', 'Nuevo documento aquí'], ['newfolder', 'Nueva carpeta aquí']]
    : [['open', 'Abrir'], ['side', 'Abrir al lado'], ['newdoc', 'Nuevo documento al lado'], ['newfolder', 'Nueva carpeta al lado']];
  return [...head, '-', ['ren', 'Renombrar'], ['dup', 'Duplicar'], ['move', 'Mover a…'], ['up', 'Subir'], ['down', 'Bajar'], '-', ['del', 'Mover a la papelera', true]];
}
function closeCtx(){ ctxMenu.classList.remove('show'); }
function openCtxMenu(x, y, n, row){
  document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
  ctxTarget = n || null;
  ctxMenu.innerHTML = ctxItems(n).map(it => it === '-' ? '<div class="hr"></div>' : '<button data-r="' + it[0] + '"' + (it[2] ? ' style="color:var(--danger)"' : '') + '>' + it[1] + '</button>').join('');
  ctxMenu.classList.add('show');
  if (row){ ctxRowEl = row; row.classList.add('ctx'); }
  const w = ctxMenu.offsetWidth, h = ctxMenu.offsetHeight;
  ctxMenu.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
  ctxMenu.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
}
new MutationObserver(() => { if (!ctxMenu.classList.contains('show') && ctxRowEl){ ctxRowEl.classList.remove('ctx'); ctxRowEl = null; } })
  .observe(ctxMenu, { attributes: true, attributeFilter: ['class'] });
// nuevo documento o carpeta en el sitio donde se pulsó: dentro de una carpeta, junto a un documento o en la raíz
function newIn(n, asFolder){
  const isFolder = !!n && n.type === 'folder';
  askName(asFolder ? 'Nueva carpeta' : 'Nuevo documento', asFolder ? 'Carpeta' : 'Sin título', v => {
    const node = asFolder ? { id: uid(), type: 'folder', name: v, open: true, children: [] } : { id: uid(), type: 'doc', name: v, mod: Date.now() };
    if (!n){ state.tree.unshift(node); treeEl.scrollTop = 0; }          // en la raíz y arriba del todo
    else if (isFolder){ (n.children = n.children || []).push(node); n.open = true; }
    else placeNode(node, n, 'after');
    if (!asFolder) state.docs[node.id] = '<h1>' + esc(v) + '</h1><p><br></p>';
    renderTree();
    if (!asFolder){ openDoc(node.id); if (innerWidth <= 900) document.body.classList.remove('side-open'); }
    save(true);
  });
}
function rowAction(act, n){
  if (act === 'newdoc') return newIn(n, false);
  if (act === 'newfolder') return newIn(n, true);
  if (!n) return;
  if (act === 'open'){ openDoc(n.id); if (innerWidth <= 900) document.body.classList.remove('side-open'); return; }
  if (act === 'side'){
    if (!split) return enableSplit(n.id, true);
    activate(1); openDoc(n.id); paintPaneNames(); return;
  }
  if (act === 'ren') return renameNode(n);
  if (act === 'dup'){
    const c = cloneTree(n); c.name = n.name + ' (copia)';
    placeNode(c, n, 'after'); renderTree(); save(true); toast('Duplicado'); return;
  }
  if (act === 'up' || act === 'down'){
    const s = siblingsOf(n.id); if (!s) return;
    const j = s.i + (act === 'up' ? -1 : 1);
    if (j < 0 || j >= s.arr.length) return toast(act === 'up' ? 'Ya está arriba del todo' : 'Ya está abajo del todo');
    [s.arr[s.i], s.arr[j]] = [s.arr[j], s.arr[s.i]];
    renderTree(); save(true); return;
  }
  if (act === 'move') return moveToDialog(n);
  if (act === 'del') return moveToTrash(n);
}
$('#side').addEventListener('contextmenu', e => {
  if (e.target.closest('input,textarea')) return;                      // en el buscador se conserva el menú normal (copiar, pegar)
  const row = e.target.closest('.row');
  if (!row && e.target.closest('button')) return;
  e.preventDefault();
  const n = row ? findNode(row.dataset.id) : null;
  if (row && !n) return;
  openCtxMenu(e.clientX, e.clientY, n, row);
});
ctxMenu.addEventListener('contextmenu', e => e.preventDefault());
ctxMenu.addEventListener('click', e => {
  e.stopPropagation();
  const b = e.target.closest('[data-r]'); if (!b) return;
  const n = ctxTarget; closeCtx(); stash();
  rowAction(b.dataset.r, n);
});
addEventListener('keydown', e => { if (e.key === 'Escape' && ctxMenu.classList.contains('show')){ e.stopPropagation(); closeCtx(); } }, true);
addEventListener('blur', closeCtx); addEventListener('resize', closeCtx);

/* ====== 56. Cambiar un punto de lista entre viñeta y numerada ====== */
// «* » en un punto de una lista numerada lo convierte en viñeta; «1. » en un punto de viñetas, en numerado.
// Solo cambia ese punto: la lista se parte en dos y lo de debajo sigue la numeración de la parte de arriba.
function convertListItem(li, kind, num, rest){
  const list = li.parentElement;
  const items = [...list.children].filter(x => x.tagName === 'LI');
  const idx = items.indexOf(li);
  const before = items.slice(0, idx), after_ = items.slice(idx + 1);
  const nl = document.createElement(kind);
  const nli = document.createElement('li');
  nli.innerHTML = rest || '<br>';
  nl.appendChild(nli);
  li.remove();                                                    // el punto original se sustituye por el nuevo
  let tailList = null;
  if (after_.length){
    tailList = list.cloneNode(false);
    after_.forEach(x => tailList.appendChild(x));
    if (tailList.tagName === 'OL' && before.length) tailList.setAttribute('data-cont', '');
  }
  list.after(nl);
  if (tailList) nl.after(tailList);
  if (!before.length) list.remove();
  if (kind === 'ol'){
    if (num !== 1) nl.setAttribute('start', num);
    const prev = nl.parentElement === ed ? prevOlInScope(nl) : null;
    if (prev && num !== 1 && num === olLast(prev) + 1) nl.setAttribute('data-cont', '');
  }
  caretInto(nli, false);
}

