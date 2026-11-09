"use strict";
/* ====== 71. Al terminar una ruta, comando o dirección, el formato termina con el espacio ====== */
// Con el cursor al final de un código que es un comando o ruta (o de una dirección que es un enlace) un espacio sale del formato: lo siguiente es texto normal.
// un espacio junto a otro espacio va como espacio duro (si no, el navegador lo colapsa y se come uno al seguir escribiendo)
function insertSpaceAt(tn, o){
  const nx = tn.nodeValue[o], pv = o > 0 ? tn.nodeValue[o - 1] : '';
  tn.insertData(o, (nx === ' ' || nx === '\u00a0' || pv === ' ') ? '\u00a0' : ' ');
  return o + 1;
}
function exitInline(sel, withSpace){
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const n = sel.anchorNode;
  if (!n || !ed.contains(n)) return false;
  let el = closestFrom(n, 'a,[data-code]');
  if (el){
    if (!ed.contains(el) || el.closest('.cb,pre')) return false;
    const r = document.createRange(); r.selectNodeContents(el);
    try { r.setStart(n, sel.anchorOffset); } catch(_){ return false; }
    if (r.toString().replace(/\u200b/g, '') !== '') return false;               // el cursor no está al final
  } else {                                                                       // cursor justo DETRÁS del código o enlace (entre elementos, o al inicio del texto que sigue)
    const blank = x => x && x.nodeType === 3 && !x.nodeValue.replace(/\u200b/g, '');
    let prev = null;
    if (n.nodeType === 1) prev = n.childNodes[sel.anchorOffset - 1] || null;
    else if (n.nodeType === 3 && !n.nodeValue.slice(0, sel.anchorOffset).replace(/\u200b/g, '')) prev = n.previousSibling;
    while (blank(prev)) prev = prev.previousSibling;
    if (!(prev && prev.nodeType === 1 && prev.matches('a,[data-code]')) || prev.closest('.cb,pre')) return false;
    el = prev;
  }
  const txt = el.textContent.replace(/\u200b/g, '');
  const ok = el.tagName === 'A' ? (isUrl(txt) && hrefOf(txt) === (el.getAttribute('href') || '')) : (txt === txt.trim() && (isCodeLike(txt) || WIN_SPACED.test(txt)));
  if (!ok) return false;
  History.snap(true); History.mark();
  let tn = el.nextSibling, o = 0;
  if (!(tn && tn.nodeType === 3)){ tn = document.createTextNode('\u200b'); el.after(tn); }
  if (withSpace){ o = insertSpaceAt(tn, 0); if (o === tn.length && !tn.nextSibling) tn.appendData('\u200b'); }
  const rg = document.createRange(); rg.setStart(tn, o); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg);
  return true;
}
// tras pegar, el cursor queda fuera del código o enlace del final (no dentro, donde seguiría el formato)
function caretOutOfInline(block){
  let host = block;
  while (host && host.lastElementChild && /^(UL|OL|LI)$/.test(host.lastElementChild.tagName)) host = host.lastElementChild;
  const last = host && host.lastChild;
  if (last && last.nodeType === 1 && /^(SPAN|A|STRONG|EM|S|CODE)$/.test(last.tagName)){
    const tn = document.createTextNode('\u200b'); host.appendChild(tn);
    const r = document.createRange(), s = getSelection(); r.setStart(tn, 1); r.collapse(true); s.removeAllRanges(); s.addRange(r);
  }
}
// al teclear C:\Program Files\x: la ruta se convierte en código al primer espacio y, si lo siguiente continúa la ruta (lleva «\»), el código se amplía
function extendWinPath(n, off, before, withSpace, sel){
  const prev = n.previousSibling;
  if (!prev || prev.nodeType !== 1 || !prev.matches('[data-code]') || !WIN_START.test(prev.textContent)) return false;
  const m = before.match(/^[ \u00a0]((?:[^\s\u200b]+[ \u00a0]){0,2}[^\s\u200b]+)$/);       // hasta 3 palabras, la última con «\» (Program Files (x86)\Foo)
  if (!m) return false;
  const phrase = m[1].replace(/\u00a0/g, ' '), words = phrase.split(' '), lastRaw = words[words.length - 1].replace(/[.,;:!?)\]}»"'”’]+$/, '');
  if (!lastRaw.includes('\\') || lastRaw[0] === '\\' || WIN_START.test(lastRaw) || words.slice(0, -1).some(w => !w || /[\\/:*?"<>|]/.test(w) || /[.,;:!?]$/.test(w)) || /[\s/:*?"<>|]/.test(lastRaw)) return false;
  const raw = words.slice(0, -1).concat(lastRaw).join(' ');
  History.snap(true); History.mark();
  prev.textContent = prev.textContent + ' ' + raw;
  n.deleteData(0, 1 + raw.length);
  let o = off - (1 + raw.length);
  if (withSpace){ o = insertSpaceAt(n, o); if (o === n.length && !n.nextSibling) n.appendData('\u200b'); }
  const rg = document.createRange(); rg.setStart(n, o); rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg);
  return true;
}
function slashToCode(sel, withSpace){
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const n = sel.anchorNode, off = sel.anchorOffset;
  if (!n || n.nodeType !== 3 || !ed.contains(n) || closestFrom(n, '.cb,[data-code],a,code,pre')) return false;
  const before = n.nodeValue.slice(0, off), m = before.match(/(^|[\s\u200b])([^\s\u200b]+)$/);
  if (!m) return false;
  const lead = (m[2].match(/^[(\[{«"'“‘¿¡]+/) || [''])[0].length;
  let core = '', kind = '';
  const u = trimUrl(m[2].slice(lead));
  if (isUrl(u)){ core = u; kind = 'a'; }
  else { const c = chunkCore(m[2]); if (c.core && isCodeLike(c.core)){ core = c.core; kind = 'code'; } }
  if (!kind) return extendWinPath(n, off, before, withSpace, sel);
  // «Files\Git\bin» right after «C:\Program» continues that path; it is not a new relative path
  // (only for the relative rule: «.\run.bat» or «~\x» are paths of their own and never extend the previous one)
  if (kind === 'code' && core.includes('\\') && !WIN_PATH.test(core) && extendWinPath(n, off, before, withSpace, sel)) return true;
  const base = before.length - m[2].length, start = base + lead, end = start + core.length, trail = off - end;   // la puntuación del final se queda fuera
  if (slash.open) closeSlash();
  History.snap(true); History.mark();                                      // lo escrito hasta aquí es un paso; la conversión, otro (Ctrl+Z la deshace sola)
  const r = document.createRange(); r.setStart(n, start); r.setEnd(n, end);
  const el = kind === 'a' ? document.createElement('a') : makeFmtEl('code');
  if (kind === 'a') el.setAttribute('href', hrefOf(core));
  r.surroundContents(el);
  let tn = el.nextSibling, o = trail;
  if (!(tn && tn.nodeType === 3)){ tn = document.createTextNode('\u200b'); el.after(tn); o = 0; }   // texto fuera del formato donde dejar el cursor
  if (withSpace){
    o = insertSpaceAt(tn, o);
    if (o === tn.length && !tn.nextSibling) tn.appendData('\u200b');          // un espacio final no se vería y el cursor volvería al formato
  }
  const rg = document.createRange(); rg.setStart(tn, o); rg.collapse(true);
  sel.removeAllRanges(); sel.addRange(rg);
  return true;
}

// teclados que no avisan de la tecla (móvil): se atiende en beforeinput, antes de que escriba el espacio o parta el párrafo
ed.addEventListener('beforeinput', e => {
  if (!e.cancelable || e.isComposing) return;
  const s = getSelection();
  if (e.inputType === 'insertText' && e.data === ' '){ if (exitInline(s, true) || slashToCode(s, true)){ e.preventDefault(); after(); History.snap(true); } }
  else if (e.inputType === 'insertParagraph'){ if (pushDownFormat(s)){ e.preventDefault(); after(); History.snap(true); } else if (!exitInline(s, false)) slashToCode(s, false); }
  else if (e.inputType === 'insertLineBreak'){ if (!exitInline(s, false)) slashToCode(s, false); }
}, true);

