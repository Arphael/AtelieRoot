"use strict";
/* ====== 18. Menús y diálogos ====== */
function popup(menu, anchor, right){
  document.querySelectorAll('.menu.show').forEach(m => { if (m !== menu) m.classList.remove('show'); });
  if (!anchor || !anchor.offsetParent) anchor = $('#moreBtn').offsetParent ? $('#moreBtn') : $('#bar');
  const r = anchor.getBoundingClientRect();
  menu.classList.add('show');
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, right ? r.right - w : r.left)) + 'px';
  menu.style.top = (r.bottom + 6 + h > innerHeight && r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6) + 'px';
}
const hide = m => m.classList.remove('show');
document.addEventListener('click', e => { if (!e.target.closest('.menu')) document.querySelectorAll('.menu.show').forEach(hide); });

const veil = $('#veil'), card = $('#card');
function dialog(title, fields, ok){
  card.innerHTML = '<h2></h2>' + fields.map(f =>
    '<div style="display:flex;flex-direction:column;gap:5px"><label for="f_'+f.id+'" style="font-size:11px;color:var(--ink-faint)"></label><input id="f_'+f.id+'"></div>').join('') +
    '<div class="btns"><button class="btn" data-no>Cancelar</button><button class="btn primary" data-yes>Aceptar</button></div>';
  card.querySelector('h2').textContent = title;
  fields.forEach(f => {
    card.querySelector('label[for="f_'+f.id+'"]').textContent = f.label;
    card.querySelector('#f_'+f.id).value = f.value || '';
  });
  veil.classList.add('show');
  const first = card.querySelector('input'); first.focus(); first.select();
  const done = () => {
    const v = {}; fields.forEach(f => v[f.id] = card.querySelector('#f_'+f.id).value.trim());
    veil.classList.remove('show'); ok(v);
  };
  card.querySelector('[data-yes]').onclick = done;
  card.querySelector('[data-no]').onclick = () => veil.classList.remove('show');
  card.querySelectorAll('input').forEach(inp => inp.onkeydown = ev => {
    if (ev.key === 'Enter'){ ev.preventDefault(); done(); }
    if (ev.key === 'Escape') veil.classList.remove('show');
  });
}
const askName = (title, value, ok) => dialog(title, [{ id:'n', label:'Nombre', value }], v => { if (v.n) ok(v.n); });
function confirmBox(title, body, ok){
  card.innerHTML = '<h2></h2><p></p><div class="btns"><button class="btn" data-no>Cancelar</button><button class="btn primary" data-yes>Continuar</button></div>';
  card.querySelector('h2').textContent = title;
  card.querySelector('p').textContent = body;
  veil.classList.add('show');
  card.querySelector('[data-yes]').onclick = () => { veil.classList.remove('show'); ok(); };
  card.querySelector('[data-no]').onclick = () => veil.classList.remove('show');
}
veil.onclick = e => { if (e.target === veil) veil.classList.remove('show'); };
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), Math.max(1800, String(msg).length * 60));   // long messages stay long enough to read
}

