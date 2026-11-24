// Landing page for GitHub Pages. Pages can only serve static files, so this page shows the product preview
// (the real mockup code from the app) and links to the live app. Set LIVE_URL once the server is deployed.
const LIVE_URL = ''; // e.g. 'https://orbitly.onrender.com'
const REPO_URL = 'https://github.com/Ishan-singh-0/orbitly';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const BG = ['#ECE9E2', '#E4EAF2', '#F2E6E4', '#E3EEE6'];

document.querySelectorAll('[data-live]').forEach(a => { if (LIVE_URL) { a.href = LIVE_URL; a.hidden = false; } });
document.querySelectorAll('[data-repo]').forEach(a => { a.href = REPO_URL; });
$('#soon').hidden = !!LIVE_URL;

// hero preview
let demo = { p: 'tote', c: 4, seed: 1 };
function paint() {
  const p = PRODUCTS.find(x => x.id === demo.p), col = p.colors[demo.c % p.colors.length], stage = $('#stage');
  stage.style.setProperty('--stage', col[1]); stage.querySelector('.mock')?.remove();
  stage.insertAdjacentHTML('beforeend', mockup(p.id, col[1], sampleArt(demo.seed)));
  $('#dName').textContent = p.name + ' in ' + col[0].toLowerCase();
  $('#dSw').innerHTML = p.colors.map((c, i) => `<button type="button" class="sw ${i === demo.c % p.colors.length ? 'on' : ''}" data-c="${i}" style="--sw:${c[1]}" aria-label="${c[0]}" title="${c[0]}"></button>`).join('');
  document.querySelectorAll('#dTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === demo.p));
}
$('#dTabs').innerHTML = ['tote', 'mouse', 'hoodie', 'mug', 'case'].map(id => `<button type="button" data-p="${id}">${PRODUCTS.find(x => x.id === id).name}</button>`).join('');
$('#demo').addEventListener('click', e => {
  const sw = e.target.closest('[data-c]'), tab = e.target.closest('[data-p]');
  if (sw) demo.c = +sw.dataset.c; if (tab) { demo.p = tab.dataset.p; demo.c = Math.min(demo.c, PRODUCTS.find(x => x.id === demo.p).colors.length - 1); } if (e.target.closest('#dShuffle')) demo.seed++;
  paint();
});
paint();

// product grid
$('#grid').innerHTML = PRODUCTS.map((p, i) => { const col = p.colors[(i * 2 + 1) % p.colors.length][1]; return `<div class="prod" style="--t:${col}"><span class="prod-n">${String(i + 1).padStart(2, '0')}</span><span class="prod-art">${mockup(p.id, col, sampleArt(i + 3))}</span><span class="prod-t"><b>${esc(p.name)}</b></span></div>`; }).join('');

// hero tilt
const art = $('#demo');
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(hover: hover)').matches) {
  art.addEventListener('pointermove', e => { const r = art.getBoundingClientRect(); art.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 9).toFixed(2) + 'deg'); art.style.setProperty('--rx', ((-(e.clientY - r.top) / r.height + .5) * 7).toFixed(2) + 'deg'); });
  art.addEventListener('pointerleave', () => { art.style.setProperty('--ry', '0deg'); art.style.setProperty('--rx', '0deg'); });
}
