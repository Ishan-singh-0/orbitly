// Tweak’d front end: home page, live data, router, seller pages, service modal.
// Loaded after art.js and pages.js; auth.js (accounts, messaging, orders) loads after this file.

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const initials = name => String(name).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
const AV_OFFSET = 100; // sellers pick portrait 0–11, which we draw from seed 100 upwards
injectSprite();

// ---------------------------------------------------------------- static data

const CATS = PRODUCT_GROUPS;
const CAT_SHORT = Object.fromEntries(PRODUCT_GROUPS.map(g => [g.id, g.name]));
const prodById = id => PRODUCTS.find(p => p.id === id);
const FAQ = [
  ['What is Tweak’d?', 'A place to get your own things customised by artists. Bring a bag, a mouse, a hoodie or anything else, share what inspires you, and an artist makes it yours.'],
  ['How do I place an order?', 'Press "Customise my item". Pick what you have, choose an artist, add inspiration pictures and notes, and send it. The artist replies with a quote. Nothing starts until you accept it.'],
  ['Do I have to buy a finished product?', 'No. Tweak’d is for customising something you already own or want made your way. Artists show their work as a showcase so you can choose whose style you like.'],
  ['What goes in the inspiration tab?', 'Up to six pictures, links to things you like, and optionally one piece from the artist’s showcase. Only you, that artist and Tweak’d admins can see your pictures.'],
  ['How does payment work?', () => S.cfg?.payments ? 'After you accept a quote, you pay through a secure Stripe checkout. Tweak’d never sees your card details, and holds the payment until you approve the finished work.' : "Online payment isn't switched on for this site yet. You and the artist arrange payment directly. Don't pay in full upfront to someone you don't know, and never share card or bank details in messages."],
  ['How do I become an artist?', 'Create an account, choose "Apply to be an artist" and fill in your page. An admin reviews each application. Once approved, your page goes public and you can receive orders.'],
  ['How do you protect my account?', 'Passwords are hashed, you can switch on two-factor login with an authenticator app, and sign-ups go through a short automatic security check. You can see and sign out your devices in Account settings.'],
  ['Can I export or delete my data?', 'Yes. Open Account settings from your account menu to download your data or delete your account.']
];
const HOME_TITLE = 'Tweak’d — Your things, customised by artists';
const HOME_DESC = 'Get your bag, mouse, hoodie or anything else customised by artists. Share your inspiration, get a quote, and make it yours.';

// ---------------------------------------------------------------- state

const S = {
  q: '', shown: 12,
  user: null, unread: 0, alerts: 0, cfg: null, v: 0, sellers: [], online: new Set(),
  place: '',
  stats: { members: 0, sellers: 0, services: 0, online: 0 }, places: []
};
let G = [];                     // artwork in the gallery
let pending = null;             // action to run after the user logs in
let ready;                      // resolves once the first data load finishes
const money = n => '₹' + Math.round(n || 0).toLocaleString('en-IN'); // all amounts are in rupees
const stars = (n = 5) => `<span class="stars">${ic('star', 'fill').repeat(n)}</span>`;
const avE = (seed, cls = '', handle = '') => `<span class="avatar ${cls}${handle && S.online.has(handle) ? ' on' : ''}"${handle ? ` data-ph="${esc(handle)}"` : ''}>${avatar(seed)}</span>`;

// ---------------------------------------------------------------- API helpers

async function call(method, url, body) {
  try {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    return r.ok ? j : { error: j.error || 'Something went wrong.', status: r.status, code: j.code };
  } catch { return { error: "Can't reach the server. Check your connection and try again." }; }
}

