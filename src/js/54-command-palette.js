"use strict";
/* ====== 40. Paleta de comandos ====== */
const clickSel = sel => () => { const el = document.querySelector(sel); if (el) el.click(); };
const COMMANDS = [
  // documento
  { g:'Documento', t:'Nuevo documento', run: clickSel('#newDoc') },
  { g:'Documento', t:'Nueva carpeta', run: clickSel('#newFolder') },
  { g:'Documento', t:'Ir a documento', k:'Ctrl+P', run: () => openSwitcher() },
  { g:'Documento', t:'Renombrar documento actual', run: () => { const n = findNode(state.current); if (n) renameNode(n); } },
  { g:'Documento', t:'Mover documento actual a…', run: () => { const n = findNode(state.current); if (n) moveToDialog(n); } },
  { g:'Documento', t:'Mover documento actual a la papelera', run: () => { const n = findNode(state.current); if (n) moveToTrash(n); } },
  { g:'Documento', t:'Abrir papelera', run: () => openTrash() },
  { g:'Documento', t:'Importar archivos .md', run: () => $('#mdFile').click() },
  // copiar y exportar
  { g:'Copiar', t:'Copiar Markdown', run: clickSel('#copyMd') },
  { g:'Copiar', t:'Copiar con formato', run: clickSel('#copyRich') },
  { g:'Exportar', t:'Exportar como Markdown (.md)', run: () => exportMenu.querySelector('[data-x="md"]').click() },
  { g:'Exportar', t:'Exportar como texto plano (.txt)', run: () => exportMenu.querySelector('[data-x="txt"]').click() },
  { g:'Exportar', t:'Exportar como HTML (.html)', run: () => exportMenu.querySelector('[data-x="html"]').click() },
  { g:'Exportar', t:'Exportar respaldo completo (.json)', run: () => backup() },
  { g:'Exportar', t:'Descargar la copia automática previa a la actualización', run: () => downloadPreviousCopy() },
  { g:'Exportar', t:'Restaurar desde respaldo', run: () => $('#file').click() },
  // edición
  { g:'Editar', t:'Deshacer', k:'Ctrl+Z', run: () => History.undo() },
  { g:'Editar', t:'Rehacer', k:'Ctrl+Shift+Z', run: () => History.redo() },
  { g:'Editar', t:'Buscar', k:'Ctrl+F', run: () => openFind(false) },
  { g:'Editar', t:'Buscar y reemplazar', k:'Ctrl+H', run: () => openFind(true) },
  { g:'Editar', t:'Ordenar documento', run: clickSel('#tidyBtn') },
  { g:'Editar', t:'Borrar la línea', k:'Shift+Supr', run: () => deleteCaretUnit() },
  { g:'Editar', t:'Rellenar marcadores', run: clickSel('#phBtn') },
  // formato
  { g:'Formato', t:'Párrafo', run: () => setBlockLevel(0) },
  ...[1,2,3,4,5,6].map(n => ({ g:'Formato', t:'Encabezado ' + n, run: () => setBlockLevel(n) })),
  { g:'Formato', t:'Negrita', k:'Ctrl+B', run: () => toggleWrap('strong') },
  { g:'Formato', t:'Cursiva', k:'Ctrl+I', run: () => toggleWrap('em') },
  { g:'Formato', t:'Tachado', k:'Ctrl+Shift+X', run: () => toggleWrap('s') },
  { g:'Formato', t:'Código en línea', k:'Ctrl+E', run: () => toggleWrap('code') },
  { g:'Formato', t:'Quitar formato', run: () => clearFormat() },
  { g:'Insertar', t:'Lista con viñetas', run: () => insertBlock('ul') },
  { g:'Insertar', t:'Lista numerada', run: () => insertBlock('ol') },
  { g:'Insertar', t:'Cambiar el número del punto de lista', run: () => {
      const li = closestFrom(getSelection().anchorNode, 'li');
      if (!li || !li.parentElement || li.parentElement.tagName !== 'OL') return toast('Pon el cursor en un punto de una lista numerada');
      editItemNumber(li);
  } },
  { g:'Insertar', t:'Lista de tareas', run: () => insertBlock('task') },
  { g:'Insertar', t:'Cita', run: () => insertBlock('quote') },
  { g:'Insertar', t:'Bloque de código', run: () => insertBlock('pre') },
  { g:'Insertar', t:'Tabla', run: () => insertBlock('table') },
  { g:'Insertar', t:'Línea divisoria', run: () => insertBlock('hr') },
  { g:'Insertar', t:'Enlace', k:'Ctrl+K', run: clickSel('#linkBtn') },
  { g:'Insertar', t:'Imagen', run: clickSel('#imgBtn') },
  // secciones
  { g:'Secciones', t:'Plegar o desplegar la sección actual', k:'Ctrl+.', run: () => { const b = currentBlock(); toggleFold(b && sectionHeadOf(b)); } },
  { g:'Secciones', t:'Plegar todas las secciones', run: () => foldAll(true) },
  { g:'Secciones', t:'Desplegar todas las secciones', run: () => foldAll(false) },
  // vista
  { g:'Vista', t:'Abrir vista dividida', when: () => !split, run: () => openSwitcher(id => enableSplit(id, true), 'Abrir al lado') },
  { g:'Vista', t:'Cerrar vista dividida', when: () => split, run: () => closeSplit() },
  { g:'Vista', t:'Cambiar de panel', when: () => split, run: () => { activate(1 - active); ed.focus({ preventScroll: true }); } },
  { g:'Vista', t:'Mostrar u ocultar el panel lateral', run: () => toggleSide() },
  { g:'Vista', t:'Mostrar u ocultar el esquema', run: clickSel('#olBtn') },
  { g:'Vista', t:'Mostrar u ocultar el Markdown en vivo', run: clickSel('#pvBtn') },
  { g:'Vista', t:'Modo enfoque', k:'Ctrl+Shift+F', run: () => toggleFocus() },
  { g:'Vista', t:'Mostrar u ocultar los saltos de línea', k:'Ctrl+Shift+8', run: () => setBreaks(!state.breaks) },
  { g:'Vista', t:'Cambiar entre tema claro y oscuro', run: clickSel('#themeBtn') }
];
function setBlockLevel(lvl){ applyBlockType(lvl); }
function openPalette(){
  // se guarda la selección para que los comandos de formato actúen sobre ella
  const s = getSelection();
  const saved = s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
  card.innerHTML = '<h2>Paleta de comandos</h2><input id="palq" placeholder="Escribe una acción: exportar, tema, plegar…" autocomplete="off" aria-label="Buscar comando"><div class="sw-list" id="pall"></div>';
  veil.classList.add('show');
  const q = card.querySelector('#palq'), l = card.querySelector('#pall');
  let sel = 0, res = [];
  const run = c => {
    veil.classList.remove('show');
    ed.focus({ preventScroll: true });
    if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); }
    setTimeout(() => c.run(), 0);
  };
  const paint = () => {
    const words = norm(q.value).split(/\s+/).filter(Boolean);
    res = COMMANDS.filter(c => (!c.when || c.when()) && words.every(w => norm(c.g + ' ' + c.t).includes(w)));
    sel = Math.min(sel, Math.max(0, res.length - 1));
    l.innerHTML = '';
    if (!res.length){ l.innerHTML = '<div class="ol-empty">Ningún comando coincide</div>'; return; }
    res.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'pal-item' + (i === sel ? ' on' : '');
      b.innerHTML = '<span class="pg"></span><span class="pt"></span><span class="pk"></span>';
      b.querySelector('.pg').textContent = c.g;
      b.querySelector('.pt').textContent = c.t;
      b.querySelector('.pk').textContent = c.k || '';
      b.onclick = () => run(c);
      l.appendChild(b);
    });
    const on = l.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  q.oninput = () => { sel = 0; paint(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (res[sel]) run(res[sel]); }
    else if (e.key === 'Escape'){ veil.classList.remove('show'); ed.focus({ preventScroll: true }); if (saved){ const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(saved); } }
  };
  paint(); q.focus();
}
$('#palBtn').addEventListener('mousedown', e => e.preventDefault());
$('#palBtn').onclick = openPalette;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p'){ e.preventDefault(); e.stopPropagation(); openPalette(); }
}, true);


