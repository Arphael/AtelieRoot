"use strict";
/* ====== 36. Enlaces entre documentos [[nombre]] ====== */
const WL_RE = /\[\[([^\[\]\n]+?)\]\]/g;
function docByName(name){
  const t = norm(name.trim());
  let r = null;
  walk(state.tree, n => { if (!r && n.type === 'doc' && norm(n.name.trim()) === t) r = n; });
  return r;
}
function paintLinks(){
  if (!(window.CSS && CSS.highlights && window.Highlight)) return;
  const ok = [], bad = [];
  textNodes().forEach(n => {
    if (n.parentElement.closest('.cb')) return;
    const re = new RegExp(WL_RE.source, 'g');
    let m;
    while ((m = re.exec(n.nodeValue))){
      const r = document.createRange();
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      (docByName(m[1]) ? ok : bad).push(r);
    }
  });
  CSS.highlights.set('wl', new Highlight(...ok));
  CSS.highlights.set('wlx', new Highlight(...bad));
}
function linkAt(x, y){
  const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
  if (!r || r.startContainer.nodeType !== 3 || !ed.contains(r.startContainer)) return null;
  const t = r.startContainer.nodeValue, o = r.startOffset;
  const re = new RegExp(WL_RE.source, 'g');
  let m;
  while ((m = re.exec(t))) if (o >= m.index && o <= m.index + m[0].length) return m[1].trim();
  return null;
}
function followLink(name){
  const d = docByName(name);
  if (d){ openDoc(d.id); return; }
  confirmBox('Crear «' + name + '»', 'Todavía no existe un documento con ese nombre. Se creará en la carpeta actual.', () => {
    const nd = { id: uid(), type: 'doc', name };
    let host = state.tree;
    walk(state.tree, (n, p) => { if (n.id === state.current && p) host = p.children; });
    stash(); host.push(nd);
    state.docs[nd.id] = '<h1>' + esc(name) + '</h1><p><br></p>';
    renderTree(); openDoc(nd.id); save(true);
  });
}
ed.addEventListener('mousedown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const name = linkAt(e.clientX, e.clientY);
  if (name){ e.preventDefault(); e.stopPropagation(); followLink(name); }
}, true);
ed.addEventListener('mousemove', e => {
  ed.style.cursor = (e.ctrlKey || e.metaKey) && linkAt(e.clientX, e.clientY) ? 'pointer' : '';
});
// autocompletado al escribir [[
const wlMenu = $('#wlMenu');
const wl = { open: false, items: [], i: 0, q: '' };
function wlContext(){
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed) return null;
  const n = s.anchorNode;
  if (!n || n.nodeType !== 3 || closestFrom(n, '.cb')) return null;
  const before = n.nodeValue.slice(0, s.anchorOffset);
  const m = before.match(/\[\[([^\[\]\n]{0,40})$/);
  return m ? { node: n, start: s.anchorOffset - m[1].length, q: m[1] } : null;
}
function closeWl(){ wl.open = false; wlMenu.classList.remove('show'); }
function paintWl(){
  const c = wlContext();
  if (!c) return closeWl();
  wl.q = c.q;
  const all = [];
  walk(state.tree, n => { if (n.type === 'doc' && n.id !== state.current) all.push(n); });
  const t = norm(c.q);
  wl.items = all.filter(n => !t || norm(n.name).includes(t)).slice(0, 8).map(n => ({ name: n.name, path: pathOf(n.id) }));
  if (c.q.trim() && !docByName(c.q)) wl.items.push({ name: c.q.trim(), create: true });
  if (!wl.items.length) return closeWl();
  wl.i = Math.min(wl.i, wl.items.length - 1);
  wlMenu.innerHTML = '<div class="hint">Enlazar a documento</div>';
  wl.items.forEach((it, i) => {
    const b = document.createElement('button');
    b.textContent = it.create ? 'Crear «' + it.name + '»' : it.name;
    if (i === wl.i) b.className = 'on';
    b.onmousedown = ev => { ev.preventDefault(); wl.i = i; applyWl(); };
    wlMenu.appendChild(b);
  });
  wl.open = true;
  const s = getSelection(), rc = s.getRangeAt(0).getBoundingClientRect();
  wlMenu.classList.add('show');
  wlMenu.style.left = Math.max(8, Math.min(innerWidth - wlMenu.offsetWidth - 8, rc.left)) + 'px';
  const h = wlMenu.offsetHeight;
  wlMenu.style.top = (rc.bottom + 6 + h > innerHeight ? Math.max(8, rc.top - h - 6) : rc.bottom + 6) + 'px';
}
function applyWl(){
  const c = wlContext(), it = wl.items[wl.i];
  closeWl();
  if (!c || !it) return;
  History.mark();
  const n = c.node, s = getSelection();
  const endQ = s.anchorOffset;
  const hasClose = n.nodeValue.slice(endQ, endQ + 2) === ']]';
  const text = n.nodeValue;
  n.nodeValue = text.slice(0, c.start) + it.name + (hasClose ? '' : ']]') + text.slice(endQ);
  const pos = c.start + it.name.length + 2;
  const r = document.createRange(); r.setStart(n, Math.min(pos, n.nodeValue.length)); r.collapse(true);
  s.removeAllRanges(); s.addRange(r);
  after(); History.snap(true);
}
ed.addEventListener('input', () => { if (wl.open || wlContext()) { wl.i = 0; paintWl(); } });
ed.addEventListener('keydown', e => {
  if (!wl.open || !wlMenu.classList.contains('show')) return;
  if (e.key === 'ArrowDown'){ e.preventDefault(); e.stopImmediatePropagation(); wl.i = (wl.i + 1) % wl.items.length; paintWl(); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); e.stopImmediatePropagation(); wl.i = (wl.i - 1 + wl.items.length) % wl.items.length; paintWl(); }
  else if (e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); e.stopImmediatePropagation(); applyWl(); }
  else if (e.key === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); closeWl(); }
}, true);
document.addEventListener('mousedown', e => { if (wl.open && !e.target.closest('#wlMenu')) closeWl(); });
function paintBacklinks(){
  const list = $('#blList');
  const me = findNode(state.current);
  list.innerHTML = '';
  if (!me) return;
  const key = norm('[[' + esc(me.name.trim()) + ']]');
  const hits = [];
  walk(state.tree, n => {
    if (n.type !== 'doc' || n.id === me.id) return;
    if (norm(state.docs[n.id] || '').includes(key)) hits.push(n);
  });
  if (!hits.length){ list.innerHTML = '<div class="ol-empty">Ningún documento enlaza aquí. Escribe [[' + esc(me.name) + ']] en otro para enlazarlo.</div>'; return; }
  hits.forEach(n => {
    const b = document.createElement('button');
    b.className = 'ol-item';
    b.textContent = n.name;
    b.title = pathOf(n.id);
    b.onclick = () => openDoc(n.id);
    list.appendChild(b);
  });
}

