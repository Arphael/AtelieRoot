"use strict";
/* ====== 24. Buscar y reemplazar ====== */
const F = { open: false, ranges: [], i: -1, cs: false };
function openFind(rep){
  const bar = $('#findBar');
  bar.classList.add('show');
  bar.classList.toggle('rep', !!rep);
  const s = getSelection();
  if (s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode) && s.toString().length < 80) $('#fq').value = s.toString();
  F.open = true;
  $('#fq').focus(); $('#fq').select();
  runFind();
}
function closeFind(){
  $('#findBar').classList.remove('show');
  F.open = false; F.ranges = []; F.i = -1;
  if (window.CSS && CSS.highlights){ CSS.highlights.delete('find'); CSS.highlights.delete('find-cur'); }
  ed.focus({ preventScroll: true });
}
function runFind(keep){
  const q = $('#fq').value;
  F.ranges = [];
  if (q){
    const nq = F.cs ? q : q.toLowerCase();
    textNodes().forEach(n => {
      const t = F.cs ? n.nodeValue : n.nodeValue.toLowerCase();
      let i = t.indexOf(nq);
      while (i >= 0){
        const r = document.createRange();
        r.setStart(n, i); r.setEnd(n, i + q.length);
        F.ranges.push(r);
        i = t.indexOf(nq, i + q.length);
      }
    });
  }
  if (!keep) F.i = F.ranges.length ? 0 : -1;
  else F.i = F.ranges.length ? Math.min(Math.max(F.i, 0), F.ranges.length - 1) : -1;
  paintFind(!keep);
}
function paintFind(scrollTo){
  $('#fcount').textContent = F.ranges.length ? (F.i + 1) + '/' + F.ranges.length : '0/0';
  if (window.CSS && CSS.highlights && window.Highlight){
    CSS.highlights.set('find', new Highlight(...F.ranges));
    if (F.i >= 0) CSS.highlights.set('find-cur', new Highlight(F.ranges[F.i]));
    else CSS.highlights.delete('find-cur');
  }
  if (scrollTo && F.i >= 0){
    unfoldFor(F.ranges[F.i].startContainer);
    const rc = F.ranges[F.i].getBoundingClientRect(), sc = scroll.getBoundingClientRect();
    if (rc.top < sc.top + 70 || rc.bottom > sc.bottom - 40) scroll.scrollTop += rc.top - sc.top - sc.height / 3;
  }
}
function stepFind(d){
  if (!F.ranges.length) return;
  F.i = (F.i + d + F.ranges.length) % F.ranges.length;
  paintFind(true);
}
function replaceOne(){
  if (F.i < 0) return;
  History.mark();
  const r = F.ranges[F.i];
  r.deleteContents();
  r.insertNode(document.createTextNode($('#fr').value));
  ed.normalize();
  after(); History.snap(true); runFind(true); paintFind(true);
}
function replaceAll(){
  if (!F.ranges.length) return;
  History.mark();
  const total = F.ranges.length;
  for (let k = F.ranges.length - 1; k >= 0; k--){
    const r = F.ranges[k];
    r.deleteContents();
    r.insertNode(document.createTextNode($('#fr').value));
  }
  ed.normalize();
  after(); History.snap(true); runFind();
  toast(T(total === 1 ? 'msg.replaced-1' : 'msg.replaced', { n: total }));
}
$('#fq').addEventListener('input', () => runFind());
$('#fq').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  if (e.key === 'Escape'){ e.preventDefault(); closeFind(); }
});
$('#fr').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); e.ctrlKey || e.metaKey ? replaceAll() : replaceOne(); }
  if (e.key === 'Escape'){ e.preventDefault(); closeFind(); }
});
$('#fnext').onclick = () => stepFind(1);
$('#fprev').onclick = () => stepFind(-1);
$('#fclose').onclick = closeFind;
$('#fcase').onclick = () => { F.cs = !F.cs; $('#fcase').classList.toggle('on', F.cs); runFind(); };
$('#frepT').onclick = () => { $('#findBar').classList.toggle('rep'); if ($('#findBar').classList.contains('rep')) $('#fr').focus(); };
$('#fr1').onclick = replaceOne;
$('#frAll').onclick = replaceAll;
$('#findBtn').onclick = () => F.open ? closeFind() : openFind(false);

