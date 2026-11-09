"""Carpeta de trabajo con la API de carpetas del navegador (File System Access).
Se usa OPFS, que es la implementación real de esa API en Chromium: el código de FsBackend se ejecuta de verdad."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio, http.server, socket, threading
from functools import partial
from pathlib import Path
from playwright.async_api import async_playwright
from browser import LAUNCH
from ws_common import T, OpfsDisk, run_core, seed, until, tree, names, nid, open_doc, type_end, save_now, ask, _has

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(os.environ.get('ATELIERROOT_APP_DIR', ROOT / 'src'))
INIT = """
window.__WS_POLL_MS = 400;                                              // en las pruebas se mira cada 0,4 s (en uso real, cada 3 s)
window.__perm = { query: sessionStorage.getItem('__pq') || 'granted', request: 'granted' };       // el estado del permiso sobrevive a las recargas
const _root = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('ws', { create: true });
window.showDirectoryPicker = async () => _root();
// En el Chromium sin interfaz, leer un handle de IndexedDB cierra la página; el almacén de la prueba guarda solo el nombre y reconstruye el handle.
window.__WS_HANDLES = {
  async put(k, h){ sessionStorage.setItem('__wsh.' + k, h.name); },
  async get(k){ const n = sessionStorage.getItem('__wsh.' + k); return n ? (await navigator.storage.getDirectory()).getDirectoryHandle(n) : null; },
  async del(k){ sessionStorage.removeItem('__wsh.' + k); },
};
const _q = FileSystemHandle.prototype.queryPermission, _r = FileSystemHandle.prototype.requestPermission;
FileSystemHandle.prototype.queryPermission = async function(o){ return window.__perm.query; };
FileSystemHandle.prototype.requestPermission = async function(o){ return window.__perm.request; };
"""


def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), partial(Q, directory=str(SRC)))
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv, port


async def main():
    t = T(); srv, port = serve(); url = f'http://localhost:{port}/index.html'
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        ctx = await b.new_context(viewport={'width': 1300, 'height': 700}); await ctx.add_init_script(INIT)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(url); await pg.wait_for_timeout(900)
        disk = OpfsDisk(pg)
        print('=== 0. Modo temporal y primera carpeta ===')
        t.check('sin carpeta ni servidor, AtelierRoot empieza en modo temporal y lo dice', await pg.evaluate("Workspace.active === false && Workspace.status === 'off'") and 'temporal' in (await pg.evaluate("document.getElementById('wsState').textContent")).lower(), await pg.evaluate("document.getElementById('wsState').textContent"))
        ok = await until(lambda: pg.evaluate("document.getElementById('veil').classList.contains('show') && document.getElementById('card').innerText.includes('en una carpeta')"), 4)
        t.check('...y ofrece abrir una carpeta (Chrome/Edge pueden)', ok, await pg.evaluate("document.getElementById('card').innerText"))
        t.check('...con la opción de seguir sin carpeta', 'Seguir sin carpeta' in await pg.evaluate("document.getElementById('card').innerText"), '')
        await pg.evaluate("document.getElementById('veil').classList.remove('show')")
        # un documento de verdad en modo temporal, para ver que se ofrece copiarlo
        await pg.click('#newDoc'); await ask(pg, 'Mi nota temporal')
        await type_end(pg, 'Mi nota temporal', ' contenido temporal importante'); await asyncio.sleep(0.6)
        await seed(disk)
        await pg.evaluate("wsPickFolder()")
        await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"), 15)
        t.check('abrir la carpeta (selector del navegador + permiso) la carga', await pg.evaluate("Workspace.active && Workspace.kind === 'fs'"), await pg.evaluate("[Workspace.active, Workspace.kind]"))
        ok = await until(lambda: pg.evaluate("document.getElementById('card').innerText.includes('Copiar tus documentos temporales')"), 4)
        t.check('como había un documento temporal con contenido, ofrece copiarlo a la carpeta', ok, await pg.evaluate("document.getElementById('card').innerText"))
        await pg.click('#card [data-yes]'); await asyncio.sleep(1.2)
        fl = await disk.files()
        t.check('...y lo copia a «Del modo temporal» como .md', any(f.startswith('Del modo temporal/Mi nota temporal') for f in fl) and 'contenido temporal importante' in (await disk.read('Del modo temporal/Mi nota temporal.md') or ''), fl)
        await disk.delete('Del modo temporal/Mi nota temporal.md'); await disk.rmdir('Del modo temporal')
        await until(lambda: pg.evaluate("(() => { let r = false; walk(state.tree, n => { if (n.name === 'Del modo temporal') r = true; }); return !r; })()"), 6)
        state = {'pg': pg}
        async def reopen():
            await state['pg'].reload(); await state['pg'].wait_for_timeout(1200); return state['pg']
        pg = await run_core(t, pg, disk, 'fs', reopen); state['pg'] = pg
        errs2 = list(errs)

        print('=== 10. Carpeta del navegador: recordarla, permisos y salir ===')
        t.check('al recargar, la carpeta recordada se abre sola (el navegador conserva el permiso)', await pg.evaluate("Workspace.active && Workspace.kind === 'fs'"), '')
        # el navegador pide permiso de nuevo (cada sesión nueva)
        await pg.evaluate("sessionStorage.setItem('__pq', 'prompt'); window.__perm.query = 'prompt'"); await pg.reload(); await pg.wait_for_timeout(1500)
        ok = await until(lambda: pg.evaluate("Workspace.active === false && !!Workspace.remembered"), 6)
        t.check('si el navegador vuelve a pedir permiso, no abre la carpeta a escondidas: se queda en modo temporal', ok, await pg.evaluate("[Workspace.active, !!Workspace.remembered]"))
        await until(lambda: pg.evaluate("document.getElementById('card').innerText.includes('Continuar con')"), 4)
        t.check('...y ofrece «Continuar con «nombre»» (un clic basta para darlo)', await pg.evaluate("document.getElementById('card').innerText.includes('Continuar con')"), await pg.evaluate("document.getElementById('card').innerText"))
        await pg.evaluate("window.__perm.query = 'prompt'"); await pg.evaluate("window.__perm.request = 'denied'")
        await pg.evaluate("[...document.querySelectorAll('#card button')].find(b => b.textContent.includes('Continuar con')).click()"); await asyncio.sleep(0.8)
        t.check('si el usuario niega el permiso, no se abre y lo explica', await pg.evaluate("Workspace.active === false"), '')
        await pg.evaluate("sessionStorage.removeItem('__pq'); window.__perm.request = 'granted'; window.__perm.query = 'granted'")
        await pg.evaluate("wsChipClick()"); await asyncio.sleep(0.3)
        await pg.evaluate("[...document.querySelectorAll('#card button')].find(b => b.textContent.includes('Continuar con')).click()")
        ok = await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"), 15)
        t.check('con permiso concedido, «Continuar con…» abre la carpeta con todo', ok and 'zeta' in names(await tree(pg)), names(await tree(pg)))
        # el permiso se pierde mientras trabajas
        await open_doc(pg, 'zeta')
        await pg.evaluate("window.__orig = FileSystemFileHandle.prototype.createWritable; FileSystemFileHandle.prototype.createWritable = async function(){ throw new DOMException('permiso retirado', 'NotAllowedError'); }; 0")
        await pg.evaluate("caretInto(ed.lastElementChild, true)"); await pg.keyboard.type(' SIN PERMISO')
        ok = await until(lambda: pg.evaluate("Workspace.status === 'denied'"), 8)
        t.check('si el navegador retira el permiso, el indicador avisa (no finge que guarda)', ok, await pg.evaluate("Workspace.status"))
        t.check('...y lo escrito sigue en el editor', 'SIN PERMISO' in await pg.evaluate("ed.innerText"), '')
        await pg.evaluate("FileSystemFileHandle.prototype.createWritable = window.__orig; 0")
        await pg.evaluate("wsChipClick()"); await asyncio.sleep(0.3)
        t.check('el cuadro de la carpeta ofrece «Volver a dar permiso»', 'Volver a dar permiso' in await pg.evaluate("document.getElementById('card').innerText"), await pg.evaluate("document.getElementById('card').innerText"))
        await pg.evaluate("[...document.querySelectorAll('#card button')].find(b => b.textContent.includes('Volver a dar permiso')).click()")
        ok = await until(lambda: _has(disk, 'zeta.md', 'SIN PERMISO'), 10)
        t.check('al darlo, lo que escribiste sin permiso se guarda', ok, await disk.read('zeta.md'))
        # cerrar la carpeta: vuelve al modo temporal
        await pg.evaluate("wsLeaveFolder()"); await pg.wait_for_timeout(1500)
        t.check('«Cerrar la carpeta» vuelve al modo temporal y no la reabre al recargar', await pg.evaluate("Workspace.active === false && Workspace.status === 'off'"), await pg.evaluate("Workspace.status"))
        t.check('...sin tocar los archivos de la carpeta', 'zeta.md' in await disk.files(), await disk.files())
        t.check('sin errores de JavaScript en toda la prueba (salvo los que provoca a propósito el permiso retirado)', not [e for e in errs2 if 'permiso' not in e], errs2)
        await b.close()
    srv.shutdown()
    print(f'\nRESUMEN (carpeta del navegador, File System Access): {t.n} comprobaciones,', 'todo correcto' if not t.fails else f'{len(t.fails)} fallos: {t.fails}')
asyncio.run(main())
