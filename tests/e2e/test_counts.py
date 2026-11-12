import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
# Status bar word counter: zero-width characters (used as caret anchors) are not words.
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
CASES = [('', 0), ('<p>​</p>', 0), ('<p>​</p><p>﻿ ​</p>', 0), ('<p>hola mundo</p>', 2),
         ('<p>​hola</p><p>​</p><p>dos tres​</p>', 3), ('<p>a ​ b</p>', 2)]
async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH); pg = await b.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    for html, want in CASES:
      got = await pg.evaluate("h => { ed.innerHTML = h || '<p><br></p>'; counts(); return document.getElementById('wc').textContent }", html)
      n = int(''.join(c for c in got if c.isdigit()) or -1)
      check(f'{html!r} -> {want} palabras', n == want, got)
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
