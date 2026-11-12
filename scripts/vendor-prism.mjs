#!/usr/bin/env node
// Descarga prismjs de npm y copia a src/vendor/prism SOLO el núcleo, el autoloader y los lenguajes de scripts/prism-languages.json
// (con sus dependencias). Así AtelieRoot resalta código sin conexión y sin CDN. Para añadir un lenguaje: edítalo en el JSON y ejecuta
//   npm run vendor:prism
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'scripts/prism-languages.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prism-'));
execFileSync('npm', ['pack', `prismjs@${cfg.version}`, '--pack-destination', tmp], { stdio: 'inherit', shell: process.platform === 'win32', cwd: tmp });
const tgz = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'));
execFileSync('tar', ['-xzf', path.join(tmp, tgz), '-C', tmp], { stdio: 'inherit' });
const pkg = path.join(tmp, 'package');
const comps = JSON.parse(fs.readFileSync(path.join(pkg, 'components.json'), 'utf8')).languages;

// cierre de dependencias («require») de los lenguajes pedidos
const need = new Set();
const add = id => {
  if (need.has(id)) return;
  if (!comps[id]) throw new Error(`Prism no tiene el lenguaje «${id}»`);
  need.add(id);
  [].concat(comps[id].require || []).forEach(add);
};
cfg.languages.forEach(add);

const out = path.join(root, 'src/vendor/prism');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'components'), { recursive: true });
fs.mkdirSync(path.join(out, 'plugins'), { recursive: true });
const copy = (from, to) => fs.copyFileSync(path.join(pkg, from), path.join(out, to));
copy('components/prism-core.min.js', 'prism-core.min.js');
copy('plugins/autoloader/prism-autoloader.min.js', 'plugins/prism-autoloader.min.js');
copy('LICENSE', 'LICENSE');
for (const id of [...need].sort()) copy(`components/prism-${id}.min.js`, `components/prism-${id}.min.js`);
// los lenguajes que la página carga al arrancar (como hacía el paquete prism.min.js del CDN)
for (const id of ['markup', 'css', 'clike', 'javascript']) copy(`components/prism-${id}.min.js`, `components/prism-${id}.min.js`);
fs.writeFileSync(path.join(out, 'README.md'), `Prism ${cfg.version} (MIT), copiado de npm por scripts/vendor-prism.mjs.\nLenguajes incluidos: ${[...need].sort().join(', ')}.\nPara añadir otros, edita scripts/prism-languages.json y ejecuta «npm run vendor:prism».\n`);
fs.rmSync(tmp, { recursive: true, force: true });
const size = fs.readdirSync(path.join(out, 'components')).reduce((s, f) => s + fs.statSync(path.join(out, 'components', f)).size, 0);
console.log(`Prism ${cfg.version}: ${need.size} lenguajes (${Math.round(size / 1024)} KB) en src/vendor/prism`);
