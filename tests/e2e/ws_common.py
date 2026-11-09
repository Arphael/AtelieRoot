"""Escenas comunes para probar la carpeta de trabajo con los dos backends (servidor local y carpeta del navegador).

Cada backend aporta un «disco» (lo que hay de verdad en la carpeta) con la misma interfaz:
    read(p) · write(p, texto) · delete(p) · rmdir(p) · exists(p) · files() · mtime(p) · mkdir(p)
Los .md y lo demás se ven exactamente como los vería VS Code o git: desde fuera de AtelierRoot.
"""
import asyncio
import json
import re
import time
from pathlib import Path

DUMP = "(()=>{ const d = n => ({ n: n.name, t: n.type, c: (n.children || []).map(d) }); return state.tree.map(d); })()"


class Disk:
    """Disco real (carpeta del servidor)."""
    def __init__(self, root): self.root = Path(root)
    def _p(self, p): return self.root / p
    async def read(self, p):
        try: return self._p(p).read_text(encoding='utf-8')
        except FileNotFoundError: return None
    async def write(self, p, text): f = self._p(p); f.parent.mkdir(parents=True, exist_ok=True); f.write_text(text, encoding='utf-8')
    async def delete(self, p): self._p(p).unlink()
    async def rmdir(self, p):
        import shutil; shutil.rmtree(self._p(p))
    async def exists(self, p): return self._p(p).exists()
    async def mkdir(self, p): self._p(p).mkdir(parents=True, exist_ok=True)
    async def mtime(self, p): return self._p(p).stat().st_mtime_ns
    async def files(self, atelierroot=False):
        out = []
        for f in self.root.rglob('*'):
            rel = f.relative_to(self.root).as_posix()
            if not f.is_file() or '.atelierroot-tmp' in rel or rel.startswith('.git/'): continue
            if rel.startswith('.atelierroot/') and not atelierroot: continue
            out.append(rel)
        return sorted(out)


OPFS_JS = """
window.__opfs = window.__opfs || {
  async dir(p, create){ let d = await (await navigator.storage.getDirectory()).getDirectoryHandle('ws', { create: true }); for (const s of (p || '').split('/').filter(Boolean)) d = await d.getDirectoryHandle(s, { create: !!create }); return d; },
  async fh(p, create){ const parts = p.split('/'), n = parts.pop(); const d = await this.dir(parts.join('/'), create); return d.getFileHandle(n, { create: !!create }); },
  async read(p){ try { return await (await (await this.fh(p)).getFile()).text(); } catch(e){ return null; } },
  async write(p, t){ const w = await (await this.fh(p, true)).createWritable(); await w.write(t); await w.close(); },
  async del(p){ const parts = p.split('/'), n = parts.pop(); const d = await this.dir(parts.join('/')); await d.removeEntry(n); },
  async rmdir(p){ const parts = p.split('/'), n = parts.pop(); const d = await this.dir(parts.join('/')); await d.removeEntry(n, { recursive: true }); },
  async exists(p){ try { await this.fh(p); return true; } catch(_){ try { await this.dir(p); return true; } catch(__){ return false; } } },
  async mtime(p){ return (await (await this.fh(p)).getFile()).lastModified; },
  async files(atelierroot){ const out = []; const walk = async (d, rel) => { for await (const [n, h] of d.entries()){ const p = rel ? rel + '/' + n : n; if (h.kind === 'directory') await walk(h, p); else if (!n.startsWith('.crswap') && (atelierroot || !p.startsWith('.atelierroot/'))) out.push(p); } }; await walk(await this.dir(''), ''); return out.sort(); },
};
"""


