"""Large folder: 5 000 documents in 50 folders open through the local server in under the time budget,
and the content of a document is there when it is opened (also one that was never opened before)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, shutil, tempfile, time
from pathlib import Path
from playwright.async_api import async_playwright
from browser import LAUNCH, engine
ENGINES = ('chromium',)   # time budget measured on Chromium (the browsers with folder access)
import socket, subprocess

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIERROOT_APP_DIR', ROOT / 'src'))

def free_port():
  s = socket.socket(); s.bind(('127.0.0.1', 0)); n = s.getsockname()[1]; s.close(); return n

def start_server(work, port):
  proc = subprocess.Popen(['node', str(ROOT / 'server' / 'atelierroot-server.js'), '--dir', str(work), '--port', str(port), '--app', str(SRC)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
  end = time.time() + 10
  while time.time() < end:
    try: socket.create_connection(('127.0.0.1', port), timeout=0.3).close(); return proc
    except OSError: time.sleep(0.1)
  proc.kill(); raise RuntimeError('the server did not start')

N_DIRS, PER_DIR = 50, 100
BUDGET = float(os.environ.get('ATELIERROOT_LARGE_BUDGET', '4.0'))      # regression guard, seconds to a usable tree (about 1.5 s on an idle desktop; 10 s before batch reads)
fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

BODY = '\n\n'.join(['Some text with **bold**, a [link](https://example.com) and `code`.'] * 6 + ['- one\n- two\n- [ ] task', '| a | b |\n| --- | --- |\n| 1 | 2 |'])

async def main():
  tmp = Path(tempfile.mkdtemp(prefix='atelierroot-big-')); work = tmp / 'Big'
  for d in range(N_DIRS):
    (work / f'Folder {d:02}').mkdir(parents=True)
    for i in range(PER_DIR): (work / f'Folder {d:02}' / f'Note {i:03}.md').write_text(f'# Note {d}-{i}\n\n{BODY}\n', encoding='utf-8')
  port = free_port(); srv = start_server(work, port)
  try:
    async with async_playwright() as p:
      b = await engine(p).launch(**LAUNCH); pg = await b.new_page(viewport={'width': 1300, 'height': 760})
      times = []
      for run in range(2):                                    # the first run warms up the server and the disk cache
        t0 = time.time(); await pg.goto(f'http://localhost:{port}/?lang=en')
        await pg.wait_for_function("() => typeof Workspace !== 'undefined' && Workspace.active && state.tree.length >= %d && document.querySelectorAll('#tree .node, #tree [data-id]').length > 0" % N_DIRS, timeout=120000, polling=20)
        times.append(time.time() - t0)
      dt = min(times)
      print(f'open {N_DIRS * PER_DIR} documents: ' + ', '.join(f'{x:.2f}s' for x in times))
      check(f'{N_DIRS * PER_DIR} documents open in < {BUDGET:.1f}s', dt < BUDGET, f'{dt:.2f}s')
      docs = await pg.evaluate("() => { let n = 0; walk(state.tree, x => { if (x.type === 'doc') n++; }); return n }")
      check('every document is in the tree', docs == N_DIRS * PER_DIR, docs)
      text = await pg.evaluate("""async () => { let id; walk(state.tree, x => { if (x.type === 'doc' && x.name === 'Note 099' && x.path.startsWith('Folder 49')) id = x.id; });
        openDoc(id); await new Promise(r => setTimeout(r, 400)); return ed.innerText }""")
      check('a document never opened before shows its content', 'Note 49-99' in text and 'bold' in text, text[:80])
      # documents are converted lazily: one edited right after opening (before the background pass) is still saved,
      # and the ones nobody touched are not rewritten
      await pg.goto(f'http://localhost:{port}/?lang=en')
      await pg.wait_for_function("() => typeof Workspace !== 'undefined' && Workspace.active && state.tree.length >= %d" % N_DIRS, timeout=120000, polling=10)
      early = await pg.evaluate("""async () => { const lazyAtStart = Workspace.lazy ? Workspace.lazy.size : -1; let id; walk(state.tree, x => { if (x.type === 'doc' && x.name === 'Note 050' && x.path.startsWith('Folder 30')) id = x.id; });
        openDoc(id); const p = document.createElement('p'); p.textContent = 'EARLY EDIT'; ed.appendChild(p); ed.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await wsSaveNow(); return lazyAtStart }""")
      check('right after opening most documents are not converted yet', early > N_DIRS * PER_DIR - 10, early)
      on_disk = (work / 'Folder 30' / 'Note 050.md').read_text(encoding='utf-8')
      check('an edit made before the background conversion reaches the disk', 'EARLY EDIT' in on_disk, on_disk[-60:])
      untouched = (work / 'Folder 31' / 'Note 050.md').read_text(encoding='utf-8')
      check('untouched documents keep their exact bytes', untouched == f'# Note 31-50\n\n{BODY}\n', untouched[:60])
      await pg.wait_for_function("() => Workspace.lazy && Workspace.lazy.size === 0", timeout=60000)
      check('the background pass converts every document', True)
      hits = await pg.evaluate("() => { let n = 0; walk(state.tree, x => { if (x.type === 'doc' && (state.docs[x.id] || '').includes('Note 12-34')) n++; }); return n }")
      check('content of every document is searchable after the background pass', hits == 1, hits)
      await b.close()
  finally:
    srv.kill(); shutil.rmtree(tmp, ignore_errors=True)
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
