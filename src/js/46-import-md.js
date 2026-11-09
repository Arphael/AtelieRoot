"use strict";
/* ====== 29. Importar archivos .md ====== */
function importFiles(files){
  const list = [...files].filter(f => /\.(md|markdown|txt)$/i.test(f.name));
  if (!list.length) return toast('Solo archivos .md, .markdown o .txt');
  let host = state.tree;
  walk(state.tree, (n, p) => { if (n.id === state.current && p) host = p.children; });
  stash();
  let done = 0, lastId = null;
  list.forEach(f => {
    const rd = new FileReader();
    rd.onload = () => {
      const d = { id: uid(), type: 'doc', mod: Date.now(), name: f.name.replace(/\.(md|markdown|txt)$/i, '') };
      host.push(d);
      state.docs[d.id] = domFromMd(tidyMd(String(rd.result)));
      lastId = d.id;
      if (++done === list.length){
        renderTree(); openDoc(lastId); save(true);
        toast(done === 1 ? 'Documento importado' : done + ' documentos importados');
      }
    };
    rd.readAsText(f);
  });
}
$('#mdFile').onchange = e => { if (e.target.files.length) importFiles(e.target.files); e.target.value = ''; };
addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
addEventListener('drop', e => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){ e.preventDefault(); importFiles(e.dataTransfer.files); }
});

