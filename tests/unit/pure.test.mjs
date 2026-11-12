// Unit tests for pure functions of the editor (no browser): node --test tests/unit
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const get = load('10-markdown.js', '75-slash-code.js', '82-ws-core.js');
const urlAllowed = get('urlAllowed'), isCodeLike = get('isCodeLike'), isFileName = get('isFileName'),
  tidyMd = get('tidyMd'), wsSafeName = get('wsSafeName'), wsHash = get('wsHash');

test('urlAllowed: web, mail and relative links pass', () => {
  for (const u of ['https://x.com/a?b=1', 'http://localhost:3000', 'mailto:a@b.c', 'tel:+52123', 'docs/a.md', '#top', '../x.png', 'HTTPS://X.COM'])
    assert.equal(urlAllowed(u), true, u);
});
test('urlAllowed: script and other schemes are refused, even disguised', () => {
  for (const u of ['javascript:alert(1)', 'JavaScript:alert(1)', 'java\tscript:x', ' javascript:x', 'java\u200bscript:x',
    'vbscript:x', 'data:text/html,<b>', 'file:///C:/x', 'jav&amp;ascript:x'.replace('&amp;a', 'a')])
    assert.equal(urlAllowed(u), false, JSON.stringify(u));
});
test('urlAllowed: data images only in images', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(urlAllowed(png, true), true);
  assert.equal(urlAllowed(png), false);
  assert.equal(urlAllowed('data:image/svg+xml;base64,PHN2Zz4=', true), false);
});

test('isFileName / isCodeLike: file names with known extensions', () => {
  for (const t of ['Fix.prompt.md', 'app.py', 'package.json', '.gitignore', 'README.md', 'build-v2.tar.gz'])
    assert.equal(isCodeLike(t), true, t);
  for (const t of ['p.ej.', 'v1.2', 'google.com', 'e.g.', '.hidden', 'a.b', '1.5.md'])
    assert.equal(isFileName(t), false, t);
});
test('isCodeLike: paths and commands', () => {
  for (const t of ['/clear', '/plugin:cmd', 'src/app.js', './run.sh', '~/notas', 'C:\\Users\\x', 'src\\app.js', 'docs\\adr\\', '\\\\srv\\share'])
    assert.equal(isCodeLike(t), true, t);
  for (const t of ['y/o', 'and/or', '1/2', '24/7', 'TCP/IP', 'x.com/a', 'https://x.com', 'hola', 'ab'])
    assert.equal(isCodeLike(t), false, t);
});

test('tidyMd: normalizes bullets, headings, numbering and spacing', () => {
  assert.equal(tidyMd('*  a\n+ b\n• c'), '- a\n- b\n- c');
  assert.equal(tidyMd('##Title'), '## Title');
  assert.equal(tidyMd('3. a\n7. b\n1. c'), '3. a\n4. b\n5. c');
  assert.equal(tidyMd('a\n\n\n\nb  \r\n'), 'a\n\nb');
  assert.equal(tidyMd('one    two'), 'one two');
});
test('tidyMd: code blocks and tables are left alone', () => {
  const code = '```\n*  keep   this\n##no\n```';
  assert.equal(tidyMd(code), code);
  assert.equal(tidyMd('| a  |  b |'), '| a  |  b |');
});

test('wsSafeName: valid on Windows, macOS and Linux', () => {
  assert.equal(wsSafeName('a:b*c?', true), 'a-b-c-');
  assert.equal(wsSafeName('  ..hidden. ', true), 'hidden');
  assert.equal(wsSafeName('CON', true), 'CON_');
  assert.equal(wsSafeName('a/b\\c', false), 'a-b-c');
  assert.equal(wsSafeName('x'.repeat(200), true).length, 120);
  assert.ok(wsSafeName('', true).length > 0);
  assert.ok(wsSafeName(null, false).length > 0);
});

test('wsHash: stable, short and sensitive to changes', () => {
  assert.equal(wsHash('hola'), wsHash('hola'));
  assert.notEqual(wsHash('hola'), wsHash('hola '));
  assert.match(wsHash(''), /^[0-9a-z]+$/);
  assert.ok(wsHash('x'.repeat(10000)).length <= 7);
});
