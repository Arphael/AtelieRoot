"""Comments (only in the app): create, reply, edit, resolve, delete; they never reach the Markdown, copies or
exports; they survive reloads (temporary mode and a real folder through the local server), outside edits,
deleting the commented text (orphan) and undo."""
import os, sys, json, time, socket, subprocess, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
ENGINES = ('chromium', 'webkit')   # Firefox: synthetic key handling of contenteditable differs; see FAQ
ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIEROOT_APP_DIR', ROOT / 'src'))
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

def free_port():
  s = socket.socket(); s.bind(('127.0.0.1', 0)); n = s.getsockname()[1]; s.close(); return n
def start_server(work, port):
  proc = subprocess.Popen(['node', str(ROOT / 'server' / 'atelieroot-server.js'), '--dir', str(work), '--port', str(port), '--app', str(SRC)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
  end = time.time() + 10
  while time.time() < end:
    try: socket.create_connection(('127.0.0.1', port), timeout=0.3).close(); return proc
    except OSError: time.sleep(0.1)
  proc.kill(); raise RuntimeError('the server did not start')

SELECT = """t => { const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.data.includes(t)) break;
  const i = n.data.indexOf(t), r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length); ed.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }"""
async def comment(pg, word, text):
  await pg.evaluate(SELECT, word)
  await pg.keyboard.press('Control+/'); await pg.wait_for_timeout(150)
  await pg.keyboard.type(text); await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(150)
async def threads(pg): return await pg.evaluate("[...ed.querySelectorAll('span[data-cmt]')].map(sp => [sp.textContent, JSON.parse(sp.getAttribute('data-cmt-t')).items.map(i => i.t), !!JSON.parse(sp.getAttribute('data-cmt-t')).r])")

async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    pg = await b.new_page(viewport={'width': 1400, 'height': 860}); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    print('=== temporary mode ===')
    await pg.evaluate("() => { ed.innerHTML = '<p>El **plan** de hoy tiene <strong>tres partes</strong> claras.</p><p>Segunda línea con más texto.</p>'.replace('**plan**', 'plan'); History.init(); Dirty.add(state.current); stash(); save(true); }")
    md0 = await pg.evaluate("mdFromDom(ed)")
    # a selection that crosses into the bold text grows to the whole bold part (splitting it would change the Markdown)
    await pg.evaluate("""() => { const p = ed.firstChild, a = p.firstChild, st = p.querySelector('strong').firstChild, r = document.createRange();
      r.setStart(a, a.data.indexOf('tiene')); r.setEnd(st, 4); ed.focus(); getSelection().removeAllRanges(); getSelection().addRange(r); }""")
    await pg.keyboard.press('Control+/'); await pg.wait_for_timeout(150)
    await pg.keyboard.type('revisar el número'); await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(150)
    t = await threads(pg)
    check('Ctrl+/ comments the selection (the bold part is kept whole)', len(t) == 1 and t[0][0] == 'tiene tres partes' and t[0][1] == ['revisar el número'], t)
    check('the comments panel opens and shows it', await pg.evaluate("document.body.classList.contains('cmts-open') && document.querySelectorAll('#cmtsBody .cmt-card').length === 1"))
    check('the toolbar shows how many open comments', await pg.evaluate("document.getElementById('cmtN').textContent") == '1')
    check('the Markdown does not change', await pg.evaluate("mdFromDom(ed)") == md0, await pg.evaluate("mdFromDom(ed)"))
    out = await pg.evaluate("() => { const h = document.createElement('div'); h.innerHTML = ed.innerHTML; forOutsideHtml(h); return h.innerHTML }")
    check('copies and exports carry no comments', 'data-cmt' not in out and 'revisar' not in out and 'tres partes' in out, out[:200])
    await pg.evaluate("document.getElementById('pvBtn').click()"); await pg.wait_for_timeout(200)
    check('the live Markdown shows no comments', 'revisar' not in await pg.evaluate("document.getElementById('pvText').textContent"))
    await pg.evaluate("document.getElementById('pvBtn').click()")
    # reply, edit, resolve, reopen
    await pg.click('#cmtsBody .cmt-card .cmt-acts button:nth-child(1)')   # reply
    await pg.keyboard.type('hecho'); await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(150)
    check('reply', (await threads(pg))[0][1] == ['revisar el número', 'hecho'], await threads(pg))
    await pg.click('#cmtsBody .cmt-card .cmt-acts button:nth-child(2)')   # edit (first message)
    await pg.fill('#cmtsBody textarea', 'revisar el total'); await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(150)
    check('edit', (await threads(pg))[0][1] == ['revisar el total', 'hecho'], await threads(pg))
    await pg.click('#cmtsBody .cmt-card .cmt-acts button:nth-child(3)')   # resolve
    check('resolve: hidden from the list, counter goes to 0', (await threads(pg))[0][2] and await pg.evaluate("document.querySelectorAll('#cmtsBody .cmt-card').length === 0 && document.getElementById('cmtN').textContent === ''"))
    await pg.click('.cmt-res-toggle')
    check('   ...«show resolved» brings it back', await pg.evaluate("document.querySelectorAll('#cmtsBody .cmt-card.resolved').length") == 1)
    await pg.click('#cmtsBody .cmt-card .cmt-acts button:nth-child(3)')   # reopen
    check('reopen', not (await threads(pg))[0][2])
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
    check('undo goes back to resolved', (await threads(pg))[0][2], await threads(pg))
    await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(100)
    # orphan: delete the commented text, then undo
    await pg.evaluate("() => { const r = document.createRange(); r.selectNode(ed.querySelector('span[data-cmt]')); ed.focus(); getSelection().removeAllRanges(); getSelection().addRange(r); }")
    await pg.keyboard.press('Backspace'); await pg.wait_for_timeout(150)
    t = await threads(pg)
    check('deleting the commented text keeps the comment (without text)', len(t) == 1 and t[0][0] == '' and t[0][1] == ['revisar el total', 'hecho'], t)
    check('   ...the panel says the text was deleted', await pg.evaluate("!!document.querySelector('#cmtsBody .cmt-quote.orphan')"))
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
    t = await threads(pg)
    check('   ...undo brings the text and the comment back together (no duplicate)', len(t) == 1 and t[0][0] == 'tiene tres partes', t)
    # duplicate a line with a comment: the copy is plain text
    await pg.evaluate("() => { const n = ed.querySelector('span[data-cmt]').firstChild; const r = document.createRange(); r.setStart(ed.firstChild.firstChild, 1); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r); }")
    await pg.keyboard.press('Shift+Alt+ArrowDown'); await pg.wait_for_timeout(150)
    check('duplicating a commented line does not duplicate the comment', await pg.evaluate("ed.querySelectorAll('span[data-cmt]').length") == 1)
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
    # reload (temporary mode keeps the HTML in the browser)
    await pg.evaluate("stash(); save(true)"); await pg.wait_for_timeout(600)
    await pg.reload(); await pg.wait_for_timeout(900)
    t = await threads(pg)
    check('a reload keeps the comment (temporary mode)', len(t) == 1 and t[0][1] == ['revisar el total', 'hecho'], t)
    # remove with Ctrl+K Ctrl+U, delete from the panel
    await pg.evaluate(SELECT, 'tres')
    await pg.keyboard.press('Control+k'); await pg.keyboard.press('Control+u'); await pg.wait_for_timeout(100)
    check('Ctrl+K Ctrl+U removes the comment, the text stays', await pg.evaluate("ed.querySelectorAll('span[data-cmt]').length === 0 && ed.textContent.includes('tres partes')"))
    await comment(pg, 'Segunda', 'borrar')
    await pg.click('#cmtsBody .cmt-card .cmt-acts button:nth-child(4)'); await pg.click('#card [data-yes]'); await pg.wait_for_timeout(100)
    check('delete from the panel (after confirming)', await pg.evaluate("ed.querySelectorAll('span[data-cmt]').length") == 0)
    await pg.evaluate("() => { const s = getSelection(); s.removeAllRanges(); }")
    await pg.evaluate(SELECT, 'Segunda'); await pg.evaluate("getSelection().collapseToStart()")
    await pg.keyboard.press('Control+/'); await pg.wait_for_timeout(100)
    check('Ctrl+/ without a selection does not create anything', await pg.evaluate("ed.querySelectorAll('span[data-cmt]').length") == 0)
    await pg.evaluate("I18n.set('en')"); await pg.evaluate("openComments()")
    check('texts follow the language', 'No comments' in await pg.evaluate("document.getElementById('cmtsBody').textContent"))
    await pg.evaluate("I18n.set('es')")
    await pg.close()

    print('=== a real folder (local server) ===')
    tmp = Path(tempfile.mkdtemp(prefix='atelieroot-cmt-')); work = tmp / 'Notas'; work.mkdir()
    md = '# Informe\n\nEl presupuesto es de **mil** pesos.\n\nOtra línea.\n'
    (work / 'informe.md').write_text(md, encoding='utf-8')
    port = free_port(); srv = start_server(work, port)
    try:
      pg = await b.new_page(viewport={'width': 1400, 'height': 860}); pg.on('pageerror', lambda e: errs.append(str(e)))
      url = f'http://localhost:{port}/?lang=es'
      await pg.goto(url); await pg.wait_for_function("() => typeof Workspace !== 'undefined' && Workspace.active", timeout=20000); await pg.wait_for_timeout(400)
      await comment(pg, 'presupuesto', 'confirmar cifra')
      await pg.evaluate("wsSaveNow()"); await pg.wait_for_timeout(300)
      check('the .md keeps its exact bytes', (work / 'informe.md').read_text(encoding='utf-8') == md)
      meta = json.loads((work / '.atelieroot' / 'state.json').read_text(encoding='utf-8'))
      cm = meta.get('extras', {}).get('informe.md', {}).get('cmts', [])
      check('the comment is stored in .atelieroot/state.json', len(cm) == 1 and cm[0]['q'] == 'presupuesto' and 'confirmar cifra' in cm[0]['t'], meta.get('extras'))
      await pg.reload(); await pg.wait_for_function("() => typeof Workspace !== 'undefined' && Workspace.active", timeout=20000); await pg.wait_for_timeout(400)
      t = await threads(pg)
      check('after a reload the comment is back on its text', len(t) == 1 and t[0][0] == 'presupuesto' and t[0][1] == ['confirmar cifra'], t)
      (work / 'informe.md').write_text('# Informe\n\nIntro nueva.\n\nEl presupuesto es de **mil** pesos.\n\nOtra línea.\n', encoding='utf-8')
      await pg.wait_for_timeout(2500)
      t = await threads(pg)
      check('an outside edit elsewhere keeps the comment on its text', len(t) == 1 and t[0][0] == 'presupuesto', t)
      (work / 'informe.md').write_text('# Informe\n\nTodo cambió.\n', encoding='utf-8')
      await pg.wait_for_timeout(2500)
      t = await threads(pg)
      check('an outside edit that removes the text keeps the comment (without text)', len(t) == 1 and t[0][0] == '' and t[0][1] == ['confirmar cifra'], t)
      await pg.close()
    finally:
      srv.kill(); shutil.rmtree(tmp, ignore_errors=True)
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
