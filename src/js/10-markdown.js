"use strict";
/* ====== 1. DOM -> Markdown ====== */
function inlineMd(node){
  let out = '';
  node.childNodes.forEach(n => {
    if (n.nodeType === 3){ out += n.nodeValue.replace(/\u00a0/g,' ').replace(/\u200b/g,''); return; }
    if (n.nodeType !== 1) return;
    const t = n.tagName, inner = inlineMd(n);
    if (t === 'BR') out += '\n';
    else if (t === 'CODE' || (t === 'SPAN' && n.hasAttribute('data-code'))) out += '`' + n.textContent.replace(/\u200b/g,'') + '`';
    else if (t === 'STRONG' || t === 'B') out += inner.trim() ? '**' + inner.trim() + '**' : inner;
    else if (t === 'EM' || t === 'I') out += inner.trim() ? '*' + inner.trim() + '*' : inner;
    else if (t === 'S' || t === 'DEL' || t === 'STRIKE') out += inner.trim() ? '~~' + inner.trim() + '~~' : inner;
    else if (t === 'A'){ const hr = n.getAttribute('href') || '', tx = n.textContent.replace(/\u200b/g, ''); out += (isUrl(tx) && hrefOf(tx) === hr) ? tx : '[' + inner + '](' + hr + ')'; }   // una dirección que se muestra a sí misma va sin corchetes
    else if (t === 'IMG') out += '![' + (n.getAttribute('alt')||'') + '](' + (n.getAttribute('src')||'') + ')';
    else out += inner;
  });
  return out;
}
function listMd(list, depth){
  const ordered = list.tagName === 'OL', pad = '  '.repeat(depth), lines = [];
  let i = ordered && Number.isFinite(list.start) ? list.start : 1;
  [...list.children].forEach(li => {
    if (li.tagName !== 'LI') return;
    const subs = [...li.children].filter(c => c.tagName === 'UL' || c.tagName === 'OL');
    const clone = li.cloneNode(true);
    [...clone.children].forEach(c => { if (c.tagName==='UL'||c.tagName==='OL') c.remove(); });
    const body = inlineMd(clone).trim();
    let marker;
    if (li.hasAttribute('data-task')) marker = (li.getAttribute('data-task') === '1' ? '[x] ' : '[ ] ');
    else marker = ordered ? olMarker(olLevelOf(list), i++) + ' ' : '- ';
    lines.push(pad + marker + body.split('\n').join('\n' + pad + ' '.repeat(marker.length)));
    subs.forEach(k => lines.push(listMd(k, depth + 1)));
  });
  return lines.join('\n');
}
function tableMd(tbl){
  const rows = [...tbl.querySelectorAll('tr')].map(tr => [...tr.children].map(c => inlineMd(c).trim().replace(/\s*\n\s*/g, '<br>').replace(/\|/g,'\\|')));
  if (!rows.length) return '';
  const head = rows[0], body = rows.slice(1);
  const aligns = [...(tbl.querySelector('tr')?.children || [])].map(c => c.getAttribute('data-a') || 'left');
  const cols = head.length, w = [];
  for (let c = 0; c < cols; c++){ let m = 3; rows.forEach(r => { if ((r[c]||'').length > m) m = r[c].length; }); w.push(m); }
  const padCell = (s, i) => {
    s = s || ''; const gap = Math.max(0, w[i] - s.length), a = aligns[i] || 'left';
    if (a === 'right') return ' '.repeat(gap) + s;
    if (a === 'center'){ const l = Math.floor(gap/2); return ' '.repeat(l) + s + ' '.repeat(gap-l); }
    return s + ' '.repeat(gap);
  };
  const line = r => '| ' + Array.from({length:cols}, (_,i) => padCell(r[i], i)).join(' | ') + ' |';
  const numCol = i => numericVals(body.map(r => r[i] || ''));
  const sepCell = i => {
    const a = aligns[i] || 'left', n = w[i];
    if (a === 'left' && numCol(i)) return ':' + '-'.repeat(Math.max(2, n - 1));            // columna de números a la izquierda a propósito: se marca para que no se mueva sola
    if (a === 'center') return ':' + '-'.repeat(Math.max(1, n - 2)) + ':';
    if (a === 'right')  return '-'.repeat(Math.max(2, n - 1)) + ':';
    return '-'.repeat(n);
  };
  const sep = '| ' + Array.from({length:cols}, (_,i) => sepCell(i)).join(' | ') + ' |';
  return [line(head), sep, ...body.map(line)].join('\n');
}
function mdFromDom(root){
  const out = [];
  [...root.children].forEach(el => {
    const t = el.tagName;
    if (/^H[1-6]$/.test(t)){
      const s = inlineMd(el).trim();
      if (s) out.push('#'.repeat(+t[1]) + ' ' + s);
    }
    else if (t === 'UL' || t === 'OL'){ const s = listMd(el, 0); if (s.trim()) out.push(s); }
    else if (t === 'BLOCKQUOTE' || (t === 'P' && el.hasAttribute('data-quote'))){
      const q = inlineMd(el).trim();
      if (q) out.push(q.split('\n').map(l => '> ' + l).join('\n'));
    }
    else if (t === 'HR') out.push('---');
    else if (t === 'TABLE') out.push(tableMd(el));
    else if (el.classList && el.classList.contains('cb')){
      const lang = el.getAttribute('data-lang') || '';
      const body = ((el.querySelector(SRC) || el.querySelector('pre') || {}).innerText || '').replace(/\n+$/,'');
      out.push('```' + lang + '\n' + body + '\n```');
    }
    else {
      const s = inlineMd(el).replace(/\u00a0/g,' ').trim();
      if (s) out.push(s);
    }
  });
  return out.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
}

