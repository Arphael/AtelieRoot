"use strict";
/* ====== 19. Arranque ====== */
// Contenido del documento de bienvenida (solo en el modo temporal, cuando no hay carpeta abierta)
const SEED_HTML = '<h1>Bienvenida</h1><p>Escribe aquí. Los atajos funcionan al escribir: <span data-code="">##</span> y espacio para un encabezado, <span data-code="">-</span> y espacio para una viñeta, <span data-code="">[ ]</span> y espacio para una tarea.</p>';
(async function load(){
  let inWs = false;                                                 // ¿se abrió una carpeta de trabajo? (servidor local o carpeta recordada)
  try { inWs = await wsBoot(); } catch(e){ console.error(e); }
  let storageOk = true;
  if (!inWs){
    try { await loadStore(); }
    catch(e){ console.error(e); storageOk = false; toast('No se pudo leer el almacenamiento: los cambios no se guardarán'); }
  }
  state.fills = state.fills || {};
  if (!inWs && !state.tree.length){
    const d = { id: uid(), type:'doc', name:'Bienvenida', mod: Date.now() };
    state.tree = [{ id: uid(), type:'folder', name:'Mis notas', open:true, children:[d] }];
    state.docs[d.id] = SEED_HTML;
    state.current = d.id;
  }
  document.documentElement.setAttribute('data-theme', state.theme || 'dark');
  paintTheme();
  $('#preview').classList.toggle('on', !!state.preview);
  $('#pvBtn').classList.toggle('on', !!state.preview);
  if (innerWidth <= 900) document.body.classList.remove('side-open');
  $('#outline').classList.toggle('on', !!state.outline);
  $('#olBtn').classList.toggle('on', !!state.outline);
  $('#nlBtn').classList.toggle('on', !!state.breaks);
  renderTree();
  if (inWs){
    wsRecover(); openDoc(Workspace.startId); wsStartWatching(); wsStatus('ok'); wsSchedule(true);
  } else {
    // al abrir AtelierRoot se muestra el último documento modificado
    const lastOpen = Ui.data.current;
    const start = lastModifiedDoc() || (lastOpen && findNode(lastOpen) && state.docs[lastOpen] !== undefined ? lastOpen : firstDoc());
    openDoc(start);
  }
  updateBackupNote(); refreshBar(); updateTrashN(); restoreSplit(); fitBar(); scheduleBreaks();
  if (!inWs){
    Sync.ready = storageOk;
    if (storageOk) startSync();
    wsStatus('off'); wsWelcomeIfNeeded();                           // modo temporal: se ofrece abrir una carpeta
  }
})();