class OpfsDisk:
    """Disco dentro del navegador (OPFS): lo que ve AtelierRoot cuando se abre una «carpeta» con File System Access."""
    def __init__(self, pg): self.pg = pg
    async def _ev(self, expr, *args):
        await self.pg.evaluate(OPFS_JS)
        return await self.pg.evaluate(expr, args[0] if args else None)
    async def read(self, p): return await self._ev("p => __opfs.read(p)", p)
    async def write(self, p, text): await self._ev("([p, t]) => __opfs.write(p, t)", [p, text])
    async def delete(self, p): await self._ev("p => __opfs.del(p)", p)
    async def rmdir(self, p): await self._ev("p => __opfs.rmdir(p)", p)
    async def exists(self, p): return await self._ev("p => __opfs.exists(p)", p)
    async def mkdir(self, p): await self._ev("p => __opfs.dir(p, true)", p)
    async def mtime(self, p): return await self._ev("p => __opfs.mtime(p)", p)
    async def files(self, atelierroot=False): return await self._ev("a => __opfs.files(a)", atelierroot)


class T:
    """Contexto de una prueba: cuenta aciertos y fallos."""
    def __init__(self): self.fails = []; self.n = 0
    def check(self, name, cond, extra=''):
        self.n += 1
        print(('OK   ' if cond else 'FALLO'), name, ('' if cond else '→ ' + str(extra)))
        if not cond: self.fails.append(name)


async def until(fn, timeout=8.0, step=0.12):
    """Espera hasta que fn() (corrutina) devuelva algo verdadero; devuelve ese valor o el último falso."""
    end = time.time() + timeout; v = None
    while time.time() < end:
        v = await fn()
        if v: return v
        await asyncio.sleep(step)
    return v


async def every(items, fn):
    for i in items:
        if not await fn(i): return False
    return True
async def tree(pg): return await pg.evaluate(DUMP)
async def nid(pg, name): return await pg.evaluate("n => { let r = null; walk(state.tree, x => { if (x.name === n) r = x.id; }); return r; }", name)
async def save_now(pg): await pg.evaluate("wsSaveNow()")
async def idle(pg): await pg.evaluate("(async () => { await Workspace.q; })()")
async def open_doc(pg, name):
    i = await nid(pg, name); await pg.evaluate("i => openDoc(i)", i); return i
async def type_end(pg, name, text):
    await open_doc(pg, name)
    await pg.evaluate("caretInto(ed.lastElementChild, true)"); await pg.keyboard.type(text)
async def ask(pg, value, expect_title=None):
    """Rellena el diálogo de nombre de AtelierRoot y lo acepta con Enter."""
    await pg.wait_for_selector('#veil.show #f_n', timeout=3000)
    await pg.fill('#f_n', value); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(120)
def names(nodes):
    out = []
    for n in nodes: out.append(n['n']); out += names(n['c'])
    return out


SAMPLE = {
    'Intro.md': "# Intro\n\n* uno\n* dos\n\nTexto con **negrita** y `código`.\n",
    'Proyectos/Plan.md': "# Plan\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n",
    'Proyectos/Sub/Deep.md': "# Deep\n",
    'zeta.md': "zeta\n",
}


async def seed(disk, files=SAMPLE):
    for p, t in files.items(): await disk.write(p, t)


