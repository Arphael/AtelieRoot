import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
# A browser that refuses the folder picker must say so (only a real cancel stays silent);
# Electron hosts (VS Code's integrated browser) never grant folder access, so no button is offered.
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
TOAST = "document.querySelector('#toast').textContent"
ELECTRON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Code/1.105.0 Chrome/138.0.0.0 Electron/37.0.0 Safari/537.36'
async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    pg = await (await b.new_context()).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    await pg.evaluate("window.showDirectoryPicker = () => Promise.reject(new DOMException('denied', 'SecurityError')); 0")
    await pg.evaluate("wsPickFolder()"); await pg.wait_for_timeout(100)
    t = await pg.evaluate(TOAST)
    check('picker refused -> message', 'SecurityError' in t, t)
    await pg.evaluate("document.querySelector('#toast').textContent = ''; window.showDirectoryPicker = () => Promise.reject(new DOMException('x', 'AbortError')); 0")
    await pg.evaluate("wsPickFolder()"); await pg.wait_for_timeout(100)
    check('cancel -> silent', await pg.evaluate(TOAST) == '')
    pe = await (await b.new_context(user_agent=ELECTRON_UA)).new_page(); pe.on('pageerror', lambda e: errs.append(str(e)))
    await pe.goto(URL); await pe.wait_for_timeout(900)
    check('electron -> no folder button', await pe.evaluate("wsCanPick()") is False)
    check('electron -> explains VS Code', 'VS Code' in await pe.evaluate("wsNoPickerText()"))
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