// Security check: find a number n so that SHA-256("salt:n") starts with `bits` zero bits. Runs in a worker.
function solveInWorker(c) {
  return new Promise((resolve, reject) => {
    let w; try { w = new Worker('/pow-worker.js'); } catch (e) { return reject(e); }
    const timer = setTimeout(() => { w.terminate(); reject(new Error('timeout')); }, 90000);
    w.onmessage = e => { clearTimeout(timer); w.terminate(); resolve(e.data.n); };
    w.onerror = () => { clearTimeout(timer); w.terminate(); reject(new Error('worker')); };
    w.postMessage({ salt: c.salt, bits: c.bits });
  });
}
async function solveOnMainThread(c) { // slower fallback if workers are unavailable
  const enc = new TextEncoder();
  for (let n = 0; ; n++) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${c.salt}:${n}`)));
    let zeros = 0; for (const b of h) { if (b === 0) { zeros += 8; continue; } zeros += Math.clz32(b) - 24; break; }
    if (zeros >= c.bits) return n;
  }
}
async function getCaptcha() {
  const c = await call('GET', '/api/captcha'); if (c.error) return null;
  let n; try { n = await solveInWorker(c); } catch { n = await solveOnMainThread(c); }
  return { salt: c.salt, exp: c.exp, bits: c.bits, sig: c.sig, n };
}
// POST that attaches the security check. With `always: false` it only does so if the server asks for it.
async function callC(url, body, { always = true } = {}) {
  if (always) body.captcha = await getCaptcha();
  let j = await call('POST', url, body);
  if (j.code === 'captcha' && !body.captcha) { body.captcha = await getCaptcha(); j = await call('POST', url, body); }
  return j;
}

async function loadGallery() {
  const j = await call('GET', '/api/gallery'); if (j.error) return;
  G = j.works; renderGallery(); renderHero(); paintDemo(false);
}
async function loadSellers() {
  const j = await call('GET', '/api/sellers'); if (j.error) return;
  S.sellers = j.sellers; renderSellers(); renderProof();
}
async function loadMe() {
  const me = await call('GET', '/api/me');
  if (me.user) { S.user = me.user; S.unread = me.user.unread || 0; S.alerts = me.user.alerts || 0; }
  if (typeof renderUser === 'function') renderUser();
  updateBadge(); renderVerifyBar();
}

// ---------------------------------------------------------------- live updates (server-sent events)

function applyState(st) {
  S.stats = st.stats; S.places = st.places || []; S.online = new Set(st.online); S.cfg = st.config;
  presence(); renderStats(); renderHeroMeta(); renderProof(); renderPlaces();
  if (faqPay !== !!S.cfg?.payments) { faqPay = !!S.cfg?.payments; renderFaq(); }
  $('#copy').textContent = `© ${new Date().getFullYear()} ${S.cfg?.company || 'Tweak’d'}`;
  if (st.v !== S.v) {
    const firstLoad = S.v === 0; S.v = st.v;
    if (!firstLoad) { loadGallery(); loadSellers(); rerender(); }
  }
}
function presence() {
  $$('[data-ph]').forEach(el => el.classList.toggle('on', S.online.has(el.dataset.ph)));
  $$('[data-ptxt]').forEach(el => { el.hidden = !S.online.has(el.dataset.ptxt); });
}
let stream = null;
function connectStream() {
  if (!window.EventSource) return;
  if (stream) stream.close();
  stream = new EventSource('/api/stream');
  stream.addEventListener('state', e => applyState(JSON.parse(e.data)));
  stream.addEventListener('message', e => {
    const d = JSON.parse(e.data);
    S.unread = d.unread ?? S.unread; if (d.alerts !== undefined) S.alerts = d.alerts;
    updateBadge(); if (typeof onLiveMessage === 'function') onLiveMessage(d);
  });
  stream.addEventListener('order', e => { const d = JSON.parse(e.data); S.alerts = d.alerts ?? S.alerts; S.unread = d.unread ?? S.unread; updateBadge(); if (typeof onLiveOrder === 'function') onLiveOrder(d); });
  stream.addEventListener('unread', e => { S.unread = JSON.parse(e.data).unread; updateBadge(); });
  stream.addEventListener('artist', e => { const ok = JSON.parse(e.data).status === 'approved'; loadMe(); toast(ok ? 'You are now an approved artist' : 'Your artist status changed', ok ? 'Your page is live' : 'Open your dashboard for details'); });
  stream.addEventListener('verified', () => { loadMe(); toast('Email verified', 'You can now publish and message'); });
}
function updateBadge() {
  const total = S.unread + S.alerts, b = $('#avBadge');
  b.hidden = !(S.user && total > 0); b.textContent = total > 9 ? '9+' : total;
  const m = $('#msgCount'); if (m) { m.hidden = !S.unread; m.textContent = S.unread; }
  const o = $('#ordCount'); if (o) { o.hidden = !S.alerts; o.textContent = S.alerts; }
}
function renderVerifyBar() {
  const bar = $('#verifyBar'), u = S.user;
  if (!u || !u.needsVerify) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="container"><span>${ic('mail')} Please verify <b>${esc(u.email)}</b> to place orders and send messages.</span><button class="btn btn-ink btn-sm" id="resendBtn">Resend email</button></div>`;
}

