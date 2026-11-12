// Loads classic src/js scripts into a sandbox so their pure functions can be tested with node --test.
// Browser objects are replaced by a stub that accepts any property access or call, so top-level wiring
// (event listeners, querySelector...) runs harmlessly; only functions that do not touch the DOM are tested here.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SRC = path.resolve(import.meta.dirname, '..', '..', 'src', 'js');
const stub = () => new Proxy(function(){}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function*(){} : k === 'then' ? undefined : stub(),
  apply: () => stub(), construct: () => stub(), set: () => true, has: () => true,
});

export function load(...files){
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, URL, TextEncoder, TextDecoder };
  for (const k of ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'location', 'history',
    'matchMedia', 'getComputedStyle', 'requestAnimationFrame', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
    'NodeFilter', 'Node', 'Element', 'HTMLElement', 'Event', 'CustomEvent', 'KeyboardEvent', 'DOMParser', 'Blob', 'FileReader',
    'Prism', 'fetch', 'addEventListener', 'removeEventListener', 'dispatchEvent', 'alert', 'confirm', 'prompt', 'open', 'print',
    'innerWidth', 'innerHeight', 'devicePixelRatio', 'screen', 'performance', 'crypto', 'BroadcastChannel', 'Image', 'ed', 'bar']) ctx[k] = stub();
  vm.createContext(ctx);
  for (const f of ['00-base.js', '05-i18n.js', ...files]) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  return name => vm.runInContext(name, ctx);
}
