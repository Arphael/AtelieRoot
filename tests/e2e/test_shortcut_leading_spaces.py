import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH
# Block shortcuts typed after leading spaces ("   * ") still apply; next to a list the spaces set the level.
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
P = '<p><br></p>'
LAST = "caretInto(ed.lastElementChild, true)"
SCEN = [
 ('spaces + * -> bullet', P, '   * X', '<ul><li>X</li></ul>'),
 ('spaces + - -> bullet', P, '  - X', '<ul><li>X</li></ul>'),
 ('spaces + # -> heading', P, '  ## X', '<h2>X</h2>'),
 ('spaces + 1. -> numbered', P, '    1. X', '<ol><li>X</li></ol>'),
 ('spaces + > -> quote', P, '  > X', '<p data-quote="">X</p>'),
 ('spaces + [] -> task', P, '  [] X', '<ul data-task=""><li data-task="0">X</li></ul>'),
 ('after a bullet, 2 spaces -> nested', '<ul><li>a</li></ul>' + P, '  * X', '<ul><li>a<ul><li>X</li></ul></li></ul>'),
 ('after a nested bullet, 4 spaces -> level 3', '<ul><li>a<ul><li>b</li></ul></li></ul>' + P, '    * X', '<ul><li>a<ul><li>b<ul><li>X</li></ul></li></ul></li></ul>'),
 ('after a numbered list, 2 spaces -> nested', '<ol><li>a</li></ol>' + P, '  1. X', '<ol><li>a<ol><li>X</li></ol></li></ol>'),
 ('no spaces still works', P, '* X', '<ul><li>X</li></ul>'),
 ('[ ] typed key by key -> task (R2-H1)', P, '[ ] X', '<ul data-task=""><li data-task="0">X</li></ul>'),
 ('spaces + [ ] typed key by key -> task', P, '  [ ] X', '<ul data-task=""><li data-task="0">X</li></ul>'),
]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(**LAUNCH)
    pg = await (await b.new_context(viewport={'width': 1300, 'height': 700})).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    for name, html, keys, want in SCEN:
      await pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}) }", html); await pg.evaluate(LAST)
      await pg.keyboard.type(keys); await pg.wait_for_timeout(30)
      got = await pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'')")
      check(name, got == want, got)
    tab = await pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}); caretInto(ed.lastElementChild, true) }", '<ul><li>a</li></ul>' + P)
    await pg.keyboard.press('Tab'); await pg.keyboard.type('* X'); await pg.wait_for_timeout(30)
    got = await pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'')")
    check('Tab + * after a bullet -> nested', got == '<ul><li>a<ul><li>X</li></ul></li></ul>', got)
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
