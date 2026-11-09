"""Carpeta de trabajo con el servidor local de AtelierRoot (server/atelierroot-server.js): el servidor de verdad, un navegador de verdad y archivos de verdad."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, shutil, socket, subprocess, tempfile, time
from pathlib import Path
from playwright.async_api import async_playwright
from browser import LAUNCH
from ws_common import T, Disk, run_core, seed, until, tree, names, nid, open_doc, type_end, save_now, _has

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIERROOT_APP_DIR', ROOT / 'src'))


def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


def start_server(work, port):
    proc = subprocess.Popen(['node', str(ROOT / 'server' / 'atelierroot-server.js'), '--dir', str(work), '--port', str(port), '--app', str(SRC)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    end = time.time() + 10
    while time.time() < end:
        try: socket.create_connection(('127.0.0.1', port), timeout=0.3).close(); return proc
        except OSError: time.sleep(0.1)
    proc.kill(); raise RuntimeError('el servidor no arrancó: ' + proc.stdout.read())


async def main():
    t = T(); tmp = Path(tempfile.mkdtemp(prefix='atelierroot-ws-')); work = tmp / 'Mis notas'; work.mkdir()
    disk = Disk(work); await seed(disk)
    await disk.write('notas.txt', 'no soy .md'); await disk.write('.git/x.md', 'oculto')
    port = free_port(); srv = start_server(work, port); url = f'http://localhost:{port}/'
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            ctx = await b.new_context(viewport={'width': 1300, 'height': 700}); pg = await ctx.new_page()
            await pg.goto(url); await pg.wait_for_timeout(900)
            state = {'pg': pg}
            async def reopen():
                await state['pg'].reload(); await state['pg'].wait_for_timeout(900); return state['pg']
            pg = await run_core(t, pg, disk, 'http', reopen); state['pg'] = pg

            print('=== 10. Servidor local: dos pestañas, servidor que se cae y diario de seguridad ===')
            t.check('la página recibe el token del servidor y no lo muestra en ningún sitio visible', await pg.evaluate("!!document.querySelector('meta[name=atelierroot-token]') && !document.body.innerText.includes(document.querySelector('meta[name=atelierroot-token]').content)"), '')
            pg2 = await ctx.new_page(); await pg2.goto(url); await pg2.wait_for_timeout(1200)
            await until(lambda: pg2.evaluate("Workspace.active && state.tree.length > 0"), 20)
            t.check('una segunda pestaña abre la misma carpeta', await pg2.evaluate("Workspace.active"), '')
            await open_doc(pg, 'zeta'); await open_doc(pg2, 'zeta')
            await pg2.evaluate("caretInto(ed.lastElementChild, true)"); await pg2.keyboard.type(' DESDE LA OTRA PESTAÑA')
            t.check('lo que escribes en una pestaña llega al archivo', await until(lambda: _has(disk, 'zeta.md', 'DESDE LA OTRA'), 6), await disk.read('zeta.md'))
            t.check('...y la primera pestaña lo ve sin tocar nada (el servidor avisa del cambio)', await until(lambda: pg.evaluate("ed.innerText.includes('DESDE LA OTRA PESTAÑA')"), 9), await pg.evaluate("ed.innerText"))
            await pg2.close()
            # el servidor se cae mientras escribes
            srv.terminate(); srv.wait(); await asyncio.sleep(0.4)
            await open_doc(pg, 'zeta'); await pg.evaluate("caretInto(ed.lastElementChild, true)"); await pg.keyboard.type(' ESCRITO SIN SERVIDOR')
            ok = await until(lambda: pg.evaluate("Workspace.status === 'offline' || Workspace.status === 'error'"), 12)
            t.check('si el servidor se cae, el indicador lo dice (no finge que está guardado)', ok, await pg.evaluate("Workspace.status"))
            t.check('...y lo escrito sigue en el editor', 'ESCRITO SIN SERVIDOR' in await pg.evaluate("ed.innerText"), '')
            t.check('...sin tocar el archivo del disco', 'SIN SERVIDOR' not in (await disk.read('zeta.md') or ''), '')
            srv = start_server(work, port)                                                 # el servidor vuelve (con otro token: la página vieja ya no sirve)
            await pg.reload(); await pg.wait_for_timeout(1500)                            # recargar: el diario de seguridad guardó lo último que escribiste
            await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"), 20)
            ok = await until(lambda: _has(disk, 'zeta.md', 'ESCRITO SIN SERVIDOR'), 10)
            t.check('al volver el servidor y recargar, lo que escribiste sin servidor se recupera y llega al archivo', ok, await disk.read('zeta.md'))
            t.check('...y los otros archivos no se tocaron', (await disk.read('Intro.md') or '').count('MI VERSION') <= 1, '')
            await b.close()
    finally:
        srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    print(f'\nRESUMEN (carpeta con servidor local): {t.n} comprobaciones,', 'todo correcto' if not t.fails else f'{len(t.fails)} fallos: {t.fails}')
asyncio.run(main())
