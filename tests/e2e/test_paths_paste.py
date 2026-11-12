import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine
ENGINES = ('chromium', 'webkit')   # Firefox: synthetic paste events arrive empty and contenteditable differs (Enter in quotes, replace inside bold); see FAQ
errs=[]; fails=[]
def check(name, cond, extra=''):
  print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '→ ' + str(extra)))
  if not cond: fails.append(name)
YES = ['/clear', '/compact', '/plugin:deploy', '/mcp__github__issue', '/usr/bin/env', '/init', 'src/app', 'docs/guia', 'src/index.js', 'node_modules/.bin', './run.sh', '../lib/x', '~/notas', 'src/', 'frontend/backend', 'a1/b2', 'v1/v2', 'my_dir/sub-dir/file.txt', 'public/img/logo.png', r'src-tauri\app-icon.svg', r'src\js\00-base.js', r'icons\32x32.png', 'docs\\adr\\', 'Fix.prompt.md', 'README.md', 'app.py', 'package.json', 'index.html', 'styles.min.css', '.gitignore', 'data_2024.csv', 'AtelierRoot.exe', 'Cargo.lock']
NO  = ['y/o', 'and/or', 'yes/no', 'on/off', 'he/she', 'input/output', 'si/no', '1/2', '24/7', '12/10/2026', '1.5/2.5', 'TCP/IP', 'I/O', 'Windows/Linux', 'ON/OFF', 'a/b', 's/n', 'w/o', 'km/h', 'c:/usr', 'https://x.com/a', 'http://a/b', 'www.x.com/p', 'x.com/a', 'foo.org/bar', '//comentario', '/', '/1', '/a', '//', 'solo', 'a', '*/x*', '**/x**', 'user@host.com/x', 'ab/', 'pros/cons', 'read/write', r'a\b', r'y\o', r'Si\No', 'p.ej', 'e.g', 'a.m', 'etc', '3.14', 'v1.2', 'U.S.A', 'Dr.House', 'fin.Luego', 'google.com', 'hola.mundo', 'v2.0.1']
async def main():
  async with async_playwright() as p:
    b = await engine(p).launch(**LAUNCH)
    ctx = await b.new_context(viewport={'width':1300,'height':700}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL); await pg.wait_for_timeout(900); kb = pg.keyboard
    dom = lambda: pg.evaluate("ed.innerHTML.replace(/\\u200b/g,'').replace(/&nbsp;/g,' ').replace(/<br><\\/p>/g,'</p>')"); md = lambda: pg.evaluate("docMd()")
    CODE = lambda t: f'<span data-code="">{t}</span>'
    async def fresh(html='<p><br></p>', caret="caretInto(ed.firstElementChild, true)"):
      await pg.evaluate("h=>{ ed.innerHTML=h; ensureBlocks(); History.init(); ed.focus({preventScroll:true}); }", html); await pg.evaluate(caret)
    async def paste(text, html=None):
      await pg.evaluate("(()=>{ const p=ed.firstElementChild; if (p && p.tagName==='P' && !p.textContent.trim()) caretInto(p, false) })()")
      await pg.evaluate("([t,h])=>{ const dt=new DataTransfer(); if(t!=null) dt.setData('text/plain', t); if(h) dt.setData('text/html', h); ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true})) }", [text, html]); await pg.wait_for_timeout(120)
    print('=== la regla (palabra por palabra) ===')
    got = await pg.evaluate("w=>w.map(x=>[x, isCodeLike(x)])", YES)
    bad = [x for x, v in got if not v]; check(f'se reconocen como comando o ruta ({len(YES)} casos)', not bad, bad)
    got = await pg.evaluate("w=>w.map(x=>[x, isCodeLike(x)])", NO)
    bad = [x for x, v in got if v]; check(f'NO se reconocen ({len(NO)} casos de prosa, URLs, fechas, fracciones…)', not bad, bad)
    check('puntuación y paréntesis alrededor', await pg.evaluate("['(src/app)', '«/clear»', 'docs/guia.', '\"/init\",'].map(x=>{ const c=chunkCore(x); return c.core })") == ['src/app', '/clear', 'docs/guia', '/init'], '')

    print('=== al teclear: rutas ===')
    async def typed(keys, html='<p><br></p>'):
      await fresh(html)
      for k in keys: (await kb.press(k)) if k in ('Enter', 'Tab') else (await kb.type(k))
      return await dom()
    d = await typed(['Edita src/app ahora']); check('«Edita src/app ahora»', d == f'<p>Edita {CODE("src/app")} ahora</p>', d)
    d = await typed(['Mira docs/guia.', ' ', 'Luego']); check('con punto final: «docs/guia.»', d == f'<p>Mira {CODE("docs/guia")}. Luego</p>', d)
    d = await typed(['Ejecuta ./run.sh y ~/notas ya']); check('./run.sh y ~/notas', d == f'<p>Ejecuta {CODE("./run.sh")} y {CODE("~/notas")} ya</p>', d)
    d = await typed(['- public/img/logo.png', 'Enter', 'otro']); check('en una lista, con Enter', d == f'<ul><li>{CODE("public/img/logo.png")}</li><li>otro</li></ul>', d)
    d = await typed(['usa y/o a/b 1/2 24/7 TCP/IP https://x.com/a 12/10/2026 fin ']); check('la prosa corriente no se toca', 'data-code' not in d, d)
    d = await typed(['uno /clear dos src/app tres ']); check('comandos y rutas mezclados', d.count('data-code') == 2, d)
    await fresh(); await kb.type('Ver src/app'); await kb.press(' '); await kb.press('Control+z'); await pg.wait_for_timeout(100); d = await dom(); check('Ctrl+Z deshace solo la conversión', 'data-code' not in d and 'src/app' in d, d)
    await fresh(); await kb.type('Ver src/app ya'); check('Markdown: «Ver `src/app` ya»', await md() == 'Ver `src/app` ya', await md())

    print('=== al pegar ===')
    await fresh(); await paste('Ejecuta /clear y luego /compact.'); d = await dom(); check('texto con comandos', d == f'<p>Ejecuta {CODE("/clear")} y luego {CODE("/compact")}.</p>', d)
    await fresh(); await paste('Edita src/app y docs/guia.'); d = await dom(); check('texto con rutas', d == f'<p>Edita {CODE("src/app")} y {CODE("docs/guia")}.</p>', d)
    await fresh(); await paste('- /init\n- ./run.sh\n- ~/notas\n- texto normal'); d = await dom(); check('lista pegada: cada punto con su código', d.count('data-code') == 3 and d.count('<li>') == 4, d)
    await fresh(); await paste('## Usa /help aquí'); check('en un encabezado', f'<h2>Usa {CODE("/help")} aquí</h2>' in await dom(), await dom())
    await fresh(); await paste('y/o 1/2 https://x.com/a a/b 12/10/2026 TCP/IP www.x.com/p c:/usr si/no'); d = await dom(); check('la prosa, URLs, fechas y dominios pegados no se convierten', 'data-code' not in d, d)
    await fresh(); await paste('Mira [la guía](docs/guia) y https://x.com/docs/a ya'); d = await dom(); check('en un enlace no se convierte', 'data-code' not in d and '<a href=' in d, d)
    await fresh(); await paste('usa `/clear` y `src/app` ya'); d = await dom(); check('lo que ya era código no se duplica', d.count('data-code') == 2 and '<span data-code=""><span' not in d, d)
    await fresh(); await paste('```\n/clear\nsrc/app\n```'); d = await dom(); check('un bloque de código pegado queda como está', d.count('data-code') == 0 and 'cb' in d, d)
    await fresh(); await paste('| ruta | uso |\n| --- | --- |\n| src/app | /clear |'); d = await dom(); check('en una tabla pegada', d.count('data-code') == 2, d)
    await fresh(); await paste(None, '<p>Mira src/app y /init hoy</p>'); d = await dom(); check('pegado enriquecido (HTML)', d == f'<p>Mira {CODE("src/app")} y {CODE("/init")} hoy</p>', d)
    await fresh('<p>abc</p>', "caretInto(ed.firstElementChild, true)"); await paste('/clear fin'); d = await dom(); check('pegado pegado a otra palabra («abc»+«/clear»): esa no se convierte', 'data-code' not in d or d.count('data-code') == 0, d)
    await fresh('<p>abc </p>', "caretInto(ed.firstElementChild, true)"); await paste('/clear fin'); d = await dom(); check('pegado tras un espacio: sí', f'{CODE("/clear")}' in d, d)
    await fresh('<p>x</p>', "(()=>{ const t=ed.firstElementChild.firstChild; const r=document.createRange(); r.setStart(t,0); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()"); await paste('hola /clear'); d = await dom(); check('el último comando pegado, pegado a texto que sigue («/clear»+«x»), no se convierte', 'data-code' not in d, d)
    await fresh('<p>antes <span data-code="">abc</span> despues</p>', "(()=>{ const t=ed.querySelector('[data-code]').firstChild; const r=document.createRange(); r.setStart(t,1); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()"); await paste('src/app'); d = await dom(); check('pegando dentro de un código existente no se anida', '<span data-code=""><span' not in d and d.count('data-code') == 1, d)
    await fresh('<p><a href="https://x.com">enlace</a></p>', "(()=>{ const t=ed.querySelector('a').firstChild; const r=document.createRange(); r.setStart(t,2); r.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(r) })()"); await paste('src/app'); check('pegando dentro de un enlace tampoco', '<a href="https://x.com"><span' not in await dom(), await dom())
    await fresh('<p><br></p>'); await pg.evaluate("(()=>{ ed.innerHTML='<div class=\"cb\" data-lang=\"js\"><pre>x</pre></div><p><br></p>'; ensureBlocks(); })()")
    await fresh(); await paste('Revisa /clear'); await kb.press('Control+z'); await pg.wait_for_timeout(100); check('Ctrl+Z deshace el pegado entero', await pg.evaluate("ed.textContent.replace(/\\u200b/g,'').trim()") == '', await dom())
    await fresh(); await paste('Revisa /clear y src/app'); check('Markdown del pegado: «Revisa `/clear` y `src/app`»', await md() == 'Revisa `/clear` y `src/app`', await md())
    big = ' '.join(f'palabra{i} src/mod{i}/x.js texto y/o 1/2' for i in range(800)); await fresh(); import time; t0 = time.time(); await paste(big); dt = time.time() - t0
    check('un pegado largo (800 rutas) sigue siendo rápido', dt < 3 and (await dom()).count('data-code') == 800, [round(dt, 2), (await dom()).count('data-code')])
    check('sin errores de JavaScript', not errs, errs)
    print('\nRESUMEN (rutas y pegado):', 'todo correcto' if not fails else f'{len(fails)} fallos: {fails}')
    await b.close()
asyncio.run(main())
