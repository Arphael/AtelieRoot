"use strict";
/* ====== 89. Varias carpetas: reglas del árbol ====== */
// With several folders open, the top of the tree is the folders themselves: they cannot be renamed, moved inside
// something or sent to the trash (their menu offers «Remove from the workspace»), and everything else lives inside
// one of them. Folders cannot move from one open folder to another (documents can).
const wsMulti = () => !!(Workspace.active && Workspace.be && Workspace.be.multi);
const wsLabelOf = n => n && n.path ? n.path.split('/')[0] : null;
/** Where moving lands, fixed for several folders; null (with a message) when it is not allowed. */
function wsPlaceFix(moving, target, where){
  if (!wsMulti()) return { target, where };
  const roots = state.tree, isRoot = roots.includes(moving) || (moving.path && !moving.path.includes('/') && Workspace.be.partOf(moving.path) >= 0);
  if (isRoot){
    if (target && roots.includes(target) && where !== 'in') return { target, where };
    toast(T('msg.root-stays')); return null;
  }
  if (!target || where === 'root') return { target: roots.find(r => r.path === wsLabelOf(moving)) || roots[0], where: 'in' };
  if (roots.includes(target) && where !== 'in') where = 'in';
  const dest = roots.includes(target) ? target : wsRootOf(target);
  if (moving.type === 'folder' && moving.path && dest && dest.path !== wsLabelOf(moving)){ toast(T('msg.folder-between')); return null; }
  return { target, where };
}
const wsPlaceCheck = (moving, target, where) => !!wsPlaceFix(moving, target, where);
const multiPlace = placeNode;
placeNode = (moving, target, where) => { const f = wsPlaceFix(moving, target, where); if (f) return multiPlace(moving, f.target, f.where); return multiPlace(moving, target, where); };
const multiNewIn = newIn;
newIn = (n, asFolder) => multiNewIn(!n && wsMulti() ? state.tree[0] : n, asFolder);
const multiCtxItems = ctxItems;
ctxItems = n => {
  if (!wsIsRootNode(n)) return multiCtxItems(n);
  const W = Workspace, items = [['newdoc', T('ctx.newdoc-here')], ['newfolder', T('ctx.newfolder-here')], '-'];
  if (W.be.reveal) items.push(['reveal', T('ctx.reveal')]);
  if (W.be.absPath) items.push(['copypath', T('ctx.copy-path')]);
  items.push('-', ['addroot', T('wsd.add')], ['droproot', T('ctx.remove-folder'), true]);
  return items;
};
const multiRowAction = rowAction;
rowAction = (act, n) => {
  if (act === 'addroot') return wsAddFolder();
  if (act === 'droproot') return wsDropRoot(n);
  if (wsIsRootNode(n) && /^(ren|dup|move|del)$/.test(act)) return toast(T('msg.root-stays'));
  return multiRowAction(act, n);
};