function toast(msg, sub = '', kind = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + (kind === 'err' ? 'err' : '');
  t.innerHTML = `<span class="ti">${ic(kind === 'err' ? 'x' : 'check')}</span><div>${msg}${sub ? `<small>${sub}</small>` : ''}</div>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
  return t;
}

// ---------------------------------------------------------------- theme and page chrome

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#themeBtn').innerHTML = ic(theme === 'dark' ? 'sun' : 'moon');
  $('meta[name=theme-color]').content = theme === 'dark' ? '#0C0C0F' : '#F2E8D5';
  store.set('theme', theme);
}
setTheme(store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

addEventListener('scroll', () => { $('#toTop').classList.toggle('show', scrollY > 800); $('#nav').classList.toggle('scrolled', scrollY > 10); spy(); }, { passive: true });
$('#toTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
$('#burger').onclick = () => document.body.classList.toggle('menu-open');
$('#avBtn').onclick = e => { e.stopPropagation(); $('#avPop').classList.toggle('open'); };
document.addEventListener('click', e => {
  if (!e.target.closest('#navLinks,#burger')) document.body.classList.remove('menu-open');
  if (!e.target.closest('.rel')) $$('.pop').forEach(p => p.classList.remove('open'));
  if (!e.target.closest('.hero-search')) $('#suggest').classList.remove('open');
});

// ---------------------------------------------------------------- home page

function renderStats() {
  const s = S.stats, box = $('#liveStrip');
  box.innerHTML = s.members === 0
    ? `<p class="strip-empty">Tweak’d has just opened. <button class="linklike" data-act="sell">Open the first artist page</button></p>`
    : `<ul class="strip"><li><b data-count="${s.members}">${s.members}</b> ${s.members === 1 ? 'member' : 'members'}</li><li><b data-count="${s.sellers}">${s.sellers}</b> ${s.sellers === 1 ? 'artist' : 'artists'}</li><li><b data-count="${s.artworks || 0}">${s.artworks || 0}</b> ${s.artworks === 1 ? 'artwork' : 'artworks'}</li><li><b data-count="${s.online}">${s.online}</b> online now</li></ul>`;
}
function renderHeroMeta() {
  const s = S.stats;
  $('#heroMeta').textContent = s.online > 0 ? `${plural(s.online, 'person')} online right now` : s.sellers > 0 ? `${plural(s.sellers, 'artist')} taking custom orders` : 'Free to join';
}
function renderProof() {
  const s = S.stats, box = $('#proof'), some = S.sellers.slice(0, 4);
  box.innerHTML = some.length
    ? `<div class="stack">${some.map(x => avE(AV_OFFSET + x.avatar)).join('')}</div><p><b>${plural(s.sellers, 'artist')}</b> ${s.sellers === 1 ? 'has' : 'have'} joined<br><small>${plural(s.artworks || 0, 'artwork')} in the gallery</small></p>`
    : `<p class="proof-empty"><b>A brand-new marketplace.</b><br><small>Be one of the first artists to open a page.</small></p>`;
}

// ---------------------------------------------------------------- hero: rotates through products on its own

const ROTATION = [['jeans', 0], ['boots', 0], ['jersey', 0], ['tote', 4], ['hoodie', 0], ['mouse', 4], ['case', 3], ['mug', 4]]; // [product, colour]
const DESIGN_FOR = { jeans: 0, boots: 4, jersey: 1, tote: 3, hoodie: 2, mouse: 5, case: 6, mug: 7 };
const TURN_MS = 3600;
let heroSig = '';
let demo = { p: 'jeans', c: 0, seed: 0, hold: 0, timer: null };
function paintDemo(animate) {
  const stage = $('#demoStage'); if (!stage) return;
  const p = prodById(demo.p), col = p.colors[demo.c % p.colors.length];
  const draw = () => {
    stage.style.setProperty('--stage', col[1]);
    stage.querySelectorAll('.mock').forEach(m => m.remove());
    stage.insertAdjacentHTML('beforeend', mockup(p.id, col[1], sampleArt(demo.seed)));
    stage.classList.remove('leaving'); stage.classList.add('arriving');
    setTimeout(() => stage.classList.remove('arriving'), 620);
  };
  if (animate) { stage.classList.add('leaving'); setTimeout(draw, 300); } else draw();
  $('#demoName').textContent = p.name + ' in ' + col[0].toLowerCase();
  $('#demoNote').textContent = DESIGN_NAMES[demo.seed % 8] + ' sample design. The whole piece can be customised.';
  $('#demoSw').innerHTML = p.colors.map((c, i) => `<button type="button" class="sw ${i === demo.c % p.colors.length ? 'on' : ''}" data-dc="${i}" style="--sw:${c[1]}" aria-label="${c[0]}" title="${c[0]}"></button>`).join('');
  $$('#demoTabs button').forEach(b => { b.classList.remove('on'); if (b.dataset.dp === demo.p) { void b.offsetWidth; b.classList.add('on'); } });
}
function turnHero() {
  if (document.hidden || home.hidden || Date.now() < demo.hold || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const i = (ROTATION.findIndex(r => r[0] === demo.p) + 1) % ROTATION.length;
  demo.p = ROTATION[i][0]; demo.c = ROTATION[i][1]; demo.seed = DESIGN_FOR[demo.p]; paintDemo(true);
}
function renderHero() {
  if (heroSig) return; heroSig = 'demo';
  $('#heroArt').innerHTML = `<div class="demo" style="--turn:${TURN_MS}ms"><div class="demo-stage" id="demoStage"><span class="demo-tag">Your item, their art</span></div>
    <div class="demo-hud"><div class="demo-meta"><b id="demoName"></b><small id="demoNote"></small></div><div class="sw-row" id="demoSw"></div><button type="button" class="btn btn-line btn-sm" id="demoDesign">${ic('refresh')} Next design</button><button type="button" class="btn btn-pop btn-sm" id="demoOrder">Customise mine</button></div>
    <div class="demo-tabs" id="demoTabs">${ROTATION.map(([id]) => `<button type="button" data-dp="${id}"><span>${prodById(id).name}</span></button>`).join('')}</div></div>`;
  const art = $('#heroArt');
  art.onclick = e => {
    const sw = e.target.closest('[data-dc]'), tab = e.target.closest('[data-dp]');
    if (e.target.closest('#demoOrder')) return openRequest({ product: demo.p, color: prodById(demo.p).colors[demo.c % prodById(demo.p).colors.length][0] });
    if (!sw && !tab && !e.target.closest('#demoDesign')) return;
    demo.hold = Date.now() + 12000; // give the visitor time to play before it moves on
    if (sw) { demo.c = +sw.dataset.dc; paintDemo(false); }
    if (tab) { demo.p = tab.dataset.dp; demo.c = Math.min(demo.c, prodById(demo.p).colors.length - 1); demo.seed = DESIGN_FOR[demo.p]; paintDemo(true); }
    if (e.target.closest('#demoDesign')) { demo.seed++; paintDemo(true); }
  };
  art.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') demo.hold = Infinity; }); art.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') demo.hold = Date.now() + 2500; });
  paintDemo(false);
  clearInterval(demo.timer); demo.timer = setInterval(turnHero, TURN_MS);
}
function renderCats() {
  $('#catGrid').innerHTML = PRODUCTS.map((p, i) => { const col = p.colors[(i * 2 + 1) % p.colors.length][1]; return `<button class="prod" data-prod="${p.id}" style="--t:${col};--i:${i}"><span class="prod-n">${String(i + 1).padStart(2, '0')}</span><span class="prod-art">${mockup(p.id, col, sampleArt(i))}</span><span class="prod-t"><span><b>${p.name}</b><small>Customise yours</small></span></span></button>`; }).join('')
    + `<button class="prod prod-other" data-prod="other" style="--i:${PRODUCTS.length}"><span class="prod-plus">+</span><span class="prod-t"><span><b>Something else</b><small>Anything you own</small></span></span></button>`;
  $('#popChips').innerHTML = ['Jeans', 'Boots', 'Jersey', 'Tote bag', 'Hoodie'].map(p => `<button class="chip" data-q="${p}">${p}</button>`).join('');
}
let placeSig = '';
function renderPlaces() {
  const sig = JSON.stringify(S.places) + S.place; if (sig === placeSig) return; placeSig = sig;
  $('#places').hidden = !S.places.length;
  $('#placeRow').innerHTML = S.places.map(c => `<button class="place ${S.place === c.name ? 'on' : ''}" data-place="${esc(c.name)}"><b>${esc(c.name)}</b><small>${plural(c.artists, 'artist')}</small></button>`).join('');
  }
let sellerSig = null;
function renderSellers() {
  const sig = S.sellers.map(s => [s.handle, s.avatar, s.accent, s.works, s.headline, s.rating, s.reviews].join()).join('|');
  if (sig === sellerSig) return; sellerSig = sig;
  $('#sellerRow').innerHTML = S.sellers.length ? S.sellers.slice(0, 8).map(p => {
    const colour = PALS[p.accent % 8][1], joined = new Date(p.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return `<a class="s-card" href="/@${p.handle}" data-nav><div class="s-ban" style="background:${colour}"></div><div class="s-body">${avE(AV_OFFSET + p.avatar, 'lg', p.handle)}<h3>${esc(p.name)}</h3><span class="role">${esc(p.headline)}</span><span class="cat-badge">${esc(p.place) || CAT_SHORT[p.category] || ''}</span><div class="s-meta"><div><b>${p.works || 0}</b>${p.works === 1 ? 'Artwork' : 'Artworks'}</div><div><b>${p.reviews ? p.rating.toFixed(1) + ' ★' : joined}</b>${p.reviews ? plural(p.reviews, 'review') : 'Joined'}</div></div></div></a>`;
  }).join('') : `<div class="empty-card"><h3>No artists yet</h3><p>Your page could be the first one here. It takes a few minutes to set up.</p><button class="btn btn-ink btn-lg" data-act="sell">Open your artist page</button></div>`;
}
let faqPay = null;
function renderFaq() {
  $('#faqList').innerHTML = FAQ.map(f => `<div class="qa"><button aria-expanded="false"><span>${f[0]}</span><span class="plus">${ic('plus')}</span></button><div class="ans"><div><p>${typeof f[1] === 'function' ? f[1]() : f[1]}</p></div></div></div>`).join('');
  $('.qa').classList.add('open'); $('.qa>button').setAttribute('aria-expanded', 'true');
  $$('.qa>button').forEach(b => b.onclick = () => {
    const item = b.parentElement, wasOpen = item.classList.contains('open');
    $$('.qa').forEach(x => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
    if (!wasOpen) { item.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
  });
}
function renderExamplePage() {
  $('#pmBan').innerHTML = bannerSvg(0); $('#pmAv').innerHTML = avatar(AV_OFFSET + 5); $('#pmArt').innerHTML = mockup('tote', '#D9C7A3', sampleArt(2));
  $('#pmUrl').textContent = location.host + '/@yourname'; $('#exAddr').textContent = location.host + '/@yourname';
}

// ---------------------------------------------------------------- gallery: artists show their work here

const workCard = (w, i) => `<figure class="shot" style="--i:${i}"><button type="button" class="shot-img" data-work="${esc(w.url)}" data-wt="${esc(w.title)}" data-wh="${esc(w.handle)}" data-wid="${esc(w.id)}" ${w.contactOnly ? 'data-contactonly="1"' : ''} aria-label="View ${esc(w.title)}"><img src="${esc(w.url)}" alt="${esc(w.title)}" loading="lazy"></button>
  <figcaption><div><b>${esc(w.title)}</b><a href="/@${esc(w.handle)}" data-nav>${esc(w.artist)}${w.place ? ' · ' + esc(w.place) : ''}</a></div>${w.contactOnly ? `<a class="btn btn-ink btn-sm" href="/@${esc(w.handle)}" data-nav>View portfolio</a>` : `<button type="button" class="btn btn-ink btn-sm" data-ask="${esc(w.handle)}" data-ref="${esc(w.id)}">Order in this style</button>`}</figcaption></figure>`;
function filtered() {
  const q = S.q.toLowerCase();
  return G.filter(w => (!S.place || w.place === S.place) && (!q || `${w.title} ${w.artist} ${w.place}`.toLowerCase().includes(q)));
}
function renderGallery() {
  const all = filtered(), shown = all.slice(0, S.shown);
  const tags = [S.q && ['q', `“${esc(S.q)}”`], S.place && ['place', esc(S.place)]].filter(Boolean);
  $('#activeF').innerHTML = tags.map(([k, l]) => `<span class="af">${l}<button data-clearf="${k}" aria-label="Remove filter">${ic('x')}</button></span>`).join('');
  $('#gallery-grid').innerHTML = shown.length ? shown.map(workCard).join('')
    : `<div class="empty"><span class="empty-art">${mockup('mug', '#F4F3EF', sampleArt(7), { bg: 'transparent' })}</span><h3>${G.length ? 'Nothing matches that yet' : 'The first artwork is on its way'}</h3><p>${G.length ? 'Try another word, or send a request and describe what you want.' : 'Approved artists upload their work here as soon as they join.'}</p><div class="btn-row"><button class="btn btn-ink btn-lg" data-act="request">Order something custom</button></div></div>`;
  $('#moreBtn').style.display = all.length > S.shown ? '' : 'none';
  if (typeof fxScan === 'function') fxScan();
}
function clearFilter(kind) {
  if (kind === 'q') { S.q = ''; $('#heroIn').value = ''; $('#heroClear').classList.remove('show'); }
  if (kind === 'place') { S.place = ''; placeSig = ''; renderPlaces(); }
  renderGallery();
}
function setQuery(q) { S.q = q; S.shown = 12; $('#heroIn').value = q; $('#heroClear').classList.toggle('show', !!q); renderGallery(); goHash('gallery'); }
$('#moreBtn').onclick = () => { S.shown += 8; renderGallery(); };

// ---------------------------------------------------------------- hero search

const heroInput = $('#heroIn'), suggestBox = $('#suggest'); let suggestSel = -1;
const highlight = (text, q) => q ? text.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : text;
function showSuggestions() {
  const q = heroInput.value.trim(); $('#heroClear').classList.toggle('show', !!q);
  const pool = [...new Set([...G.map(w => w.title), ...S.sellers.map(s => s.name), ...S.places.map(c => c.name)])];
  const items = (q ? pool.filter(t => t.toLowerCase().includes(q.toLowerCase())) : pool).slice(0, 5);
  suggestSel = -1;
  suggestBox.innerHTML = items.length ? items.map(t => `<button type="button" data-q="${esc(t)}">${ic('search')}<span>${highlight(esc(t), esc(q))}</span></button>`).join('') : '<button type="button">No suggestions. Press Enter to search anyway.</button>';
  suggestBox.classList.add('open');
}
heroInput.addEventListener('input', showSuggestions); heroInput.addEventListener('focus', showSuggestions);
heroInput.addEventListener('keydown', e => {
  const items = $$('button', suggestBox); if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); suggestSel = (suggestSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((x, i) => x.classList.toggle('sel', i === suggestSel));
  }
  if (e.key === 'Enter' && suggestSel >= 0) { e.preventDefault(); items[suggestSel].click(); suggestBox.classList.remove('open'); }
});
$('#heroClear').onclick = () => { heroInput.value = ''; S.q = ''; showSuggestions(); heroInput.focus(); renderGallery(); };
$('#heroForm').onsubmit = e => { e.preventDefault(); suggestBox.classList.remove('open'); setQuery(heroInput.value.trim()); };

// ---------------------------------------------------------------- router

const home = $('#homeView'), prof = $('#profileView'), pageV = $('#pageView');
function setMeta(title, desc) {
  document.title = title;
  const set = (sel, v) => { const el = $(sel); if (el) el.content = v; };
  set('meta[name=description]', desc); set('meta[property="og:title"]', title); set('meta[property="og:description"]', desc); set('meta[property="og:url"]', location.href);
  const canonical = $('link[rel=canonical]'); if (canonical) canonical.href = location.origin + location.pathname;
}
const setView = v => { home.hidden = v !== 'home'; prof.hidden = v !== 'profile'; pageV.hidden = v !== 'page'; document.body.classList.remove('menu-open'); };
function showHome() { setView('home'); setMeta(HOME_TITLE, HOME_DESC); }
function go(url, keepScroll) { history.pushState({}, '', url); route(); if (!keepScroll) scrollTo(0, 0); }
function goHash(id) {
  if (location.pathname !== '/') { history.pushState({}, '', '/#' + id); showHome(); }
  setTimeout(() => $('#' + id)?.scrollIntoView({ behavior: 'smooth' }), 30);
}
function route(keepScroll) {
  const path = location.pathname.replace(/\/+$/, '') || '/', seller = path.match(/^\/@([a-z0-9-]+)$/);
  if (seller) return showProfile(seller[1], keepScroll);
  if (path === '/admin') return showAdmin();
  const name = path.slice(1);
  if (name && Object.hasOwn(PAGES, name)) { setView('page'); setMeta(...PAGE_META[name]); pageV.innerHTML = PAGES[name](); if (!keepScroll) scrollTo(0, 0); return; }
  if (path !== '/') { setView('page'); setMeta('Page not found — Tweak’d', 'This page does not exist.'); pageV.innerHTML = notFoundHTML(path); return; }
  showHome();
}
addEventListener('popstate', () => { route(true); if (location.hash) setTimeout(() => $(location.hash)?.scrollIntoView(), 30); });
const rerender = () => { if (!prof.hidden) route(true); };
const notFoundHTML = what => `<div class="container nf"><div><p class="kicker">404</p><h1>We couldn't find that page</h1><p class="lead">There's nothing at <b>${esc(what)}</b>. The address may have changed, or the page was never published.</p><div class="btn-row"><a class="btn btn-ink btn-lg" href="/" data-nav>Back home</a><a class="btn btn-line btn-lg" href="/#sellers" data-scroll>Browse artists</a></div></div><div class="nf-art">${coverArt('ai', 7, 0)}</div></div>`;

// ---------------------------------------------------------------- seller pages

async function showProfile(handle, keepScroll) {
  setView('profile'); if (!keepScroll) scrollTo(0, 0);
  if (!keepScroll) prof.innerHTML = '<div class="pf-banner"></div><div class="container"><div class="pf-head"><span class="sk sk-av"></span><div class="pf-id"><span class="sk sk-l1"></span><span class="sk sk-l2"></span><span class="sk sk-l3"></span></div></div></div>';
  const j = await call('GET', '/api/sellers/' + encodeURIComponent(handle)); await ready;
  if (prof.hidden) return; // the visitor navigated away while this loaded
  if (j.error) { setMeta('Artist not found — Tweak’d', 'This artist page does not exist.'); prof.innerHTML = notFoundHTML('/@' + handle); return; }
  const p = { ...j.seller, avatar: AV_OFFSET + j.seller.avatar };
  setMeta(`${p.name} — ${p.headline} | Tweak’d`, `${p.name}: ${p.headline}. ${String(p.bio).replace(/\s+/g, ' ').slice(0, 120)}…`);
  prof.innerHTML = profileHTML(p, j.reviews || [], j.art || []); spy(); if (typeof fxScan === 'function') fxScan();
}
function spy() {
  if (prof.hidden) return;
  const links = $$('#pfNav a'); if (!links.length) return;
  let current = links[0].dataset.pf;
  links.forEach(a => { const sec = document.getElementById(a.dataset.pf); if (sec && sec.getBoundingClientRect().top <= 240) current = a.dataset.pf; });
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) current = links[links.length - 1].dataset.pf;
  links.forEach(a => a.classList.toggle('on', a.dataset.pf === current));
}
function reviewHTML(r) {
  return `<div class="pf-rev"><div class="h"><div><b>${esc(r.buyer)}</b><small>${new Date(r.created).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · ${esc(r.service)}</small></div>${stars(r.rating)}</div>${r.text ? `<p>${esc(r.text)}</p>` : ''}</div>`;
}
function profileHTML(p, reviews, art) {
  const mine = S.user?.seller?.handle === p.handle;
  const since = new Date(p.since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), cat = CATS.find(c => c.id === p.category);
  const site = /^https?:\/\//i.test(p.website || '') ? `<a href="${esc(p.website)}" target="_blank" rel="nofollow noopener noreferrer">${esc(p.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>` : '';
  const insta = /^[A-Za-z0-9._]{1,30}$/.test(p.instagram || '') ? 'https://www.instagram.com/' + p.instagram + '/' : '';
  const instaBtn = cls => `<a class="btn btn-insta ${cls}" href="${insta}" target="_blank" rel="noopener noreferrer">${ic('camera')} @${esc(p.instagram)}</a>`;
  const main = cls => mine ? `<button class="btn btn-ink ${cls}" data-act="edit-profile">${ic('edit')} Edit my page</button>` : p.contactOnly ? instaBtn(cls) : `<button class="btn btn-pop ${cls}" data-ask="${esc(p.handle)}">${ic('edit')} Order custom work</button>`;
  const waiting = mine && S.user.artist !== 'approved';
  return `<div class="pf-banner">${bannerSvg(p.accent)}<div class="container" style="position:relative;height:100%"><div class="pf-back"><a href="/" data-nav>${ic('left')} Home</a></div></div></div>
  <div class="container">
    ${waiting ? `<div class="pf-wait">${ic('clock')} ${S.user.artist === 'rejected' ? 'Your application was not approved. Update your page and save it to apply again.' : 'Only you can see this page until an admin approves your application.'}</div>` : ''}
    <div class="pf-head">${avE(p.avatar, 'xl', p.handle)}
      <div class="pf-id"><h1>${esc(p.name)}</h1><p class="hl">${esc(p.headline)}</p>
        <div class="pf-meta">${p.reviews ? `<span class="rate">${ic('star', 'fill')}<b>${p.rating.toFixed(1)}</b><small>(${plural(p.reviews, 'review')})</small></span>` : ''}${p.place ? `<span>${ic('pin')}${esc(p.place)}</span>` : ''}<span class="online-txt" data-ptxt="${esc(p.handle)}" ${S.online.has(p.handle) ? '' : 'hidden'}>Online now</span><span>${ic('clock')}Member since ${since}</span></div></div>
      <div class="pf-actions">${main('')}${insta && !p.contactOnly ? instaBtn('') : ''}${mine || p.contactOnly ? '' : `<button class="btn btn-line" data-contact="${esc(p.handle)}">${ic('chat')} Message</button>`}<button class="btn btn-line" data-share="${esc(p.handle)}">${ic('share')} Share</button></div></div>
    <nav class="pf-nav" id="pfNav" aria-label="Page sections"><a href="#pf-work" data-pf="pf-work">Showcase</a><a href="#pf-about" data-pf="pf-about">About</a><a href="#pf-reviews" data-pf="pf-reviews">Reviews</a></nav>
    <div class="pf-grid"><div>
      <section class="pf-sec" id="pf-work"><h2>Showcase${art.length ? ` <small>${plural(art.length, 'piece')}</small>` : ''}</h2>${art.length ? `<div class="works">${art.map(a => `<button class="work" data-work="${esc(a.url)}" data-wt="${esc(a.title)}" data-wh="${esc(p.handle)}" data-wid="${esc(a.id)}" ${p.contactOnly ? 'data-contactonly="1"' : ''}><img src="${esc(a.url)}" alt="${esc(a.title)}" loading="lazy"><span>${esc(a.title)}</span></button>`).join('')}</div>` : `<div class="empty-s"><b>No artwork uploaded yet</b>${mine ? 'Open your dashboard to add your first piece.' : 'Check back soon.'}</div>`}</section>
      <section class="pf-sec" id="pf-about"><h2>About</h2><p class="pf-about">${esc(p.bio)}</p>${p.skills?.length ? `<div class="skill-row">${p.skills.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}</section>
      <section class="pf-sec" id="pf-reviews"><h2>Reviews${p.reviews ? ` <small>${p.rating.toFixed(1)} average from ${plural(p.reviews, 'review')}</small>` : ''}</h2>${reviews.length ? reviews.map(reviewHTML).join('') : `<div class="empty-s"><b>No reviews yet</b>Reviews appear here after a customer completes an order.</div>`}</section>
    </div>
    <aside class="pf-side"><div class="card side-card"><div class="from">Custom work</div><div class="amt">${p.contactOnly ? 'On Instagram' : 'Get a quote'}</div>${main('btn-block btn-lg')}<button class="btn btn-line btn-block" data-share="${esc(p.handle)}">${ic('link')} Copy page link</button></div>
      <div class="card side-card"><ul class="facts"><li><span>Member since</span><b>${since}</b></li>${cat ? `<li><span>Mostly makes</span><b>${cat.name}</b></li>` : ''}${p.place ? `<li><span>Location</span><b>${esc(p.place)}</b></li>` : ''}${insta ? `<li><span>Instagram</span><b><a class="ulink" href="${insta}" target="_blank" rel="noopener noreferrer">@${esc(p.instagram)}</a></b></li>` : ''}<li><span>Artworks</span><b>${art.length}</b></li>${p.completed ? `<li><span>Orders completed</span><b>${p.completed}</b></li>` : ''}
        ${p.languages?.length ? `<li><span>Languages</span><b>${p.languages.map(esc).join(', ')}</b></li>` : ''}${site ? `<li><span>Website</span><b>${site}</b></li>` : ''}</ul></div>
      ${mine ? '' : `<a class="report-link" href="/contact?report=${esc(p.handle)}" data-nav>${ic('flag')} Report this page</a>`}</aside></div></div>`;
}
function openMessage(handle) {
  if (!S.user) { pending = () => openMessage(handle); return openAuth('login', 'Log in to send a message.'); }
  if (S.user.seller?.handle === handle) return toast("That's your own page");
  openDyn(`<div class="pad"><h2>Send a message</h2><p class="sub">Say what you need. Scope, deadline and budget help sellers reply faster.</p><div id="aErr"></div>
    <form id="msgForm" novalidate data-handle="${esc(handle)}"><label class="field"><span>Message</span><textarea name="text" rows="6" maxlength="2000" placeholder="Hi, I'm looking for…"></textarea></label><button class="btn btn-ink btn-lg btn-block" id="mGo">Send message</button></form></div>`, 'narrow');
}

// ---------------------------------------------------------------- command palette (search button)

const ACTIONS = [
  ['edit', 'Order something custom', () => openRequest()], ['sun', 'Toggle theme', () => $('#themeBtn').click()], ['up', 'Back to top', () => scrollTo({ top: 0, behavior: 'smooth' })],
  ['chat', 'Ask the help assistant', () => openChat()], ['chat', 'Go to FAQ', () => goHash('faq')], ['briefcase', 'Apply to be an artist', () => openSeller()],
  ['chat', 'Open messages', () => (S.user ? openMessages() : openAuth('login', 'Log in to see your messages.'))],
  ['briefcase', 'Open orders', () => (S.user ? openOrders() : openAuth('login', 'Log in to see your orders.'))]
];
let cmdSel = 0, cmdItems = [];
function paintCmd() {
  const q = $('#cmdIn').value.trim().toLowerCase();
  const ps = PRODUCTS.filter(p => p.name.toLowerCase().includes(q)).slice(0, q ? 5 : 3).map(p => ({ ico: ic('edit'), t: 'Customise a ' + p.name.toLowerCase(), run: () => openRequest({ product: p.id }) }));
  const ss = S.sellers.filter(s => `${s.name} ${s.headline} ${s.place}`.toLowerCase().includes(q)).slice(0, q ? 4 : 3).map(s => ({ ico: avatar(AV_OFFSET + s.avatar), t: esc(s.name), run: () => go('/@' + s.handle) }));
  const acts = ACTIONS.filter(a => a[1].toLowerCase().includes(q)).map(a => ({ ico: ic(a[0]), t: a[1], run: a[2] }));
  cmdItems = [...ps, ...ss, ...acts]; cmdSel = 0; let offset = 0;
  const section = (title, arr) => { const html = arr.length ? `<h6>${title}</h6>` + arr.map((x, i) => `<button class="cmd-item" data-ci="${offset + i}"><span class="ico">${x.ico}</span>${x.t}</button>`).join('') : ''; offset += arr.length; return html; };
  $('#cmdList').innerHTML = cmdItems.length ? section('Customise', ps) + section('Artists', ss) + section('Actions', acts) : '<div class="empty" style="padding:40px">Nothing found</div>';
  markCmd();
}
function markCmd() { $$('.cmd-item').forEach(x => x.classList.toggle('sel', +x.dataset.ci === cmdSel)); $('.cmd-item.sel')?.scrollIntoView({ block: 'nearest' }); }
function openCmd() { $('#cmdOv').classList.add('open'); $('#cmdIn').value = ''; paintCmd(); setTimeout(() => $('#cmdIn').focus(), 50); }
function closeCmd() { $('#cmdOv').classList.remove('open'); }
$('#openCmd').onclick = openCmd; $('#cmdIn').oninput = paintCmd;
$('#cmdOv').addEventListener('click', e => { if (e.target.id === 'cmdOv') closeCmd(); const it = e.target.closest('.cmd-item'); if (it) { closeCmd(); cmdItems[+it.dataset.ci].run(); } });
$('#cmdIn').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = (cmdSel + 1) % cmdItems.length; markCmd(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = (cmdSel - 1 + cmdItems.length) % cmdItems.length; markCmd(); }
  if (e.key === 'Enter' && cmdItems[cmdSel]) { closeCmd(); cmdItems[cmdSel].run(); }
});
addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !home.hidden) { e.preventDefault(); heroInput.focus(); heroInput.scrollIntoView({ block: 'center' }); }
  if (e.key === 'Escape') { closeCmd(); suggestBox.classList.remove('open'); $$('.pop').forEach(p => p.classList.remove('open')); }
});

