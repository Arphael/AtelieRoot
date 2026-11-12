"use strict";
/* ====== 86. Comentarios (solo en la app) ====== */
// A comment is anchored to text with <span data-cmt="id" data-cmt-t='{"r":0,"items":[{"d":ms,"t":"text"}]}'>.
// The span lives only in the internal HTML: Markdown ignores it (the .md never changes), forOutsideHtml removes
// it from copies and exports, and with a folder open wsCapture/wsApply keep it in .atelieroot/state.json
// (like folds). Undo, the temporary mode and conflict copies keep it because it is part of the HTML.
// If the commented text is deleted, the comment stays as an empty "orphan" span (data-cmt-o) instead of
// disappearing; when undo brings the text back, the orphan is dropped.
const Cm = { known: new Map(), active: null, showResolved: false, editing: null };
const cmSpans = () => [...ed.querySelectorAll('span[data-cmt]')];
const cmNewId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function cmData(sp){ try { const o = JSON.parse(sp.getAttribute('data-cmt-t') || '{}'); return { r: o.r ? 1 : 0, items: Array.isArray(o.items) ? o.items : [] }; } catch(_){ return { r: 0, items: [] }; } }
function cmWrite(sp, data){
  sp.setAttribute('data-cmt-t', JSON.stringify(data));
  if (data.r) sp.setAttribute('data-cmt-r', ''); else sp.removeAttribute('data-cmt-r');
}
const cmUnwrap = sp => sp.replaceWith(...sp.childNodes);
// one change to the document: undo step + save
function cmEdit(fn){ History.mark(); fn(); after(); History.snap(true); cmReconcile(); cmRender(); }

/* ---- create and remove ---- */
// the selection without splitting bold/links/code (that would change the Markdown), inside one block
function cmRange(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return null;
  const r = s.getRangeAt(0).cloneRange();
  if (r.collapsed) return null;
  const top = topBlockOf(r.startContainer); if (!top) return null;
  if (!top.contains(r.endContainer)){ r.setEnd(top, top.childNodes.length); }
  const host = closestFrom(r.startContainer, 'li') || closestFrom(r.startContainer, 'td,th') || top;
  if (!host.contains(r.endContainer)) r.setEnd(host, host.childNodes.length);
  const inl = n => { let x = n.nodeType === 3 ? n.parentNode : n; const out = []; while (x && x !== host && !/^(P|LI|TD|TH|H[1-6]|BLOCKQUOTE|DIV)$/.test(x.tagName)){ out.push(x); x = x.parentNode; } return out; };
  inl(r.startContainer).forEach(x => { if (!x.contains(r.endContainer)) r.setStartBefore(x); });
  inl(r.endContainer).forEach(x => { if (!x.contains(r.startContainer)) r.setEndAfter(x); });
  return r.toString().trim() ? r : null;
}
function addComment(){
  const s = getSelection();
  if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast(T('msg.cmt-need-sel'));
  if (closestFrom(s.anchorNode, '.cb') || closestFrom(s.focusNode, '.cb')) return toast(T('msg.cmt-in-code'));
  const inside = closestFrom(s.anchorNode, 'span[data-cmt]');
  if (s.isCollapsed){ if (inside){ openComments(inside.getAttribute('data-cmt')); return; } return toast(T('msg.cmt-need-sel')); }
  const r = cmRange(); if (!r) return toast(T('msg.cmt-need-sel'));
  const id = cmNewId();
  cmEdit(() => {
    const sp = document.createElement('span'); sp.setAttribute('data-cmt', id); cmWrite(sp, { r: 0, items: [] });
    sp.appendChild(r.extractContents()); r.insertNode(sp);
    sp.querySelectorAll('span[data-cmt]').forEach(cmUnwrap);                // no comments inside comments
    s.removeAllRanges();
  });
  Cm.editing = { id, item: -1 }; openComments(id);
}
// Ctrl+K Ctrl+U: the comments touched by the selection (or under the cursor) are removed
function removeComment(){
  const s = getSelection(); if (!s.rangeCount || !ed.contains(s.anchorNode)) return toast(T('msg.cmt-none-here'));
  const r = s.getRangeAt(0);
  const hit = cmSpans().filter(sp => r.intersectsNode(sp) || sp.contains(r.startContainer));
  if (!hit.length) return toast(T('msg.cmt-none-here'));
  cmEdit(() => hit.forEach(sp => { Cm.known.delete(sp.getAttribute('data-cmt')); cmUnwrap(sp); }));
  toast(T('msg.cmt-removed'));
}
function deleteThread(id){
  const sp = ed.querySelector('span[data-cmt="' + CSS.escape(id) + '"]'); if (!sp) return;
  cmEdit(() => { Cm.known.delete(id); cmUnwrap(sp); });
}

