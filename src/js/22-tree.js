"use strict";
/* ====== 6. Árbol ====== */
function walk(nodes, fn, parent){ nodes.forEach(n => { fn(n, parent); if (n.children) walk(n.children, fn, n); }); }
function findNode(id){ let r = null; walk(state.tree, n => { if (n.id === id) r = n; }); return r; }
function removeNode(id){
  let got = null;
  const rec = arr => { for (let i=0;i<arr.length;i++){ if (arr[i].id===id){ got = arr.splice(i,1)[0]; return true; } if (arr[i].children && rec(arr[i].children)) return true; } return false; };
  rec(state.tree); return got;
}
function isInside(node, id){ let r = false; if (node.children) walk(node.children, n => { if (n.id === id) r = true; }); return r; }
function firstDoc(){ let r = null; walk(state.tree, n => { if (!r && n.type === 'doc') r = n.id; }); return r; }
function pathOf(id){
  const parts = [];
  const rec = (arr, acc) => arr.some(n => {
    const p = acc.concat(n.name);
    if (n.id === id){ parts.push(...p); return true; }
    return n.children ? rec(n.children, p) : false;
  });
  rec(state.tree, []); return parts.join(' / ');
}
const ICON = {
  tw:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  ren:'<svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>',
  del:'<svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="3 6 21 6"></polyline><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path></svg>'
};
function renderTree(){
  const q = $('#search').value.trim().toLowerCase();
  treeEl.innerHTML = '';
  const build = (nodes, depth) => nodes.forEach(n => {
    const hit = !q || n.name.toLowerCase().includes(q) || (n.children && JSON.stringify(n.children).toLowerCase().includes(q));
    if (!hit) return;
    const row = document.createElement('div');
    row.className = 'row' + (n.type === 'folder' ? ' folder' : '') + (n.id === state.current ? ' sel' : '');
    row.style.paddingLeft = (7 + depth * 16) + 'px';
    row.draggable = true; row.dataset.id = n.id;
    row.innerHTML = '<span class="grip" aria-hidden="true">⋮⋮</span>' + (n.type === 'folder' ? '<span class="tw' + (n.open ? ' open':'') + '">' + ICON.tw + '</span>' : '<span style="width:12px;flex-shrink:0"></span>') +
      '<span class="nm"></span><span class="act"><button class="mini" data-act="ren" aria-label="Renombrar">'+ICON.ren+'</button><button class="mini" data-act="menu" aria-label="Más acciones" style="color:var(--ink-faint);font-size:13px">⋯</button></span>';
    row.querySelector('.nm').textContent = n.name;
    treeEl.appendChild(row);
    if (n.type === 'folder' && (n.open || q)) build(n.children || [], depth + 1);
  });
  build(state.tree, 0);
}
treeEl.addEventListener('click', e => {
  const row = e.target.closest('.row'); if (!row) return;
  const n = findNode(row.dataset.id); if (!n) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'ren') return renameNode(n);
  if (act === 'menu'){ e.stopPropagation(); const mb = e.target.closest('[data-act]').getBoundingClientRect(); return openCtxMenu(mb.left, mb.bottom + 4, n, row); }
  if (n.type === 'folder'){ n.open = !n.open; renderTree(); save(); }
  else { openDoc(n.id); if (innerWidth <= 900) document.body.classList.remove('side-open'); }
});
let dragId = null;
treeEl.addEventListener('dragstart', e => {
  const row = e.target.closest('.row'); if (!row) return;
  dragId = row.dataset.id; row.classList.add('drag');
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId);
});
const clearDz = () => { treeEl.classList.remove('dz-root'); treeEl.querySelectorAll('.dz-before,.dz-after,.dz-in').forEach(r => r.classList.remove('dz-before','dz-after','dz-in')); };
let dzOpenT = null, dzOpenId = null;
treeEl.addEventListener('dragend', () => { dragId = null; clearDz(); clearTimeout(dzOpenT); treeEl.querySelectorAll('.row').forEach(r => r.classList.remove('drag')); });
// cada fila se divide en zonas: arriba = antes, abajo = después, centro de una carpeta = dentro
function dropZone(row, e){
  const n = findNode(row.dataset.id), r = row.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
  if (n && n.type === 'folder') return y < .28 ? 'before' : y > .72 ? 'after' : 'in';
  return y < .5 ? 'before' : 'after';
}
treeEl.addEventListener('dragover', e => {
  if (!dragId) return;
  e.preventDefault();
  clearDz();
  const row = e.target.closest('.row');
  if (!row){ treeEl.classList.add('dz-root'); return; }
  const moving = findNode(dragId), target = findNode(row.dataset.id);
  if (!target || target.id === dragId || (moving && isInside(moving, target.id))) return;
  const z = dropZone(row, e);
  row.classList.add('dz-' + z);
  if (z === 'in' && !target.open){
    if (dzOpenId !== target.id){ clearTimeout(dzOpenT); dzOpenId = target.id;
      dzOpenT = setTimeout(() => { target.open = true; renderTree(); }, 700); }
  } else { clearTimeout(dzOpenT); dzOpenId = null; }
});
treeEl.addEventListener('dragleave', e => { if (!treeEl.contains(e.relatedTarget)) clearDz(); });
treeEl.addEventListener('drop', e => {
  e.preventDefault();
  clearTimeout(dzOpenT);
  const row = e.target.closest('.row');
  const z = row ? dropZone(row, e) : 'root';
  clearDz();
  if (!dragId) return;
  const moving = findNode(dragId), target = row ? findNode(row.dataset.id) : null;
  if (!moving || (target && (target.id === dragId || isInside(moving, target.id)))) return;
  removeNode(dragId);
  placeNode(moving, target, z);
  renderTree(); save(true);
});
$('#search').addEventListener('input', renderTree);
$('#newDoc').onclick = () => newIn(null, false);
$('#newFolder').onclick = () => newIn(null, true);