/* ====== 2. Markdown -> DOM ====== */
// Un .md puede venir de cualquiera (un repositorio clonado, una descarga…): en un enlace o una imagen solo se admiten direcciones http(s), mailto, tel
// (y data:image de imágenes) o rutas sin esquema. Con «javascript:», «vbscript:», «data:text/html»… el enlace pasa a texto y la imagen a su texto alternativo.
function urlAllowed(u, isImg){
  const raw = String(u).replace(/&amp;/g, '&').replace(/[\u0000-\u0020\u00a0\u200b-\u200d\u2028\u2029\ufeff]/g, '');   // el navegador ignora espacios y controles dentro del esquema
  const m = raw.match(/^([a-z][a-z0-9+.\-]*):/i);
  if (!m) return true;
  const sch = m[1].toLowerCase();
  if (sch === 'http' || sch === 'https' || sch === 'mailto' || sch === 'tel') return true;
  return !!isImg && sch === 'data' && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw);
}
function inlineHtml(src){
  const codes = [];
  let s = esc(src).replace(/&lt;br\s*\/?&gt;/gi, '\u0002').replace(/`([^`]+)`/g, (m,c) => { codes.push(c); return '\u0001' + (codes.length-1) + '\u0001'; });
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m,a,u) => !urlAllowed(u, true) ? a : '<img alt="'+a.replace(/"/g,'&quot;')+'" src="'+u.replace(/"/g,'&quot;')+'">');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m,t,u) => !urlAllowed(u) ? t : '<a href="'+u.replace(/"/g,'&quot;')+'">'+t+'</a>');
  s = s.replace(/&lt;(https?:\/\/[^\s]*?)&gt;/gi, (m, u) => '<a href="' + u + '">' + u + '</a>');        // <https://…>
  const urlLinks = [];                                                                                  // direcciones sueltas → enlaces (protegidas del resto de formatos)
  s = s.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/g).map((part, i) => i % 2 ? part : part.replace(/(^|[\s(\[«"'“‘¿¡])((?:https?:\/\/|www\.)[^\s<]+)/gi, (m, pre, u0) => {
    const u = u0.replace(/(?:&quot;|&#39;|&gt;|&lt;)+$/, ''), t = trimUrl(u);
    if (!isUrl(t)) return m;
    urlLinks.push('<a href="' + hrefOf(t) + '">' + t + '</a>');
    return pre + '\u0003' + (urlLinks.length - 1) + '\u0003' + u0.slice(t.length);
  })).join('');
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g,'<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  s = s.replace(/~~([^~]+)~~/g,'<s>$1</s>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
  s = s.replace(/\u0001(\d+)\u0001/g, (m,i) => '<span data-code="">' + codes[+i] + '</span>');
  s = s.replace(/\u0003(\d+)\u0003/g, (m,i) => urlLinks[+i]);
  return s.replace(/\u0002/g, '<br>');
}
const alignOf = c => { const t = c.trim(); return t.startsWith(':') && t.endsWith(':') ? 'center' : t.endsWith(':') ? 'right' : 'left'; };
const splitRow = l => l.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g,'|'));
const isSepRow = l => !!l && /\|/.test(l) && /^[\s|:-]+$/.test(l.trim()) && /-/.test(l);
const isBlockStart = l => /^\s*(#{1,6}\s|>|```|([-*+•●◦▪‣∙\uF0B7]|\d+[.)])\s|\[[ xX]\]\s)/.test(l) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l) || /\|/.test(l);

