#!/usr/bin/env python3
"""Ejecuta TODAS las pruebas: servidor (node --test) y navegador (Playwright).

  python3 tests/run.py              todas, contra src/ (sin compilar)
  python3 tests/run.py --dist       las de navegador contra dist/ (después de «npm run build»)
  python3 tests/run.py --only urls  solo las pruebas cuyo nombre contiene «urls»
  python3 tests/run.py --skip-server
  python3 tests/run.py --browser firefox   (o webkit) solo las pruebas que funcionan sin File System Access

Requisitos: Node 18+, Python 3.9+, «pip install playwright» y «playwright install chromium».
Variables útiles: PLAYWRIGHT_CHROMIUM_PATH (otro Chromium).
"""
import argparse, http.server, os, re, socket, subprocess, sys, threading, time
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def serve(directory):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), partial(Quiet, directory=str(directory)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port


def run(cmd, env=None, timeout=900):
    t0 = time.time()
    # tests print UTF-8 (→, «»); on Windows the default console code page (cp1252) cannot encode it
    env = dict(env or os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')
    p = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    return p.returncode, p.stdout + p.stderr, time.time() - t0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dist', action='store_true'); ap.add_argument('--only'); ap.add_argument('--skip-server', action='store_true')
    ap.add_argument('--browser', default='chromium', choices=('chromium', 'firefox', 'webkit'))   # tests with ENGINES = (...) run only in the engines they list
    a = ap.parse_args()
    app = ROOT / ('dist' if a.dist else 'src')
    if not (app / 'index.html').exists(): sys.exit(f'No existe {app}/index.html' + (' (¿falta «npm run build»?)' if a.dist else ''))
    rows = []; bad = 0
    if not a.skip_server and not a.only:
        # contract.test.mjs: shared scenarios (tests/contract/scenarios.json), the desktop app runs them in cargo test
        for test_file, label in (('server/test/server.test.mjs', 'servidor (seguridad de la API)'), ('server/test/contract.test.mjs', 'contrato compartido (servidor)'),
                                 ('tests/unit/pure.test.mjs', 'unitarias (funciones puras)')):
            code, out, dt = run(['node', '--test', test_file])
            n = re.search(r'^[#ℹ] pass (\d+)', out, re.M); f = re.search(r'^[#ℹ] fail (\d+)', out, re.M)   # TAP or spec reporter
            rows.append((label, int(n.group(1)) if n else 0, int(f.group(1)) if f else 1, dt)); bad += code != 0
            if code != 0:                                                  # show which server tests failed and why
                for line in out.splitlines():
                    if re.match(r'^\s*(✖|not ok|error:|Error|AssertionError|\s+(expected|actual|step))', line): print(f'  {test_file}: ' + line.strip()[:300])
    srv, port = serve(app)
    env = dict(os.environ, ATELIEROOT_URL=f'http://localhost:{port}/index.html?test=1&lang=es', ATELIEROOT_APP_DIR=str(app), BROWSER=a.browser)
    for f in sorted((ROOT / 'tests' / 'e2e').glob('test_*.py')):
        if a.only and a.only not in f.name: continue
        engines = re.search(r'^ENGINES = \(([^)]*)\)', f.read_text(encoding='utf-8'), re.M)       # a test lists its engines when it cannot run in all three
        if engines and f"'{a.browser}'" not in engines.group(1): continue
        code, out, dt = run([sys.executable, str(f)], env=env)
        ok = len(re.findall(r'^OK ', out, re.M)); fail = len(re.findall(r'^FALLO', out, re.M))
        if code != 0 and not fail: fail = 1; print(f'--- {f.name}: terminó con error ---\n' + out[-1500:])
        for line in out.splitlines():
            if line.startswith('FALLO'): print(f'  {f.name}: {line[:300]}')
        rows.append((f.stem.replace('test_', ''), ok, fail, dt)); bad += code != 0 or fail > 0
    srv.shutdown()
    print('\n%-44s %8s %8s %8s' % ('prueba', 'bien', 'fallos', 'segundos'))
    for n, ok, fail, dt in rows: print('%-44s %8d %8d %8.0f' % (n, ok, fail, dt))
    print('\nTOTAL: %d comprobaciones, %s' % (sum(r[1] for r in rows), 'todo correcto' if not bad else f'{sum(r[2] for r in rows)} con fallos'))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    for s in (sys.stdout, sys.stderr):
        try: s.reconfigure(encoding='utf-8', errors='replace')
        except AttributeError: pass
    main()
