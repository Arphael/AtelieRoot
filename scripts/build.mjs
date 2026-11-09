#!/usr/bin/env node
// Compila src/ → dist/: un index.html con el CSS y el JS en línea (un solo <script>, en el orden de index.html) y vendor/ al lado.
// No necesita dependencias. Lo que se descarga para usar en local es dist/ (≈ 0,5 MB, 100 KB comprimido).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..'), src = path.join(root, 'src'), dist = path.join(root, 'dist');
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const read = f => fs.readFileSync(path.join(src, f), 'utf8');

const css = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)">\n?/g)].map(m => m[1]);
const js = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n?/g)].map(m => m[1]);
if (!css.length || !js.length) throw new Error('index.html no enlaza archivos css/ o js/: ¿cambió su formato?');

html = html.replace(/<link rel="stylesheet" href="css\/[^"]+">\n?/g, '');
html = html.replace('</head>', `<style>\n${css.map(read).join('')}</style>\n</head>`);
const code = js.map(read).join('\n').replace(/<\/script/gi, '<\\/script');     // en un script en línea, «</script» cerraría la etiqueta
let first = true;
html = html.replace(/<script src="js\/[^"]+"><\/script>\n?/g, () => { if (!first) return ''; first = false; return `<script>\n${code}\n</script>\n`; });

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.cpSync(path.join(src, 'vendor'), path.join(dist, 'vendor'), { recursive: true });

const size = p => { let n = 0; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : (n += fs.statSync(f).size); }); walk(p); return n; };
console.log(`dist/ listo: ${css.length} archivos CSS y ${js.length} de JS en un solo index.html (${Math.round(fs.statSync(path.join(dist, 'index.html')).size / 1024)} KB); total ${Math.round(size(dist) / 1024)} KB`);
