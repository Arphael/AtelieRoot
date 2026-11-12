// Minimal lint: names that do not exist (no-undef) and names that are never used (no-unused-vars).
// src/js are classic scripts that share one global scope, so every top-level declaration of any file
// is a known global for the others (collected below). Top-level names are not checked for use
// (vars: 'local'): a function declared in one file is usually called from another.
import fs from 'node:fs';
import path from 'node:path';
import globals from 'globals';

const SRC = path.join(import.meta.dirname, 'src', 'js');
const shared = {};
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.js'))) {
  for (const line of fs.readFileSync(path.join(SRC, f), 'utf8').split(/\r?\n/)) {
    let m = line.match(/^(?:async\s+)?function\*?\s+([\w$]+)|^(?:const|let|var|class)\s+([\w$]+)/);
    if (m) shared[m[1] || m[2]] = 'writable';
    m = line.match(/^(?:const|let|var)\s+([\w$]+\s*=[^;]*?,\s*[\w$]+\s*=.*)$/);           // const a = 1, b = 2;
    if (m) for (const d of m[1].matchAll(/(?:^|,\s*)([\w$]+)\s*=/g)) shared[d[1]] = 'writable';
    m = line.match(/^(?:const|let|var)\s+[{[]([^}\]]+)[}\]]\s*=/);                          // const { a, b } = ...
    if (m) for (const d of m[1].split(',')) { const n = d.split(':').pop().split('=')[0].trim(); if (n) shared[n] = 'writable'; }
  }
}
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { vars: 'local', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
};

export default [
  { ignores: ['dist/**', 'release/**', 'src-tauri/**', 'src/vendor/**', 'node_modules/**', 'tests/e2e/**'] },
  {
    files: ['src/js/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, ...shared, Prism: 'readonly', __TAURI__: 'readonly' } },
    rules,
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'server/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { ...rules, 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
  { files: ['server/**/*.js'], languageOptions: { sourceType: 'commonjs' } },
];
