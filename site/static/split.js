// split.js — clicking a reference into the other book opens it beside the text
// instead of navigating away. Everything degrades to an ordinary link: no JS,
// narrow screen, or middle-click all just follow the href.

const WIDE = 1000;
const pane = document.getElementById('pane');
const paneBody = pane?.querySelector('.pane-body');
const paneTitle = pane?.querySelector('.pane-title');
const cache = new Map();

async function fetchMain(url) {
  if (!cache.has(url)) {
    const html = await fetch(url).then((r) => r.text());
    const doc = new DOMParser().parseFromString(html, 'text/html');
    cache.set(url, doc);
  }
  return cache.get(url);
}

async function openPane(href) {
  const [path, hash] = href.split('#');
  const doc = await fetchMain(path);
  const main = doc.querySelector('main');
  if (!main) { location.href = href; return; }
  paneBody.replaceChildren(...main.cloneNode(true).childNodes);
  paneTitle.textContent = doc.title.replace(/ · .*$/, '');
  paneTitle.href = href;
  document.body.classList.add('split');
  if (hash) {
    const target = paneBody.querySelector('#' + CSS.escape(hash));
    if (target) { target.scrollIntoView(); target.classList.add('flash'); }
  } else paneBody.scrollTop = 0;
  history.replaceState(null, '', location.pathname + location.hash + '?beside=' + encodeURIComponent(href));
  if (window.MMP?.initApplets) window.MMP.initApplets(paneBody);
}

function closePane() {
  const appletSplit = document.body.classList.contains('mmp-split');
  document.body.classList.remove('split');
  document.body.classList.remove('mmp-split');
  document.querySelectorAll('.mmp-origin-expanded').forEach((box) => box.classList.remove('mmp-origin-expanded'));
  if (appletSplit) paneBody?.replaceChildren();
  history.replaceState(null, '', location.pathname + location.hash);
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-book]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  if (a.dataset.book === document.body.dataset.book) return;   // same book: normal link
  if (window.innerWidth < WIDE) return;                         // phone: normal link
  e.preventDefault();
  openPane(a.getAttribute('href'));
});

pane?.querySelector('[data-act="close-pane"]')?.addEventListener('click', closePane);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePane(); });

// restore ?beside= on load so a split view can be linked to
const beside = new URLSearchParams(location.search).get('beside');
if (beside && window.innerWidth >= WIDE) openPane(beside);
