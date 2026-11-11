import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH
# Small screens: every right-hand tool (live Markdown ... language) stays reachable. When one does not fit,
# the whole group moves to the right-hand Tools panel; view tools that overflow go there too, not to «More».
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
RIGHT = ['#pvBtn', '#phBtn', '#tidyBtn', '#copyMd', '#copyRich', '#exportBtn', '#langBtn', '#themeBtn']
STATE = """r => { const vis = el => el && !el.closest('.ovf') && getComputedStyle(el).display !== 'none';
  return { hidden: r.filter(s => !vis(document.querySelector(s))), tools: vis(document.getElementById('toolsBtn')),
           overflow: bar.scrollWidth > bar.clientWidth + 1 } }"""
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(**LAUNCH)
    for w in (1400, 1100, 760, 390):
      ctx = await b.new_context(viewport={'width': w, 'height': 760}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
      await pg.goto(URL); await pg.wait_for_timeout(900)
      st = await pg.evaluate(STATE, RIGHT)
      check(f'{w}px: the toolbar fits', not st['overflow'], st)
      in_panel = []
      if st['tools']:
        await pg.click('#mTools' if w <= 600 else '#toolsBtn'); await pg.wait_for_timeout(250)
        in_panel = await pg.evaluate("[...document.querySelectorAll('#toolsBody [data-src]')].map(b => b.dataset.src).concat(document.querySelectorAll('#toolsBody .tl-seg').length === 2 ? ['#langBtn', '#themeBtn'] : [])")
      lost = [s for s in st['hidden'] if s not in in_panel]
      check(f'{w}px: every right-hand tool is in the bar or in the panel', not lost, lost)
      if w == 1400: check('1400px: the right-hand group stays in the bar', not st['hidden'], st['hidden'])
      if st['tools'] and w > 600:
        gap = await pg.evaluate("""() => { const vis = [...bar.children].filter(el => !el.classList.contains('ovf') && getComputedStyle(el).display !== 'none' && el.id !== 'toolsBtn');
          const last = vis[vis.length - 1].getBoundingClientRect().right, tb = document.getElementById('toolsBtn').getBoundingClientRect().left;
          const hidden = OVF_ORDER.map(s => bar.querySelector(s)).filter(el => el && el.classList.contains('ovf') && !document.querySelector('.tb-group').contains(el));
          const smallest = Math.min(...hidden.map(el => { el.classList.remove('ovf'); const r = el.getBoundingClientRect().width; el.classList.add('ovf'); return r; }), 999);
          return [Math.round(tb - last), Math.round(smallest)] }""")
        check(f'{w}px: no tool left in «More» that would fit in the free space', gap[0] - 8 <= gap[1] + 4, gap)
      if w == 1100:
        await pg.click('#toolsBtn'); await pg.wait_for_timeout(400)
        xs = await pg.evaluate("""async () => { document.getElementById('toolsClose').click(); const xs = [];
          for (let i = 0; i < 6; i++){ await new Promise(r => setTimeout(r, 40)); const cs = getComputedStyle(document.getElementById('tools')); xs.push([new DOMMatrix(cs.transform).m41, cs.visibility]); }
          return xs }""")
        check('1100px: the panel slides out (visible while moving, hidden at the end)', any(v == 'visible' and x > 0 for x, v in xs) and xs[-1][1] == 'hidden', xs)
      if w <= 760:
        check(f'{w}px: the group went to the panel', set(st['hidden']) >= set(RIGHT) - {'#copyMd'} and st['tools'], st)
        got = await pg.evaluate("() => { document.querySelector('#toolsBody .tl-seg button[data-v=en]').click(); return [document.documentElement.lang, document.getElementById('toolsTitle').textContent, document.body.classList.contains('tools-open')] }")
        check(f'{w}px: language from the panel (live, panel stays open)', got == ['en', 'Tools', True], got)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        check(f'{w}px: Esc closes the panel', not await pg.evaluate("document.body.classList.contains('tools-open')"))
        await pg.click('#mTools' if w <= 600 else '#toolsBtn'); await pg.wait_for_timeout(200)
        await pg.click('#toolsBody .tl-row[data-src="#pvBtn"]'); await pg.wait_for_timeout(200)
        check(f'{w}px: a panel row runs the real tool and closes the panel', await pg.evaluate("[document.body.classList.contains('tools-open'), document.getElementById('preview').classList.contains('on')]") == [False, True])
        await pg.evaluate("() => { document.getElementById('pvBtn').click(); document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show')) }")
        more = await pg.evaluate("() => { document.getElementById('moreBtn').click(); const t = [...document.querySelectorAll('#moreMenu button')].map(b => b.lastChild.textContent); document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show')); return t }")
        bad = [x for x in more if any(k in x for k in ('Find', 'Go to document', 'Split view', 'outline', 'Focus', 'live Markdown', 'placeholders', 'Export', 'theme', 'language'))]
        check(f'{w}px: «More» keeps only formatting and insert tools', not bad, bad)
      await ctx.close()
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
