"use strict";
/* ====== 17. Exportar, respaldo, tema ====== */
const exportMenu = $('#exportMenu');
$('#exportBtn').onclick = e => { e.stopPropagation(); popup(exportMenu, $('#exportBtn'), true); };
exportMenu.addEventListener('click', e => {
  e.stopPropagation();
  const x = e.target.closest('[data-x]') && e.target.closest('[data-x]').dataset.x;
  if (!x) return;
  hide(exportMenu);
  const name = ((findNode(state.current) || {}).name || 'documento').replace(/[\\/:*?"<>|]/g,'-');
  if (x === 'md')   download(name + '.md', withFills(docMd()), 'text/markdown');
  if (x === 'importmd') $('#mdFile').click();
  if (x === 'txt')  download(name + '.txt', ed.innerText, 'text/plain');
  if (x === 'html') download(name + '.html', htmlDoc(name), 'text/html');
  if (x === 'json') backup();
  if (x === 'import') $('#file').click();
});
function htmlDoc(title){
  const host = document.createElement('div'); host.innerHTML = ed.innerHTML;
  forOutsideHtml(host);
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(title)+'</title>' +
    '<style>body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.65 Georgia,serif;color:#222}' +
    'code,pre{font-family:ui-monospace,Menlo,monospace;background:#f4f4f0;border-radius:3px}' +
    'pre{padding:12px;overflow:auto}code{padding:1px 5px}img{max-width:100%}' +
    'ol ol{list-style-type:lower-alpha}ol ol ol{list-style-type:lower-roman}ol ol ol ol{list-style-type:upper-alpha}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:7px 10px}' +
    'blockquote{border-left:3px solid #ccc;margin:0;padding-left:16px;color:#555}</style></head><body>' +
    host.innerHTML + '</body></html>';
}
// Descarga un archivo con el mecanismo normal del navegador. Devuelve una promesa (true si se pidió la descarga).
function download(name, content, type){
  const url = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return Promise.resolve(true);
}
function backup(){
  stash();
  return download('atelierroot-respaldo-' + new Date().toISOString().slice(0,10) + '.json',
    JSON.stringify({ v:1, at: Date.now(), tree: state.tree, docs: (() => { const o = {}; walk(state.tree, n => { if (n.type === 'doc') o[n.id] = state.docs[n.id]; }); return o; })() }, null, 1), 'application/json').then(ok => {
    if (!ok) return;                                          // solo cuenta como respaldo si de verdad se guardó el archivo
    state.lastBackup = Date.now(); save(true); updateBackupNote(); toast('Respaldo descargado');
  });
}
$('#backupBtn').onclick = backup;
$('#file').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d.tree || !d.docs) throw 0;
      confirmBox('Restaurar respaldo', 'Se añadirán ' + Object.keys(d.docs).length + ' documentos a los que ya tienes. Nada se borra.', () => {
        const newDocs = {};
        const cp = n => {
          const c = { id: uid(), type: n.type, name: n.name, open: false };
          if (n.type === 'folder') c.children = (n.children || []).map(cp);
          else { newDocs[c.id] = (d.docs && d.docs[n.id]) || '<p><br></p>'; c.mod = Date.now(); }
          return c;
        };
        const restored = d.tree.map(cp);
        Object.assign(state.docs, newDocs);
        state.tree.push({ id: uid(), type:'folder', name:'Restaurado ' + new Date(d.at||Date.now()).toLocaleDateString(), open:true, children: restored });
        renderTree(); save(true); toast('Respaldo restaurado');
      });
    } catch(_){ toast('El archivo no es un respaldo válido'); }
  };
  rd.readAsText(f); e.target.value = '';
};
function updateBackupNote(){
  const n = $('#backupNote');
  if (!state.lastBackup){ n.textContent = 'Sin respaldo todavía'; n.classList.add('warn'); return; }
  const days = Math.floor((Date.now() - state.lastBackup) / 86400000);
  n.textContent = days === 0 ? 'Respaldo: hoy' : 'Respaldo: hace ' + days + (days === 1 ? ' día' : ' días');
  n.classList.toggle('warn', days >= 10);
}
addEventListener('beforeunload', e => {
  flushNow();
  const days = state.lastBackup ? (Date.now() - state.lastBackup) / 86400000 : 99;
  if (!Workspace.active && days >= 14 && Object.keys(state.docs).length > 1){ e.preventDefault(); e.returnValue = ''; }
});
function paintTheme(){
  const dark = document.documentElement.getAttribute('data-theme') !== 'light';
  $('#themeBtn').innerHTML = dark
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="5"></line><line x1="12" y1="19" x2="12" y2="22"></line><line x1="2" y1="12" x2="5" y2="12"></line><line x1="19" y1="12" x2="22" y2="12"></line></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';
}
$('#themeBtn').onclick = () => {
  state.theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  paintTheme(); save();
};