/* ---- keep comments alive: orphans, duplicates ---- */
// orphans: only for text deleted while typing; undo/redo (orphans=false) simply follow the document
function cmReconcile(orphans = true){
  const seen = new Set();
  cmSpans().forEach(sp => {                                          // a copied line can duplicate a span: the copy is plain text
    const id = sp.getAttribute('data-cmt');
    if (seen.has(id)) cmUnwrap(sp); else seen.add(id);
  });
  const spans = cmSpans(), byId = new Map(spans.map(sp => [sp.getAttribute('data-cmt'), sp]));
  spans.forEach(sp => {
    const id = sp.getAttribute('data-cmt');
    if (sp.hasAttribute('data-cmt-o') && sp.textContent) sp.removeAttribute('data-cmt-o');
    Cm.known.set(id, sp.getAttribute('data-cmt-t'));
  });
  if (!orphans){ [...Cm.known.keys()].forEach(id => { if (!byId.has(id)) Cm.known.delete(id); }); return; }
  let made = false;
  Cm.known.forEach((t, id) => {                                       // its text was deleted: keep the comment as an orphan
    if (byId.has(id)) return;
    const sp = document.createElement('span'); sp.setAttribute('data-cmt', id); sp.setAttribute('data-cmt-t', t); sp.setAttribute('data-cmt-o', '');
    const host = ed.lastElementChild && !closestFrom(ed.lastElementChild, '.cb') && ed.lastElementChild.tagName !== 'HR' ? ed.lastElementChild : null;
    if (host) host.appendChild(sp); else { const p = document.createElement('p'); p.appendChild(sp); ed.appendChild(p); }
    made = true;
  });
  if (made){ stash(); save(); }
}
function cmOnOpen(){ Cm.known.clear(); Cm.active = null; Cm.editing = null; cmReconcile(false); cmRender(); }

