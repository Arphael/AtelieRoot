"""v2.2 with a real folder (dev server): images of v2.1 (assets/ next to the document) move to .atelieroot/assets/
when the folder opens, links are rewritten and nothing else in the .md changes; a new image goes to the same place."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, base64, shutil, tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from browser import LAUNCH, engine
import socket, subprocess, time
ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIEROOT_APP_DIR', ROOT / 'src'))
def free_port():
  s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def start_server(work, port):
  env = dict(os.environ, ATELIEROOT_NO_REVEAL='1')
  proc = subprocess.Popen(['node', str(ROOT / 'server' / 'atelieroot-server.js'), '--dir', str(work), '--port', str(port), '--app', str(SRC)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
  end = time.time() + 10
  while time.time() < end:
    try: socket.create_connection(('127.0.0.1', port), timeout=0.3).close(); return proc
    except OSError: time.sleep(0.1)
  proc.kill(); raise RuntimeError('server did not start')
fails = []; errs = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==')

async def main():
  tmp = Path(tempfile.mkdtemp(prefix='atelieroot-img-')); work = tmp / 'Notas'
  (work / 'notas' / 'assets').mkdir(parents=True); (work / 'otra' / 'assets').mkdir(parents=True)
  ideas = '# Ideas\n\nAntes ![](assets/a.png) y <img src="assets/b.png" alt="" width="10">\n\nUna línea con `assets/a.png` en código.\n'
  (work / 'notas' / 'ideas.md').write_text(ideas, encoding='utf-8')
  (work / 'notas' / 'assets' / 'a.png').write_bytes(PNG); (work / 'notas' / 'assets' / 'b.png').write_bytes(PNG)
  (work / 'otra' / 'doc.md').write_text('![](assets/c.png)\n', encoding='utf-8')
  (work / 'otra' / 'assets' / 'c.png').write_bytes(PNG); (work / 'otra' / 'assets' / 'suelta.png').write_bytes(PNG)
  port = free_port(); srv = start_server(work, port)
  try:
    async with async_playwright() as p:
      b = await engine(p).launch(**LAUNCH); pg = await b.new_page()
      pg.on('pageerror', lambda e: errs.append(str(e)))
      await pg.goto(f'http://localhost:{port}/?lang=es'); await pg.wait_for_timeout(1500)
      check('the folder opens', await pg.evaluate("Workspace.active"))
      text = (work / 'notas' / 'ideas.md').read_text(encoding='utf-8')
      check('the links now point to .atelieroot/assets/notas/ (Markdown and <img>)', '![](../.atelieroot/assets/notas/a.png)' in text and 'src="../.atelieroot/assets/notas/b.png"' in text, text)
      check('   ...and nothing else in the document changed', text.replace('../.atelieroot/assets/notas/', 'assets/') == ideas, text)
      check('the images moved there', (work / '.atelieroot' / 'assets' / 'notas' / 'a.png').is_file() and (work / '.atelieroot' / 'assets' / 'notas' / 'b.png').is_file())
      check('   ...and the empty assets/ folder is gone', not (work / 'notas' / 'assets').exists())
      check('an assets/ folder with other files stays, with them', (work / 'otra' / 'assets' / 'suelta.png').is_file() and (work / '.atelieroot' / 'assets' / 'otra' / 'c.png').is_file())
      await pg.evaluate("(() => { let id; walk(state.tree, n => { if (n.name === 'ideas') id = n.id; }); openDoc(id); })()")
      ok = False
      for _ in range(30):
        ok = await pg.evaluate("[...ed.querySelectorAll('img')].length === 2 && [...ed.querySelectorAll('img')].every(i => (i.src || '').startsWith('blob:'))")
        if ok: break
        await pg.wait_for_timeout(100)
      check('the document shows both images from their new place', ok, await pg.evaluate("[...ed.querySelectorAll('img')].map(i => [i.getAttribute('data-md-src'), (i.src || '').slice(0, 5)])"))
      await pg.evaluate("""async () => { const s = getSelection(), r = document.createRange(); r.selectNodeContents(ed.querySelector('h1')); r.collapse(false); s.removeAllRanges(); s.addRange(r);
        const c = document.createElement('canvas'); c.width = 3; c.height = 3; const bl = await new Promise(x => c.toBlob(x, 'image/png'));
        await insertImages([new File([bl], 'n.png', { type: 'image/png' })], r); }""")
      await pg.wait_for_timeout(300); await pg.evaluate("wsSaveNow()"); await pg.wait_for_timeout(500)
      new = [f for f in (work / '.atelieroot' / 'assets' / 'notas').iterdir() if f.name.startswith('ideas-')]
      text = (work / 'notas' / 'ideas.md').read_text(encoding='utf-8')
      check('a new image goes to .atelieroot/assets/notas/ and the .md links it from its folder', len(new) == 1 and ('../.atelieroot/assets/notas/' + new[0].name) in text, [new, text])
      if engine(p).name == 'chromium':
        await pg.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        await pg.evaluate("document.getElementById('copyMd').click()"); await pg.wait_for_timeout(800)
        clip = await pg.evaluate("navigator.clipboard.readText()")
        full = str(work / '.atelieroot' / 'assets' / 'notas' / 'a.png')
        check('«Copy Markdown» gives the text with the full path of each image (Claude Code opens them itself)', '# Ideas' in clip and ('](<' + full + '>)') in clip and ('<' + str(work / '.atelieroot' / 'assets' / 'notas' / new[0].name) + '>') in clip and 'src="<' not in clip, clip)
        check('   ...the document itself still keeps relative links', '../.atelieroot/assets/notas/a.png' in (work / 'notas' / 'ideas.md').read_text(encoding='utf-8'))
      print('=== images no document uses go to the trash ===')
      newimg = work / '.atelieroot' / 'assets' / 'notas' / new[0].name
      await pg.evaluate("(() => { window.__withImg = ed.innerHTML; const im = [...ed.querySelectorAll('img')].find(i => i.getAttribute('data-md-src').includes('ideas-')); History.mark(); im.remove(); after(); History.snap(true); })()")
      await pg.evaluate("wsSaveNow()"); await pg.wait_for_timeout(5500)
      check('right after deleting it the file stays (Ctrl+Z can still bring it back)', newimg.is_file())
      await pg.evaluate("(() => { let id; walk(state.tree, n => { if (n.name === 'doc') id = n.id; }); openDoc(id); })()")
      await pg.evaluate("wsSaveNow()")
      gone = False
      for _ in range(40):
        if not newimg.exists(): gone = True; break
        await pg.wait_for_timeout(250)
      trashed = list((work / '.atelieroot' / 'trash' / 'images' / 'notas').glob(new[0].stem + '~*.png')) if (work / '.atelieroot' / 'trash' / 'images' / 'notas').exists() else []
      check('after switching documents it moves to the trash (.atelieroot/trash/images/)', gone and len(trashed) == 1, [gone, trashed])
      check('   ...images still used stay (a.png, b.png, c.png)', all((work / '.atelieroot' / 'assets' / d / f).is_file() for d, f in [('notas', 'a.png'), ('notas', 'b.png'), ('otra', 'c.png')]))
      check('   ...and files outside .atelieroot/assets/ are never touched', (work / 'otra' / 'assets' / 'suelta.png').is_file())
      await pg.evaluate("(() => { let id; walk(state.tree, n => { if (n.name === 'ideas') id = n.id; }); openDoc(id); })()"); await pg.wait_for_timeout(200)
      await pg.evaluate("(() => { ed.innerHTML = window.__withImg; after(); })()"); await pg.wait_for_timeout(1500)   # what Ctrl+Z does: the old HTML comes back
      back = await pg.evaluate("(() => { const im = [...ed.querySelectorAll('img')].find(i => (i.getAttribute('data-md-src') || '').includes('ideas-')); return im ? (im.src || '').slice(0, 5) : null; })()")
      check('undoing after that (the <img> comes back) brings its file back from the trash', back == 'blob:' and newimg.is_file(), [back, newimg.is_file()])
      check('no page errors', not errs, errs)
      await b.close()
  finally:
    srv.kill(); shutil.rmtree(tmp, ignore_errors=True)
  print('\nTOTAL:', 'todo bien' if not fails else f'{len(fails)} fallos: {fails}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
