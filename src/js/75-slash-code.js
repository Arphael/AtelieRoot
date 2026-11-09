"use strict";
/* ====== 69. «/comando» se vuelve código en línea ====== */
// Un texto que empieza con «/» (como /clear, /compact o /plugin:comando) pasa a código en línea al terminarlo con espacio o Enter.
// No cuenta si «/» va pegada a otra cosa (y/o, 1/2, https://…), ni dentro de código, enlaces o bloques de código.
// ¿Esta palabra es un comando o una ruta? «/clear», «/plugin:cmd», «src/app», «docs/guia», «./run.sh», «~/notas»
const PATH_STOP = new Set(['and/or', 'yes/no', 'on/off', 'he/she', 'input/output', 'si/no', 'y/o', 'e/o', 'o/a', 'el/la', 'km/h', 'w/o', 'pros/cons', 'pros/contras', 'read/write']);
// Rutas de Windows: C:\Users\x, \\servidor\recurso, %APPDATA%\x, .\x, ..\x, ~\x
const WS_ = String.raw`[^\s\\/:*?"<>|]`;
const WIN_PATH = new RegExp(String.raw`^(?:[A-Za-z]:\\(?:${WS_}+\\?)*|\\\\${WS_}+(?:\\${WS_}+)+\\?|%[A-Za-z_][\w()]*%(?:\\${WS_}*)*|(?:\.{1,2}|~)\\${WS_}+(?:\\${WS_}+)*\\?)$`);
const WIN_START = /^(?:[A-Za-z]:\\|\\\\|%[A-Za-z_][\w()]*%\\)/;
const WIN_SPACED = new RegExp(String.raw`^(?:[A-Za-z]:\\|\\\\)[^\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n]*)*$`);       // con espacios dentro de los nombres (Program Files)
function isCodeLike(t){
  if (t.length < 3 || !/[A-Za-z]/.test(t)) return false;
  if (WIN_PATH.test(t)) return true;
  // relative Windows path (src-tauri\app-icon.svg, docs\adr\): needs a file extension or 2+ backslashes
  if (/^[\w.~-]+(?:\\[\w.~-]+)+\\?$/.test(t) && (/\.[A-Za-z0-9]{1,8}$/.test(t) || (t.match(/\\/g) || []).length >= 2)) return true;
  if (t[0] === '/') return /^\/[A-Za-z_](?:[\w\-:./]*[\w/])?$/.test(t);              // comando o ruta absoluta
  if (/:\/\//.test(t) || t.indexOf('/') < 0) return false;                           // URLs y palabras sin «/»
  if (!/^(?:\.{1,2}\/|~\/)?[\w.~-]+(?:\/[\w.~-]+)*\/?$/.test(t)) return false;
  const rel = /^(?:\.{1,2}\/|~\/)/.test(t), body = t.replace(/^(?:\.{1,2}\/|~\/)/, ''), segs = body.split('/').filter(Boolean);
  if (!segs.length) return false;
  if (rel) return true;                                                              // ./x, ../x, ~/x: siempre son rutas
  if (PATH_STOP.has(t.toLowerCase())) return false;                                  // pares corrientes de la prosa
  if (segs.every(s => /^[\d.]+$/.test(s))) return false;                             // 1/2, 24/7, 12/10/2026
  if (/^(?:[\w-]+\.)+[A-Za-z]{2,}$/.test(segs[0])) return false;                     // dominios: x.com/a, www.x.com/b
  const slashes = (body.match(/\//g) || []).length, dir = body.endsWith('/');
  if (slashes === 1 && !dir){
    if (segs.some(s => s.length < 2)) return false;                                  // y/o, a/b, s/n
    if (segs.every(s => /^[A-Z][A-Za-z]*$/.test(s))) return false;                  // TCP/IP, Windows/Linux
  }
  if (dir && segs.length === 1 && segs[0].length < 3) return false;
  return true;
}
// parte «de verdad» de una palabra: sin signos de apertura delante ni puntuación detrás
function chunkCore(w){
  const lead = (w.match(/^[(\[{«"'“‘¿¡]+/) || [''])[0].length;
  let e = w.length; const tm = w.slice(lead).match(/[.,;:!?)\]}»"'”’]+$/); if (tm) e -= tm[0].length;
  return { s: lead, e, core: w.slice(lead, e) };
}
// al pegar: los comandos y rutas del texto pasan a código en línea (salvo donde ya hay código, enlaces o bloques de código)
function codeifyNode(root, skipFirst, skipLast){
  const bad = n => { for (let p = n.parentNode; p && p !== root.parentNode; p = p.parentNode){ if (p.nodeType === 1 && (p.matches('pre,code,a,script,style,[data-code],.cb') )) return true; } return false; };
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (!bad(n) && n.nodeValue.trim()) nodes.push(n);
  nodes.forEach((tn, ni) => {
    const text = tn.nodeValue, chunks = [...text.matchAll(/[^\s\u200b]+/g)], frag = document.createDocumentFragment();
    let last = 0, hit = false;
    for (let ci = 0; ci < chunks.length; ci++){
      const m = chunks[ci], c = chunkCore(m[0]);
      if (!c.core || !isCodeLike(c.core)) continue;
      const a = m.index + c.s; let z = m.index + c.e, end = ci;
      if (WIN_START.test(c.core) && c.e === m[0].length){                                  // ruta de Windows con espacios (C:\Program Files (x86)\x): se une con lo que sigue si, en las 3 palabras siguientes, hay una que continúa la ruta (X\…)
        for (;;){
          let hit2 = -1, endRaw = 0, cleanEnd = true;
          for (let k = end + 1; k < chunks.length && k <= end + 3; k++){
            const nx = chunks[k], pv = chunks[k - 1], raw = nx[0].replace(/[.,;:!?)\]}»"'”’]+$/, '');
            if (nx.index - (pv.index + pv[0].length) !== 1 || text[nx.index - 1] !== ' ' || !raw || /[\s/:*?"<>|]/.test(raw) || WIN_START.test(raw)) break;      // otra ruta que empieza ahí (%VAR%\…) no es continuación
            if (raw.includes('\\')){ if (raw[0] !== '\\'){ hit2 = k; endRaw = raw.length; cleanEnd = raw.length === nx[0].length; } break; }   // una palabra que EMPIEZA con «\» (como \n) no es continuación
            if (raw.length !== nx[0].length) break;
          }
          if (hit2 < 0) break;
          z = chunks[hit2].index + endRaw; end = hit2;
          if (!cleanEnd) break;
        }
      }
      if ((skipFirst && ni === 0 && ci === 0) || (skipLast && ni === nodes.length - 1 && end === chunks.length - 1)){ ci = end; continue; }
      if (a > last) frag.appendChild(document.createTextNode(text.slice(last, a)));
      const sp = makeFmtEl('code'); sp.textContent = text.slice(a, z); frag.appendChild(sp);
      last = z; hit = true; ci = end;
    }
    if (!hit) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    tn.replaceWith(frag);
  });
}
const CMD_INSIDE = /(^|[\s\u200b(\[{«"'“‘¿¡])\/[\w\-:./]*$/;               // ¿el texto anterior acaba dentro de un «/comando»?
