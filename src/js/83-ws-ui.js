"use strict";
/* ====== 77. Carpeta de trabajo: pantallas y arranque ====== */
// Hay tres formas de empezar, y AtelierRoot elige solo la que pueda:
//   1. Servidor local de AtelierRoot (la página trae un token): se abre su carpeta, sin preguntar nada.
//   2. Carpeta recordada del navegador (Chrome/Edge): se vuelve a pedir permiso con un clic.
//   3. Modo temporal: los documentos viven solo en este navegador (IndexedDB), como antes, hasta que se abra una carpeta.
const wsServerToken = () => { const m = document.querySelector('meta[name="atelierroot-token"]'); return m ? m.content : ''; };
// apps built on Electron (VS Code's integrated browser) expose the picker but never grant folder access
const wsEmbedded = () => !wsTauri() && /\bElectron\//.test(navigator.userAgent);
const wsCanPick = () => !!wsTauri() || (typeof window.showDirectoryPicker === 'function' && !wsEmbedded());

function wsInitUi(){                                        // lo mismo que hace loadStore() con las preferencias de pantalla
  Ui.read();
  state.theme = Ui.data.theme || 'dark'; state.preview = !!Ui.data.preview; state.outline = !!Ui.data.outline; state.breaks = !!Ui.data.breaks;
  state.current = null; state.split = Ui.data.split || null;
}
function wsGoLive(){
  Workspace.active = true; Sync.ready = false;               // con carpeta abierta, la base de datos del navegador deja de guardar
  document.body.classList.add('ws-on');
}
async function wsBoot(){
  const W = Workspace; Ui.read();
  if (wsTauri()){                                            // desktop app: the folder chosen last time, if it still exists
    try { const f = await wsTauri().invoke('ws_root'); if (f){ const be = new TauriBackend(f.name); wsInitUi(); await wsLoad(be); wsGoLive(); return true; } }
    catch(e){ console.error(e); setTimeout(() => toast('No se pudo abrir la carpeta: ' + (e.message || e)), 600); }
    return false;
  }
  const tk = wsServerToken();
  if (tk){
    try { const be = await new HttpBackend(tk).init(); wsInitUi(); await wsLoad(be); wsGoLive(); return true; }
    catch(e){ console.error(e); setTimeout(() => toast('No se pudo abrir la carpeta del servidor: ' + e.message), 600); }
  }
  if (wsCanPick()){
    try {
      const h = await WsHandles.get('last');
      if (h){
        if (await wsPermission(h, false)){ const be = new FsBackend(h); wsInitUi(); await wsLoad(be); wsGoLive(); return true; }
        W.remembered = h;                                      // hay carpeta recordada, pero hace falta un clic para que el navegador vuelva a dar permiso
      }
    } catch(e){ console.warn('carpeta recordada:', e); }
  }
  return false;
}

