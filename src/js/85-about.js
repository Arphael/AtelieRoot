"use strict";
/* ====== 85. Versión y «Acerca de» ====== */
// APP_SEMVER must match package.json (npm run check verifies it). The status bar shows it next to «Saved»;
// the version and the app name in the sidebar open «About», which links to the repository.
const APP_SEMVER = '2.0.0';
const APP_NAME = 'AtelieRoot';
const APP_LINKS = {
  repo: 'https://github.com/Arphael/AtelieRoot',
  changelog: 'https://github.com/Arphael/AtelieRoot/blob/main/CHANGELOG.md',
  issues: 'https://github.com/Arphael/AtelieRoot/issues',
  web: 'https://arphael.github.io/AtelieRoot/',
};
// links leave the app: in the desktop app they open in the system browser (open_link in src-tauri, limited to the project's pages)
function openExternal(url){
  if (wsTauri()){ wsTauri().invoke('open_link', { url }).catch(e => toast(String(e && e.message || e))); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}
function openAbout(){
  const link = (k, key) => '<a href="' + esc(APP_LINKS[k]) + '" data-ext rel="noopener noreferrer" target="_blank">' + esc(T(key)) + '</a>';
  card.innerHTML = '<h2>' + esc(T('about.title', { app: APP_NAME })) + '</h2>' +
    '<p class="about-ver">' + esc(T('about.version', { v: APP_SEMVER })) + ' · ' + esc(T('about.license')) + '</p>' +
    '<p class="about-what">' + esc(T('about.what')) + '</p>' +
    '<div class="about-links">' + link('repo', 'about.repo') + link('changelog', 'about.changelog') + link('web', 'about.web') + link('issues', 'about.issues') + '</div>' +
    '<div class="btns"><button class="btn" id="aboutClose">' + esc(T('about.close')) + '</button></div>';
  veil.classList.add('show');
  card.querySelectorAll('a[data-ext]').forEach(a => a.onclick = e => { e.preventDefault(); openExternal(a.href); });
  const close = () => { veil.classList.remove('show'); ed.focus({ preventScroll: true }); };
  card.querySelector('#aboutClose').onclick = close;
  card.querySelector('#aboutClose').onkeydown = e => { if (e.key === 'Escape') close(); };
  card.querySelector('#aboutClose').focus();
}
(() => {
  const v = $('#ver');
  v.textContent = 'v' + APP_SEMVER;
  v.onclick = openAbout;
  const b = $('#brandBtn');
  b.onclick = openAbout;
  const paint = () => { b.title = T('brand.title', { app: APP_NAME }); };
  document.addEventListener('langchange', paint); paint();
})();
