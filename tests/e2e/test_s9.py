"""v2.2 (temporary mode): Ctrl+Shift+V is left to the system (paste as plain text), shortcuts can be changed in the
shortcut list (and system or browser shortcuts are refused), the word guide can be turned off, reading and focus
keep the text in the middle of the screen, and the full path of a file (also in the browser, after asking the
folder's place once) without quotes; «Open with its program» and «Show in Explorer» in the browser."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine, BROWSER
ENGINES = ('chromium', 'webkit')   # Firefox: synthetic key handling of contenteditable differs; see FAQ
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

async def newdoc(pg, name, html):
  return await pg.evaluate("""([name, html]) => { const n = { id: uid(), type: 'doc', name, mod: Date.now() }; state.tree.push(n); state.docs[n.id] = html; renderTree(); openDoc(n.id); return n.id; }""", [name, html])
async def caret_at(pg, text, at=0):
  await pg.evaluate("""([t, at]) => { ed.focus(); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.data.includes(t)) break;
    const r = document.createRange(); r.setStart(n, n.data.indexOf(t) + at); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""", [text, at])
async def chord(pg, k):
  await pg.keyboard.press('Control+k'); await pg.keyboard.press(k); await pg.wait_for_timeout(250)
ROW = "id => { const r = card.querySelector('[data-km=\"' + id + '\"]'); return r ? r.querySelector('kbd').textContent : null; }"

async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    ctx = await b.new_context(viewport={'width': 1300, 'height': 760})
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    paras = ''.join('<p>Párrafo número %d con unas cuantas palabras para leer despacio.</p>' % i for i in range(60))
    await newdoc(pg, 'Largo', paras)
    await caret_at(pg, 'número 3 ')

    print('=== 1. Ctrl+Shift+V is the system paste, reading mode is Ctrl+K R ===')
    await pg.keyboard.press('Control+Shift+V'); await pg.wait_for_timeout(200)
    check('Ctrl+Shift+V no longer opens reading mode (paste as plain text keeps working)', not await pg.evaluate("Rd.on"))
    await chord(pg, 'r')
    check('Ctrl+K R opens reading mode', await pg.evaluate("Rd.on"))
    await chord(pg, 'r')
    check('   ...and Ctrl+K R leaves it', not await pg.evaluate("Rd.on"))
    check('no default shortcut uses a reserved system or browser combination',
          await pg.evaluate("KM_ACTIONS.filter(a => kmReserved(a.def) || (a.def.startsWith('Ctrl+K ') && kmReserved(a.def.slice(7)) && !/^(Ctrl\\+)?[A-Z]$/.test(a.def.slice(7)))).map(a => a.id)") == [])
    check('Ctrl+Shift+V, Ctrl+W, Alt+F4, F5 and Ctrl+Alt (AltGr) are reserved',
          await pg.evaluate("['Ctrl+Shift+V', 'Ctrl+W', 'Alt+F4', 'F5', 'Ctrl+Alt+E', 'Ctrl+T', 'Ctrl+R', 'F12'].every(kmReserved)"))

    print('=== 2. change a shortcut in the shortcut list ===')
    await caret_at(pg, 'número 3 ')
    await chord(pg, 's')
    check('Ctrl+K Ctrl+S opens the list, with the reading mode row and its shortcut', await pg.evaluate(ROW, 'reading') == 'Ctrl+K R', await pg.evaluate(ROW, 'reading'))
    await pg.click('[data-km="reading"] [data-km-set]'); await pg.wait_for_timeout(100)
    check('   «Change» waits for the new keys', 'rec' in (await pg.evaluate("card.querySelector('[data-km=\"reading\"]').className")))
    await pg.keyboard.press('Control+Shift+V'); await pg.wait_for_timeout(100)
    check('   ...a system shortcut is refused and says why', await pg.evaluate(ROW, 'reading') != 'Ctrl+Shift+V' and len(await pg.evaluate("card.querySelector('#kbMsg').textContent")) > 5, await pg.evaluate("card.querySelector('#kbMsg').textContent"))
    await pg.click('[data-km="reading"] [data-km-set]'); await pg.wait_for_timeout(100)
    await pg.keyboard.press('Control+b'); await pg.wait_for_timeout(100)
    check('   ...a fixed editing shortcut (Ctrl+B) is refused', await pg.evaluate(ROW, 'reading') == 'Ctrl+K R', await pg.evaluate("[card.querySelector('#kbMsg').textContent]"))
    await pg.click('[data-km="reading"] [data-km-set]'); await pg.wait_for_timeout(100)
    await pg.keyboard.press('Control+p'); await pg.wait_for_timeout(100)
    msg = await pg.evaluate("card.querySelector('#kbMsg').textContent")
    check('   ...one that another command uses is refused and names it', await pg.evaluate(ROW, 'reading') == 'Ctrl+K R' and len(msg) > 5, msg)
    await pg.click('[data-km="reading"] [data-km-set]'); await pg.wait_for_timeout(100)
    await pg.keyboard.press('Alt+r'); await pg.wait_for_timeout(100)
    check('   ...Alt+R is taken and saved', await pg.evaluate(ROW, 'reading') == 'Alt+R' and await pg.evaluate("Ui.data.keys.reading") == 'Alt+R', await pg.evaluate(ROW, 'reading'))
    await pg.click('[data-km="focus"] [data-km-set]'); await pg.wait_for_timeout(100)
    await pg.keyboard.press('Control+k'); await pg.keyboard.press('j'); await pg.wait_for_timeout(100)
    check('   ...a Ctrl+K chord can be recorded too', await pg.evaluate(ROW, 'focus') == 'Ctrl+K J', await pg.evaluate(ROW, 'focus'))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
    await caret_at(pg, 'número 3 ')
    await chord(pg, 'r')
    check('the old shortcut does nothing any more', not await pg.evaluate("Rd.on"))
    await pg.keyboard.press('Alt+r'); await pg.wait_for_timeout(250)
    check('the new one opens reading mode', await pg.evaluate("Rd.on"))
    await pg.keyboard.press('Alt+r'); await pg.wait_for_timeout(250)
    check('   ...and leaves it', not await pg.evaluate("Rd.on"))
    await caret_at(pg, 'número 3 ')
    await chord(pg, 'j')
    check('Ctrl+K J runs focus mode', await pg.evaluate("document.body.classList.contains('focus')"))
    await pg.evaluate("toggleFocus(false)")
    await pg.reload(); await pg.wait_for_timeout(800)
    await newdoc(pg, 'Largo', paras); await caret_at(pg, 'número 3 ')
    await pg.keyboard.press('Alt+r'); await pg.wait_for_timeout(250)
    check('the changed shortcuts are remembered after reloading', await pg.evaluate("Rd.on"))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
    await pg.evaluate("openKeys()"); await pg.wait_for_timeout(100)
    check('   the shortcut list shows the changed one', await pg.evaluate(ROW, 'reading') == 'Alt+R')
    await pg.click('[data-km="reading"] [data-km-reset]'); await pg.wait_for_timeout(100)
    check('«Reset» brings the original back', await pg.evaluate(ROW, 'reading') == 'Ctrl+K R' and 'reading' not in await pg.evaluate("Object.keys(Ui.data.keys || {})"))
    await pg.click('#kbResetAll'); await pg.wait_for_timeout(100)
    check('«Reset all» clears every change', await pg.evaluate(ROW, 'focus') == 'Ctrl+K Z' and await pg.evaluate("Object.keys(Ui.data.keys || {}).length") == 0)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)

    print('=== 3. the word guide can be turned off ===')
    await caret_at(pg, 'número 3 ')
    await chord(pg, 'r')
    await pg.click('[data-rd="words"]'); await pg.wait_for_timeout(150)
    st = await pg.evaluate("[rdPrefs().guide, !!(window.CSS && CSS.highlights && CSS.highlights.has('rd-word')), getComputedStyle(rdPanel.querySelector('[data-rd=\"play\"]')).display]")
    check('the guide button hides the mark: no word is marked, play stays', st == [False, False, 'flex'], st)
    await pg.keyboard.press(' '); await pg.wait_for_timeout(300)
    check('   ...Space still starts the page moving', await pg.evaluate("Rd.play"))
    await pg.keyboard.press(' '); await pg.wait_for_timeout(100)
    await pg.click('[data-rd="words"]'); await pg.wait_for_timeout(150)
    check('   ...and the same button turns it on again', await pg.evaluate("rdPrefs().guide && CSS.highlights.has('rd-word')") if BROWSER == 'chromium' else await pg.evaluate("rdPrefs().guide"))

    print('=== 4. reading and focus keep the text in the middle ===')
    await pg.evaluate("scroll.scrollTop = 0"); await pg.wait_for_timeout(100)
    mid = "(() => { const s = scroll.getBoundingClientRect(); return s.top + s.height / 2; })()"
    first = await pg.evaluate("ed.firstElementChild.getBoundingClientRect().top")
    m = await pg.evaluate(mid)
    check('reading: at the start the first line is in the middle of the screen (blank page above)', abs(first - m) < 60, [first, m])
    await pg.evaluate("scroll.scrollTop = scroll.scrollHeight"); await pg.wait_for_timeout(100)
    last = await pg.evaluate("ed.lastElementChild.getBoundingClientRect().bottom")
    check('   ...and at the end the last line is in the middle too (blank page below)', abs(last - m) < 60, [last, m])
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
    pad = await pg.evaluate("getComputedStyle(ed.closest('.wrapc')).paddingBottom")
    check('the blank page is only in reading and focus mode', float(pad.replace('px', '')) < 300, pad)
    await pg.evaluate("toggleFocus(true)"); await pg.wait_for_timeout(150)
    await caret_at(pg, 'número 40 '); await pg.wait_for_timeout(200)
    y = await pg.evaluate("(() => { const r = getSelection().getRangeAt(0).getClientRects()[0] || getSelection().getRangeAt(0).startContainer.parentElement.getBoundingClientRect(); return r.top + r.height / 2; })()")
    m = await pg.evaluate(mid)
    check('focus: the line being written stays in the middle', abs(y - m) < 60, [y, m])
    await caret_at(pg, 'número 0 '); await pg.wait_for_timeout(200)
    y = await pg.evaluate("ed.firstElementChild.getBoundingClientRect().top")
    check('   ...also the first line of the document', abs(y - m) < 60, [y, m])
    await pg.evaluate("toggleFocus(false)")

    print('=== 5. paths ===')
    out = await pg.evaluate("""async () => {
      const copied = []; copyText = t => copied.push(t);
      const be = new FsBackend({ name: 'Notas' });
      const p1 = be.absPath('sub/a.md'); await new Promise(r => setTimeout(r, 100));
      const asked = veil.classList.contains('show');
      card.querySelector('input').value = '"C:\\\\Users\\\\x\\\\Notas\\\\"'; card.querySelector('[data-yes]').click();
      const a = await p1;
      const b = await be.absPath('b.md');                        // remembered: no question
      const again = veil.classList.contains('show');
      await be.reveal('sub/a.md');
      return [asked, a, b, again, copied];
    }""")
    check('browser: «Copy path» asks the folder\'s place once and gives the full path, without quotes', out[:4] == [True, 'C:\\Users\\x\\Notas\\sub\\a.md', 'C:\\Users\\x\\Notas\\b.md', False], out)
    check('   ...«Show in Explorer» in the browser copies the folder of the item to paste in the Explorer', out[4] == ['C:\\Users\\x\\Notas\\sub'], out[4])
    bad = await pg.evaluate("""async () => {
      const be = new FsBackend({ name: 'Otra' }); let e = null;
      const p1 = be.absPath('a.md').catch(x => e = x); await new Promise(r => setTimeout(r, 100));
      card.querySelector('input').value = 'C:\\\\Users\\\\x\\\\Notas'; card.querySelector('[data-yes]').click(); await p1;
      return [!!e, !!JSON.parse(localStorage.getItem('atelieroot.fsbase') || '{}').Otra];
    }""")
    check('   ...a place that is not that folder is refused', bad == [True, False], bad)
    items = await pg.evaluate("""() => { const W = Workspace, keep = [W.active, W.be]; W.active = true; W.be = new FsBackend({ name: 'Notas' });
      const n = { id: 'x', type: 'doc', name: 'a', path: 'a.md' }, f = { id: 'y', type: 'folder', name: 'f', path: 'f', children: [] };
      const r = [ctxItems(n).map(i => i[0]), ctxItems(f).map(i => i[0])]; W.active = keep[0]; W.be = keep[1]; return r; }""")
    check('the browser menu has «Show in Explorer» and «Copy path»', all(k in items[0] for k in ('reveal', 'copypath', 'copyrel')), items[0])
    check('   ...«Open with its program» only where the app can open it (desktop app, dev server)', 'openfile' not in items[0], items[0])

    check('no page errors', not errs, errs)
    await b.close()
  print('\nTOTAL:', 'todo bien' if not fails else f'{len(fails)} fallos: {fails}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
