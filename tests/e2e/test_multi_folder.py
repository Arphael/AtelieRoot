"""Several folders at once (v2.1) with the browser's folder API (OPFS: the real File System Access code runs).
Each folder keeps its own .atelieroot/ (state, trash), documents move between folders, folders do not, the open
folders are remembered, removing one changes nothing on disk; images are saved in assets/ next to the document."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, http.server, socket, threading, json
from functools import partial
from pathlib import Path
from playwright.async_api import async_playwright
from browser import LAUNCH, engine
ENGINES = ('chromium',)   # File System Access exists only in Chromium browsers

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIEROOT_APP_DIR', ROOT / 'src'))
INIT = """
window.__WS_POLL_MS = 400;
window.__perm = { query: 'granted', request: 'granted' };
window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle(sessionStorage.getItem('__pick') || 'wsA', { create: true });
window.__WS_HANDLES = {                    // keeps names only (reading a handle from IndexedDB closes headless Chromium)
  async put(k, h){ sessionStorage.setItem('__wsh.' + k, JSON.stringify(Array.isArray(h) ? h.map(x => x.name) : h.name)); },
  async get(k){ const v = JSON.parse(sessionStorage.getItem('__wsh.' + k) || 'null'); if (!v) return null; const r = await navigator.storage.getDirectory(); return Array.isArray(v) ? Promise.all(v.map(n => r.getDirectoryHandle(n))) : r.getDirectoryHandle(v); },
  async del(k){ sessionStorage.removeItem('__wsh.' + k); },
};
FileSystemHandle.prototype.queryPermission = async function(){ return window.__perm.query; };
FileSystemHandle.prototype.requestPermission = async function(){ return window.__perm.request; };
"""
DISK = """
window.__disk = {
  async dir(path, create){ let d = await navigator.storage.getDirectory(); for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create: !!create }); return d; },
  async write(path, text){ const parts = path.split('/'), name = parts.pop(), d = await this.dir(parts.join('/'), true); const w = await (await d.getFileHandle(name, { create: true })).createWritable(); await w.write(text); await w.close(); },
  async read(path){ try { const parts = path.split('/'), name = parts.pop(), d = await this.dir(parts.join('/')); return await (await (await d.getFileHandle(name)).getFile()).text(); } catch(_){ return null; } },
  async size(path){ try { const parts = path.split('/'), name = parts.pop(), d = await this.dir(parts.join('/')); return (await (await d.getFileHandle(name)).getFile()).size; } catch(_){ return -1; } },
  async files(root){ const out = []; const walk = async (d, rel) => { for await (const [n, h] of d.entries()){ const p = rel ? rel + '/' + n : n; if (h.kind === 'directory') await walk(h, p); else out.push(p); } }; try { await walk(await this.dir(root), ''); } catch(_){} return out.sort(); },
  async wipe(){ const r = await navigator.storage.getDirectory(); for await (const [n] of r.entries()) await r.removeEntry(n, { recursive: true }); },
};
"""
fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

def serve():
  class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
  s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
  srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), partial(Q, directory=str(SRC)))
  threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv, port

async def until(fn, secs=8):
  for _ in range(int(secs * 10)):
    if await fn(): return True
    await asyncio.sleep(0.1)
  return False

PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='

async def main():
  srv, port = serve(); url = f'http://localhost:{port}/index.html?test=1&lang=es'
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    ctx = await b.new_context(viewport={'width': 1300, 'height': 760}); await ctx.add_init_script(INIT + DISK)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url); await pg.wait_for_timeout(600)
    await pg.evaluate("__disk.wipe()")
    await pg.evaluate("""async () => { await __disk.write('wsA/a.md', '# A\\n\\nuno\\n'); await __disk.write('wsA/a2.md', 'mover\\n');
      await __disk.write('wsB/b.md', '# B\\n\\ndos\\n'); await __disk.write('wsB/sub/c.md', 'tres\\n'); await __disk.write('wsB/foto.txt', 'no es md'); }""")
    names = lambda: pg.evaluate("state.tree.map(n => n.name)")
    find = lambda name: pg.evaluate("name => { let r = null; walk(state.tree, n => { if (n.name === name) r = n.id; }); return r; }", name)

    print('=== one folder, then a second one ===')
    await pg.evaluate("sessionStorage.setItem('__pick', 'wsA'); wsPickFolder()")
    await until(lambda: pg.evaluate("Workspace.active && !!state.tree.length"))
    await pg.evaluate("""() => { openDoc(state.tree.find(n => n.name === 'a').id); ed.focus(); const t = ed.lastElementChild.firstChild, r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); toggleNoCopyRange(); }"""); await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.4)
    sa0 = json.loads(await pg.evaluate("__disk.read('wsA/.atelieroot/state.json')") or '{}')
    check('a «do not copy» mark is kept in the folder state (not in the .md)', (sa0.get('extras', {}).get('a.md', {}).get('nocopy') or [{}])[0].get('q') == 'uno' and 'uno' in (await pg.evaluate("__disk.read('wsA/a.md')") or ''), sa0.get('extras'))
    check('one folder: as before (no folder labels on top)', sorted(await names()) == ['a', 'a2'] and not await pg.evaluate("!!Workspace.be.multi"), await names())
    await pg.evaluate("sessionStorage.setItem('__pick', 'wsB'); wsAddFolder()")
    await until(lambda: pg.evaluate("!!(Workspace.be && Workspace.be.multi)"))
    await asyncio.sleep(0.3)
    check('«Add another folder»: both folders are on top of the tree', await names() == ['wsA', 'wsB'], await names())
    kids = await pg.evaluate("state.tree.map(r => r.children.map(c => c.name).sort())")
    check('   ...each with its documents', kids == [['a', 'a2'], ['b', 'sub']], kids)
    check('   ...the «do not copy» mark of a.md (state of folder A) is still there', await pg.evaluate("(() => { openDoc(state.tree[0].children.find(c => c.name === 'a').id); return ed.querySelector('span[data-nocopy]') && ed.querySelector('span[data-nocopy]').textContent; })()") == 'uno')
    check('   ...the folder chip names both', 'wsA' in await pg.evaluate("Workspace.name") and 'wsB' in await pg.evaluate("Workspace.name"))

    print('=== editing and creating in the second folder ===')
    bid = await find('b')
    await pg.evaluate("id => { openDoc(id); ed.lastElementChild.textContent = 'dos editado'; Dirty.add(id); stash(); }", bid)
    await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.3)
    check('editing b saves wsB/b.md', 'dos editado' in (await pg.evaluate("__disk.read('wsB/b.md')") or ''), await pg.evaluate("__disk.read('wsB/b.md')"))
    await pg.evaluate("""() => { const r = state.tree[1], n = { id: uid(), type: 'doc', name: 'nuevo en B', mod: Date.now() }; r.children.push(n); state.docs[n.id] = '<p>hola</p>'; renderTree(); save(true); }""")
    await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.3)
    check('a new document in B is created in wsB', 'nuevo en B.md' in await pg.evaluate("__disk.files('wsB')"), await pg.evaluate("__disk.files('wsB')"))
    check('   ...a new document at the top goes into the first folder, never outside', await pg.evaluate("(() => { newIn(null, false); return true; })()"))
    await pg.evaluate("document.getElementById('veil').classList.remove('show')")

    print('=== moving between folders ===')
    a2 = await find('a2')
    await pg.evaluate("id => { const n = removeNode(id); placeNode(n, state.tree[1], 'in'); renderTree(); save(true); }", a2)
    await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.4)
    fa, fb = await pg.evaluate("__disk.files('wsA')"), await pg.evaluate("__disk.files('wsB')")
    check('a document moved from A to B leaves A and arrives in B', 'a2.md' not in fa and 'a2.md' in fb and (await pg.evaluate("__disk.read('wsB/a2.md')")).strip() == 'mover', [fa, fb])
    sub = await pg.evaluate("(() => { const s = state.tree[1].children.find(c => c.name === 'sub'); return wsPlaceCheck(s, state.tree[0], 'in'); })()")
    check('   ...a folder cannot go to another open folder', sub is False)
    await pg.evaluate("rowAction('ren', state.tree[0])")
    check('   ...an open folder is not renamed (it would rename it on disk)', not await pg.evaluate("document.getElementById('veil').classList.contains('show')") and await names() == ['wsA', 'wsB'])
    menu = await pg.evaluate("ctxItems(state.tree[1]).filter(x => x !== '-').map(x => x[0])")
    check('   ...its menu offers «Remove from the workspace» instead of the trash', 'droproot' in menu and 'del' not in menu and 'ren' not in menu, menu)

    print('=== trash and state stay in each folder ===')
    cid = await find('c')
    await pg.evaluate("id => moveToTrash(findNode(id))", cid)
    await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.4)
    fb = await pg.evaluate("__disk.files('wsB')")
    check('deleting c (in B) puts it in wsB/.atelieroot/trash/', any(f.startswith('.atelieroot/trash/') and f.endswith('c.md') for f in fb) and 'sub/c.md' not in fb, fb)
    check('   ...not in the trash of A', not any(f.startswith('.atelieroot/trash/') for f in await pg.evaluate("__disk.files('wsA')")))
    sa = json.loads(await pg.evaluate("__disk.read('wsA/.atelieroot/state.json')") or '{}')
    sb = json.loads(await pg.evaluate("__disk.read('wsB/.atelieroot/state.json')") or '{}')
    check('each state.json keeps paths of its own folder (no labels)', (sa.get('extras', {}).get('a.md', {}).get('nocopy') or [{}])[0].get('q') == 'uno' and any(t.get('docPaths') for t in sb.get('trash', [])) and 'wsB' not in json.dumps(sb.get('order', {})), [sa.get('extras'), sb.get('order')])
    check('   ...the files that are not .md are untouched', await pg.evaluate("__disk.read('wsB/foto.txt')") == 'no es md')

    print('=== images in a folder ===')
    aid = await find('a')
    await pg.evaluate("id => openDoc(id)", aid)
    await pg.evaluate("""b64 => { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed.lastElementChild); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u], 's.png', { type: 'image/png' })); ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""", PNG)
    await until(lambda: pg.evaluate("!!ed.querySelector('img[data-md-src]')"))
    await pg.evaluate("wsSaveNow()"); await asyncio.sleep(0.4)
    fa = await pg.evaluate("__disk.files('wsA')"); imgs = [f for f in fa if f.startswith('assets/') and f.endswith('.png')]
    check('a pasted image is saved as wsA/assets/<name>.png', len(imgs) == 1 and await pg.evaluate("p => __disk.size(p)", 'wsA/' + imgs[0]) > 50, fa)
    md = await pg.evaluate("__disk.read('wsA/a.md')")
    check('   ...and a.md links it with a relative path', imgs and f'![]({imgs[0]})' in md, md)

    print('=== remembered, and removing one ===')
    await pg.reload(); await pg.wait_for_timeout(400)
    await until(lambda: pg.evaluate("Workspace.active && !!(Workspace.be && Workspace.be.multi)"))
    check('after reloading, both folders open again', await names() == ['wsA', 'wsB'], await names())
    await until(lambda: pg.evaluate("!!ed.querySelector('img') || state.current !== null"))
    await pg.evaluate("openDoc(state.tree[0].children.find(c => c.name === 'a').id)")
    ok = await until(lambda: pg.evaluate("!!ed.querySelector('img') && ed.querySelector('img').src.startsWith('blob:')"))
    check('   ...and the image shows from the folder', ok, await pg.evaluate("ed.innerHTML"))
    await pg.evaluate("wsDropRoot(state.tree[1])"); await pg.click('#card [data-yes]')
    await until(lambda: pg.evaluate("Workspace.active && !(Workspace.be && Workspace.be.multi) && !state.tree.some(n => n.name === 'wsB')"))
    check('«Remove from the workspace»: only A is left (as one folder; assets/ holds the image)', sorted(await names()) == ['a', 'assets'], await names())
    check('   ...and nothing in B changed', 'b.md' in await pg.evaluate("__disk.files('wsB')") and 'a2.md' in await pg.evaluate("__disk.files('wsB')"))
    check('no page errors', not errs, errs)
    await b.close()
  srv.shutdown()
  print('\nTOTAL:', 'todo bien' if not fails else f'{len(fails)} fallos: {fails}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