/* ---- abrir una carpeta ---- */
function wsTempTree(){                                      // lo que hay ahora en modo temporal (para ofrecer copiarlo a la carpeta)
  let real = 0;
  const clone = nodes => nodes.map(n => {
    const c = { id: uid(), type: n.type, name: n.name, mod: n.mod };
    if (n.type === 'folder'){ c.children = clone(n.children || []); }
    else { c.html = state.docs[n.id]; if (c.html !== undefined && c.html !== SEED_HTML && wsMdText(c.html).trim()) real++; }
    return c;
  });
  const tree = clone(state.tree); return real ? tree : null;
}
function wsImportTemp(tree){
  const build = nodes => nodes.map(c => { const n = { id: c.id, type: c.type, name: c.name, mod: c.mod || Date.now() }; if (c.type === 'folder'){ n.open = false; n.children = build(c.children); } else state.docs[n.id] = c.html !== undefined ? c.html : '<p><br></p>'; return n; });
  state.tree.push({ id: uid(), type: 'folder', name: 'Del modo temporal', open: true, children: build(tree) });
  renderTree(); save(true); toast('Copiado a la carpeta «Del modo temporal»');
}
async function wsOpenFlow(be){
  const W = Workspace; let temp = null;
  if (W.active){ stash(); wsStopWatching(); await wsSchedule(true); }
  else {
    stash(); temp = wsTempTree();
    if (Sync.ready){ clearTimeout(persistT); Sync.q = Sync.q.then(doPersist); try { await Sync.q; } catch(_){} }   // lo último escrito en modo temporal queda guardado en el navegador
  }
  await wsLoad(be);
  wsGoLive(); wsRecover(); renderTree(); updateTrashN(); updateBackupNote();
  openDoc(W.startId); wsStartWatching(); wsStatus('ok'); wsSchedule(true);
  toast('Carpeta «' + W.name + '» abierta');
  if (temp) setTimeout(() => confirmBox('¿Copiar tus documentos temporales?', 'Tenías documentos en el modo temporal de este navegador. ¿Los copio a la carpeta como archivos .md (en «Del modo temporal»)? Los originales siguen en el navegador.', () => wsImportTemp(temp)), 400);
}
// why folders cannot be opened here; Brave ships the File System Access API turned off behind a flag
function wsNoPickerText(){
  if (wsEmbedded()) return 'El navegador integrado de VS Code (y otras apps basadas en Electron) no permite abrir carpetas. Abre este archivo en Chrome, Edge o Brave, o usa la app de escritorio AtelierRoot.exe.';
  if (navigator.brave) return 'Brave trae desactivado el acceso a carpetas. Para activarlo abre brave://flags/#file-system-access-api, elige «Enabled» y reinicia Brave. También puedes usar Chrome, Edge o la app de escritorio AtelierRoot.exe.';
  return 'Este navegador no puede abrir carpetas. Usa Chrome, Edge o la app de escritorio AtelierRoot.exe.';
}
async function wsPickFolder(){
  if (!wsCanPick()){ toast(wsNoPickerText()); return; }
  if (wsTauri()){
    let f; try { f = await wsTauri().invoke('ws_pick'); } catch(e){ toast('No se pudo abrir la carpeta: ' + (e.message || e)); return; }
    if (!f) return;                                            // cancelling the dialog is not an error
    Ui.read(); Ui.data.noWelcome = false; Ui.write();
    try { await wsOpenFlow(new TauriBackend(f.name)); } catch(e){ console.error(e); toast('No se pudo abrir la carpeta: ' + (e.message || e)); }
    return;
  }
  let h;
  try { h = await window.showDirectoryPicker({ id: 'atelierroot', mode: 'readwrite' }); }
  catch(e){                                                     // cancelling is silent; anything else is the browser refusing
    if (e && e.name === 'AbortError') return;
    toast('El navegador no dejó abrir la carpeta (' + ((e && e.name) || e) + '). Prueba en Chrome, Edge o Brave, o usa AtelierRoot.exe.');
    return;
  }
  if (!(await wsPermission(h, true))){ toast('Sin permiso para escribir en esa carpeta'); return; }
  try { await WsHandles.put('last', h); } catch(_){}
  Ui.read(); Ui.data.noWelcome = false; Ui.write();
  try { await wsOpenFlow(new FsBackend(h)); } catch(e){ console.error(e); toast('No se pudo abrir la carpeta: ' + (e.message || e)); }
}
async function wsContinueRemembered(){
  const h = Workspace.remembered; if (!h) return wsPickFolder();
  if (!(await wsPermission(h, true))){ toast('Sin permiso para esa carpeta'); return; }
  try { await wsOpenFlow(new FsBackend(h)); } catch(e){ console.error(e); toast('No se pudo abrir la carpeta: ' + (e.message || e)); }
}
function wsReloadFromDisk(){ const W = Workspace; if (!W.active) return; W.q = W.q.then(() => wsRefreshOnce()).then(() => toast('Recargado desde el disco')).catch(wsFail); }
async function wsLeaveFolder(){                             // vuelve al modo temporal
  const W = Workspace; if (!W.active) return;
  stash(); await wsSchedule(true);
  if (wsTauri()) { try { await wsTauri().invoke('ws_clear'); } catch(_){} }
  else { try { await WsHandles.del('last'); } catch(_){} }
  Ui.read(); Ui.data.noWelcome = true; Ui.write(); location.reload();
}