async def run_core(t, pg, disk, kind, reopen):
    """Escenas que valen igual para los dos backends. `reopen()` vuelve a cargar AtelierRoot y devuelve la página lista."""
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # ---------------------------------------------------------------- 1. abrir una carpeta con contenido
    print('=== 1. Abrir una carpeta que ya tiene .md ===')
    await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"))
    t.check('AtelierRoot abre la carpeta: modo carpeta activo y la base de datos del navegador apagada', await pg.evaluate("Workspace.active === true && Sync.ready === false"), await pg.evaluate("[Workspace.active, Sync.ready]"))
    tr = await tree(pg)
    t.check('el árbol refleja las carpetas del disco y los .md (sin la extensión)', names(tr) == ['Intro', 'Proyectos', 'Plan', 'Sub', 'Deep', 'zeta'], names(tr))
    t.check('...con las carpetas como carpetas', [n['t'] for n in tr] == ['doc', 'folder', 'doc'] and tr[1]['c'][1]['t'] == 'folder', tr)
    t.check('...y lo que no es .md (notas.txt, .git) no aparece', 'notas' not in ' '.join(names(tr)).lower() and 'x' not in names(tr), names(tr))
    await open_doc(pg, 'Intro')
    h = await pg.evaluate("ed.innerHTML")
    t.check('el contenido del .md se ve como documento (negrita, código, lista)', '<strong>negrita</strong>' in h and 'data-code' in h and '<li>uno</li>' in h, h[:200])
    t.check('el indicador dice que el documento está en la carpeta', 'ok' == await pg.evaluate("Workspace.status") and '📁' in await pg.evaluate("document.getElementById('wsState').textContent"), await pg.evaluate("document.getElementById('wsState').textContent"))
    m0 = {p: await disk.mtime(p) for p in SAMPLE}; txt0 = {p: await disk.read(p) for p in SAMPLE}
    await asyncio.sleep(2.0)
    t.check('solo abrirlos NO reescribe ningún archivo (ni «normalizando» el Markdown ni tocando la fecha)', await every(SAMPLE, lambda p: _same(disk, p, txt0, m0)), 'cambió alguno')
    t.check('se creó .atelierroot/state.json con el orden y lo que Markdown no guarda', '"order"' in (await disk.read('.atelierroot/state.json') or ''), await disk.read('.atelierroot/state.json'))
    t.check('...y .atelierroot/.gitignore para que la papelera no acabe en git', (await disk.read('.atelierroot/.gitignore') or '').strip() == 'trash/', await disk.read('.atelierroot/.gitignore'))

    # ---------------------------------------------------------------- 2. escribir
    print('=== 2. Escribir: se guarda solo en el .md ===')
    await type_end(pg, 'Intro', ' AGREGADO')
    ok = await until(lambda: _has(disk, 'Intro.md', 'AGREGADO'), 6)
    t.check('al escribir, el archivo .md se actualiza solo (sin pulsar nada)', ok, await disk.read('Intro.md'))
    s = await disk.read('Intro.md') or ''
    t.check('...en Markdown de verdad (negrita y código siguen siendo Markdown)', '**negrita**' in s and '`código`' in s and 'AGREGADO' in s, s)
    t.check('...y solo cambió el documento que tocaste', await every(('Proyectos/Sub/Deep.md', 'zeta.md'), lambda p: _same_text(disk, p, txt0)), '')
    t.check('el indicador vuelve a «guardado»', await until(lambda: pg.evaluate("Workspace.status === 'ok' && wsUnsaved().length === 0"), 4), await pg.evaluate("Workspace.status"))
    await type_end(pg, 'Plan', ' XYZ')
    await until(lambda: _has(disk, 'Proyectos/Plan.md', 'XYZ'), 6)
    s = await disk.read('Proyectos/Plan.md') or ''
    t.check('un documento dentro de una carpeta se guarda en su ruta (con su tabla)', 'XYZ' in s and s.count('|') >= 9 and re.search(r'\|\s+1 \|', s) is not None, s)

    # ---------------------------------------------------------------- 3. crear, renombrar, mover
    print('=== 3. Crear, renombrar y mover (el árbol y el disco van juntos) ===')
    await pg.click('#newDoc'); await ask(pg, 'Nota nueva')
    t.check('crear un documento crea su archivo .md con el título dentro', await until(lambda: _has(disk, 'Nota nueva.md', '# Nota nueva'), 6), await disk.files())
    await pg.evaluate("n => renameNode(findNode(n))", await nid(pg, 'Nota nueva')); await ask(pg, 'Renombrada')
    ok = await until(lambda: disk.exists('Renombrada.md'), 6)
    t.check('renombrar un documento renombra el archivo (y el viejo desaparece)', ok and not await disk.exists('Nota nueva.md') and '# Nota nueva' in (await disk.read('Renombrada.md') or ''), await disk.files())
    await pg.evaluate("n => renameNode(findNode(n))", await nid(pg, 'Renombrada')); await ask(pg, 'a/b:c')
    await until(lambda: disk.exists('a-b-c.md'), 6)
    t.check('un nombre con caracteres que el sistema no admite (/ :) se vuelve válido, y el árbol muestra lo mismo que el disco', await disk.exists('a-b-c.md') and 'a-b-c' in names(await tree(pg)), [await disk.files(), names(await tree(pg))])
    await pg.click('#newDoc'); await ask(pg, 'a-b-c')
    await until(lambda: disk.exists('a-b-c (2).md'), 6)
    t.check('dos documentos con el mismo nombre: el segundo pasa a «(2)» en el disco y en el árbol', await disk.exists('a-b-c (2).md') and 'a-b-c (2)' in names(await tree(pg)), [await disk.files(), names(await tree(pg))])
    await pg.evaluate("([a, b]) => { const m = removeNode(a); placeNode(m, findNode(b), 'in'); renderTree(); save(true); }", [await nid(pg, 'a-b-c (2)'), await nid(pg, 'Proyectos')])
    ok = await until(lambda: disk.exists('Proyectos/a-b-c (2).md'), 6)
    t.check('mover un documento a una carpeta mueve el archivo', ok and not await disk.exists('a-b-c (2).md'), await disk.files())
    await pg.evaluate("n => renameNode(findNode(n))", await nid(pg, 'Proyectos')); await ask(pg, 'Proy')
    ok = await until(lambda: disk.exists('Proy/Plan.md'), 8)
    fl = await disk.files()
    t.check('renombrar una carpeta renombra toda la carpeta con lo que lleva dentro', ok and 'Proy/Sub/Deep.md' in fl and not any(f.startswith('Proyectos/') for f in fl), fl)
    await type_end(pg, 'Deep', ' PROFUNDO')
    t.check('un documento dentro de una carpeta renombrada sigue guardándose bien (en la ruta nueva)', await until(lambda: _has(disk, 'Proy/Sub/Deep.md', 'PROFUNDO'), 6) and not await disk.exists('Proyectos/Sub/Deep.md'), await disk.files())
    await pg.evaluate("n => { findNode(n).open = false; }", await nid(pg, 'Proy')); await pg.evaluate("renderTree(); save(true)")
    await pg.click('#newFolder'); await ask(pg, 'Vacía')
    t.check('crear una carpeta crea la carpeta en el disco', await until(lambda: disk.exists('Vacía') if False else _dir_exists(disk, 'Vacía'), 6), await disk.files())

    # ---------------------------------------------------------------- 4. papelera
    print('=== 4. Papelera: nada se borra de verdad ===')
    await pg.evaluate("n => moveToTrash(findNode(n))", await nid(pg, 'zeta'))
    ok = await until(lambda: _gone(disk, 'zeta.md'), 6)
    fl = await disk.files(True)
    tz = [f for f in fl if f.startswith('.atelierroot/trash/') and f.endswith('/zeta.md')]
    t.check('eliminar un documento lo quita de su lugar y lo guarda en .atelierroot/trash (con su contenido)', ok and len(tz) == 1 and (await disk.read(tz[0]) or '').strip() == 'zeta', fl)
    t.check('...y la papelera de AtelierRoot lo muestra', await pg.evaluate("state.trash.length") == 1, await pg.evaluate("state.trash.length"))
    await pg.evaluate("restoreTrash(state.trash[0])")
    ok = await until(lambda: disk.exists('zeta.md'), 6)
    await until(lambda: _no_trash(disk), 6)
    t.check('restaurarlo lo devuelve a su lugar con su contenido', ok and (await disk.read('zeta.md') or '').strip() == 'zeta', await disk.files(True))
    t.check('...y la copia de la papelera desaparece', await _no_trash(disk), await disk.files(True))
    await disk.write('Proy/imagen.png', 'no soy markdown')                                  # un archivo que AtelierRoot no muestra, dentro de la carpeta
    await pg.evaluate("n => moveToTrash(findNode(n))", await nid(pg, 'Proy'))
    ok = await until(lambda: _gone_dir(disk, 'Proy'), 6)
    fl = await disk.files(True)
    t.check('eliminar una carpeta la guarda entera en la papelera, incluso lo que AtelierRoot no muestra', ok and any(f.endswith('/Proy/imagen.png') for f in fl) and any(f.endswith('/Proy/Plan.md') for f in fl), fl)
    await pg.evaluate("restoreTrash(state.trash[0])")
    await until(lambda: disk.exists('Proy/Plan.md'), 6); await until(lambda: _no_trash(disk), 6)
    fl = await disk.files(True)
    t.check('al restaurar la carpeta, vuelven sus documentos...', 'Proy/Plan.md' in fl and 'Proy/Sub/Deep.md' in fl and 'Proy/a-b-c (2).md' in fl, fl)
    t.check('...y también lo que no era Markdown (la imagen)', (await disk.read('Proy/imagen.png')) == 'no soy markdown', fl)
    await pg.evaluate("n => moveToTrash(findNode(n))", await nid(pg, 'Vacía'))
    await until(lambda: _gone_dir(disk, 'Vacía'), 6)
    await pg.evaluate("t => { purgeDocs(t.docIds); state.trash = state.trash.filter(x => x !== t); updateTrashN(); save(true); }", await pg.evaluate("state.trash[0]"))
    await until(lambda: _no_trash(disk), 6)
    t.check('borrar de la papelera «para siempre» elimina también su copia del disco', await _no_trash(disk), await disk.files(True))

    # ---------------------------------------------------------------- 5. cambios hechos fuera
    print('=== 5. Cambios hechos fuera de AtelierRoot (VS Code, git…) ===')
    await open_doc(pg, 'Intro')
    await disk.write('Intro.md', '# Intro\n\nCAMBIADO FUERA\n')
    ok = await until(lambda: pg.evaluate("ed.innerText.includes('CAMBIADO FUERA')"), 9)
    t.check('si cambias el .md desde fuera, el documento abierto se actualiza solo', ok, await pg.evaluate("ed.innerText"))
    await pg.evaluate("caretInto(ed.lastElementChild, true)"); await pg.keyboard.type(' sigo escribiendo')
    await until(lambda: _has(disk, 'Intro.md', 'sigo escribiendo'), 6)
    s = await disk.read('Intro.md') or ''
    t.check('...y lo que escribes después se suma a lo que llegó de fuera', 'CAMBIADO FUERA' in s and 'sigo escribiendo' in s, s)
    await disk.write('Externo.md', '# Externo\n\nvino de fuera\n'); await disk.write('Carpeta Nueva/uno.md', 'uno\n')
    ok = await until(lambda: _in_tree(pg, ['Externo', 'Carpeta Nueva', 'uno']), 9)
    t.check('un .md nuevo y una carpeta nueva creados fuera aparecen en el árbol', ok, names(await tree(pg)))
    await open_doc(pg, 'Externo')
    t.check('...y se pueden abrir con su contenido', 'vino de fuera' in await pg.evaluate("ed.innerText"), await pg.evaluate("ed.innerText"))
    await disk.delete('Externo.md')
    ok = await until(lambda: _not_in_tree(pg, 'Externo'), 9)
    t.check('un .md borrado fuera desaparece del árbol (y AtelierRoot abre otro documento)', ok and await pg.evaluate("state.current !== null && !!findNode(state.current)"), names(await tree(pg)))
    # conflicto: yo lo edité y alguien lo cambió en el disco a la vez
    await open_doc(pg, 'Intro'); iid = await nid(pg, 'Intro')
    await pg.evaluate("i => { state.docs[i] = '<h1>Intro</h1><p>MI VERSION</p>'; Dirty.add(i); refreshEditorsFor(i); }", iid)
    await disk.write('Intro.md', '# Intro\n\nVERSION DEL DISCO\n')
    await pg.evaluate("Workspace.q = Workspace.q.then(() => wsRefreshOnce())"); await idle(pg)
    nm = names(await tree(pg)); cp = [n for n in nm if n.startswith('Intro (versión del disco')]
    t.check('si cambia en el disco mientras tú tenías ediciones sin guardar, la versión del disco pasa a una copia', len(cp) == 1, nm)
    cid = await nid(pg, cp[0]) if cp else None
    t.check('...con su contenido, y tu versión sigue siendo la tuya', bool(cid) and 'VERSION DEL DISCO' in (await pg.evaluate("i => state.docs[i]", cid)) and 'MI VERSION' in await pg.evaluate("i => state.docs[i]", iid), '')
    await save_now(pg)
    s = await disk.read('Intro.md') or ''
    t.check('al guardar, tu versión se escribe (la del disco quedó a salvo en la copia)', 'MI VERSION' in s, s)
    t.check('...y la copia de conflicto es un archivo más de la carpeta', await until(lambda: _any_file(disk, 'versión del disco'), 6), await disk.files())
    # conflicto al escribir: el archivo cambió entre mi lectura y mi escritura
    await pg.evaluate("i => { state.docs[i] = '<h1>Intro</h1><p>OTRA EDICION MIA</p>'; Dirty.add(i); refreshEditorsFor(i); }", iid)
    await disk.write('Intro.md', '# Intro\n\nEDITADO POR OTRO\n')
    await save_now(pg)
    nm = names(await tree(pg)); cp = [n for n in nm if n.startswith('Intro (mi versión')]
    t.check('si el archivo cambió en el disco justo antes de guardar, NO se pisa: tu versión pasa a una copia y el documento adopta lo del disco', len(cp) == 1 and 'EDITADO POR OTRO' in (await pg.evaluate("i => state.docs[i]", iid)), nm)
    t.check('...y el archivo conserva lo que escribió el otro', 'EDITADO POR OTRO' in (await disk.read('Intro.md') or ''), await disk.read('Intro.md'))
    # borrado fuera con ediciones sin guardar: no se pierde
    await open_doc(pg, 'Deep') if await nid(pg, 'Deep') else None
    did = await nid(pg, 'Deep')
    await pg.evaluate("i => { state.docs[i] = '<h1>Deep</h1><p>SIN GUARDAR</p>'; Dirty.add(i); refreshEditorsFor(i); }", did)
    await disk.rmdir('Proy/Sub')
    await pg.evaluate("Workspace.q = Workspace.q.then(() => wsRefreshOnce())"); await idle(pg); await save_now(pg)
    t.check('si borran fuera un archivo que yo tenía editado sin guardar, se vuelve a crear con mi edición', await until(lambda: _has(disk, 'Proy/Sub/Deep.md', 'SIN GUARDAR'), 6), await disk.files())

    # ---------------------------------------------------------------- 6. lo que Markdown no guarda
    print('=== 6. Lo que Markdown no guarda (va en .atelierroot/) y recargar ===')
    tid = await nid(pg, 'zeta')
    await pg.evaluate("i => { state.docs[i] = '<h1>Zeta</h1><table data-cw=\"\"><thead><tr><th data-w=\"30.00\" style=\"width:30.00%\">a</th><th data-w=\"70.00\" style=\"width:70.00%\">b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table><h2 data-fold=\"\">Sección</h2><p>oculto</p><h2>Otra</h2><p>visible</p>'; Dirty.add(i); state.fills = state.fills || {}; state.fills[i] = { CLIENTE: 'ACME' }; save(true); }", tid)
    await save_now(pg)
    z = await disk.read('zeta.md') or ''
    t.check('el .md no lleva ni anchos de columna ni pliegues (queda Markdown limpio)', 'data-cw' not in z and 'data-fold' not in z and 'data-w' not in z and '| a' in z, z)
    st = json.loads(await disk.read('.atelierroot/state.json') or '{}')
    t.check('...están en .atelierroot/state.json, por ruta', st.get('extras', {}).get('zeta.md', {}).get('tw') == [[30.0, 70.0]] and st['extras']['zeta.md'].get('folds') == [1], st.get('extras'))
    t.check('...y los valores de los marcadores también', st.get('fills', {}).get('zeta.md') == {'CLIENTE': 'ACME'}, st.get('fills'))
    await pg.evaluate("i => openDoc(i)", await nid(pg, 'Intro'))
    await pg.evaluate("() => { const ids = []; walk(state.tree, n => { if (n.type === 'folder') n.open = true; }); state.tree.forEach(n => {}); }")
    # reordenar: zeta arriba del todo
    await pg.evaluate("i => { const m = removeNode(i); state.tree.unshift(m); renderTree(); save(true); }", tid)
    await save_now(pg)
    before = names(await tree(pg))
    pg = await reopen()
    await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"))
    after = names(await tree(pg))
    t.check('al recargar, el orden que elegiste se conserva', after == before and after[0] == 'zeta', [before, after])
    zid = await nid(pg, 'zeta'); zh = await pg.evaluate("i => state.docs[i]", zid)
    t.check('...los anchos de columna vuelven', 'data-cw' in zh and 'data-w="30.00"' in zh and 'data-w="70.00"' in zh, zh[:300])
    t.check('...los pliegues vuelven', re.search(r'<h2 data-fold="">Sección</h2>', zh) is not None and '<h2 data-fold="">Otra' not in zh, zh[:400])
    t.check('...y los valores de los marcadores', await pg.evaluate("i => (state.fills || {})[i]", zid) == {'CLIENTE': 'ACME'}, await pg.evaluate("i => (state.fills || {})[i]", zid))
    t.check('...y se abre el documento en el que estabas', await pg.evaluate("findNode(state.current).name") == 'Intro', await pg.evaluate("findNode(state.current).name"))
    # fidelidad
    print('=== 7. Fidelidad Markdown → documento → Markdown ===')
    CORPUS = {
        'encabezados y énfasis': "# Título uno\n\n## Dos\n\n### Tres\n\nTexto con *cursiva*, **negrita**, ~~tachado~~ y `código en línea`.\n",
        'listas': "- uno\n- dos\n  - sub a\n  - sub b\n- tres\n\n1. primero\n2. segundo\n3. tercero\n\n- [ ] pendiente\n- [x] hecha\n",
        'cita y regla': "> una cita\n> en dos líneas\n\n---\n\nfin\n",
        'código': "```python\nprint('hola')\nif x:\n    pass\n```\n\nluego `inline`.\n",
        'tabla': "| Nombre | Edad |\n| --- | ---: |\n| Ana | 31 |\n| Beto | 7 |\n",
        'enlaces': "Mira [AtelierRoot](https://example.com/a?b=1&c=2) y https://example.com/suelta y [[otro documento]].\n",
        'acentos y símbolos': "Canción №1: ¿qué tal? ¡Bien! — “comillas” … ñandú 😀 → ✓ © & < > \" '\n",
    }
    import_js = "md => { const h = wsHtml(md); const m1 = wsMdText(h); const m2 = wsMdText(wsHtml(m1)); return [m1, m2]; }"
    for name, md in CORPUS.items():
        m1, m2 = await pg.evaluate(import_js, md)
        words = lambda s: sorted(set(re.findall(r'[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]{3,}', s)))
        t.check(f'«{name}»: es estable (volver a abrirlo y guardarlo no cambia nada más)', m1 == m2, [m1, m2])
        t.check(f'«{name}»: no se pierde ninguna palabra', all(w in m1 for w in words(md)), [w for w in words(md) if w not in m1])
    m1, _ = await pg.evaluate(import_js, "Línea uno\r\nLínea dos\r\n\r\nOtra\r\n")
    t.check('los finales de línea de Windows (CRLF) no dejan «\\r» sueltos', '\r' not in m1 and 'Línea uno' in m1, repr(m1))
    # seguridad del contenido
    print('=== 8. Un .md ajeno no puede ejecutar nada ===')
    await disk.write('Malicioso.md', '# Hola\n\n<script>window.__pwn = 1</script>\n\n<img src=x onerror="window.__pwn = 2">\n\n[clic](javascript:window.__pwn=3)\n\n<a href="javascript:window.__pwn=4" onclick="window.__pwn=5">trampa</a>\n\n<iframe src="javascript:window.__pwn=6"></iframe>\n\n![x](javascript:window.__pwn=7)\n')
    await until(lambda: _in_tree(pg, ['Malicioso']), 9)
    await open_doc(pg, 'Malicioso'); await asyncio.sleep(0.6)
    t.check('los scripts, onerror e iframes de un .md quedan como texto, no se ejecutan', await pg.evaluate("window.__pwn === undefined && !ed.querySelector('script, iframe, [onerror], [onclick], [onload]')"), await pg.evaluate("[window.__pwn, ed.innerHTML.slice(0, 400)]"))
    t.check('...y ningún enlace usa «javascript:»', await pg.evaluate("![...ed.querySelectorAll('a, img')].some(x => /^\\s*javascript:/i.test(x.getAttribute('href') || x.getAttribute('src') || ''))"), await pg.evaluate("ed.innerHTML.slice(0, 500)"))
    await pg.evaluate("ed.querySelectorAll('a').forEach(a => a.click())"); await asyncio.sleep(0.2)
    t.check('...ni siquiera haciendo clic en los enlaces', await pg.evaluate("window.__pwn === undefined"), await pg.evaluate("window.__pwn"))
    # muchos archivos
    print('=== 9. Una carpeta grande ===')
    for i in range(30):
        for j in range(10): await disk.write(f'Grande/c{i:02d}/doc{j}.md', f'# Doc {i}-{j}\n\n' + ('texto de relleno número %d. ' % j) * 40 + '\n')
    t0 = time.time(); pg = await reopen(); await until(lambda: pg.evaluate("Workspace.active && state.tree.length > 0"), 30)
    await until(lambda: pg.evaluate("(() => { let n = 0; walk(state.tree, x => { if (x.type === 'doc') n++; }); return n >= 300; })()"), 30)
    dt = time.time() - t0
    t.check(f'300 documentos más se cargan en un tiempo razonable ({dt:.1f} s)', dt < 25, dt)
    t.check('...y no hubo errores de JavaScript', not errs, errs)
    return pg


async def _same(disk, p, txt0, m0): return await disk.read(p) == txt0[p] and await disk.mtime(p) == m0[p]
async def _same_text(disk, p, txt0): return await disk.read(p) == txt0[p]
async def _has(disk, p, s): return s in (await disk.read(p) or '')
async def _gone(disk, p): return not await disk.exists(p)
async def _dir_exists(disk, p): return await disk.exists(p)
async def _gone_dir(disk, p): return not await disk.exists(p)
async def _no_trash(disk): return not any(f.startswith('.atelierroot/trash/') for f in await disk.files(True))
async def _any_file(disk, frag): return any(frag in f for f in await disk.files())
async def _in_tree(pg, wanted): nm = names(await tree(pg)); return all(w in nm for w in wanted)
async def _not_in_tree(pg, w): return w not in names(await tree(pg))
