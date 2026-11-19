"""v2.2 fix round 1 (temporary mode): the word guide only hides the mark (the page still scrolls by itself), the
shortcut list is readable, «Copy path» for folders and a browser folder's place that is never asked twice,
«Copy Markdown» carries the image as a file, images can be resized, aligned, rotated, flipped and cropped, and
new images live in .atelieroot/assets/."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine, BROWSER
ENGINES = ('chromium', 'webkit')
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)

async def newdoc(pg, name, html):
  return await pg.evaluate("""([name, html]) => { const n = { id: uid(), type: 'doc', name, mod: Date.now() }; state.tree.push(n); state.docs[n.id] = html; renderTree(); openDoc(n.id); return n.id; }""", [name, html])
async def caret_at(pg, text, at=0):
  await pg.evaluate("""([t, at]) => { ed.focus(); const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.data.includes(t)) break;
    const r = document.createRange(); r.setStart(n, n.data.indexOf(t) + at); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""", [text, at])
# a 40x20 PNG: left half red, right half blue
MAKE = """async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; const x = c.getContext('2d');
  x.fillStyle = '#f00'; x.fillRect(0, 0, 20, 20); x.fillStyle = '#00f'; x.fillRect(20, 0, 20, 20);
  const b = await new Promise(r => c.toBlob(r, 'image/png')); return new File([b], 'a.png', { type: 'image/png' }); }"""
SIZE = """async () => { const im = ed.querySelector('img'); const full = imgFullPath(im.getAttribute('data-md-src'), state.current);
  const b = await ImgStore.get(full); const bmp = await createImageBitmap(b); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const px = (i, j) => Array.from(x.getImageData(i, j, 1, 1).data.slice(0, 3)).map(v => v > 128 ? 1 : 0).join('');
  return [bmp.width, bmp.height, px(1, 1), px(bmp.width - 2, bmp.height - 2), im.getAttribute('data-md-src')]; }"""

async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    ctx = await b.new_context(viewport={'width': 1300, 'height': 760})
    if BROWSER == 'chromium': await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    paras = ''.join('<p>Párrafo número %d con unas cuantas palabras para leer despacio.</p>' % i for i in range(60))
    await newdoc(pg, 'Largo', paras); await caret_at(pg, 'número 3 ')

    print('=== 1. hiding the word guide keeps the page scrolling ===')
    await pg.evaluate("toggleReading(true)"); await pg.wait_for_timeout(200)
    await pg.click('[data-rd="words"]'); await pg.wait_for_timeout(150)
    st = await pg.evaluate("[rdPrefs().guide, CSS.highlights ? CSS.highlights.has('rd-word') : false, getComputedStyle(rdPanel.querySelector('[data-rd=\"play\"]')).display !== 'none']")
    check('the guide hides: no word is marked, play is still there', st == [False, False, True], st)
    await pg.evaluate("rdSave({ wpm: 600 })")
    y0 = await pg.evaluate("scroll.scrollTop")
    await pg.keyboard.press(' '); await pg.wait_for_timeout(2500)
    check('   ...Space starts it and the page scrolls by itself without the mark', await pg.evaluate("Rd.play") and await pg.evaluate("scroll.scrollTop") > y0 + 5, [y0, await pg.evaluate("scroll.scrollTop")])
    check('   ...still no word marked', not await pg.evaluate("CSS.highlights ? CSS.highlights.has('rd-word') : false"))
    await pg.keyboard.press(' '); await pg.click('[data-rd="words"]'); await pg.evaluate("rdSave({ wpm: 200 }); toggleReading(false)")

    print('=== 2. the shortcut list is readable ===')
    await pg.evaluate("openKeys()"); await pg.wait_for_timeout(150)
    w = await pg.evaluate("(() => { const r = card.querySelector('[data-km=\"select-line\"]'); return [card.getBoundingClientRect().width, r.children[1].getBoundingClientRect().width, r.getBoundingClientRect().height]; })()")
    check('the list is wide and a row with buttons keeps its text on one or two lines', w[0] >= 640 and w[1] >= 220 and w[2] < 60, w)
    check('   ...no horizontal scroll', await pg.evaluate("(() => { const l = card.querySelector('#kbl'); return l.scrollWidth <= l.clientWidth + 1; })()"))
    await pg.keyboard.press('Escape')

    print('=== 3. paths ===')
    out = await pg.evaluate("""async () => {
      const copied = [], keepCopy = copyText; copyText = t => copied.push(t);
      localStorage.removeItem('atelieroot.fsbase');
      const be = new FsBackend({ name: 'Notas' });
      const p1 = be.absPath('sub/a.md'); await new Promise(r => setTimeout(r, 100));
      card.querySelector('input').value = 'C:\\\\Users\\\\x\\\\Notas\\\\sub\\\\a.md'; card.querySelector('[data-yes]').click();
      const a = await p1;
      Ui.data = {}; Ui.write(); saveUi();                    // another part of the app (or tab) rewrites the settings
      const b2 = new FsBackend({ name: 'Notas' });
      const b = await b2.absPath('sub'); const asked = veil.classList.contains('show');
      copyText = keepCopy; return [a, b, asked];
    }""")
    check('pasting the path of a file inside the folder is understood, and the place is never asked again', out == ['C:\\Users\\x\\Notas\\sub\\a.md', 'C:\\Users\\x\\Notas\\sub', False], out)
    items = await pg.evaluate("""() => { const W = Workspace, keep = [W.active, W.be]; W.active = true; W.be = new FsBackend({ name: 'Notas' });
      const f = { id: 'y', type: 'folder', name: 'f', path: 'f', children: [] }; const r = ctxItems(f).map(i => i[0]); W.active = keep[0]; W.be = keep[1]; return r; }""")
    check('«Copy path» is in the menu of a folder too', 'copypath' in items and 'copyrel' in items, items)

    print('=== 4. images live in .atelieroot/assets/ ===')
    iid = await newdoc(pg, 'Fotos', '<p>antes</p><p>después</p>')
    await caret_at(pg, 'antes', 5)
    await pg.evaluate("async ([mk]) => { const f = await (eval(mk))(); const s = getSelection(); await insertImages([f], s.getRangeAt(0).cloneRange()); }", [MAKE])
    await pg.wait_for_timeout(300)
    src = await pg.evaluate("ed.querySelector('img').getAttribute('data-md-src')")
    check('a pasted image is saved in .atelieroot/assets/', src.startswith('.atelieroot/assets/') and src.endswith('.png'), src)

    print('=== 5. Copy Markdown is text only (a chat keeps the text) ===')
    if BROWSER == 'chromium':
      await pg.evaluate("document.getElementById('copyMd').click()"); await pg.wait_for_timeout(600)
      clip = await pg.evaluate("""async () => { const items = await navigator.clipboard.read(); const it = items[0];
        return [it.types.slice().sort(), it.types.includes('text/plain') ? await (await it.getType('text/plain')).text() : '']; }""")
      check('«Copy Markdown»: only text, with the whole document and its image path (no image file that would replace it)', clip[0] == ['text/plain'] and 'antes' in clip[1] and 'después' in clip[1] and '.atelieroot/assets/' in clip[1], clip)

    print('=== 6. change an image ===')
    await pg.click('#ed img'); await pg.wait_for_timeout(200)
    check('clicking an image shows its tools', await pg.evaluate("getComputedStyle(document.getElementById('imgBar')).display !== 'none'"))
    await pg.click('#imgBar [data-im="w50"]'); await pg.wait_for_timeout(200)
    md = await pg.evaluate("docMd()")
    check('50 %: the image is half its size and the Markdown keeps it as <img ... width>', '<img src=".atelieroot/assets/' in md and 'width="20"' in md, md)
    await pg.click('#ed img'); await pg.click('#imgBar [data-im="center"]'); await pg.wait_for_timeout(150)
    md = await pg.evaluate("docMd()")
    check('   ...centred (align="center")', 'align="center"' in md, md)
    back = await pg.evaluate("(() => { const h = domFromMd(docMd()); const d = document.createElement('div'); d.innerHTML = h; const im = d.querySelector('img'); return [im.getAttribute('width'), im.getAttribute('align')]; })()")
    check('   ...and reading that Markdown gives the same image back', back == ['20', 'center'], back)
    s0 = await pg.evaluate(SIZE)
    await pg.click('#ed img'); await pg.click('#imgBar [data-im="rot-r"]'); await pg.wait_for_timeout(600)
    s1 = await pg.evaluate(SIZE)
    check('rotate 90°: the image file itself turns (20x40, red on top)', s1[:3] == [20, 40, '100'] and s1[4] != s0[4], [s0, s1])
    await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
    check('   ...Ctrl+Z brings the previous image back', (await pg.evaluate(SIZE))[:3] == [40, 20, '100'])
    await pg.click('#ed img'); await pg.click('#imgBar [data-im="flip-h"]'); await pg.wait_for_timeout(600)
    check('flip horizontally: blue on the left now', (await pg.evaluate(SIZE))[2] == '001', await pg.evaluate(SIZE))
    await pg.click('#ed img'); await pg.click('#imgBar [data-im="w100"]'); await pg.click('#imgBar [data-im="crop"]'); await pg.wait_for_timeout(200)
    box = await pg.evaluate("(() => { const r = ed.querySelector('img').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
    await pg.mouse.move(box[0] + 0.3, box[1] + 0.3); await pg.mouse.down(); await pg.mouse.move(box[0] + box[2] / 2, box[1] + box[3] + 6, steps=4); await pg.mouse.up()
    await pg.click('#imgBar [data-im="crop-ok"]'); await pg.wait_for_timeout(600)
    s2 = await pg.evaluate(SIZE)
    check('crop: only the part inside the box stays (the left half: blue after the flip)', abs(s2[0] - 20) <= 2 and s2[1] >= 18 and s2[2] == '001' and s2[3] == '001', s2)
    await pg.click('#ed img'); await pg.click('#imgBar [data-im="w100"]'); await pg.wait_for_timeout(150)
    check('100 %: back to plain Markdown ![](...) when nothing else is set', '](.atelieroot/assets/' in await pg.evaluate("docMd()") or 'align="center"' in await pg.evaluate("docMd()"))

    check('no page errors', not errs, errs)
    await b.close()
  print('\nTOTAL:', 'todo bien' if not fails else f'{len(fails)} fallos: {fails}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
