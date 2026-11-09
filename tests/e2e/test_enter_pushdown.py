import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, json
from playwright.async_api import async_playwright
from browser import URL, LAUNCH
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '→ ' + str(extra)))
  if not cond: fails.append(name)
GOLDEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'golden', 'enter_unchanged.json')
P = '<p><br></p>'
SEL_START = "(()=>{ const b=ed.firstElementChild; const w=document.createTreeWalker(b, NodeFilter.SHOW_TEXT); const t=w.nextNode(); const r=document.createRange(); if (t) r.setStart(t,0); else r.setStart(b,0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()"
at = lambda sel, i, off=0: f"(()=>{{ const t=ed.querySelectorAll('{sel}')[{i}].firstChild; const r=document.createRange(); r.setStart(t,{off}); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) }})()"
LI0, LI1 = at('li', 0), at('li', 1)
# (nombre, html inicial, cómo poner el cursor, teclas, esperado o None si debe quedar como en el archivo golden)
SCEN = [
 ('h1 al inicio', '<h1>Título</h1>', SEL_START, ['Enter'], P + '<h1>Título</h1>'),
 ('h2 al inicio', '<h2>Título</h2>', SEL_START, ['Enter'], P + '<h2>Título</h2>'),
 ('h3 al inicio', '<h3>Título</h3>', SEL_START, ['Enter'], P + '<h3>Título</h3>'),
 ('h6 al inicio', '<h6>Título</h6>', SEL_START, ['Enter'], P + '<h6>Título</h6>'),
 ('h1 al inicio y escribir', '<h1>Título</h1>', SEL_START, ['Enter', 'X'], P + '<h1>XTítulo</h1>'),
 ('h1 con negrita al inicio', '<h1><strong>Tí</strong>tulo</h1>', SEL_START, ['Enter'], P + '<h1><strong>Tí</strong>tulo</h1>'),
 ('h1 con cursor a nivel de elemento', '<h1>Título</h1>', "caretInto(ed.firstElementChild, false)", ['Enter'], P + '<h1>Título</h1>'),
 ('h1 plegado al inicio', '<h1 data-fold="">Título</h1><p>debajo</p>', SEL_START, ['Enter'], P + '<h1 data-fold="">Título</h1><p data-hid="">debajo</p>'),
 ('h1 en medio del documento', '<p>antes</p><h1>Título</h1><p>después</p>', at('h1', 0), ['Enter'], '<p>antes</p>' + P + '<h1>Título</h1><p>después</p>'),
 ('h1 dos Enter al inicio', '<h1>Título</h1>', SEL_START, ['Enter', 'Enter'], P + P + '<h1>Título</h1>'),
 ('h1 en medio del texto', '<h1>Título largo</h1>', at('h1', 0, 6), ['Enter'], None),
 ('h1 al final', '<h1>Título</h1>', "caretInto(ed.firstElementChild, true)", ['Enter', 'X'], None),
 ('h1 vacío', '<h1><br></h1>', "caretInto(ed.firstElementChild, false)", ['Enter'], None),
 ('cita al inicio', '<p data-quote="">cita</p>', SEL_START, ['Enter'], P + '<p data-quote="">cita</p>'),
 ('cita de 2 líneas, inicio de la 1ª', '<p data-quote="">uno<br>dos</p>', SEL_START, ['Enter'], P + '<p data-quote="">uno<br>dos</p>'),
 ('cita de 2 líneas, inicio de la 2ª', '<p data-quote="">uno<br>dos</p>', "(()=>{ const t=ed.firstElementChild.lastChild; const r=document.createRange(); r.setStart(t,0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()", ['Enter'], None),
 ('cita al final', '<p data-quote="">cita</p>', "caretInto(ed.firstElementChild, true)", ['Enter', 'X'], None),
 ('párrafo normal al inicio', '<p>texto</p>', SEL_START, ['Enter'], None),
 ('viñeta al inicio', '<ul><li>uno</li></ul>', LI0, ['Enter'], P + '<ul><li>uno</li></ul>'),
 ('numerada al inicio', '<ol><li>uno</li><li>dos</li></ol>', LI1, ['Enter'], '<ol><li>uno</li></ol>' + P + '<ol data-cont="" start="2"><li>dos</li></ol>'),
 ('viñeta: primer punto al inicio', '<ul><li>uno</li><li>dos</li></ul>', LI0, ['Enter'], P + '<ul><li>uno</li><li>dos</li></ul>'),
 ('viñeta: punto del medio al inicio', '<ul><li>a</li><li>b</li><li>c</li></ul>', LI1, ['Enter'], '<ul><li>a</li></ul>' + P + '<ul><li>b</li><li>c</li></ul>'),
 ('viñeta: y escribir', '<ul><li>a</li><li>b</li></ul>', LI1, ['Enter', 'X'], '<ul><li>a</li></ul>' + P + '<ul><li>Xb</li></ul>'),
 ('tareas: punto del medio al inicio', '<ul data-task=""><li data-task="0">a</li><li data-task="1">b</li><li data-task="0">c</li></ul>', LI1, ['Enter'], '<ul data-task=""><li data-task="0">a</li></ul>' + P + '<ul data-task=""><li data-task="1">b</li><li data-task="0">c</li></ul>'),
 ('viñeta con sublista al inicio del punto', '<ul><li>a</li><li>b<ul><li>sub</li></ul></li></ul>', LI1, ['Enter'], '<ul><li>a</li></ul>' + P + '<ul><li>b<ul><li>sub</li></ul></li></ul>'),
 ('sublista: punto al inicio (sin cambio)', '<ul><li>a<ul><li>sub1</li><li>sub2</li></ul></li></ul>', at('li', 2), ['Enter'], None),
 ('viñeta: punto vacío (sin cambio)', '<ul><li>a</li><li><br></li></ul>', "caretInto(ed.querySelectorAll('li')[1], false)", ['Enter'], None),
 ('viñeta: en medio del texto (sin cambio)', '<ul><li>uno dos</li></ul>', at('li', 0, 3), ['Enter'], None),
 ('viñeta: al final (sin cambio)', '<ul><li>uno</li></ul>', "caretInto(ed.querySelector('li'), true)", ['Enter', 'X'], None),
 ('bloque de código al inicio', '<div class="cb" data-lang="js"><pre>codigo</pre></div>', "(()=>{ const t=ed.querySelector('pre'); const r=document.createRange(); r.setStart(t.firstChild,0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()", ['Enter'], None),
 ('celda de tabla al inicio', '<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>texto</td></tr></tbody></table>', at('td', 0), ['Enter'], None),
 ('con texto seleccionado', '<h1>Título</h1>', "(()=>{ const t=ed.firstElementChild.firstChild; const r=document.createRange(); r.setStart(t,0); r.setEnd(t,3); getSelection().removeAllRanges(); getSelection().addRange(r) })()", ['Enter'], None),
]
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(**LAUNCH)
    pg = await (await b.new_context(viewport={'width': 1300, 'height': 700})).new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900); kb = pg.keyboard
    out = {}
    for name, html, caret, keys, _ in SCEN:
      await pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}) }", html); await pg.evaluate(caret)
      for k in keys: (await kb.press(k)) if k == 'Enter' else (await kb.type(k))
      await pg.wait_for_timeout(30)
      out[name] = await pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'')")
    golden = None
    if os.path.exists(GOLDEN) and not os.environ.get('UPDATE_GOLDEN'): golden = json.load(open(GOLDEN, encoding='utf-8'))
    else:
      json.dump({n: out[n] for n, _, _, _, e in SCEN if e is None}, open(GOLDEN, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('(valores de referencia escritos en', GOLDEN, ')'); golden = json.load(open(GOLDEN, encoding='utf-8'))
    print('=== Enter al inicio de un encabezado, una cita, un punto de lista o una tarea: arriba queda un párrafo normal ===')
    for name, _, _, _, e in SCEN:
      if e is not None: check(name, out[name] == e, out[name])
    print('=== Lo que NO debe cambiar (valores de referencia) ===')
    for name, _, _, _, e in SCEN:
      if e is None: check(name, out[name] == golden.get(name), [out[name], golden.get(name)])
    # teclado de móvil, deshacer, Markdown, vista
    new = lambda h: pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}) }", h)
    snap = lambda: pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'')")
    await new('<h1>Título</h1>'); await pg.evaluate(SEL_START)
    r = await pg.evaluate("()=>{ const ev = new InputEvent('beforeinput', { inputType: 'insertParagraph', cancelable: true, bubbles: true }); const notPrevented = ed.dispatchEvent(ev); return [notPrevented, ed.innerHTML.replace(/\\u200b/g,'')] }")
    check('teclado de móvil (insertParagraph sin tecla Enter): también empuja el encabezado', r[0] is False and r[1] == P + '<h1>Título</h1>', r)
    await new('<p>antes</p><h1>Título</h1>'); await pg.evaluate(at('h1', 0)); await kb.press('Enter'); await pg.wait_for_timeout(100); await kb.press('Control+z'); await pg.wait_for_timeout(100)
    check('Ctrl+Z devuelve el encabezado a su sitio', await snap() == '<p>antes</p><h1>Título</h1>', await snap())
    await kb.press('Control+Shift+z'); await pg.wait_for_timeout(100)
    check('...y Rehacer lo vuelve a empujar', await snap() == '<p>antes</p>' + P + '<h1>Título</h1>', await snap())
    LIST = '<ul><li>a</li><li>b</li><li>c</li></ul>'
    await new(LIST); await pg.evaluate(LI1); await kb.press('Enter'); await pg.wait_for_timeout(100)
    await kb.type('X'); check('el cursor se queda en el punto: escribir lo modifica y no crea puntos nuevos', await pg.evaluate("[...ed.querySelectorAll('li')].map(l=>l.textContent)") == ['a', 'Xb', 'c'], await snap())
    await kb.press('Control+z'); await pg.wait_for_timeout(100); await kb.press('Control+z'); await pg.wait_for_timeout(100)
    check('Ctrl+Z devuelve la lista entera', await snap() == LIST, await snap())
    await new(LIST); await pg.evaluate(LI1); await kb.press('Enter'); await pg.wait_for_timeout(100)
    await pg.evaluate("caretInto(ed.querySelector('p'), false)"); await kb.press('Shift+Delete'); await pg.wait_for_timeout(150)
    check('si quitas ese párrafo vacío, las dos listas vuelven a ser una', await snap() == LIST, await snap())
    await new('<ol><li>a</li><li>b</li><li>c</li><li>d</li></ol>'); await pg.evaluate(at('li', 2)); await kb.press('Enter'); await pg.wait_for_timeout(150)
    md = await pg.evaluate("docMd()")
    check('numerada: la parte de abajo sigue la numeración (3 y 4, no 1 y 2)', await pg.evaluate("[document.querySelectorAll('ol')[1].start, document.querySelectorAll('ol').length]") == [3, 2] and '3. c\n4. d' in md, md)
    check('...y el Markdown de la parte de arriba sigue siendo 1 y 2', md.startswith('1. a\n2. b'), md)
    await new('<ul><li>a</li><li>b</li></ul>'); await pg.evaluate(LI1)
    r = await pg.evaluate("()=>{ const ev = new InputEvent('beforeinput', { inputType: 'insertParagraph', cancelable: true, bubbles: true }); const notPrevented = ed.dispatchEvent(ev); return [notPrevented, ed.innerHTML.replace(/\\u200b/g,'')] }")
    check('teclado de móvil: también en listas', r[0] is False and r[1] == '<ul><li>a</li></ul><p><br></p><ul><li>b</li></ul>', r)
    await new('<h2>Sección</h2><p>cuerpo</p>'); await pg.evaluate(SEL_START); await kb.press('Enter')
    check('el Markdown deja una línea en blanco arriba y el encabezado intacto', (await pg.evaluate("docMd()")).strip() == '## Sección\n\ncuerpo', repr(await pg.evaluate("docMd()")))
    await kb.type('Mi '); check('...escribir tras empujar edita el texto del encabezado', await pg.evaluate("ed.querySelector('h2').textContent") == 'Mi Sección' and await pg.evaluate("ed.firstElementChild.tagName") == 'P', await snap())
    await pg.evaluate("if(!state.outline) document.getElementById('olBtn').click(); paintOutline()"); await pg.wait_for_timeout(300)
    check('el esquema sigue mostrando el encabezado (el párrafo vacío no aparece)', await pg.evaluate("document.querySelectorAll('#olList .ol-item').length") == 1, await pg.evaluate("document.querySelectorAll('#olList .ol-item').length"))
    check('sin errores de JavaScript', not errs, errs)
    print('\nRESUMEN (Enter al inicio de un formato):', 'todo correcto' if not fails else f'{len(fails)} fallos: {fails}')
    await b.close()
asyncio.run(main())
