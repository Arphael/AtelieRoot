"""Configuración común de las pruebas de navegador.

  ATELIERROOT_URL               dirección de la app a probar (la fija tests/run.py; por defecto http://localhost:8765/index.html)
  PLAYWRIGHT_CHROMIUM_PATH  ruta a un Chromium concreto (si no, Playwright usa el suyo)
"""
import glob
import os

URL = os.environ.get('ATELIERROOT_URL', 'http://localhost:8765/index.html?test=1')      # ?test=1: sin pantalla de bienvenida


def _chrome():
    p = os.environ.get('PLAYWRIGHT_CHROMIUM_PATH')
    if p:
        return p
    found = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
    return found[-1] if found else None


CHROME = _chrome()
LAUNCH = {'executable_path': CHROME} if CHROME else {}
