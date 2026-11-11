#!/usr/bin/env node
// Comprobación estática rápida (sin navegador): npm run check
//   · cada archivo js/css que enlaza index.html existe, y no sobra ninguno;
//   · cada js tiene sintaxis válida y empieza con "use strict" (el modo estricto vale por script, no por proyecto);
//   · index.html no pide nada a internet (la app funciona sin conexión).
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(import.meta.dirname, '..', 'src');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const errors = [];
for (const [kind, re] of [['js', /<script src="(js\/[^"]+)"><\/script>/g], ['css', /<link rel="stylesheet" href="(css\/[^"]+)">/g]]) {
  const linked = [...html.matchAll(re)].map(m => m[1]), onDisk = fs.readdirSync(path.join(src, kind)).filter(f => f.endsWith('.' + kind)).map(f => `${kind}/${f}`);
  linked.filter(f => !onDisk.includes(f)).forEach(f => errors.push(`index.html enlaza ${f} y no existe`));
  onDisk.filter(f => !linked.includes(f)).forEach(f => errors.push(`${f} existe pero index.html no lo carga`));
  if (JSON.stringify(linked) !== JSON.stringify([...linked].sort())) errors.push(`el orden de los ${kind} en index.html no es el alfabético (el orden de carga ES el orden de los nombres)`);
  if (kind === 'js') for (const f of linked) {
    const code = fs.readFileSync(path.join(src, f), 'utf8');
    try { new Function(code); } catch (e) { errors.push(`${f}: ${e.message}`); }
    if (!f.endsWith('00-base.js') && !code.startsWith('"use strict";')) errors.push(`${f}: debe empezar con "use strict";`);
  }
}
// interface texts go through T('key') (src/js/05-i18n.js); a literal in these calls would not change language (best effort)
const i18nCalls = /\b(toast|confirmBox|dialog|askName|flag)\(\s*(['"`])[^'"`]*[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/;
for (const f of fs.readdirSync(path.join(src, 'js')).filter(f => f.endsWith('.js') && f !== '05-i18n.js')) {
  fs.readFileSync(path.join(src, 'js', f), 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim().startsWith('//') && i18nCalls.test(line)) errors.push(`js/${f}:${i + 1}: texto de interfaz sin T('clave'): ${line.trim().slice(0, 80)}`);
  });
}
// every data-i18n key in index.html exists in the dictionary
const dict = fs.readFileSync(path.join(src, 'js', '05-i18n.js'), 'utf8');
for (const m of html.matchAll(/data-i18n(?:-title|-aria|-ph)?="([^"]+)"/g)) {
  if (!dict.includes(`'${m[1]}': [`)) errors.push(`index.html usa la clave ${m[1]}, que no está en js/05-i18n.js`);
}
const external = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
external.forEach(u => errors.push(`index.html pide un recurso externo: ${u}`));
if (errors.length) { console.error(errors.map(e => '✗ ' + e).join('\n')); process.exit(1); }
console.log('✓ estructura, sintaxis y modo estricto correctos; sin recursos externos');