function codeBlockHtml(lang, body){
  return '<div class="cb" contenteditable="false" data-lang="'+esc(lang)+'">' +
    '<div class="cb-head"><button class="cb-lang">'+ (esc(lang) || 'texto') +
    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>' +
    '<span style="flex:1"></span>' +
    '<button class="mini cb-del" title="Eliminar este bloque" aria-label="Eliminar este bloque"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6"></polyline><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path></svg></button>' +
    '<button class="mini cb-copy" title="Copiar este bloque" aria-label="Copiar este bloque"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></div>' +
    '<div class="cb-body"><pre class="cb-hl" aria-hidden="true"><code>' + esc(body) + '\n</code></pre>' +
    '<pre class="cb-src" contenteditable="true" spellcheck="false">' + esc(body) + '</pre></div></div>';
}
function tableHtml(head, aligns, body){
  const cols = head.length;
  const cell = (tag, txt, i) => '<'+tag+' data-a="'+(aligns[i]||'left')+'" style="text-align:'+(aligns[i]||'left')+'">'+(inlineHtml(txt||'') || '<br>')+'</'+tag+'>';
  const th = head.map((c,i) => cell('th', c, i)).join('');
  const rows = body.map(r => '<tr>' + Array.from({length:cols}, (_,i) => cell('td', r[i], i)).join('') + '</tr>').join('');
  return '<table><thead><tr>'+th+'</tr></thead><tbody>'+rows+'</tbody></table>';
}
function domFromMd(md){
  md = pipeRowsToTables(md);
  const lines = md.replace(/\r\n?/g,'\n').split('\n');
  const html = [], stack = [];
  let i = 0;
  const closeLists = (to = 0) => { while (stack.length > to) html.push('</li></' + stack.pop().tag + '>'); };

  while (i < lines.length){
    const raw = lines[i], line = raw.trim();

    if (/^```/.test(line)){
      const lang = line.slice(3).trim(), buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++; closeLists(); html.push(codeBlockHtml(lang, buf.join('\n'))); continue;
    }
    if (!line){ closeLists(); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h){ closeLists(); html.push('<h'+h[1].length+'>'+inlineHtml(h[2])+'</h'+h[1].length+'>'); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)){ closeLists(); html.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)){
      closeLists(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) buf.push(lines[i++].trim().replace(/^>\s?/,''));
      html.push('<p data-quote="">'+buf.map(inlineHtml).join('<br>')+'</p>'); continue;
    }

    if (line.includes('|') && isSepRow(lines[i+1])){
      closeLists();
      const head = splitRow(lines[i]), rawSep = splitRow(lines[i+1]), aligns = rawSep.map(alignOf);
      i += 2; const body = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) body.push(splitRow(lines[i++]));
      head.forEach((_, k) => { if (!/:/.test(rawSep[k] || '') && numericVals(body.map(r => r[k] || ''))) aligns[k] = 'right'; });   // columnas de números: a la derecha, salvo que se pidiera otra cosa
      html.push(tableHtml(head, aligns, body)); continue;
    }

    // nivel de esta línea según su sangría: sirven 2, 3 o 4 espacios, o tabulaciones (cada nivel se compara con el anterior)
    const ind = raw.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
    let lvlDepth = 0;
    for (let k = stack.length - 1; k >= 0; k--){ if (stack[k].ind <= ind){ lvlDepth = ind >= stack[k].ind + 2 ? k + 1 : k; break; } }
    // subniveles con letras o romanos (a. b. · i. ii. · A. B.) dentro de una lista numerada
    let rawL = raw;
    const lm = raw.match(/^([ \t]+)([A-Za-z]{1,2}|[ivxlcdm]{1,6})[.)]\s+(\S[\s\S]*)$/);
    if (lm && lvlDepth >= 1 && stack[lvlDepth - 1] && stack[lvlDepth - 1].tag === 'ol'){
      const lvl = stack.slice(0, lvlDepth).filter(x => x.tag === 'ol').length % 4;
      let val = 0;
      if (lvl === 1 && /^[a-z]{1,2}$/.test(lm[2])) val = fromAlpha(lm[2]);
      else if (lvl === 2 && /^[ivxlcdm]{1,6}$/.test(lm[2])) val = fromRoman(lm[2]);
      else if (lvl === 3 && /^[A-Z]{1,2}$/.test(lm[2])) val = fromAlpha(lm[2]);
      if (val > 0) rawL = lm[1] + val + '. ' + lm[3];
    }
    const li = rawL.match(/^(\s*)(?:([-*+•●◦▪‣∙\uF0B7]|\d+[.)])\s+)?(\[[ xX]\]\s+)?([\s\S]*)$/);
    if (li && (li[2] || li[3])){
      const depth = lvlDepth;
      const task = !!li[3];
      const ordered = !task && /\d/.test(li[2] || '');
      const tag = ordered ? 'ol' : 'ul';
      const startNum = ordered ? parseInt(li[2], 10) : 1;
      while (stack.length > depth + 1) html.push('</li></' + stack.pop().tag + '>');
      if (stack.length === depth + 1){
        if (stack[depth].tag !== tag || stack[depth].task !== task) html.push('</li></' + stack.pop().tag + '>');
        else html.push('</li>');
      }
      while (stack.length < depth + 1){
        const leaf = stack.length === depth;                   // solo la lista que recibe el elemento lleva el número inicial
        html.push('<' + tag + (task ? ' data-task=""' : '') + (leaf && ordered && startNum !== 1 ? ' start="' + startNum + '"' : '') + '>');
        stack.push({ tag, task, ind });
      }
      html.push(task
        ? '<li data-task="' + (/x/i.test(li[3]) ? '1' : '0') + '">' + inlineHtml(li[4])
        : '<li>' + inlineHtml(li[4]));
      i++; continue;
    }

    // línea sangrada sin marcador tras un elemento de lista: continúa ese elemento
    if (stack.length && /^\s+\S/.test(raw)){ html.push('<br>' + inlineHtml(line)); i++; continue; }

    closeLists();
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++].trim());
    // cada salto de línea escrito es intencional: se conserva como <br>
    html.push('<p>' + buf.map(inlineHtml).join('<br>') + '</p>');
  }
  closeLists();
  return html.join('') || '<p><br></p>';
}

/* ====== 3. Normalizador ====== */
function tidyMd(md){
  let lines = md.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').split('\n');
  let inCode = false, counters = {};
  lines = lines.map(l => {
    if (/^\s*```/.test(l)){ inCode = !inCode; return l.trim(); }
    if (inCode) return l.replace(/\s+$/,'');
    let s = l.replace(/\s+$/,'');
    if (!s.trim()){ counters = {}; return ''; }
    if (/^\s*\|/.test(s)) return s;
    s = s.replace(/^(\s*)[•●◦▪‣∙\uF0B7]\s*(?=\S)/, '$1- ');
    s = s.replace(/^(\s*)[*+]\s+/, '$1- ');
    s = s.replace(/^(\s*)-\s{2,}/, '$1- ');
    s = s.replace(/^(#{1,6})([^#\s])/, '$1 $2');
    const num = s.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (num){
      const d = num[1].length;
      counters[d] = counters[d] === undefined ? +num[2] : counters[d] + 1;     // la lista continúa desde el número con que empezó
      Object.keys(counters).forEach(k => { if (+k > d) delete counters[k]; });
      s = num[1] + counters[d] + '. ' + num[3];
    } else if (!/^\s*(-|\[[ xX]\])\s/.test(s) && !/^\s/.test(s)) counters = {};
    s = s.replace(/([^\s])[ \t]{2,}([^\s])/g, '$1 $2');
    return s;
  });
  return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

