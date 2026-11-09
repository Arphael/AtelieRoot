import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, re
from playwright.async_api import async_playwright
from browser import URL, LAUNCH
errs = []; fails = []
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '→ ' + str(extra)))
  if not cond: fails.append(name)
YES = [r'C:\Users\ana', 'C:\\', r'D:\Proyectos\AtelierRoot\atelierroot.html', r'c:\temp', r'C:\Program', r'\\servidor\recurso\carpeta', r'%USERPROFILE%\.config-tool\\', r'%APPDATA%', r'%USERPROFILE%', r'.\run.bat', r'..\lib\x', r'~\notas', r'C:\Users\ana\.config\skills\x.md']
NO = [r'Nota:\x', 'C:', r'\\x', r'\Users\ana', '50%', r'%%\x', 'C:/Users/ana', r'a\b', r'\n', 'x:y']
async def main():
  async with async_playwright() as p:
    b = await p.chromium.launch(**LAUNCH)
    ctx = await b.new_context(viewport={'width': 1300, 'height': 700}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900); kb = pg.keyboard
    dom = lambda: pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'').replace(/&nbsp;/g,' ').replace(/<br><\\/p>/g,'</p>')"); md = lambda: pg.evaluate("docMd()")
    CODE = lambda t: f'<span data-code="">{t}</span>'
    async def fresh(html='<p><br></p>', caret="caretInto(ed.firstElementChild, true)"):
      await pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}); }", html); await pg.evaluate(caret)
    async def typed(keys, html='<p><br></p>'):
      await fresh(html)
      for k in keys: (await kb.press(k)) if k in ('Enter', 'Tab') else (await kb.type(k))
      return await dom()
    async def paste(text):
      await pg.evaluate("(()=>{ const p=ed.firstElementChild; if (p && p.tagName==='P' && !p.textContent.trim()) caretInto(p, false) })()")
      await pg.evaluate("t=>{ const dt=new DataTransfer(); dt.setData('text/plain', t); ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})) }", text); await pg.wait_for_timeout(150)

    print('=== 1. la regla, palabra por palabra ===')
    got = await pg.evaluate("w=>w.map(x=>[x, isCodeLike(x)])", YES); bad = [x for x, v in got if not v]
    check(f'se reconocen como ruta de Windows ({len(YES)} casos)', not bad, bad)
    got = await pg.evaluate("w=>w.map(x=>[x, isCodeLike(x)])", NO); bad = [x for x, v in got if v]
    check(f'NO se reconocen ({len(NO)} casos)', not bad, bad)

    print('=== 2. al teclear ===')
    d = await typed([r'(C:\Users\ana) ', 'sigue']); check('«(C:\\Users\\ana)» + espacio : el código no incluye los paréntesis', d == f'<p>({CODE(r"C:\Users\ana")}) sigue</p>', d)
    d = await typed([r'Abre C:\Users\ana ', 'ahora']); check('suelta, y lo que sigue queda fuera del código', d == f'<p>Abre {CODE(r"C:\Users\ana")} ahora</p>', d)
    d = await typed([r'Ve a C:\Users\ana.', ' ', 'Luego']); check('con punto final', d == f'<p>Ve a {CODE(r"C:\Users\ana")}. Luego</p>', d)
    d = await typed([r'"C:\Users\ana" ', 'fin']); check('entre comillas', d == f'<p>"{CODE(r"C:\Users\ana")}" fin</p>', d)
    d = await typed([r'- D:\Proyectos\AtelierRoot', 'Enter', 'otro']); check('en una lista, con Enter', d == f'<ul><li>{CODE(r"D:\Proyectos\AtelierRoot")}</li><li>otro</li></ul>', d)
    d = await typed([r'## En %APPDATA%\Editor', 'Enter', 'x']); check('con variable de entorno, en un encabezado', f'<h2>En {CODE(r"%APPDATA%\Editor")}</h2>' in d, d)
    d = await typed([r'Red \\servidor\recurso\x y .\run.bat ', 'fin']); check('ruta de red y ruta relativa', d.count('data-code') == 2, d)
    d = await typed([r'C:\Program Files\Git\bin ', 'fin']); check('con espacios en los nombres (C:\\Program Files\\Git\\bin): UN solo código', d == f'<p>{CODE(r"C:\Program Files\Git\bin")} fin</p>', d)
    d = await typed([r'C:\Program Files (x86)\Foo\bar ', 'fin']); check('...también con «Program Files (x86)»', d == f'<p>{CODE(r"C:\Program Files (x86)\Foo\bar")} fin</p>', d)
    d = await typed([r'C:\Program Files y luego sigo']); check('si lo que sigue no continúa la ruta, no se traga el resto de la frase', 'y luego sigo' in re.sub(r'<[^>]+>', '', d) and 'y luego' not in ''.join(re.findall(r'<span data-code="">([^<]*)</span>', d)), d)
    d = await typed([r'Mira C:\Users\ana y /usr/bin y src/app ', 'fin']); check('conviven con las rutas con «/» y los comandos', d.count('data-code') == 3, d)
    d = await typed([r'texto con \n y 50% y a:b ', 'fin']); check('lo que no es ruta no se toca', 'data-code' not in d, d)
    await fresh(); await kb.type(r'C:\Users\ana'); await kb.press(' '); await kb.press('Control+z'); await pg.wait_for_timeout(100); d = await dom()
    check('Ctrl+Z deshace solo la conversión', 'data-code' not in d and r'C:\Users\ana' in d, d)
    await fresh(); await kb.type(r'Mira C:\Users\ana hoy'); check('Markdown: «Mira `C:\\Users\\ana` hoy»', await md() == r'Mira `C:\Users\ana` hoy', await md())
    await fresh(); await kb.type(r'Ver C:\Users\ana'); await kb.press(' '); await kb.type('ZZ'); d = await dom(); check('el texto tras el espacio queda fuera del código', d == f'<p>Ver {CODE(r"C:\Users\ana")} ZZ</p>', d)
    await fresh(CODE(r'C:\Users\ana').join(['<p>', '</p>']), "caretInto(ed.firstElementChild, true)"); await kb.press(' '); await kb.type('ZZ'); check('con el cursor al final de un código de ruta de Windows ya existente, el espacio lo cierra', await dom() == f'<p>{CODE(r"C:\Users\ana")} ZZ</p>', await dom())
    await fresh(CODE(r'C:\Program Files\Git').join(['<p>', '</p>']), "caretInto(ed.firstElementChild, true)"); await kb.press(' '); await kb.type('ZZ'); check('...también si la ruta lleva espacios dentro', await dom() == f'<p>{CODE(r"C:\Program Files\Git")} ZZ</p>', await dom())
    await fresh(CODE('git commit').join(['<p>', '</p>']), "caretInto(ed.firstElementChild, true)"); await kb.press(' '); await kb.type('-m'); check('un código normal sigue admitiendo espacios', 'git commit -m' in await pg.evaluate("ed.querySelector('[data-code]').textContent"), await dom())
    await fresh('<table><thead><tr><th>a</th></tr></thead><tbody><tr><td><br></td></tr></tbody></table>', "(()=>{ const c=ed.querySelector('td'); const r=document.createRange(); r.selectNodeContents(c); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r) })()"); await kb.type(r'C:\x\y '); check('en una celda de tabla', 'data-code' in await pg.evaluate("ed.querySelector('td').innerHTML"), await dom())
    await fresh(); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(100); await kb.type(r'cd C:\Users\ana '); check('dentro de un bloque de código no se toca', 'data-code' not in await dom(), await dom())

    print('=== 3. al pegar ===')
    await fresh(); await paste(r'(C:\Users\ana)'); d = await dom(); check('pegar «(C:\\Users\\ana)»', d == f'<p>({CODE(r"C:\Users\ana")})</p>', d)
    await fresh(); await paste(r'Mira C:\Users\ana\.config\x y %APPDATA%\Editor fin'); d = await dom(); check('varias en una frase, con «\\.» dentro (la barra se conserva)', d == f'<p>Mira {CODE(r"C:\Users\ana\.config\x")} y {CODE(r"%APPDATA%\Editor")} fin</p>', d)
    await fresh(); await paste(r'C:\Program Files\AtelierRoot\app.exe listo'); d = await dom(); check('con espacios: «C:\\Program Files\\AtelierRoot\\app.exe» entera', d == f'<p>{CODE(r"C:\Program Files\AtelierRoot\app.exe")} listo</p>', d)
    await fresh(); await paste(r'Instalado en C:\Program Files (x86)\Foo\bar.'); d = await dom(); check('con «(x86)» y punto final', d == f'<p>Instalado en {CODE(r"C:\Program Files (x86)\Foo\bar")}.</p>', d)
    await fresh(); await paste(r'Copia C:\a\b C:\c\d ya'); d = await dom(); check('dos rutas seguidas son dos códigos, no una sola', d.count('data-code') == 2 and CODE(r'C:\a\b') in d and CODE(r'C:\c\d') in d, d)
    await fresh(); await paste(r'"C:\Program Files\x"'); d = await dom(); check('entre comillas y con espacios: las comillas quedan fuera', d == f'<p>"{CODE(r"C:\Program Files\x")}"</p>', d)
    await fresh(); await paste('- C:\\Users\\a\n- D:\\datos\\b\n- texto normal'); d = await dom(); check('lista de rutas', d.count('data-code') == 2 and d.count('<li>') == 3, d)
    await fresh(); await paste('| ruta | uso |\n| --- | --- |\n| C:\\Users\\a | x |'); d = await dom(); check('en una tabla pegada', d.count('data-code') == 1, d)
    await fresh(); await paste(r'`C:\Users\a` ya era código'); d = await dom(); check('lo que ya era código no se duplica', d.count('data-code') == 1 and '<span data-code=""><span' not in d, d)
    await fresh(); await paste(r'C:\Users\ana'); await kb.press(' '); await kb.type('ZZ'); d = await dom(); check('tras pegar una ruta, el espacio y lo siguiente van fuera del código', d == f'<p>{CODE(r"C:\Users\ana")} ZZ</p>', d)
    await fresh('<p>abc</p>', "caretInto(ed.firstElementChild, true)"); await paste(r'C:\Users\x'); check('pegada pegada a una palabra («abc»): esa no se convierte', 'data-code' not in await dom(), await dom())
    await fresh(); await paste(r'Ruta: C:\Users\ana\ y C:\\temp'); check('ruta terminada en «\\»', 'data-code' in await dom(), await dom())
    await fresh(); await paste(r'Usa /clear y src/app y C:\Users\a'); check('mezcla con comandos y rutas con «/»', (await dom()).count('data-code') == 3, await dom())
    await fresh(); await paste('el 50% de C:\\x\\y \\n literal'); d = await dom(); check('texto con «\\n» y «%» alrededor no se confunde', d.count('data-code') == 1 and CODE(r'C:\x\y') in d, d)
    await fresh(); await paste(r'C:\Users\ana'); await kb.press('Control+z'); await pg.wait_for_timeout(100); check('Ctrl+Z deshace el pegado entero', await pg.evaluate("ed.textContent.replace(/\\u200b/g,'').trim()") == '', await dom())

    print('=== 4. Ctrl+Z tras convertir a bloque de código ===')
    snap = lambda: pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'')")
    async def conv_case(name, setup, act, undos=1):
      await fresh(*setup); before = await snap(); await act(); await pg.wait_for_timeout(700)
      mid = await snap(); okc = 'class="cb"' in mid
      for _ in range(undos): await kb.press('Control+z'); await pg.wait_for_timeout(250)
      after = await snap(); pend = await pg.evaluate("ed.innerHTML !== History.last")
      check(f'{name}: convierte y UN Ctrl+Z lo deshace', okc and after == before, [okc, before[:60], after[:80]])
      check(f'   ...sin dejar cambios fantasma', not pend, '')
      await kb.press('Control+Shift+z'); await pg.wait_for_timeout(500); redo = await snap()
      check(f'   ...y Rehacer lo vuelve a convertir', 'class="cb"' in redo, redo[:80])
      await kb.press('Control+z'); await pg.wait_for_timeout(300); check('   ...y otro Ctrl+Z lo vuelve a deshacer', await snap() == before, '')
    async def fence_enter():
      await kb.type('```'); await kb.press('Enter')
    await conv_case('escribir ``` y Enter', ("<p><br></p>", "caretInto(ed.firstElementChild, true)"), fence_enter)
    async def fence_lang():
      await kb.type('```js'); await kb.press('Enter')
    await conv_case('escribir ```js y Enter', ("<p><br></p>", "caretInto(ed.firstElementChild, true)"), fence_lang)
    await conv_case('botón de bloque de código sobre un párrafo', ("<p>console.log(1)</p>", "caretInto(ed.firstElementChild, true)"), lambda: pg.evaluate("document.querySelector('[data-block=pre]').click()"))
    async def btn_sel():
      await pg.evaluate("(()=>{ const r=document.createRange(); r.selectNodeContents(ed); getSelection().removeAllRanges(); getSelection().addRange(r) })()"); await pg.evaluate("document.querySelector('[data-block=pre]').click()")
    await conv_case('botón sobre texto seleccionado de 2 líneas', ("<p>uno</p><p>dos</p>", "0"), btn_sel)
    async def slash_code():
      await kb.type('/codigo'); await kb.press('Enter')
    await conv_case('menú «/» → código', ("<p><br></p>", "caretInto(ed.firstElementChild, true)"), slash_code)
    await conv_case('«Ordenar» con ``` escrito como texto', ("<p>```</p><p>x = 1</p><p>```</p>", "caretInto(ed.firstElementChild, true)"), lambda: pg.evaluate("document.getElementById('tidyBtn').click()"))
    await conv_case('pegar un bloque ```', ("<p><br></p>", "caretInto(ed.firstElementChild, false)"), lambda: paste('```python\nprint(1)\n```'))
    await fresh("<p>antes</p><p>console.log(1)</p><p>después</p>", "(()=>{ const p=ed.children[1]; const r=document.createRange(); r.selectNodeContents(p); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r) })()")
    before = await snap(); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(700); await kb.press('Control+z'); await pg.wait_for_timeout(300)
    check('en medio del documento: deshacer no toca los párrafos de alrededor', await snap() == before, await snap())
    await fresh("<p>uno</p><p>dos</p>", "caretInto(ed.children[0], true)"); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(700)
    await pg.evaluate("caretInto(ed.querySelector('p'), true)"); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(700)
    check('dos conversiones seguidas dan dos bloques', await pg.evaluate("ed.querySelectorAll('.cb').length") == 2, await pg.evaluate("ed.querySelectorAll('.cb').length"))
    await kb.press('Control+z'); await pg.wait_for_timeout(300); n1 = await pg.evaluate("ed.querySelectorAll('.cb').length"); await kb.press('Control+z'); await pg.wait_for_timeout(300); n2 = await pg.evaluate("ed.querySelectorAll('.cb').length")
    check('...se deshacen de una en una (2 → 1 → 0)', [n1, n2] == [1, 0], [n1, n2])
    await fresh("<p>texto</p>", "caretInto(ed.firstElementChild, true)"); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(700)
    src = "ed.querySelector('.cb-src')"; await pg.evaluate("(()=>{ const s = %s; s.focus(); const r=document.createRange(); r.selectNodeContents(s); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r) })()" % src)
    await kb.type(' mas'); await pg.wait_for_timeout(700); t1 = await pg.evaluate("ed.querySelector('.cb-src').innerText")
    await kb.press('Control+z'); await pg.wait_for_timeout(300); t2 = await pg.evaluate("ed.querySelector('.cb') ? ed.querySelector('.cb-src').innerText : '(sin bloque)'")
    check('escribir DENTRO de un bloque y deshacer quita lo escrito (sin quitar el bloque)', ' mas' in t1 and ' mas' not in t2 and 'class="cb"' in await snap(), [t1, t2])
    await fresh("<p>texto</p>", "caretInto(ed.firstElementChild, true)"); await kb.type(' nuevo'); await pg.wait_for_timeout(700)
    await kb.press('Control+z'); await pg.wait_for_timeout(250); check('un cambio real sin registrar sigue deshaciéndose (el arreglo no oculta ediciones)', 'nuevo' not in await pg.evaluate("ed.textContent"), await pg.evaluate("ed.textContent"))
    await fresh("<p>texto</p>", "caretInto(ed.firstElementChild, true)"); await pg.evaluate("document.querySelector('[data-block=pre]').click()"); await pg.wait_for_timeout(700)
    await pg.evaluate("document.querySelector('.cb-del').click()"); await pg.wait_for_timeout(300); await kb.press('Control+z'); await pg.wait_for_timeout(300)
    check('borrar un bloque con su botón y Ctrl+Z lo trae de vuelta', 'class="cb"' in await snap(), '')
    check('sin errores de JavaScript', not errs, errs)
    print('\nRESUMEN (rutas de Windows y Ctrl+Z en bloques):', 'todo correcto' if not fails else f'{len(fails)} fallos: {fails}')
    await b.close()
asyncio.run(main())
