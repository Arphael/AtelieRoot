"use strict";
/* ====== 15. Copiar, ordenar, vista Markdown ====== */
const docMd = () => tidyMd(mdFromDom(ed));
function selectionMd(){
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed || !ed.contains(s.anchorNode)) return null;
  const host = document.createElement('div');
  host.appendChild(s.getRangeAt(0).cloneContents());
  if (!host.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,hr,.cb')) return inlineMd(host).trim();
  return tidyMd(mdFromDom(host));
}
function copyText(t){
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
  else fallbackCopy(t);
}
function fallbackCopy(t){
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch(_){}
  ta.remove();
}
$('#tidyBtn').onclick = () => tidyDocument();
$('#copyMd').onclick = () => { copyText(withFills(selectionMd() || docMd())); toast(T('msg.copied-md')); };
$('#copyRich').onclick = async () => {
  const s = getSelection();
  const host = document.createElement('div');
  if (s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode)) host.appendChild(s.getRangeAt(0).cloneContents());
  else host.innerHTML = ed.innerHTML;
  forOutsideHtml(host);
  const text = withFills(selectionMd() || docMd());
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob(['<meta charset="utf-8">' + host.innerHTML], {type:'text/html'}),
      'text/plain': new Blob([text], {type:'text/plain'})
    })]);
    toast(T('msg.copied-rich'));
  } catch(_){ copyText(text); toast(T('msg.copied-text')); }
};
ed.addEventListener('copy', e => {
  const trc = tableRect();
  if (trc && trc.multi){ e.preventDefault(); lineClip = null; writeTableClip(e, trc); return; }
  const md = selectionMd();
  if (md === null){ if (getSelection().isCollapsed && setLineClipboard(e)){ e.preventDefault(); toast(T('msg.line-copied')); } return; }
  lineClip = null;
  const host = document.createElement('div');
  host.appendChild(getSelection().getRangeAt(0).cloneContents());
  forOutsideHtml(host);
  e.clipboardData.setData('text/plain', withFills(md));
  e.clipboardData.setData('text/html', host.innerHTML);
  e.preventDefault();
});
function paintPreview(){ if (state.preview) $('#pvText').textContent = withFills(docMd()); }
$('#pvBtn').onclick = () => {
  state.preview = !state.preview;
  $('#preview').classList.toggle('on', state.preview);
  $('#pvBtn').classList.toggle('on', state.preview);
  paintPreview(); save();
};
$('#pvCopy').onclick = () => { copyText(withFills(docMd())); toast(T('msg.copied-md')); };

