"""Desktop app backend (TauriBackend) against a simulated window.__TAURI__.

The real Rust side is covered by `cargo test` in src-tauri/. Here the page talks to an in-memory
folder that answers the same commands, so the frontend wiring is checked in every browser run:
boot with the remembered folder, autosave through ws_write, error-code mapping, outside changes
via the "ws-changed" event.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import asyncio
from playwright.async_api import async_playwright
from browser import URL, LAUNCH, engine

fails = []
def check(name, cond, extra=''):
    print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '-> ' + str(extra)))
    if not cond: fails.append(name)

MOCK = r"""
(() => {
  let clock = 1700000000000;
  const files = { 'Intro.md': { text: '# Intro\n\nhola desde el disco\n', m: clock } };
  const dirs = new Set(['Proyectos']);
  const calls = [], listeners = [];
  const err = (c, m) => Promise.reject(c + ':' + m);
  const okPath = p => typeof p === 'string' && p && !p.includes('..') && !p.startsWith('/') && !p.includes('\\');
  const cmds = {
    ws_root: () => ({ name: 'Mis notas', path: 'C:\\Users\\x\\Mis notas' }),
    ws_roots: () => [{ name: 'Mis notas', path: 'C:\\Users\\x\\Mis notas' }],
    ws_pick: () => ({ name: 'Mis notas', path: 'C:\\Users\\x\\Mis notas' }),
    ws_abs: ({ p }) => 'C:\\Users\\x\\Mis notas\\' + p.split('/').join('\\'),
    ws_reveal: () => null,
    ws_open: () => null,
    ws_clear: () => null,
    ws_list: ({ hidden }) => [
      ...[...dirs].filter(d => hidden || !d.startsWith('.')).map(p => ({ p, t: 'd', s: 0, m: 0 })),
      ...Object.keys(files).filter(p => hidden || !p.startsWith('.')).map(p => ({ p, t: 'f', s: files[p].text.length, m: files[p].m })),
    ],
    ws_read: ({ p, optional }) => files[p] ? { text: files[p].text, m: files[p].m, s: files[p].text.length } : (optional ? null : err('missing', 'no existe')),
    ws_read_many: ({ paths }) => paths.map(p => files[p] ? { text: files[p].text, m: files[p].m, s: files[p].text.length } : { error: 'missing' }),
    ws_write: ({ p, text, expect }) => {
      if (!okPath(p)) return err('denied', 'ruta no valida');
      if (expect != null && files[p] && files[p].m !== expect) return err('conflict', 'el archivo cambio en el disco');
      files[p] = { text, m: ++clock }; return { m: files[p].m, s: text.length };
    },
    ws_mkdir: ({ p }) => { dirs.add(p); return null; },
    ws_move: ({ from, to }) => { if (files[to] || dirs.has(to)) return err('exists', 'el destino ya existe'); if (files[from]) { files[to] = files[from]; delete files[from]; } else dirs.add(to); return null; },
    ws_remove: ({ p }) => { delete files[p]; return null; },
  };
  window.__mock = { files, calls, emit: () => listeners.forEach(f => f({ payload: null })), outside: (p, text) => { files[p] = { text, m: ++clock }; } };
  window.__TAURI__ = {
    core: { invoke: (cmd, args) => { calls.push([cmd, args || {}]); return cmds[cmd] ? Promise.resolve().then(() => cmds[cmd](args || {})) : Promise.reject('io:unknown command ' + cmd); } },
    event: { listen: (name, cb) => { if (name === 'ws-changed') listeners.push(cb); return Promise.resolve(() => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }); } },
  };
})();
"""

async def until(pg, expr, ms=8000):
    for _ in range(ms // 100):
        if await pg.evaluate(expr): return True
        await pg.wait_for_timeout(100)
    return False

async def main():
    async with async_playwright() as p:
        b = await engine(p).launch(**LAUNCH)
        pg = await b.new_page()
        await pg.add_init_script(MOCK)
        await pg.goto(URL)
        await pg.wait_for_function("typeof Workspace !== 'undefined'")

        ok = await until(pg, "Workspace.active && Workspace.kind === 'tauri'")
        check('boot opens the remembered desktop folder', ok, await pg.evaluate("[Workspace.active, Workspace.kind]"))
        check('boot asked the Rust side for the open folders (ws_roots)', await pg.evaluate("__mock.calls.some(c => c[0] === 'ws_roots')"))
        check('v2.1: every command says which open folder (r)', await pg.evaluate("__mock.calls.filter(c => c[0] === 'ws_list').every(c => c[1].r === 0)"))
        await pg.evaluate("(() => { const n = state.tree.find(x => x.name === 'Intro'); placeAction('reveal', n); })()"); await pg.wait_for_timeout(100)
        check('v2.1: «Show in Explorer» asks the desktop app (ws_reveal) for that document', await pg.evaluate("__mock.calls.some(c => c[0] === 'ws_reveal' && c[1].p === 'Intro.md' && c[1].r === 0)"))
        await pg.evaluate("(() => { const n = state.tree.find(x => x.name === 'Intro'); placeAction('openfile', n); })()"); await pg.wait_for_timeout(100)
        check('v2.2: «Open with its program» asks the desktop app (ws_open) for that document, and is in its menu', await pg.evaluate("__mock.calls.some(c => c[0] === 'ws_open' && c[1].p === 'Intro.md' && c[1].r === 0) && ctxItems(state.tree.find(x => x.name === 'Intro')).some(i => i[0] === 'openfile')"))
        path = await pg.evaluate("Workspace.be.absPath('Intro.md')")
        check('v2.1: «Copy path» gives the absolute path', path == 'C:\\Users\\x\\Mis notas\\Intro.md', path)
        check('documents from disk appear in the tree', await until(pg, "document.querySelector('#tree').textContent.includes('Intro')"), await pg.evaluate("document.querySelector('#tree').textContent"))
        check('folders from disk appear in the tree', await pg.evaluate("document.querySelector('#tree').textContent.includes('Proyectos')"))

        await pg.evaluate("(() => { const n = state.tree.find(x => x.name === 'Intro'); openDoc(n.id); })()")
        check('the document content is loaded from the file', await until(pg, "ed.textContent.includes('hola desde el disco')"), await pg.evaluate("ed.innerHTML.slice(0, 200)"))

        await pg.evaluate("caretInto(ed.lastElementChild, true)")
        await pg.keyboard.type(' y desde AtelieRoot')
        saved = await until(pg, "(__mock.files['Intro.md'].text || '').includes('y desde AtelieRoot')", 10000)
        check('autosave writes the .md through ws_write', saved, await pg.evaluate("__mock.files['Intro.md'].text"))
        check('ws_write is called with expect (mtime last read)', await pg.evaluate("__mock.calls.some(c => c[0] === 'ws_write' && c[1].p === 'Intro.md' && typeof c[1].expect === 'number')"))

        codes = await pg.evaluate("""(async () => {
          const be = new TauriBackend('x'), out = [];
          for (const f of [() => be.write('../x.md', 'a'), () => be.read('nope.md'), () => be.move('Intro.md', 'Intro.md'), () => be.call('nope')]) {
            try { await f(); out.push('none'); } catch (e) { out.push(e instanceof WsError ? e.code : 'not-WsError'); }
          }
          return out; })()""")
        check('Rust errors become WsError with the contract code', codes == ['denied', 'missing', 'exists', 'io'], codes)
        check('optional read of a missing file returns null', await pg.evaluate("new TauriBackend('x').read('nope.md', true).then(r => r === null)"))

        await pg.wait_for_timeout(500)
        await pg.evaluate("__mock.outside('Intro.md', '# Intro\\n\\ncambiado en VS Code\\n'); __mock.emit()")
        check('an outside change announced by ws-changed reloads the editor', await until(pg, "ed.textContent.includes('cambiado en VS Code')", 10000), await pg.evaluate("ed.textContent.slice(0, 200)"))

        await b.close()
    print('\n' + ('todo correcto' if not fails else f'{len(fails)} fallos'))
    sys.exit(1 if fails else 0)

asyncio.run(main())