/* ---- pantallas ---- */
function openWsWelcome(){
  const W = Workspace, h = W.remembered;
  card.innerHTML = '<h2>Tus documentos, en una carpeta de tu computadora</h2>' +
    '<p>AtelierRoot guarda cada documento como un archivo <b>.md</b> en la carpeta que elijas y recarga los cambios que hagas desde otros programas (VS Code, git…).</p>' +
    '<div class="btns" style="flex-direction:column;align-items:stretch;gap:8px" id="wsOpts"></div>';
  const opts = card.querySelector('#wsOpts'), add = (label, fn, primary) => { const b = document.createElement('button'); b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = label; b.onclick = () => { veil.classList.remove('show'); fn(); }; opts.appendChild(b); };
  if (h) add('Continuar con «' + h.name + '»', wsContinueRemembered, true);
  if (wsCanPick()) add(h ? 'Abrir otra carpeta…' : 'Abrir una carpeta…', wsPickFolder, !h);
  else { const p = document.createElement('p'); p.style.cssText = 'font-size:12px;color:var(--ink-faint);margin:0'; p.textContent = wsNoPickerText(); opts.appendChild(p); }
  add('Seguir sin carpeta (modo temporal)', () => { Ui.read(); Ui.data.noWelcome = true; Ui.write(); toast('Modo temporal: tus documentos solo están en este navegador'); });
  const small = document.createElement('p'); small.style.cssText = 'font-size:11px;color:var(--ink-faint);margin:10px 0 0'; small.textContent = 'En modo temporal los documentos viven solo en este navegador, así que conviene exportar un respaldo de vez en cuando.'; card.appendChild(small);
  veil.classList.add('show');
}
function openWsDialog(){
  const W = Workspace; if (!W.active) return openWsWelcome();
  let docs = 0; walk(state.tree, n => { if (n.type === 'doc') docs++; });
  const server = W.kind === 'http', denied = W.status === 'denied';
  card.innerHTML = '<h2>📁 <span id="wsN"></span></h2><p>Cada documento es un archivo <b>.md</b> dentro de esta carpeta, y se guarda solo. Lo que Markdown no puede guardar (orden, anchos de columna, valores de marcadores, papelera) va en <b>.atelierroot/</b>.</p>' +
    '<p style="font-size:12px;color:var(--ink-dim);margin:0 0 4px" id="wsInfo"></p><p style="font-size:12px;margin:0 0 10px" id="wsMsg"></p><div class="btns" style="flex-wrap:wrap" id="wsBtns"></div>';
  card.querySelector('#wsN').textContent = W.name;
  card.querySelector('#wsInfo').textContent = docs + (docs === 1 ? ' documento' : ' documentos') + ' · ' + (server ? 'servidor local de AtelierRoot' : W.kind === 'tauri' ? 'app de escritorio' : 'carpeta del navegador') + (W.lastOk ? ' · último guardado ' + new Date(W.lastOk).toLocaleTimeString() : '');
  card.querySelector('#wsMsg').textContent = W.status === 'ok' ? '✓ Todo guardado.' : (W.msg || WS_LABEL[W.status] || '');
  const btns = card.querySelector('#wsBtns'), add = (label, fn, primary) => { const b = document.createElement('button'); b.className = 'btn' + (primary ? ' primary' : ''); b.textContent = label; b.onclick = fn; btns.appendChild(b); };
  if (denied) add('Volver a dar permiso', async () => { if (await wsPermission(W.be.root, true)){ veil.classList.remove('show'); wsSchedule(true); toast('Permiso recuperado'); } else toast('Sin permiso'); }, true);
  add('Guardar ahora', () => { veil.classList.remove('show'); wsSaveNow().then(() => toast(W.status === 'ok' ? 'Guardado' : 'No se pudo guardar')); }, !denied);
  add('Recargar desde el disco', () => { veil.classList.remove('show'); wsReloadFromDisk(); });
  if (!server && wsCanPick()){ add('Cambiar de carpeta…', () => { veil.classList.remove('show'); wsPickFolder(); }); add('Cerrar la carpeta', () => { veil.classList.remove('show'); wsLeaveFolder(); }); }
  add('Cerrar', () => veil.classList.remove('show'));
  veil.classList.add('show');
}
function wsChipClick(){ if (Workspace.active) openWsDialog(); else openWsWelcome(); }
document.querySelectorAll('.ws-chip').forEach(el => { el.onclick = wsChipClick; });
function wsWelcomeIfNeeded(){
  if (/[?&]test=1\b/.test(location.search)) return;           // ?test=1 (pruebas automáticas): sin pantalla de bienvenida, que se interpondría
  Ui.read(); if (!Ui.data.noWelcome && !Workspace.active) setTimeout(openWsWelcome, 500); }

COMMANDS.push(
  { g:'Carpeta', t:'Carpeta: ver opciones', run: () => wsChipClick() },
  { g:'Carpeta', t:'Carpeta: abrir una carpeta…', when: () => !wsServerToken(), run: () => wsPickFolder() },
  { g:'Carpeta', t:'Carpeta: guardar ahora', when: () => Workspace.active, run: () => wsSchedule(true).then(() => toast('Guardado')) },
  { g:'Carpeta', t:'Carpeta: recargar desde el disco', when: () => Workspace.active, run: () => wsReloadFromDisk() },
);
