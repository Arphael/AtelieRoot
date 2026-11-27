"""A document or a paste can come from anyone: nothing in it may run script in the page (the page holds the folder's token)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

# each one tries to add an event attribute (on...) or run code; window.__x stays unset if nothing ran
MDS = [
  ('a bare address with quotes', 'mira https://x.com/"onmouseover="window.__x=1" fin'),
  ('a bare www. address with quotes', 'mira www.x.com/"onfocus="window.__x=1"autofocus="" fin'),
  ('an <https://...> address with quotes', '<https://x.com/"onmouseover="window.__x=1>'),
  ('a [text](url) link with quotes', '[t](https://x.com/"onmouseover="window.__x=1)'),
  ('an ![](url) image with quotes', '![a"onerror="window.__x=1](x.png)'),
  ('an <img> with an extra attribute', '<img src="nope.png" onerror="window.__x=1">'),
  ('an <img> whose alt closes the quote', '<img src="nope.png" alt="a" onerror="window.__x=1">'),
  ('a code block language with quotes', '```x"onmouseover="window.__x=1\ncode\n```'),
  ('a table cell', '| a |\n| --- |\n| https://x.com/"onmouseover="window.__x=1 |'),
  ('a list item', '- https://x.com/"onmouseover="window.__x=1'),
  ('a javascript: link', '[t](javascript:window.__x=1)'),
]
PASTES = [
  ('<img onerror>', '<p>hola<img src="nope://x" onerror="window.__x=1"></p>'),
  ('<svg onload>', '<div><svg onload="window.__x=1"></svg>hola</div>'),
  ('<img onerror> inside a <div> (rebuilt as <p>)', '<div><img src="nope://x" onerror="window.__x=1">hola</div>'),
  ('<img onerror> inside inline code', '<span data-code=""><img src="nope://x" onerror="window.__x=1">x</span>'),
  ('<iframe srcdoc>', '<iframe srcdoc="<script>parent.__x=1</script>"></iframe><p>hola</p>'),
]
ON = "[...ed.querySelectorAll('*')].flatMap(el => [...el.attributes].filter(a => /^on/i.test(a.name) || /^\\s*javascript:/i.test(a.value)).map(a => el.tagName + ' ' + a.name + '=' + a.value))"

async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH); pg = await b.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    print('=== Markdown from a document ===')
    for name, md in MDS:
      await pg.evaluate("m => { window.__x = undefined; ed.innerHTML = domFromMd(m); ensureBlocks(); }", md)
      await pg.wait_for_timeout(150)
      bad = await pg.evaluate(ON); ran = await pg.evaluate("window.__x !== undefined")
      check(name + ': no event attribute and nothing runs', not bad and not ran, [bad, ran, await pg.evaluate("ed.innerHTML")])
    r = await pg.evaluate("domFromMd('ver https://x.com/a?b=1&c=2 y <https://y.com/z>')")
    check('   ...normal addresses still become links', 'href="https://x.com/a?b=1&amp;c=2"' in r and 'href="https://y.com/z"' in r, r)
    print('=== pasted HTML (copied from a web page) ===')
    await pg.evaluate("() => { ed.innerHTML = '<p><br></p>'; ensureBlocks(); ed.focus(); caretInto(ed.firstElementChild, false); const dt = new DataTransfer(); dt.setData('text/html', '<p>zqz</p>'); ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }")
    await pg.wait_for_timeout(200)
    synthetic = await pg.evaluate("ed.textContent.includes('zqz')")
    if not synthetic:      # Firefox drops clipboardData of a made-up paste event: Chromium and WebKit cover this part
      print('(this browser cannot make a paste event with data: skipped)'); PASTES.clear()
    for name, html in PASTES:
      await pg.evaluate("() => { window.__x = undefined; ed.innerHTML = '<p><br></p>'; ensureBlocks(); History.init(); ed.focus(); caretInto(ed.firstElementChild, false); }")
      await pg.evaluate("h => { const dt = new DataTransfer(); dt.setData('text/html', h); ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }", html)
      await pg.wait_for_timeout(400)
      bad = await pg.evaluate(ON); ran = await pg.evaluate("window.__x !== undefined")
      check(name + ': nothing runs while pasting', not bad and not ran, [bad, ran])
    if synthetic: check('   ...the pasted text arrives', 'hola' in await pg.evaluate("ed.textContent"), await pg.evaluate("ed.innerHTML"))
    check('no page errors', not errs, errs)
    await b.close()
  print('\nTOTAL:', 'todo bien' if not fails else f'{len(fails)} fallos: {fails}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
