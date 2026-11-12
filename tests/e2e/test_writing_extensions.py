import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
ENGINES = ('chromium', 'webkit')   # Firefox: synthetic paste events arrive empty and contenteditable differs (Enter in quotes, replace inside bold); see FAQ
# Writing assistant extensions (spell/grammar checkers) replace words in the editor; the change must reach
# the Markdown, be undoable and keep the inline format, and spell check must stay on.
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
SETUP = "h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}) }"
REPLACE = """([sel, word, rep]) => { const t = ed.querySelector(sel).firstChild, i = t.nodeValue.indexOf(word);
  const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + word.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText', false, rep); }"""
MD = "mdFromDom(ed).trim()"
async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    pg = await (await b.new_context(viewport={'width': 1300, 'height': 700})).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    await pg.evaluate(SETUP, '<p>Esto es teh texto</p>'); await pg.evaluate(REPLACE, ['p', 'teh', 'the'])
    got = await pg.evaluate(MD); check('replacement reaches the Markdown', got == 'Esto es the texto', got)
    await pg.evaluate("History.undo()"); got = await pg.evaluate(MD); check('Ctrl+Z restores the original word', got == 'Esto es teh texto', got)
    await pg.evaluate(SETUP, '<p><strong>teh</strong> texto</p>'); await pg.evaluate(REPLACE, ['strong', 'teh', 'the'])
    got = await pg.evaluate(MD); check('replacement inside bold keeps bold', got == '**the** texto', got)
    await pg.evaluate(SETUP, '<p>teh</p>'); await pg.evaluate(REPLACE, ['p', 'teh', 'the cat'])
    got = await pg.evaluate(MD); check('replacement with spaces is plain text', got == 'the cat', got)
    await pg.evaluate(SETUP, '<p>Esto es teh texto</p>')
    await pg.evaluate("()=>{ const t = ed.querySelector('p').firstChild; t.nodeValue = t.nodeValue.replace('teh','the'); ed.dispatchEvent(new InputEvent('input', {bubbles:true, inputType:'insertReplacementText'})) }")
    got = await pg.evaluate(MD); check('direct text edit + input event reaches the Markdown', got == 'Esto es the texto', got)
    ok = await pg.evaluate("ed.spellcheck && ed2.spellcheck")
    check('spell check is on in both editor panes', ok)
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
