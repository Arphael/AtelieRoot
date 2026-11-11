"use strict";
/* ====== 32. Barra adaptable: lo que no cabe pasa a «Más» ====== */
// orden en que se esconden: primero lo menos usado
const OVF_ORDER = ['#unlinkBtn','#imgBtn','[data-block="hr"]','[data-fmt="clear"]','[data-fmt="strike"]','#focusBtn','#swBtn','#splitBtn',
  '#outBtn','#inBtn','[data-cmd="redo"]','[data-block="quote"]','[data-block="table"]','#findBtn','[data-block="pre"]','#linkBtn',
  '[data-block="task"]','#copyRich','#pvBtn','#olBtn','#phBtn','#exportBtn','#langBtn','#themeBtn','[data-fmt="code"]','#tidyBtn',
  '[data-block="ol"]','[data-block="ul"]','[data-fmt="italic"]','[data-fmt="bold"]','[data-cmd="undo"]','#hBtn'];
const bar = $('#bar'), moreBtn = $('#moreBtn'), moreMenu = $('#moreMenu');
function fixSeps(){
  const seq = [...bar.querySelectorAll('.tb, .sep')].filter(el => el !== moreBtn);
  const vis = el => !el.classList.contains('ovf') && getComputedStyle(el).display !== 'none';
  seq.filter(el => el.classList.contains('sep')).forEach(s => s.classList.remove('ovf'));
  let prevVisible = null;
  seq.forEach(el => {
    if (el.classList.contains('sep')){
      if (!prevVisible || prevVisible.classList.contains('sep')) el.classList.add('ovf');
      else prevVisible = el;
    } else if (vis(el)) prevVisible = el;
  });
  if (prevVisible && prevVisible.classList.contains('sep')) prevVisible.classList.add('ovf');
}
// the right-hand group (live Markdown ... language) goes whole to the tools panel (84-tools-panel.js) when it does not fit;
// the view tools that overflow are also there, so «More» keeps only formatting and insert tools
const toolGroup = bar.querySelector('.tb-group'), toolsBtn = $('#toolsBtn');
const VIEW_TOOLS = ['#findBtn', '#swBtn', '#splitBtn', '#olBtn', '#focusBtn'];
const overflowing = () => bar.scrollWidth > bar.clientWidth + 1;
// hides tools in OVF_ORDER until the bar fits; returns true if it reached a tool of the right-hand group
function fitPass(groupOut){
  OVF_ORDER.forEach(sel => { const el = bar.querySelector(sel); if (el) el.classList.remove('ovf'); });
  toolGroup.classList.toggle('ovf', groupOut); toolsBtn.classList.toggle('ovf', !groupOut);
  moreBtn.classList.add('ovf');
  fixSeps();
  let i = 0;
  while (overflowing() && i < OVF_ORDER.length){
    const el = bar.querySelector(OVF_ORDER[i++]);
    if (!el) continue;
    if (toolGroup.contains(el)){ if (!groupOut) return true; continue; }
    el.classList.add('ovf');
    if (VIEW_TOOLS.some(s => el.matches(s))) toolsBtn.classList.remove('ovf');
    else moreBtn.classList.remove('ovf');
    fixSeps();
  }
  return false;
}
// when the group's turn comes it leaves whole, and the bar is laid out again without it: the freed space
// brings back the tools hidden before (no empty gap with half the tools in «More»)
function fitBar(){ if (fitPass(false)) fitPass(true); }
let fitRaf = 0;
const scheduleFit = () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitBar); };
if (window.ResizeObserver) new ResizeObserver(scheduleFit).observe(bar);
// si cambia el texto de un botón (nivel de bloque, contador de marcadores), se recalcula
new MutationObserver(scheduleFit).observe(bar, { subtree: true, characterData: true, childList: true });
addEventListener('resize', fitBar);
moreMenu.addEventListener('mousedown', e => e.preventDefault());
moreBtn.addEventListener('mousedown', e => e.preventDefault());
moreBtn.onclick = e => {
  e.stopPropagation();
  moreMenu.innerHTML = '';
  // se listan en el orden en que aparecen en la barra
  [...bar.querySelectorAll('.tb.ovf')].filter(el => el !== moreBtn && el !== toolsBtn && !VIEW_TOOLS.some(s => el.matches(s))).forEach(el => {
    const b = document.createElement('button');
    const label = (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent).trim();
    b.innerHTML = '<span style="display:inline-flex;width:20px;justify-content:center;vertical-align:middle;margin-right:8px;color:var(--ink-dim)"></span><span></span>';
    const icon = el.querySelector('svg');
    if (icon) b.firstChild.appendChild(icon.cloneNode(true));
    else b.firstChild.textContent = el.textContent.trim().slice(0, 2);
    b.lastChild.textContent = label;
    b.onclick = ev => { ev.stopPropagation(); hide(moreMenu); el.click(); };
    moreMenu.appendChild(b);
  });
  popup(moreMenu, moreBtn);
};

/* ====== 33. Pantallas pequeñas ====== */
function setVvh(){ if (window.visualViewport) document.documentElement.style.setProperty('--vvh', visualViewport.height + 'px'); }
if (window.visualViewport){ visualViewport.addEventListener('resize', setVvh); setVvh(); }
const toggleSide = () => {
  if (innerWidth <= 900) document.body.classList.toggle('side-open');
  else $('#side').classList.toggle('off');
  setTimeout(fitBar, 200);
};
$('#sideBtn').onclick = toggleSide;
$('#mSide').onclick = toggleSide;
$('#scrim').onclick = () => document.body.classList.remove('side-open');
$('#mCopy').onclick = () => $('#copyMd').click();
// en pantallas estrechas, abrir un panel cierra el otro
['#olBtn', '#pvBtn'].forEach(sel => $(sel).addEventListener('click', () => {
  if (innerWidth > 900) return;
  if (sel === '#olBtn' && state.outline && state.preview){ state.preview = false; $('#preview').classList.remove('on'); $('#pvBtn').classList.remove('on'); }
  if (sel === '#pvBtn' && state.preview && state.outline){ state.outline = false; $('#outline').classList.remove('on'); $('#olBtn').classList.remove('on'); }
}));

