"""v2.0 renamed AtelierRoot to AtelieRoot: browser settings (atelierroot.* -> atelieroot.*) and the hidden folder
of a working folder (.atelierroot/ -> .atelieroot/, opened with folder access) move over by themselves,
keeping the language, the comments and the rest of the state."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
import re
# the folder-access stubs of test_workspace_fs (read, not imported: importing a test runs it)
INIT = re.search(r'^INIT = """(.*?)"""', open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_workspace_fs.py'), encoding='utf-8').read(), re.S | re.M).group(1)
ENGINES = ('chromium',)   # the folder part needs File System Access
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

STATE = json.dumps({ 'v': 1, 'order': {}, 'open': [], 'fills': {}, 'trash': [], 'current': 'plan.md',
  'extras': { 'plan.md': { 'cmts': [{ 'id': 'c1', 'b': 1, 's': 3, 'q': 'presupuesto', 't': json.dumps({ 'r': 0, 'items': [{ 'd': 1, 't': 'de v1' }] }) }] } } })

async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    print('=== browser settings ===')
    # a browser that only ever ran v1: the old key exists before the app starts
    c0 = await b.new_context()
    await c0.add_init_script("if (!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('atelierroot.ui', JSON.stringify({ lang: 'en', noWrap: true })); }")
    pg = await c0.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    plain = URL.replace('&lang=es', '').replace('?lang=es', '')
    await pg.goto(plain); await pg.wait_for_timeout(700)
    got = await pg.evaluate("[localStorage.getItem('atelierroot.ui'), JSON.parse(localStorage.getItem('atelieroot.ui') || '{}').lang, document.documentElement.lang, document.body.classList.contains('no-wrap')]")
    check('old settings move to the new keys and keep working', got == [None, 'en', 'en', True], got)
    await c0.close()

    print('=== hidden folder (File System Access) ===')
    ctx = await b.new_context(); await ctx.add_init_script(INIT); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    app = URL.split('index.html')[0] + 'index.html?lang=es'
    await pg.goto(app); await pg.wait_for_timeout(400)
    await pg.evaluate("""async st => { const root = await navigator.storage.getDirectory();
      try { await root.removeEntry('ws', { recursive: true }); } catch(_){}
      const ws = await root.getDirectoryHandle('ws', { create: true });
      const w = async (dir, name, text) => { const f = await dir.getFileHandle(name, { create: true }); const x = await f.createWritable(); await x.write(text); await x.close(); };
      await w(ws, 'plan.md', '# Plan\\n\\nEl presupuesto sube.\\n');
      const old = await ws.getDirectoryHandle('.atelierroot', { create: true });
      await w(old, 'state.json', st); await w(await old.getDirectoryHandle('trash', { create: true }), 'x.txt', 'papelera');
      sessionStorage.setItem('__wsh.last', 'ws'); }""", STATE)
    await pg.reload(); await pg.wait_for_function("() => typeof Workspace !== 'undefined' && Workspace.active", timeout=20000); await pg.wait_for_timeout(500)
    got = await pg.evaluate("""async () => { const ws = await (await navigator.storage.getDirectory()).getDirectoryHandle('ws'); const names = []; for await (const [n] of ws.entries()) names.push(n);
      let trash = false; try { await (await (await ws.getDirectoryHandle('.atelieroot')).getDirectoryHandle('trash')).getFileHandle('x.txt'); trash = true; } catch(_){}
      return [names.sort(), trash]; }""")
    check('.atelierroot/ becomes .atelieroot/ with everything inside', got[0] == ['.atelieroot', 'plan.md'] and got[1], got)
    t = await pg.evaluate("[...ed.querySelectorAll('span[data-cmt]')].map(sp => [sp.textContent, JSON.parse(sp.getAttribute('data-cmt-t')).items[0].t])")
    check('the state of v1 is kept (a comment on its text)', t == [['presupuesto', 'de v1']], t)
    await ctx.close()
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
