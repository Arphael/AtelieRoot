#!/usr/bin/env node
// Release text for a tag: the CHANGELOG.md section of that version plus what each download is.
//   node scripts/release-notes.mjs v1.1.0 [out.md]     (prints to stdout without out.md)
// Fails when the CHANGELOG has no section for the version, so a release is never published without notes.
import fs from 'node:fs';
import path from 'node:path';

const tag = process.argv[2] || '', out = process.argv[3];
const ver = tag.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(ver)) { console.error(`release-notes: «${tag}» is not a vX.Y.Z tag`); process.exit(1); }
const log = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'CHANGELOG.md'), 'utf8').replace(/\r\n/g, '\n');
const esc = ver.replace(/[.]/g, '\\.');
const m = log.match(new RegExp(`^## \\[${esc}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm'));
const body = m && m[1].trim();
if (!body) { console.error(`release-notes: CHANGELOG.md has no «## [${ver}]» section with content`); process.exit(1); }
const notes = `${body}

## Downloads

| File | What it is |
| --- | --- |
| \`AtelierRoot.exe\` | Desktop app for Windows: one file, no installation. Opens a folder and saves every document as a \`.md\` file. |
| \`AtelierRoot.html\` | The same app as a single HTML file: open it in Chrome, Edge or Brave. The web version is also at https://arphael.github.io/AtelierRoot/ |

Unsigned build: Windows SmartScreen may warn the first time ("More info" -> "Run anyway").
Full history: [CHANGELOG.md](https://github.com/Arphael/AtelierRoot/blob/main/CHANGELOG.md)
`;
if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, notes); console.log(`release-notes: ${out} (${ver})`); }
else process.stdout.write(notes);
