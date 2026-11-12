import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '→ ' + str(extra)))
  if not cond: fails.append(name)
async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    pg = await (await b.new_context(viewport={'width': 1300, 'height': 700})).new_page(); reqs = []; fail_reqs = []
    pg.on('pageerror', lambda e: errs.append((str(e), (e.stack or '')[:300])))
    pg.on('request', lambda r: reqs.append(r.url)); pg.on('requestfailed', lambda r: fail_reqs.append(r.url))
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    check('la página carga sin errores de JavaScript', not errs, errs)
    origin = URL.split('/', 3)[0] + '//' + URL.split('/', 3)[2]
    ext = [u for u in reqs if not u.startswith(origin) and not u.startswith('data:') and not u.startswith('blob:')]
    check('no hace ninguna petición fuera de su propio origen (nada de CDN)', not ext, ext)
    check('no falla ninguna petición', not [u for u in fail_reqs if '/api/events' not in u], fail_reqs)
    await pg.evaluate("ed.innerHTML='<div class=\"cb\" data-lang=\"vhdl\"><pre>entity x is end;</pre></div><div class=\"cb\" data-lang=\"python\"><pre>print(1)</pre></div><div class=\"cb\" data-lang=\"javascript\"><pre>let a = 1;</pre></div>'; ensureBlocks(); hlAll(true)"); await pg.wait_for_timeout(1500)
    tok = lambda i: pg.evaluate(f"ed.querySelectorAll('.cb')[{i}].querySelectorAll('.token').length")
    check('el resaltado funciona sin conexión: JavaScript (incluido en el arranque)', await tok(2) > 0, await tok(2))
    check('...Python (se carga la primera vez que se usa)', await tok(1) > 0, await tok(1))
    check('...y VHDL', await tok(0) > 0, await tok(0))
    check('lo que mostraba la página en modo temporal no rompe la carpeta de trabajo (sin servidor ni carpeta, empieza en modo temporal)', await pg.evaluate("Workspace.active === false && Workspace.status === 'off'"), await pg.evaluate("Workspace.status"))
    check('sin errores de JavaScript durante toda la prueba', not errs, errs)
    print('\nRESUMEN (carga y resaltado sin conexión):', 'todo correcto' if not fails else f'{len(fails)} fallos: {fails}')
    await b.close()
asyncio.run(main())