/* ---- panel ---- */
function openComments(focusId){
  document.body.classList.add('cmts-open');
  if (focusId) Cm.active = focusId;
  cmRender();
  const c = focusId && $('#cmtsBody').querySelector('[data-id="' + CSS.escape(focusId) + '"]');
  if (c){ c.scrollIntoView({ block: 'nearest' }); const ta = c.querySelector('textarea'); if (ta) ta.focus(); }
}
function closeComments(){ document.body.classList.remove('cmts-open'); Cm.active = null; cmPaintActive(); }
function toggleComments(){ document.body.classList.contains('cmts-open') ? closeComments() : openComments(); }
function cmPaintActive(){
  if (!(window.CSS && CSS.highlights)) return;
  const sp = Cm.active && ed.querySelector('span[data-cmt="' + CSS.escape(Cm.active) + '"]');
  if (sp && sp.textContent){ const r = document.createRange(); r.selectNodeContents(sp); CSS.highlights.set('cmt-on', new Highlight(r)); }
  else CSS.highlights.delete('cmt-on');
}
const cmWhen = d => { try { return new Date(d).toLocaleString(I18n.lang, { dateStyle: 'short', timeStyle: 'short' }); } catch(_){ return ''; } };
function cmRender(){
  const spans = cmSpans(), open = spans.filter(sp => !cmData(sp).r), resolved = spans.length - open.length;
  const n = $('#cmtN'); n.textContent = open.length ? String(open.length) : '';
  if (!document.body.classList.contains('cmts-open')){ cmPaintActive(); return; }
  const body = $('#cmtsBody'); body.innerHTML = '';
  const list = Cm.showResolved ? spans : open;
  if (!list.length){ const e = document.createElement('div'); e.className = 'cmt-empty'; e.textContent = T('cmt.empty'); body.appendChild(e); }
  list.forEach(sp => body.appendChild(cmCard(sp)));
  if (resolved){
    const t = document.createElement('button'); t.className = 'btn cmt-res-toggle';
    t.textContent = Cm.showResolved ? T('cmt.hide-resolved') : T('cmt.show-resolved', { n: resolved });
    t.onclick = () => { Cm.showResolved = !Cm.showResolved; cmRender(); };
    body.appendChild(t);
  }
  cmPaintActive();
}
function cmCard(sp){
  const id = sp.getAttribute('data-cmt'), data = cmData(sp), orphan = !sp.textContent;
  const c = document.createElement('div');
  c.className = 'cmt-card' + (id === Cm.active ? ' on' : '') + (data.r ? ' resolved' : '');
  c.dataset.id = id;
  const q = document.createElement('div'); q.className = 'cmt-quote' + (orphan ? ' orphan' : '');
  q.textContent = orphan ? T('cmt.orphan') : sp.textContent.slice(0, 140);
  c.appendChild(q);
  const ed1 = Cm.editing && Cm.editing.id === id ? Cm.editing.item : null;
  data.items.forEach((it, i) => {
    const m = document.createElement('div'); m.className = 'cmt-item';
    if (ed1 === i){ m.appendChild(cmEditor(it.t, txt => { data.items[i].t = txt; cmEdit(() => cmWrite(sp, data)); }, () => { Cm.editing = null; cmRender(); })); }
    else {
      const h = document.createElement('div'); h.className = 'cmt-meta'; h.textContent = T('cmt.you') + ' · ' + cmWhen(it.d);
      const t = document.createElement('div'); t.className = 'cmt-text'; t.textContent = it.t;
      m.append(h, t);
      t.ondblclick = () => { Cm.editing = { id, item: i }; cmRender(); };
    }
    c.appendChild(m);
  });
  if (ed1 === -1 || !data.items.length){                              // new comment, or answer box
    c.appendChild(cmEditor('', txt => { data.items.push({ d: Date.now(), t: txt }); Cm.editing = null; cmEdit(() => cmWrite(sp, data)); },
      () => { Cm.editing = null; if (!data.items.length) deleteThread(id); else cmRender(); }, !data.items.length ? 'cmt.ph' : 'cmt.reply-ph'));
  } else {
    const acts = document.createElement('div'); acts.className = 'cmt-acts';
    const btn = (key, fn) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = T(key); b.onclick = e => { e.stopPropagation(); fn(); }; acts.appendChild(b); };
    btn('cmt.reply', () => { Cm.editing = { id, item: -1 }; Cm.active = id; cmRender(); const ta = $('#cmtsBody').querySelector('[data-id="' + CSS.escape(id) + '"] textarea'); if (ta) ta.focus(); });
    btn('cmt.edit', () => { Cm.editing = { id, item: 0 }; cmRender(); });
    btn(data.r ? 'cmt.reopen' : 'cmt.resolve', () => { data.r = data.r ? 0 : 1; cmEdit(() => cmWrite(sp, data)); });
    btn('cmt.delete', () => confirmBox(T('cmt.delete'), T('cmt.confirm-delete'), () => deleteThread(id)));
    c.appendChild(acts);
  }
  c.onclick = () => {                                                  // select the commented text
    Cm.active = id; [...$('#cmtsBody').children].forEach(x => x.classList.toggle('on', x.dataset && x.dataset.id === id));
    if (sp.isConnected && sp.textContent){ sp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    cmPaintActive();
  };
  return c;
}
function cmEditor(text, onSave, onCancel, ph){
  const w = document.createElement('div'); w.className = 'cmt-editor';
  const ta = document.createElement('textarea'); ta.value = text; ta.rows = 2; ta.placeholder = T(ph || 'cmt.ph');
  const acts = document.createElement('div'); acts.className = 'cmt-acts';
  const ok = document.createElement('button'); ok.className = 'btn primary'; ok.textContent = T('cmt.save');
  const no = document.createElement('button'); no.className = 'btn'; no.textContent = T('cmt.cancel');
  const save = () => { const v = ta.value.trim(); if (v) onSave(v); else onCancel(); };
  ok.onclick = e => { e.stopPropagation(); save(); };
  no.onclick = e => { e.stopPropagation(); onCancel(); };
  ta.onclick = e => e.stopPropagation();
  ta.onkeydown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); save(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); onCancel(); }
  };
  acts.append(no, ok); w.append(ta, acts);
  return w;
}

/* ---- wiring ---- */
$('#cmtBtn').addEventListener('mousedown', e => e.preventDefault());
$('#cmtBtn').onclick = () => { const s = getSelection(); if (s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode)) addComment(); else toggleComments(); };
$('#cmtsClose').onclick = closeComments;
ed.addEventListener('click', e => {
  const sp = e.target.closest && e.target.closest('span[data-cmt]');
  if (sp && getSelection().isCollapsed) openComments(sp.getAttribute('data-cmt'));
});
ed.addEventListener('input', () => { cmReconcile(); cmRender(); });
document.addEventListener('keydown', e => {
  if (veil.classList.contains('show')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && !e.shiftKey && (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide')){
    if (!(document.activeElement === ed || ed.contains(document.activeElement))) return;
    e.preventDefault(); e.stopImmediatePropagation(); addComment();
  }
}, true);
document.addEventListener('langchange', () => cmRender());
// after opening a document and after undo/redo the comments are checked again
const cmOpenDoc0 = openDoc;
openDoc = function(id){ cmOpenDoc0(id); cmOnOpen(); };
['undo', 'redo'].forEach(k => { const f = History[k].bind(History); History[k] = () => { f(); cmReconcile(false); cmRender(); }; });
