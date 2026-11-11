"use strict";
/* ====== 23. Marcadores [EN_MAYÚSCULAS] ====== */
const PH_SRC = '\\[([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9_ /.-]*)\\]';
const getFills = () => {
  state.fills = state.fills || {};
  return (state.fills[state.current] = state.fills[state.current] || {});
};
function placeholders(){
  const found = [], re = new RegExp(PH_SRC, 'g'), text = mdFromDom(ed);
  let m;
  while ((m = re.exec(text))) if (!found.includes(m[1])) found.push(m[1]);
  return found;
}
function withFills(md){
  const f = (state.fills || {})[state.current] || {};
  return md.replace(new RegExp(PH_SRC, 'g'), (all, k) => (f[k] && f[k].trim()) ? f[k] : all);
}
function paintPhHighlight(){
  if (!(window.CSS && CSS.highlights && window.Highlight)) return;
  const rs = [];
  textNodes().forEach(n => {
    const re = new RegExp(PH_SRC, 'g');
    let m;
    while ((m = re.exec(n.nodeValue))){
      const r = document.createRange();
      r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      rs.push(r);
    }
  });
  CSS.highlights.set('ph', new Highlight(...rs));
}
function updatePh(){
  const list = placeholders();
  const f = (state.fills || {})[state.current] || {};
  const filled = list.filter(k => f[k] && f[k].trim()).length;
  $('#phCount').textContent = list.length ? filled + '/' + list.length : '';
  paintPhHighlight();
}
$('#phBtn').onclick = () => {
  const list = placeholders();
  if (!list.length) return toast(T('msg.no-placeholders'));
  const f = getFills();
  card.innerHTML = '<h2>' + esc(T('ph.title')) + '</h2>' +
    '<p>' + esc(T('ph.body')) + '</p>' +
    '<div class="ph-list"></div>' +
    '<div class="btns"><button class="btn" data-clear>' + esc(T('ph.clear')) + '</button><button class="btn" data-apply>' + esc(T('ph.apply')) + '</button><button class="btn primary" data-yes>' + esc(T('btn.done')) + '</button></div>';
  const host = card.querySelector('.ph-list');
  list.forEach((k, i) => {
    const row = document.createElement('div');
    row.className = 'ph-row';
    row.innerHTML = '<label for="ph_' + i + '"></label><textarea id="ph_' + i + '" rows="1"></textarea>';
    row.querySelector('label').textContent = '[' + k + ']';
    const ta = row.querySelector('textarea');
    ta.value = f[k] || '';
    ta.oninput = () => { const cur = getFills(); cur[k] = ta.value; save(); paintPreview(); updatePh(); };      // siempre sobre los valores vigentes, por si otra pestaña los renovó
    ta.onkeydown = ev => { if (ev.key === 'Escape') veil.classList.remove('show'); };
    host.appendChild(row);
  });
  veil.classList.add('show');
  host.querySelector('textarea').focus();
  card.querySelector('[data-yes]').onclick = () => { veil.classList.remove('show'); ed.focus({ preventScroll: true }); };
  card.querySelector('[data-clear]').onclick = () => {
    const cur = getFills(); Object.keys(cur).forEach(k => delete cur[k]);
    host.querySelectorAll('textarea').forEach(t => t.value = '');
    save(); paintPreview(); updatePh();
  };
  card.querySelector('[data-apply]').onclick = () => { veil.classList.remove('show'); applyFillsToDoc(); };
};
function applyFillsToDoc(){
  const f = getFills();
  const keys = Object.keys(f).filter(k => f[k] && f[k].trim());
  if (!keys.length) return toast(T('msg.no-values'));
  History.mark();
  let count = 0;
  textNodes().forEach(n => {
    const txt = n.nodeValue, re = new RegExp(PH_SRC, 'g');
    const inCode = n.parentElement && n.parentElement.closest(SRC);
    const frag = document.createDocumentFragment();
    let last = 0, m, touched = false;
    while ((m = re.exec(txt))){
      const v = f[m[1]];
      if (!v || !v.trim()) continue;
      frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      if (inCode) frag.appendChild(document.createTextNode(v));
      else v.split('\n').forEach((line, i) => { if (i) frag.appendChild(document.createElement('br')); frag.appendChild(document.createTextNode(line)); });
      last = m.index + m[0].length; count++; touched = true;
    }
    if (!touched) return;
    frag.appendChild(document.createTextNode(txt.slice(last)));
    n.replaceWith(frag);
  });
  keys.forEach(k => delete f[k]);
  after(); History.snap(true);
  toast(T(count === 1 ? 'msg.ph-replaced-1' : 'msg.ph-replaced', { n: count }));
}

