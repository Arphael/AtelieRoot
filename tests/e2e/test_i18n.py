import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL as _URL, LAUNCH
import re
URL = re.sub(r'[?&]lang=\w+', '', _URL)          # this test checks the automatic language, so no forced ?lang=
URL_EN = URL + ('&' if '?' in URL else '?') + 'lang=en'
# Interface language: follows the system by default, switches live (no reload), persists, never touches documents.
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
  if not cond: fails.append(name)
UI = """() => ({
  lang: document.documentElement.lang,
  btn: document.getElementById('langBtn').textContent,
  newDoc: document.getElementById('newDoc').textContent.trim(),
  trash: document.getElementById('trashBtn').childNodes[1].nodeValue.trim(),
  find: document.getElementById('findBtn').title,
  search: document.getElementById('search').placeholder,
  bold: document.querySelector('[data-fmt=bold]').getAttribute('aria-label'),
  status: document.getElementById('wc').textContent,
})"""
async def palette(pg):
  await pg.keyboard.press('Control+Shift+P'); await pg.wait_for_timeout(150)
  r = await pg.evaluate("() => ({ title: card.querySelector('h2').textContent, ph: card.querySelector('#palq').placeholder, first: card.querySelector('.pal-item .pt').textContent, group: card.querySelector('.pal-item .pg').textContent })")
  await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100)
  return r
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(**LAUNCH)
    # default language follows the system
    for loc, want in (('en-US', 'en'), ('es-MX', 'es'), ('fr-FR', 'en')):
      ctx = await b.new_context(locale=loc); pg = await ctx.new_page(); await pg.goto(URL); await pg.wait_for_timeout(700)
      got = await pg.evaluate("document.documentElement.lang"); check(f'system {loc} -> {want}', got == want, got); await ctx.close()
    ctx = await b.new_context(locale='es-ES'); pg = await ctx.new_page(); await pg.goto(URL_EN); await pg.wait_for_timeout(700)
    got = await pg.evaluate("[document.documentElement.lang, document.getElementById('newDoc').textContent.trim()]")
    check('?lang=en forces English on a Spanish system', got == ['en', 'New document'], got); await ctx.close()

    ctx = await b.new_context(locale='es-ES', viewport={'width': 1500, 'height': 800}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900)
    await pg.evaluate("() => { ed.innerHTML = '<h1>Título</h1><p>Hola <strong>mundo</strong></p><ul><li>uno</li></ul>'; ensureBlocks(); History.init(); }")
    md0 = await pg.evaluate("mdFromDom(ed)")
    es = await pg.evaluate(UI); pal_es = await palette(pg)
    check('starts in Spanish', es['lang'] == 'es' and es['newDoc'] == 'Nuevo documento' and es['btn'] == 'ES', es)
    check('palette in Spanish', pal_es['title'] == 'Paleta de comandos' and pal_es['group'] == 'Documento', pal_es)

    await pg.click('#langBtn'); await pg.wait_for_timeout(150)
    en = await pg.evaluate(UI); pal_en = await palette(pg)
    check('html lang -> en', en['lang'] == 'en', en)
    check('button shows EN', en['btn'] == 'EN', en)
    check('sidebar text -> English', en['newDoc'] == 'New document' and en['trash'] == 'Trash', en)
    check('icons kept when text changes', await pg.evaluate("!!document.querySelector('#trashBtn svg') && !!document.querySelector('#trashN')"))
    check('toolbar title/aria -> English', en['find'].startswith('Find (Ctrl+F)') and en['bold'] == 'Bold', en)
    check('placeholder -> English', en['search'] == 'Search', en)
    check('palette -> English', pal_en['title'] == 'Command palette' and pal_en['group'] == 'Document' and pal_en['first'] == 'New document', pal_en)
    check('no reload (document still in the editor)', await pg.evaluate("mdFromDom(ed)") == md0)
    check('status bar -> English', 'word' in en['status'], en['status'])
    got = await pg.evaluate("() => { I18n.set('es'); flag(T('msg.saved')); I18n.set('en'); return document.getElementById('saved').textContent.trim() }")
    check('save indicator -> English', got == 'Saved', got)
    got = await pg.evaluate("() => { History.init(); History.undo(); return document.getElementById('toast').textContent }")
    check('messages -> English', got == 'Nothing to undo', got)
    got = await pg.evaluate("() => { caretInto(ed.firstElementChild, true); refreshBar(); return [document.getElementById('hBtn').firstChild.nodeValue, document.querySelector('#hMenu button').textContent] }")
    check('block type and its menu -> English', got == ['Heading 1', 'Paragraph'], got)
    got = await pg.evaluate("() => { openTrash(); const r = [card.querySelector('h2').textContent, card.querySelector('[data-empty]').textContent]; veil.classList.remove('show'); return r }")
    check('dialogs -> English', got == ['Trash', 'Empty trash'], got)
    got = await pg.evaluate("""() => { ed.innerHTML = domFromMd('```js\\nx\\n```'); ensureBlocks(); I18n.set('es'); I18n.set('en'); return (ed.querySelector('.cb-copy') || {}).title }""")
    check('buttons inside the document switch too', got == 'Copy this block', got)
    await pg.evaluate("() => { ed.innerHTML = '<h1>Título</h1><p>Hola <strong>mundo</strong></p><ul><li>uno</li></ul>'; ensureBlocks(); History.init(); }")
    left = await pg.evaluate("""() => { const bad = [], re = /\\b(Nuevo|Nueva|Papelera|Buscar|Copiar|Negrita|Exportar|Respaldo|Esquema|Párrafo|Encabezado|palabras|caracteres|Deshacer|Saltos|Cerrar|Reemplazar|Insertar|Eliminar|Mostrar|Cambiar)\\b/;
      document.querySelectorAll('body *').forEach(el => { if (el.closest('#ed,#ed2,#tree,#pvText,script,style')) return;
        [...el.childNodes].forEach(n => { if (n.nodeType === 3 && re.test(n.nodeValue)) bad.push(n.nodeValue.trim()); });
        ['title', 'aria-label', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v && re.test(v)) bad.push(v); }); });
      return bad }""")
    check('no Spanish left in the English interface', not left, left[:5])

    await pg.reload(); await pg.wait_for_timeout(900)
    check('choice persists after reload', await pg.evaluate("document.documentElement.lang") == 'en')
    await pg.click('#langBtn'); await pg.wait_for_timeout(150)
    back = await pg.evaluate(UI)
    check('switches back to Spanish', back['lang'] == 'es' and back['newDoc'] == 'Nuevo documento' and back['find'].startswith('Buscar'), back)
    check('no page errors', not errs, errs)
    await b.close()
  print('\n' + ('TODO OK' if not fails else f'{len(fails)} FALLOS: {fails}'))
  sys.exit(1 if fails else 0)
asyncio.run(main())
