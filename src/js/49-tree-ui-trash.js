"use strict";
// Días que la papelera guarda lo eliminado antes de borrarlo solo (0 = nunca). Se puede cambiar con Ui.data.plan.trashDays.
const trashDaysPlan = () => (Ui.data && Ui.data.plan && Ui.data.plan.trashDays !== undefined) ? Ui.data.plan.trashDays : 30;
/* ====== 34. Árbol: colocar, menú de fila, duplicar, mover a ====== */
let rowTarget = null;
function placeNode(moving, target, where){
  if (!target || where === 'root'){ state.tree.push(moving); return; }
  if (where === 'in'){ target.children = target.children || []; target.open = true; target.children.push(moving); return; }
  const rec = arr => {
    const i = arr.findIndex(x => x.id === target.id);
    if (i >= 0){ arr.splice(where === 'before' ? i : i + 1, 0, moving); return true; }
    return arr.some(x => x.children && rec(x.children));
  };
  if (!rec(state.tree)) state.tree.push(moving);
}
function siblingsOf(id){
  let res = null;
  const rec = arr => arr.some((x, i) => { if (x.id === id){ res = { arr, i }; return true; } return x.children && rec(x.children); });
  rec(state.tree); return res;
}
function renameNode(n){
  askName('Renombrar', n.name, v => {
    const old = n.name;
    n.name = v;
    if (n.type === 'doc' && old !== v){
      // los enlaces [[antiguo]] de todos los documentos pasan al nombre nuevo
      stash();
      const from = '[[' + esc(old) + ']]', to = '[[' + esc(v) + ']]';
      let count = 0;
      Object.keys(state.docs).forEach(id => {
        const h = state.docs[id];
        if (h.includes(from)){ count += h.split(from).length - 1; state.docs[id] = h.split(from).join(to); }
      });
      if (count){ ed.innerHTML = state.docs[state.current]; ensureBlocks(); History.init(); toast(count + (count === 1 ? ' enlace actualizado' : ' enlaces actualizados')); }
    }
    renderTree(); save(true); setPath(); sideRefresh();
  });
}
function cloneTree(n){
  const c = Object.assign({}, n, { id: uid() });
  if (n.type === 'doc') state.docs[c.id] = state.docs[n.id] || '<p><br></p>';
  if (n.children) c.children = n.children.map(cloneTree);
  return c;
}
function moveToDialog(n){
  const folders = [{ id: null, label: 'Raíz' }];
  walk(state.tree, f => {
    if (f.type !== 'folder' || f.id === n.id || isInside(n, f.id)) return;
    folders.push({ id: f.id, label: pathOf(f.id) });
  });
  card.innerHTML = '<h2></h2><div class="pick-list"></div><div class="btns"><button class="btn" data-no>Cancelar</button></div>';
  card.querySelector('h2').textContent = 'Mover «' + n.name + '» a…';
  const list = card.querySelector('.pick-list');
  folders.forEach(f => {
    const b = document.createElement('button');
    b.textContent = f.label;
    b.onclick = () => {
      veil.classList.remove('show');
      const moving = removeNode(n.id);
      placeNode(moving, f.id ? findNode(f.id) : null, f.id ? 'in' : 'root');
      renderTree(); save(true); toast('Movido a ' + f.label);
    };
    list.appendChild(b);
  });
  card.querySelector('[data-no]').onclick = () => veil.classList.remove('show');
  veil.classList.add('show');
}

/* ====== 35. Papelera ====== */
function updateTrashN(){ const n = (state.trash || []).length; $('#trashN').textContent = n ? String(n) : ''; }
function moveToTrash(n){
  stash();
  let parentId = null;
  walk(state.tree, (x, p) => { if (x.id === n.id && p) parentId = p.id; });
  const gone = removeNode(n.id);
  if (!gone) return;
  const docIds = [];
  walk([gone], x => { if (x.type === 'doc') docIds.push(x.id); });
  state.trash = state.trash || [];
  state.trash.unshift({ id: uid(), node: gone, docIds, parentId, at: Date.now() });
  if (!findNode(state.current)){ const f = firstDoc(); if (f) openDoc(f); else { state.current = null; ed.innerHTML = '<p><br></p>'; } }
  splitCheck();
  renderTree(); updateTrashN(); save(true);
  toast('«' + gone.name + '» está en la papelera');
}
function restoreTrash(t){
  const parent = t.parentId ? findNode(t.parentId) : null;
  placeNode(t.node, parent, parent ? 'in' : 'root');
  state.trash = state.trash.filter(x => x !== t);
  renderTree(); updateTrashN(); save(true);
  toast('Restaurado' + (t.parentId && !parent ? ' en la raíz' : ''));
}
function openTrash(){
  const list = state.trash || [];
  card.innerHTML = '<h2>Papelera</h2><p>' + (trashDaysPlan() ? 'Lo eliminado se guarda ' + trashDaysPlan() + ' días y después se borra solo.' : 'Lo eliminado se queda aquí hasta que lo borres.') + '</p><div class="trash-list"></div><div class="btns"><button class="btn" data-empty style="color:var(--danger)">Vaciar papelera</button><button class="btn primary" data-no>Cerrar</button></div>';
  const host = card.querySelector('.trash-list');
  if (!list.length) host.innerHTML = '<div class="ol-empty">La papelera está vacía.</div>';
  list.forEach(t => {
    const row = document.createElement('div');
    row.className = 'trash-row';
    const days = Math.max(0, (trashDaysPlan() || 30) - Math.floor((Date.now() - t.at) / 86400000));
    row.innerHTML = '<div class="t-n"><b></b><span></span></div><button class="btn" data-a="r">Restaurar</button><button class="btn" data-a="x" style="color:var(--danger)">Borrar</button>';
    row.querySelector('b').textContent = (t.node.type === 'folder' ? '📁 ' : '') + t.node.name;
    row.querySelector('span').textContent = trashDaysPlan() ? 'Se borra en ' + days + (days === 1 ? ' día' : ' días') : 'Se queda hasta que lo borres';
    row.querySelector('[data-a="r"]').onclick = () => { restoreTrash(t); openTrash(); };
    row.querySelector('[data-a="x"]').onclick = () => { purgeDocs(t.docIds); state.trash = state.trash.filter(x => x !== t); updateTrashN(); save(true); openTrash(); };
    host.appendChild(row);
  });
  card.querySelector('[data-no]').onclick = () => veil.classList.remove('show');
  card.querySelector('[data-empty]').onclick = () => {
    if (!list.length) return;
    confirmBox('Vaciar la papelera', 'Se borrarán para siempre ' + list.length + (list.length === 1 ? ' elemento.' : ' elementos.'), () => {
      list.forEach(t => purgeDocs(t.docIds)); state.trash = []; updateTrashN(); save(true); toast('Papelera vaciada');
    });
  };
  veil.classList.add('show');
}
$('#trashBtn').onclick = openTrash;

