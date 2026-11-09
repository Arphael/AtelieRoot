"use strict";
/* ====== 26. Esquema ====== */
function paintOutline(){
  if (!state.outline) return;
  paintBacklinks();
  const heads = [...ed.children].filter(x => /^H[1-6]$/.test(x.tagName) && x.textContent.replace(/\u200b/g,'').trim());
  const list = $('#olList');
  list.innerHTML = '';
  if (!heads.length){ olHeads = []; olBtns = []; olCur = -2; list.innerHTML = '<div class="ol-empty">Sin encabezados todavía. Usa # al inicio de una línea.</div>'; return; }
  heads.forEach((h, hi) => {
    const lvl = +h.tagName[1];
    const b = document.createElement('button');
    b.className = 'ol-item l' + lvl;
    b.style.paddingLeft = (8 + (lvl - 1) * 12) + 'px';
    b.textContent = h.textContent.replace(/\u200b/g, '');
    b.onclick = () => { olHold = Date.now() + 800; setOutlineCur(hi); setTimeout(markOutlineSoon, 850); unfoldFor(h); h.scrollIntoView({ block: 'start', behavior: 'smooth' }); ed.focus({ preventScroll: true }); caretInto(h, true); };
    list.appendChild(b);
  });
  olHeads = heads; olBtns = [...list.children]; olCur = -2; markOutline();
}
$('#olBtn').onclick = () => {
  state.outline = !state.outline;
  $('#outline').classList.toggle('on', state.outline);
  $('#olBtn').classList.toggle('on', state.outline);
  paintOutline(); save();
};

/* ====== 27. Modo enfoque ====== */
function markCur(){
  ed.querySelectorAll('[data-cur]').forEach(x => x.removeAttribute('data-cur'));
  const b = currentBlock();
  if (b && b.setAttribute) b.setAttribute('data-cur', '');
}
function toggleFocus(force){
  const on = force === undefined ? !document.body.classList.contains('focus') : force;
  document.body.classList.toggle('focus', on);
  if (on){ markCur(); toast('Modo enfoque · Esc para salir'); }
  else ed.querySelectorAll('[data-cur]').forEach(x => x.removeAttribute('data-cur'));
  ed.focus({ preventScroll: true });
}
$('#focusBtn').onclick = () => toggleFocus(true);
$('#focusExit').onclick = () => toggleFocus(false);

/* ====== 28. Cambio rápido ====== */
function openSwitcher(onPick, title){
  const docs = [];
  walk(state.tree, n => { if (n.type === 'doc') docs.push({ id: n.id, name: n.name, path: pathOf(n.id) }); });
  card.innerHTML = '<h2>' + esc(title || 'Ir a documento') + '</h2><input id="swq" placeholder="Escribe para buscar…" autocomplete="off" aria-label="Buscar documento"><div class="sw-list" id="swl"></div>';
  veil.classList.add('show');
  const q = card.querySelector('#swq'), l = card.querySelector('#swl');
  let sel = 0, res = [];
  const go = d => { veil.classList.remove('show'); onPick ? onPick(d.id) : openDoc(d.id); };
  const paint = () => {
    const t = norm(q.value);
    res = docs.filter(d => !t || norm(d.path).includes(t)).slice(0, 40);
    sel = Math.min(sel, Math.max(0, res.length - 1));
    l.innerHTML = '';
    if (!res.length){ l.innerHTML = '<div class="ol-empty">Sin resultados</div>'; return; }
    res.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = 'sw-item' + (i === sel ? ' on' : '');
      b.innerHTML = '<span class="sw-n"></span><span class="sw-p"></span>';
      b.querySelector('.sw-n').textContent = d.name;
      b.querySelector('.sw-p').textContent = d.path;
      b.onclick = () => go(d);
      l.appendChild(b);
    });
    const on = l.querySelector('.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  };
  q.oninput = () => { sel = 0; paint(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); paint(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
    else if (e.key === 'Enter'){ e.preventDefault(); if (res[sel]) go(res[sel]); }
    else if (e.key === 'Escape'){ veil.classList.remove('show'); ed.focus({ preventScroll: true }); }
  };
  paint(); q.focus();
}
$('#swBtn').onclick = () => openSwitcher();

