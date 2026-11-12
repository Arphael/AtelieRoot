"use strict";
/* ====== 9. Teclado ====== */
ed.addEventListener('keydown', e => {
  const sel = getSelection();
  if ((e.ctrlKey || e.metaKey) && !e.altKey){
    const k = e.key.toLowerCase();
    if (k === 'z'){ e.preventDefault(); e.shiftKey ? History.redo() : History.undo(); return; }
    if (k === 'y'){ e.preventDefault(); History.redo(); return; }
    if (k === 'b'){ e.preventDefault(); toggleWrap('strong'); return; }
    if (k === 'i'){ e.preventDefault(); toggleWrap('em'); return; }
    if (k === 'e'){ e.preventDefault(); toggleWrap('code'); return; }
    if (k === 'x' && e.shiftKey){ e.preventDefault(); toggleWrap('s'); return; }
    if (k === 'k' && !e.shiftKey){ e.preventDefault(); $('#linkBtn').click(); return; }   // normally Ctrl+K is a prefix (78-shortcuts.js)
    if (k === 's'){ e.preventDefault(); stash(); save(true); toast(T('msg.saved')); return; }
  }
  if (slash.open && slashMenu.classList.contains('show')){
    if (e.key === 'ArrowDown'){ e.preventDefault(); slash.i = (slash.i + 1) % slash.items.length; paintSlash(slashQuery() || ''); return; }
    if (e.key === 'ArrowUp'){ e.preventDefault(); slash.i = (slash.i - 1 + slash.items.length) % slash.items.length; paintSlash(slashQuery() || ''); return; }
    if (e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); applySlash(); return; }
    if (e.key === 'Escape'){ e.preventDefault(); closeSlash(); return; }
  }
  const inCb = closestFrom(sel.anchorNode, '.cb');
  if (inCb){
    if (e.key === 'Enter'){ e.preventDefault(); insertCodeText(sel, '\n'); return; }
    if (e.key === 'Tab'){ e.preventDefault(); insertCodeText(sel, '  '); return; }
    if (e.key === 'Backspace' || e.key.length === 1) autoPair(e, sel);
    return;
  }
  if (autoPair(e, sel)) return;

  const li = closestFrom(sel.anchorNode, 'li');
  const cell = closestFrom(sel.anchorNode, 'td,th');
  if (cell && tableKeys(e, sel)) return;
  if (!e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && sel.isCollapsed){
    if (e.key === ' '){ if (exitInline(sel, true) || slashToCode(sel, true)){ e.preventDefault(); after(); History.snap(true); return; } }
    else if (e.key === 'Enter'){ if (!exitInline(sel, false)) slashToCode(sel, false); }     // se convierte y el Enter sigue su camino
  }

  if (e.key === 'Backspace' && sel.isCollapsed){
    const zn = sel.anchorNode, zo = sel.anchorOffset;
    if (zn && zn.nodeType === 3 && zo > 0 && zn.previousSibling && !closestFrom(zn, '.cb') && !zn.nodeValue.slice(0, zo).replace(/\u200b/g, '')){
      e.preventDefault(); History.mark();
      zn.nodeValue = zn.nodeValue.slice(zo);
      const zr = document.createRange(); zr.setStart(zn, 0); zr.collapse(true); sel.removeAllRanges(); sel.addRange(zr);
      document.execCommand('delete');
      after(); History.snap(true); return;
    }
  }

  // Retroceso al inicio de un elemento, encabezado o cita: quita su formato de bloque
  if (e.key === 'Backspace' && sel.isCollapsed && !cell){
    const host = li || currentBlock();
    if (host && (li || /^(H[1-6]|BLOCKQUOTE)$/.test(host.tagName) || (host.tagName === 'P' && host.hasAttribute('data-quote')))){
      const r0 = sel.getRangeAt(0);
      const pre0 = document.createRange();
      pre0.selectNodeContents(host);
      try { pre0.setEnd(r0.startContainer, r0.startOffset); } catch(_){ pre0.collapse(true); }
      const frag0 = pre0.cloneContents();
      const atStart = !pre0.toString().replace(/\u200b/g, '').length && !frag0.querySelector('br,img');
      if (atStart){
        e.preventDefault(); History.mark();
        if (li){
          const up = li.parentElement.parentElement;
          const emptyLi = !li.textContent.replace(/\u200b/g, '').trim() && !li.querySelector('img,ul,ol,table');
          const nxt = li.nextElementSibling, prv = li.previousElementSibling;
          if (emptyLi && nxt && nxt.tagName === 'LI'){                         // punto vacío con otros debajo: se quita sin partir la lista
            li.remove();
            if (prv && prv.tagName === 'LI') caretEndOwn(prv); else caretStartOwn(nxt);
          }
          else if (up && up.tagName === 'LI') outdent(li);
          else caretInto(splitOut(li));
        } else if (host.tagName === 'P'){
          host.removeAttribute('data-quote'); caretInto(host);
        } else {
          const nodes = replaceBlock(host, '<p>' + (host.innerHTML || '<br>') + '</p>');
          caretInto(nodes[0]);
        }
        after(); History.snap(true); refreshBar(); return;
      }
    }
  }

  if (e.key === 'Tab'){
    e.preventDefault();
    if (cell){
      const cells = [...cell.closest('table').querySelectorAll('th,td')];
      const i = cells.indexOf(cell) + (e.shiftKey ? -1 : 1);
      if (i >= 0 && i < cells.length) caretInto(cells[i]);
      else if (!e.shiftKey){ History.mark(); caretInto(addRow(cell.closest('table')).firstElementChild); History.snap(true); }
      return;
    }
    if (li){ History.mark(); e.shiftKey ? outdent(li) : indent(li); after(); History.snap(true); return; }
    document.execCommand('insertText', false, '  ');
    return;
  }

  if (e.key === ' ' && sel.isCollapsed && !e.ctrlKey && !e.metaKey && !e.altKey && codeDoubleSpace(sel)){
    e.preventDefault(); after(); History.snap(true); return;
  }

  if (e.key === ' ' && sel.isCollapsed && !cell){
    liftLineShortcut(sel, li);
    const block = currentBlock();
    const host = li || block;
    if (!host) return;
    const r = sel.getRangeAt(0);
    const pre = document.createRange();
    pre.selectNodeContents(host);
    try { pre.setEnd(r.startContainer, r.startOffset); } catch(_){ return; }
    let txt = pre.toString().replace(/\u200b/g, '');
    // spaces typed before a shortcut ("   * ") are ignored; next to a list they set the nesting level
    const lead = (txt.match(/^[ \u00a0\t]+/) || [''])[0].replace(/\t/g, '  ').length;
    txt = txt.replace(/^[ \u00a0\t]+/, '');
    const nx = document.createRange();
    nx.selectNodeContents(host); nx.setStart(r.startContainer, r.startOffset);
    // «[x» + space with the auto-closed «]» → checked task; «[» + space is the start of «[ ]», so the space goes inside
    const paired = /^\[[xX]$/.test(txt) && nx.toString().replace(/\u200b/g, '')[0] === ']';
    if (paired) txt += ']';
    const restHtml = () => {
      const a = document.createRange();
      a.selectNodeContents(host); a.setStart(r.startContainer, r.startOffset);
      const d = document.createElement('div'); d.appendChild(a.cloneContents());
      return (paired ? d.innerHTML.replace(/^\]/, '') : d.innerHTML).replace(/^(?:<br\s*\/?>)+/i, '');
    };
    if (li){
      const list0 = li.parentElement;
      if (list0 && list0.tagName === 'OL' && /^[-*+•●◦▪‣∙\uF0B7]$/.test(txt)){          // «* » en un punto numerado → viñeta
        e.preventDefault(); History.mark(); convertListItem(li, 'ul', 1, restHtml()); after(); History.snap(true); return;
      }
      if (list0 && list0.tagName === 'UL' && /^\d+[.)]$/.test(txt)){                     // «1. » en un punto de viñetas → numerado
        e.preventDefault(); History.mark(); convertListItem(li, 'ol', parseInt(txt, 10), restHtml()); after(); History.snap(true); return;
      }
      if (/^\[[ xX]?\]$/.test(txt)){
        e.preventDefault(); History.mark();
        const list = li.closest('ul,ol');
        li.setAttribute('data-task', /x/i.test(txt) ? '1' : '0');
        if (list.tagName === 'UL') list.setAttribute('data-task','');
        li.innerHTML = restHtml() || '<br>';
        caretInto(li, true); after(); History.snap(true);
      }
      return;
    }
    let m;
    if ((m = txt.match(/^(#{1,6})$/))){ e.preventDefault(); History.mark(); shortcutBlock(block, '<h'+m[1].length+'>'+(restHtml()||'<br>')+'</h'+m[1].length+'>'); after(); History.snap(true); refreshBar(); return; }
    if (/^[-*+•●◦▪‣∙\uF0B7]$/.test(txt)){ e.preventDefault(); History.mark(); shortcutBlock(block, '<ul><li>'+(restHtml()||'<br>')+'</li></ul>'); nestByLead(lead); after(); History.snap(true); return; }
    if (/^\d+[.)]$/.test(txt)){
      e.preventDefault(); History.mark();
      // la lista empieza en el número que escribes; si ese número continúa justo la lista anterior, queda conectada a ella
      const typed = parseInt(txt, 10), prev = prevOlInScope(block);
      const cont = !!prev && typed !== 1 && typed === olLast(prev) + 1;
      shortcutBlock(block, '<ol' + (typed !== 1 ? ' start="' + typed + '"' : '') + (cont ? ' data-cont=""' : '') + '><li>'+(restHtml()||'<br>')+'</li></ol>');
      nestByLead(lead); after(); History.snap(true); return;
    }
    if (/^\[[ xX]?\]$/.test(txt)){ e.preventDefault(); History.mark(); shortcutBlock(block, '<ul data-task=""><li data-task="'+(/x/i.test(txt)?'1':'0')+'">'+(restHtml()||'<br>')+'</li></ul>'); nestByLead(lead); after(); History.snap(true); return; }
    const quoteDq = txt === '"';
    if (txt === '>' || quoteDq){
      e.preventDefault(); History.mark();
      let rest = restHtml() || '';
      const nt = nx.toString().replace(/\u200b/g, '');
      if (quoteDq && nt[0] === '"' && (nt.length === 1 || /[\s)\]}.,;:!?]/.test(nt[1]))) rest = rest.replace(/^"/, '');   // solo la comilla de cierre añadida sola
      shortcutBlock(block, '<p data-quote="">' + (rest.replace(/<[^>]*>|\u200b/g,'').trim() ? rest : '<br>') + '</p>');
      after(); History.snap(true); return;
    }
    return;
  }

  if (e.key === 'Enter' && e.shiftKey && li){
    e.preventDefault(); History.mark();
    insertBreak(li, sel);
    after(); History.snap(true); return;
  }
  if (e.key === 'Enter' && e.shiftKey && !li && !cell && !e.isComposing){
    const pb = currentBlock();
    if (pb && /^H[1-6]$/.test(pb.tagName)){ e.preventDefault(); History.mark(); splitHeadingAtCaret(pb, sel); after(); History.snap(true); return; }
    if (pb && pb.tagName === 'P'){ e.preventDefault(); History.mark(); insertBreak(pb, sel); after(); History.snap(true); return; }
  }

  if (e.key === 'Enter'){
    if (!e.shiftKey && !e.isComposing && sel.isCollapsed && hrBelowFormat(sel)){ e.preventDefault(); after(); History.snap(true); refreshBar(); return; }
    if (!e.shiftKey && !e.isComposing && sel.isCollapsed && pushDownFormat(sel)){ e.preventDefault(); after(); History.snap(true); refreshBar(); return; }
    const block = currentBlock();
    if (block && block.hasAttribute && block.hasAttribute('data-fold')){ block.removeAttribute('data-fold'); applyFolds(); }
    if (block && block.tagName === 'P' && !li){
      const fm = block.textContent.replace(/\u200b/g, '').trim().match(/^```\s*([\w+#.-]*)$/);
      if (fm){
        e.preventDefault(); History.mark();
        const nodes = replaceBlock(block, codeBlockHtml(fm[1], '') + '<p><br></p>');
        caretInto(nodes[0].querySelector(SRC));
        after(); History.snap(true); return;
      }
    }
    if (li && !li.textContent.trim()){
      e.preventDefault(); History.mark();
      const nested = li.closest('ul,ol').parentElement;
      if (nested && nested.tagName === 'LI') outdent(li);
      else caretInto(splitOut(li));
      after(); History.snap(true); return;
    }
    if (block && (block.tagName === 'BLOCKQUOTE' || block.hasAttribute('data-quote')) && !block.textContent.replace(/\u200b/g,'').trim()){
      e.preventDefault(); History.mark();
      replaceBlock(block, '<p><br></p>'); after(); History.snap(true); return;
    }
    // En párrafos: un Enter = salto de línea; dos Enter = párrafo nuevo, esté donde esté el cursor
    if (block && block.tagName === 'P' && !li && !cell && !e.shiftKey && !e.isComposing){
      e.preventDefault();
      if (hrOnEnter(block, sel) || quoteOnEnter(sel)){ after(); History.snap(true); refreshBar(); return; }
      paraEnter(block, sel);
      after(); History.snap(true); refreshBar(); return;
    }
    // Enter al final de un punto de lista o de un encabezado: la línea nueva empieza sin formato
    if (!e.shiftKey && !e.isComposing && !cell && sel.isCollapsed && sel.rangeCount){
      const rr = sel.getRangeAt(0);
      if (li && !li.querySelector('ul,ol') && caretAtEnd(li, rr)){
        e.preventDefault(); History.mark();
        const nli = document.createElement('li');
        if (li.hasAttribute('data-task')) nli.setAttribute('data-task', '0');
        nli.innerHTML = '<br>';
        li.after(nli); caretInto(nli);
        after(); History.snap(true); refreshBar(); return;
      }
      if (!li && block && /^H[1-6]$/.test(block.tagName) && caretAtEnd(block, rr)){
        e.preventDefault(); History.mark();
        const np = document.createElement('p'); np.innerHTML = '<br>';
        block.after(np); caretInto(np);
        after(); History.snap(true); refreshBar(); return;
      }
    }
    setTimeout(() => { ensureBlocks(); plainEmptyBlock(); after(); refreshBar(); }, 0);
  }
});
// a list item created after leading spaces joins the list right above it, 2 spaces = 1 level deeper
function nestByLead(lead){
  const levels = Math.floor(lead / 2);
  if (!levels) return;
  const s = getSelection();
  let li = s.rangeCount ? closestFrom(s.anchorNode, 'li') : null;
  const list = li && li.parentElement, prev = list && list.previousElementSibling;
  if (!prev || prev.tagName !== list.tagName || prev.hasAttribute('data-task') !== list.hasAttribute('data-task')) return;
  while (list.firstChild) prev.appendChild(list.firstChild);
  list.remove();
  for (let i = 0; i < levels && li.previousElementSibling && li.previousElementSibling.tagName === 'LI'; i++) indent(li);
  caretInto(li, false);
}
function indent(li){
  const prev = li.previousElementSibling;
  if (!prev || prev.tagName !== 'LI') return toast(T('msg.need-item-above'));
  const list = li.closest('ul,ol');
  let sub = [...prev.children].find(c => c.tagName === 'UL' || c.tagName === 'OL');
  if (!sub){
    sub = document.createElement(list.tagName.toLowerCase());
    if (list.hasAttribute('data-task')) sub.setAttribute('data-task','');
    prev.appendChild(sub);
  }
  sub.appendChild(li); caretInto(li, true);
}
function outdent(li){
  const list = li.closest('ul,ol');
  const parentLi = list.parentElement && list.parentElement.tagName === 'LI' ? list.parentElement : null;
  if (!parentLi){ caretInto(splitOut(li), true); return; }
  // los elementos que venían debajo pasan a ser hijos del que sale
  const following = [];
  let nx = li.nextElementSibling;
  while (nx){ following.push(nx); nx = nx.nextElementSibling; }
  if (following.length){
    const sub = list.cloneNode(false);
    following.forEach(x => sub.appendChild(x));
    li.appendChild(sub);
  }
  parentLi.parentElement.insertBefore(li, parentLi.nextSibling);
  if (!list.children.length) list.remove();
  caretInto(li, true);
}
function runInline(){
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed) return;
  if (closestFrom(s.anchorNode, '.cb')) return;
  const node = s.anchorNode;
  if (!node || node.nodeType !== 3) return;
  const off = s.anchorOffset, text = node.nodeValue.slice(0, off);
  const rules = [
    [/\*\*\*([^*]+)\*\*\*$/, m => '<strong><em>'+esc(m[1])+'</em></strong>'],
    [/\*\*([^*]+)\*\*$/,     m => '<strong>'+esc(m[1])+'</strong>'],
    [/__([^_]+)__$/,         m => '<strong>'+esc(m[1])+'</strong>'],
    [/~~([^~]+)~~$/,         m => '<s>'+esc(m[1])+'</s>'],
    [/`([^`]+)`$/,           m => '<span data-code="">'+esc(m[1])+'</span>'],
    [/(?<!\*)\*([^*\s][^*]*)\*$/,   m => '<em>'+esc(m[1])+'</em>'],        // un asterisco pegado a otro es el inicio de una negrita, no de una cursiva
    [/\[([^\]]+)\]\(([^)\s]+)\)$/, m => '<a href="'+m[2].replace(/"/g,'&quot;')+'">'+esc(m[1])+'</a>']
  ];
  for (const [re, make] of rules){
    const m = text.match(re); if (!m) continue;
    if (re === rules[2][0] && CMD_INSIDE.test(text.slice(0, off - m[0].length))) continue;     // __ dentro de /mcp__servidor__comando no es negrita
    const r = document.createRange();
    r.setStart(node, off - m[0].length); r.setEnd(node, off);
    r.deleteContents();
    const holder = document.createElement('div'); holder.innerHTML = make(m);
    const el = holder.firstChild;
    r.insertNode(el);
    const tail = document.createTextNode('\u200b');
    el.parentNode.insertBefore(tail, el.nextSibling);
    const rr = document.createRange(); rr.setStart(tail, 1); rr.collapse(true);
    const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(rr);
    return;
  }
}