// ---------------------------------------------------------------- click handling

document.addEventListener('click', e => {
  const link = e.target.closest('a[data-nav]');
  if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); if (typeof closeDyn === 'function') closeDyn(); return go(link.getAttribute('href')); }
  const scrollLink = e.target.closest('a[data-scroll]'); if (scrollLink) { e.preventDefault(); document.body.classList.remove('menu-open'); return goHash(scrollLink.getAttribute('href').split('#')[1]); }
  if (e.target.closest('[data-act="sell"]')) { e.preventDefault(); return openSeller(); }
  if (e.target.closest('[data-act="request"]')) { e.preventDefault(); return openRequest(); }
  if (e.target.closest('[data-act="orders"]')) return openOrders();
  const ask = e.target.closest('[data-ask]'); if (ask) return openRequest({ handle: ask.dataset.ask, reference: ask.dataset.ref || '' });
  const prodBtn = e.target.closest('[data-prod]'); if (prodBtn) return openRequest({ product: prodBtn.dataset.prod });
  const work = e.target.closest('[data-work]');
  if (work) return openDyn(`<div class="light"><img src="${esc(work.dataset.work)}" alt="${esc(work.dataset.wt)}"><p>${esc(work.dataset.wt)}</p>${S.user?.seller?.handle === work.dataset.wh || work.dataset.contactonly ? '' : `<button class="btn btn-pop" data-ask="${esc(work.dataset.wh)}" data-ref="${esc(work.dataset.wid)}">Order something in this style</button>`}</div>`, 'wide');
  const placeBtn = e.target.closest('[data-place]'); if (placeBtn) { S.place = S.place === placeBtn.dataset.place ? '' : placeBtn.dataset.place; S.shown = 12; placeSig = ''; renderPlaces(); renderGallery(); return goHash('gallery'); }
  const query = e.target.closest('[data-q]'); if (query) { if (location.pathname !== '/') { history.pushState({}, '', '/'); showHome(); } return setQuery(query.dataset.q); }
  const contact = e.target.closest('[data-contact]'); if (contact) return openMessage(contact.dataset.contact);
  const share = e.target.closest('[data-share]'); if (share) { const url = location.origin + '/@' + share.dataset.share; navigator.clipboard?.writeText(url).catch(() => {}); return toast('Link copied', url); }
  if (e.target.closest('[data-act="edit-profile"]')) return openDash('profile');
  const chat = e.target.closest('[data-open-chat]'); if (chat) return openMessages(chat.dataset.openChat);
  const clear = e.target.closest('[data-clearf]'); if (clear) return clearFilter(clear.dataset.clearf);
  const section = e.target.closest('[data-pf]'); if (section) { e.preventDefault(); return document.getElementById(section.dataset.pf)?.scrollIntoView({ behavior: 'smooth' }); }
  if (e.target.closest('#skipLink')) { e.preventDefault(); const t = home.hidden ? (prof.hidden ? pageV : prof) : $('#main'); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); return t.scrollIntoView(); }
  const resend = e.target.closest('#resendBtn');
  if (resend) { resend.disabled = true; call('POST', '/api/email/resend', {}).then(j => { resend.disabled = false; j.error ? toast(j.error, '', 'err') : toast('Verification email sent', 'Check your inbox and spam folder'); }); }
});
$('#sellBtn').onclick = $('#sellLink').onclick = () => openSeller();
$('#footSell').onclick = e => { e.preventDefault(); openSeller(); };
$('#footDash').onclick = e => { e.preventDefault(); S.user?.seller ? openDash() : openSeller(); };

// ---------------------------------------------------------------- start up

renderCats(); renderFaq(); renderExamplePage(); renderHero(); renderSellers(); renderProof(); renderStats(); renderGallery();
ready = (async () => {
  const st = await call('GET', '/api/state'); if (!st.error) applyState(st);
  await Promise.all([loadMe(), loadGallery(), loadSellers()]);
  if (!pageV.hidden) route(true); // static pages need the site config (contact email etc.)
  connectStream();
})();
document.addEventListener('DOMContentLoaded', () => route()); // after every script has loaded, so /admin can find its code

