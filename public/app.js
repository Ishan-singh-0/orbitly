// Orbitly front end: home page, live data, router, seller pages, service modal.
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
  ['What is Orbitly?', 'A marketplace where artists customise everyday products, like a bag, a mouse or a hoodie, and anyone can order them. Every artist has a public portfolio page, and many list their campus so you can find people near you.'],
  ['How do I order something?', "Open a listing, choose the colour, size and a piece from the artist's portfolio, and send the request. The artist accepts or declines, and you agree the details in Messages. Orders move through requested, in progress, delivered and completed, and you can leave a review once it is done."],
  ['How does payment work?', () => S.cfg?.payments ? 'Once the artist accepts your order, you pay through a secure Stripe checkout. Orbitly never sees your card details. We hold the payment until you approve the delivery, then pay the artist.' : "Online payment isn't switched on for this site yet. Until it is, you and the artist arrange payment directly. Don't pay in full upfront to someone you don't know, and never share card or bank details in messages."],
  ['Who makes the product?', 'The artist. Each listing says what is included and how long it takes. Ask about materials, printing and shipping in messages before you order.'],
  ['Are artists verified?', "Not yet. Artists set up their own pages, so look at their portfolio and reviews and ask questions first. If something looks wrong, report it from their page or the contact form."],
  ['How do I start selling?', 'Create an account, verify your email, choose "Sell your art", pick your page address, upload some work and list the products you customise. It shows up on the marketplace right away.'],
  ['How do you protect my account?', 'Passwords are hashed, you can switch on two-factor login with an authenticator app, and sign-ups go through a short automatic security check. You can see and sign out your devices in Account settings.'],
  ['Can I export or delete my data?', 'Yes. Open Account settings from your account menu to download your data or delete your account.']
];
const SYM = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
const HOME_TITLE = 'Orbitly — Custom products by artists around the world';
const HOME_DESC = 'Order bags, mice, mugs, hoodies and more customised by artists from campuses and countries around the world. Artists can open a free portfolio page and start selling.';

// ---------------------------------------------------------------- state

const S = {
  cur: store.get('cur', 'USD'), cat: 'all', q: '', max: 500, sort: 'new', shown: 8, onlyFav: false,
  user: null, unread: 0, alerts: 0, cfg: null, v: 0, sellers: [], online: new Set(),
  product: '', campus: '', fav: new Set(store.get('fav', [])), recent: store.get('recent', []),
  stats: { members: 0, sellers: 0, services: 0, online: 0 }, campuses: [],
  rates: { USD: 1, INR: 83, EUR: 0.92, GBP: 0.79 }
};
let G = [];                     // all services
let pending = null;             // action to run after the user logs in
let ready;                      // resolves once the first data load finishes
const gById = id => G.find(g => g.id === id);
const money = n => SYM[S.cur] + Math.round(n * (S.rates[S.cur] || 1)).toLocaleString(S.cur === 'INR' ? 'en-IN' : 'en-US');
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

const mapGig = x => ({
  id: x.id, owner: x.owner, cat: x.category, title: esc(x.title), seller: esc(x.seller), handle: x.handle, headline: esc(x.headline),
  price: x.price, days: x.days, desc: esc(x.description), included: x.included.map(esc), tags: x.tags.map(esc),
  av: AV_OFFSET + x.avatar, pal: x.accent, created: x.created, rating: x.rating || 0, reviews: x.reviews || 0,
  product: x.product || '', artworkUrl: x.artworkUrl || '', campus: x.campus || '', country: x.country || ''
});
const COVER_BG = ['#ECE9E2', '#E4EAF2', '#F2E6E4', '#E3EEE6'];
// card cover: a product mockup if the listing has one, otherwise the artwork, otherwise a generic illustration
function coverFor(g) {
  const p = g.product && prodById(g.product);
  if (p) return mockup(p.id, p.colors[g.id % p.colors.length][1], g.artworkUrl, { bg: COVER_BG[g.id % 4] });
  if (g.artworkUrl) return `<img class="art-img" src="${g.artworkUrl}" alt="" loading="lazy">`;
  return coverArt(g.cat, g.id * 5 + 3, g.pal);
}
async function loadGigs() {
  const j = await call('GET', '/api/gigs'); if (j.error) return;
  G = j.gigs.map(mapGig);
  const ids = new Set(G.map(g => g.id));
  S.fav = new Set([...S.fav].filter(id => ids.has(id)));
  S.recent = S.recent.filter(id => ids.has(id));
  updateCatCounts(); renderGigs(); renderHero(); if (heroSig) paintDemo(); renderRecent();
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
  S.stats = st.stats; S.campuses = st.campuses || []; S.online = new Set(st.online); S.cfg = st.config; if (st.rates) S.rates = st.rates;
  presence(); renderStats(); renderHeroMeta(); renderProof(); renderCampus();
  if (faqPay !== !!S.cfg?.payments) { faqPay = !!S.cfg?.payments; renderFaq(); }
  $('#copy').textContent = `© ${new Date().getFullYear()} ${S.cfg?.company || 'Orbitly'}`;
  $('#cur').title = st.rates?.updated ? 'Live exchange rates, updated ' + new Date(st.rates.updated).toLocaleString() : 'Approximate exchange rates';
  if (st.v !== S.v) {
    const firstLoad = S.v === 0; S.v = st.v;
    if (!firstLoad) { loadGigs(); loadSellers(); rerender(); }
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
  bar.innerHTML = `<div class="container"><span>${ic('mail')} Please verify <b>${esc(u.email)}</b> to list products and send messages.</span><button class="btn btn-ink btn-sm" id="resendBtn">Resend email</button></div>`;
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
  $('meta[name=theme-color]').content = theme === 'dark' ? '#0B0C10' : '#F6F4EF';
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
  box.innerHTML = s.members === 0 && s.services === 0
    ? `<p class="strip-empty">Orbitly has just opened. <button class="linklike" data-act="sell">Open the first artist page</button></p>`
    : `<ul class="strip"><li><b>${s.members.toLocaleString()}</b> members</li><li><b>${s.sellers.toLocaleString()}</b> artists</li><li><b>${s.services.toLocaleString()}</b> listings</li><li><b>${s.online.toLocaleString()}</b> online now</li></ul>`;
}
function renderHeroMeta() {
  const s = S.stats;
  $('#heroMeta').textContent = s.online > 0 ? `${plural(s.online, 'person')} online right now` : s.services > 0 ? `${plural(s.services, 'custom product')} available` : 'Free to join, free to list';
}
function renderProof() {
  const s = S.stats, box = $('#proof'), some = S.sellers.slice(0, 4);
  box.innerHTML = some.length
    ? `<div class="stack">${some.map(x => avE(AV_OFFSET + x.avatar)).join('')}</div><p><b>${plural(s.sellers, 'artist')}</b> ${s.sellers === 1 ? 'has' : 'have'} joined<br><small>${s.services ? plural(s.services, 'listing') + ' to choose from' : 'First listings coming soon'}</small></p>`
    : `<p class="proof-empty"><b>A brand-new marketplace.</b><br><small>Be one of the first artists to open a page.</small></p>`;
}

let heroSig = '';
let demo = { p: 'tote', c: 4, seed: 1 };
function paintDemo() {
  const p = prodById(demo.p), col = p.colors[demo.c % p.colors.length], pool = [...new Set(G.map(g => g.artworkUrl).filter(Boolean))]; // real artwork once artists have uploaded some
  const stage = $('#demoStage'); stage.style.setProperty('--stage', col[1]);
  stage.querySelector('.mock')?.remove(); stage.insertAdjacentHTML('beforeend', mockup(p.id, col[1], pool.length ? pool[demo.seed % pool.length] : sampleArt(demo.seed)));
  $('#demoName').textContent = p.name + ' in ' + col[0].toLowerCase();
  $('#demoNote').textContent = pool.length ? "Artwork by artists on Orbitly" : 'Sample artwork. Try the colours and products.';
  $('#demoSw').innerHTML = p.colors.map((c, i) => `<button type="button" class="sw ${i === demo.c % p.colors.length ? 'on' : ''}" data-dc="${i}" style="--sw:${c[1]}" aria-label="${c[0]}" title="${c[0]}"></button>`).join('');
  $$('#demoTabs button').forEach(b => b.classList.toggle('on', b.dataset.dp === demo.p));
}
function renderHero() {
  if (heroSig) return; heroSig = 'demo';
  $('#heroArt').innerHTML = `<div class="demo"><div class="demo-stage" id="demoStage"><span class="demo-tag">Live preview</span></div>
    <div class="demo-hud"><div class="demo-meta"><b id="demoName"></b><small id="demoNote"></small></div><div class="sw-row" id="demoSw"></div><button type="button" class="demo-shuffle" id="demoShuffle">${ic('refresh')} Other artwork</button></div>
    <div class="demo-tabs" id="demoTabs">${['tote', 'mouse', 'hoodie', 'mug', 'case'].map(id => `<button type="button" data-dp="${id}">${prodById(id).name}</button>`).join('')}</div></div>`;
  $('#heroArt').onclick = e => {
    const sw = e.target.closest('[data-dc]'), tab = e.target.closest('[data-dp]');
    if (sw) demo.c = +sw.dataset.dc; if (tab) { demo.p = tab.dataset.dp; demo.c = Math.min(demo.c, prodById(demo.p).colors.length - 1); } if (e.target.closest('#demoShuffle')) demo.seed++;
    paintDemo();
  };
  paintDemo();
}
function renderCats() {
  $('#catGrid').innerHTML = PRODUCTS.map((p, i) => { const col = p.colors[(i * 2 + 1) % p.colors.length][1]; return `<button class="prod" data-prod="${p.id}" style="--t:${col}"><span class="prod-n">${String(i + 1).padStart(2, '0')}</span><span class="prod-art">${mockup(p.id, col, sampleArt(i + 3))}</span><span class="prod-t"><span><b>${p.name}</b><small data-pc="${p.id}"></small></span></span></button>`; }).join('');
  $('#subnav').innerHTML = CATS.map(c => `<button data-cat="${c.id}">${c.name}</button>`).join('');
  $('#filterChips').innerHTML = '<button class="chip active" data-cat="all">All</button>' + CATS.map(c => `<button class="chip" data-cat="${c.id}">${CAT_SHORT[c.id]}</button>`).join('');
  $('#popChips').innerHTML = ['Tote bag', 'Mouse', 'Hoodie', 'Mug', 'Poster'].map(p => `<button class="chip" data-q="${p}">${p}</button>`).join('');
  updateCatCounts();
}
function updateCatCounts() {
  PRODUCTS.forEach(p => { const n = G.filter(g => g.product === p.id).length, el = $(`[data-pc="${p.id}"]`); if (el) el.textContent = n ? plural(n, 'listing') : 'No listings yet'; });
}
let campusSig = '';
function renderCampus() {
  const sig = JSON.stringify(S.campuses) + S.campus; if (sig === campusSig) return; campusSig = sig;
  $('#campus').hidden = !S.campuses.length;
  $('#campusRow').innerHTML = S.campuses.map(c => `<button class="campus ${S.campus === c.name ? 'on' : ''}" data-campus="${esc(c.name)}"><b>${esc(c.name)}</b><small>${plural(c.artists, 'artist')}</small></button>`).join('');
  const sel = $('#campusSel'); sel.innerHTML = '<option value="">All campuses</option>' + S.campuses.map(c => `<option value="${esc(c.name)}" ${S.campus === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}
let sellerSig = null;
function renderSellers() {
  const sig = S.sellers.map(s => [s.handle, s.avatar, s.accent, s.services, s.headline, s.rating, s.reviews].join()).join('|');
  if (sig === sellerSig) return; sellerSig = sig;
  $('#sellerRow').innerHTML = S.sellers.length ? S.sellers.slice(0, 8).map(p => {
    const colour = PALS[p.accent % 8][1], joined = new Date(p.since).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    return `<a class="s-card" href="/@${p.handle}" data-nav><div class="s-ban" style="background:${colour}"></div><div class="s-body">${avE(AV_OFFSET + p.avatar, 'lg', p.handle)}<h3>${esc(p.name)}</h3><span class="role">${esc(p.headline)}</span><span class="cat-badge">${esc(p.campus) || CAT_SHORT[p.category] || ''}</span><div class="s-meta"><div><b>${p.works || 0}</b>${p.works === 1 ? 'Artwork' : 'Artworks'}</div><div><b>${p.reviews ? p.rating.toFixed(1) + ' ★' : joined}</b>${p.reviews ? plural(p.reviews, 'review') : 'Joined'}</div></div></div></a>`;
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

// ---------------------------------------------------------------- services list

function filtered() {
  const q = S.q.toLowerCase();
  const list = G.filter(g =>
    (!S.onlyFav || S.fav.has(g.id)) && (S.cat === 'all' || g.cat === S.cat) && (!S.product || g.product === S.product) && (!S.campus || g.campus === S.campus) && g.price <= S.max &&
    (!q || (g.title + ' ' + g.tags.join(' ') + ' ' + g.seller + ' ' + g.cat + ' ' + g.desc + ' ' + (prodById(g.product)?.name || '') + ' ' + g.campus + ' ' + g.country).toLowerCase().includes(q)));
  const by = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, fast: (a, b) => a.days - b.days, rated: (a, b) => b.rating - a.rating || b.reviews - a.reviews }[S.sort];
  return list.sort(by || ((a, b) => b.created - a.created));
}
function gigCard(g) {
  const fav = S.fav.has(g.id);
  return `<article class="gig" data-id="${g.id}" tabindex="0">
    <div class="cover">${coverFor(g)}${g.days <= 2 ? `<span class="tag-fast">Fast delivery</span>` : ''}<button class="heart ${fav ? 'on' : ''}" data-fav="${g.id}" aria-pressed="${fav}" aria-label="Save to favorites">${ic('heart')}</button><span class="cat-chip">${esc(prodById(g.product)?.name || CAT_SHORT[g.cat])}</span></div>
    <div class="gig-body"><a class="seller" href="/@${g.handle}" data-nav>${avE(g.av, 'sm', g.handle)}<b>${g.seller}</b>${g.reviews ? `<span class="rating">${ic('star', 'fill')} ${g.rating.toFixed(1)} <small>(${g.reviews})</small></span>` : ''}</a>
    <h3>${g.title}</h3>${g.campus ? `<p class="g-campus">${ic('pin')}${esc(g.campus)}</p>` : ''}${g.tags.length ? `<div class="gtags">${g.tags.slice(0, 3).map(t => `<span>${t}</span>`).join('')}</div>` : ''}
    <div class="gig-foot"><span class="del">${ic('clock')} ${g.days} day${g.days > 1 ? 's' : ''}</span><span class="price">From<b>${money(g.price)}</b></span></div></div></article>`;
}
function renderActive() {
  const f = [];
  if (S.q) f.push(['q', `“${esc(S.q)}”`]);
  if (S.cat !== 'all') f.push(['cat', CATS.find(c => c.id === S.cat).name]);
  if (S.product) f.push(['product', prodById(S.product).name]);
  if (S.campus) f.push(['campus', esc(S.campus)]);
  if (S.max < 500) f.push(['max', 'Under ' + money(S.max)]);
  if (S.onlyFav) f.push(['fav', 'Favorites']);
  $('#activeF').innerHTML = f.length ? f.map(([k, label]) => `<span class="af">${label}<button data-clearf="${k}" aria-label="Remove filter">${ic('x')}</button></span>`).join('') + '<button class="af-clear" data-clearf="all">Clear all</button>' : '';
}
function clearFilter(kind) {
  if (kind === 'q' || kind === 'all') { S.q = ''; $('#heroIn').value = ''; $('#heroClear').classList.remove('show'); }
  if (kind === 'max' || kind === 'all') { S.max = 500; $('#priceR').value = 500; updRange(); }
  if (kind === 'fav' || kind === 'all') S.onlyFav = false;
  if (kind === 'product' || kind === 'all') S.product = '';
  if (kind === 'campus' || kind === 'all') { S.campus = ''; campusSig = ''; renderCampus(); }
  if (kind === 'cat' || kind === 'all') { const keepFav = S.onlyFav; setCat('all'); S.onlyFav = keepFav; return; }
  S.shown = 8; renderGigs();
}
function emptyMessage() {
  if (!G.length) return `<span class="empty-art">${mockup('mug', '#F4F3EF', sampleArt(7), { bg: 'transparent' })}</span><h3>The first listings are yet to arrive</h3><p>Orbitly just opened. Artists publish custom products from their dashboard, and each one shows up here for everyone the moment it is live.</p><div class="btn-row"><button class="btn btn-ink btn-lg" data-act="sell">Publish the first listing</button><a class="btn btn-line btn-lg" href="/#how" data-scroll>See how it works</a></div>`;
  const [title, text, btn] = S.onlyFav ? ['No favorites yet', 'Tap the heart on any listing to save it here.', 'Browse everything']
    : S.q ? [`No results for “${esc(S.q)}”`, 'Check the spelling, try a broader term, or raise your budget.', 'Reset filters'] : ['Nothing here yet', 'Try a different category or raise your budget.', 'Reset filters'];
  return `<h3>${title}</h3><p>${text}</p><button class="btn btn-ink" id="resetF">${btn}</button>`;
}
function renderGigs() {
  renderActive();
  const none = !G.length; $('.filters').hidden = none; $('.result-count').hidden = none;
  const all = filtered(), shown = all.slice(0, S.shown);
  $('#gigGrid').innerHTML = shown.length ? shown.map(gigCard).join('') : `<div class="empty">${emptyMessage()}</div>`;
  $('#moreBtn').style.display = all.length > S.shown ? '' : 'none';
  $('#resN').textContent = all.length; $('#resW').textContent = all.length === 1 ? 'listing' : 'listings';
  renderRecent();
  const favCount = $('#favN'); if (favCount) favCount.textContent = S.fav.size;
}
function setProduct(id) { S.product = id; S.cat = 'all'; S.onlyFav = false; S.shown = 8; $$('#filterChips .chip').forEach(x => x.classList.toggle('active', x.dataset.cat === 'all')); renderGigs(); goHash('gigs'); }
function setCat(id, scroll = false) {
  S.onlyFav = false; S.cat = id; if (scroll) S.product = ''; S.shown = 8;
  $$('#filterChips .chip').forEach(x => x.classList.toggle('active', x.dataset.cat === id));
  $$('#subnav button').forEach(x => x.classList.toggle('on', x.dataset.cat === id));
  renderGigs(); if (scroll) goHash('gigs');
}
function setQuery(q) { S.q = q; S.cat = 'all'; S.product = ''; $('#heroIn').value = q; $('#heroClear').classList.toggle('show', !!q); setCat('all', true); }
function updRange() {
  const r = $('#priceR'); $('#priceO').textContent = money(+r.value) + (+r.value === 500 ? '+' : '');
  r.style.setProperty('--fill', (r.value - r.min) / (r.max - r.min) * 100 + '%');
}
$('#priceR').oninput = e => { S.max = +e.target.value; updRange(); S.shown = 8; renderGigs(); };
$('#sort').onchange = e => { S.sort = e.target.value; renderGigs(); };
$('#campusSel').onchange = e => { S.campus = e.target.value; S.shown = 8; campusSig = ''; renderCampus(); renderGigs(); };
$('#moreBtn').onclick = () => { S.shown += 4; renderGigs(); };
$('#cur').value = S.cur;
$('#cur').onchange = e => { S.cur = e.target.value; store.set('cur', S.cur); updRange(); heroSig = ''; renderGigs(); renderHero(); rerender(); };
function toggleFav(id, btn) {
  const on = !S.fav.has(id); on ? S.fav.add(id) : S.fav.delete(id); store.set('fav', [...S.fav]);
  btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on);
  const favCount = $('#favN'); if (favCount) favCount.textContent = S.fav.size;
  if (on) toast('Saved to favorites', 'Find it in your account menu');
}
function renderRecent() {
  const box = $('#recent'), items = S.recent.map(gById).filter(Boolean).slice(0, 4);
  box.hidden = !items.length; if (!items.length) return;
  box.innerHTML = `<h3>Recently viewed</h3><div class="rv-row">${items.map(g => `<button class="rv" data-recent="${g.id}"><span class="th">${coverFor(g)}</span><span><b>${g.title}</b><small>${g.seller} · ${money(g.price)}</small></span></button>`).join('')}</div>`;
}

// ---------------------------------------------------------------- hero search

const heroInput = $('#heroIn'), suggestBox = $('#suggest'); let suggestSel = -1;
const highlight = (text, q) => q ? text.replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : text;
function showSuggestions() {
  const q = heroInput.value.trim(); $('#heroClear').classList.toggle('show', !!q);
  const decode = t => t.replace(/&amp;/g, '&');
  const pool = [...new Set(['Logo design', 'Website', 'Video editing', 'AI chatbot', 'SEO', 'Voice over', ...G.flatMap(g => g.tags.map(decode)), ...G.map(g => decode(g.title))])];
  const items = q ? pool.filter(t => t.toLowerCase().includes(q.toLowerCase())).slice(0, 5) : pool.slice(0, 5);
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
$('#heroClear').onclick = () => { heroInput.value = ''; S.q = ''; showSuggestions(); heroInput.focus(); renderGigs(); };
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
  if (path !== '/') { setView('page'); setMeta('Page not found — Orbitly', 'This page does not exist.'); pageV.innerHTML = notFoundHTML(path); return; }
  showHome();
}
addEventListener('popstate', () => { route(true); if (location.hash) setTimeout(() => $(location.hash)?.scrollIntoView(), 30); });
const rerender = () => { if (!prof.hidden) route(true); };
const notFoundHTML = what => `<div class="container nf"><div><p class="kicker">404</p><h1>We couldn't find that page</h1><p class="lead">There's nothing at <b>${esc(what)}</b>. The address may have changed, or the page was never published.</p><div class="btn-row"><a class="btn btn-ink btn-lg" href="/" data-nav>Back to the marketplace</a><a class="btn btn-line btn-lg" href="/#sellers" data-scroll>Browse sellers</a></div></div><div class="nf-art">${coverArt('ai', 7, 0)}</div></div>`;

// ---------------------------------------------------------------- seller pages

async function showProfile(handle, keepScroll) {
  setView('profile'); if (!keepScroll) scrollTo(0, 0);
  if (!keepScroll) prof.innerHTML = '<div class="pf-banner"></div><div class="container"><div class="pf-head"><span class="sk sk-av"></span><div class="pf-id"><span class="sk sk-l1"></span><span class="sk sk-l2"></span><span class="sk sk-l3"></span></div></div></div>';
  const j = await call('GET', '/api/sellers/' + encodeURIComponent(handle)); await ready;
  if (prof.hidden) return; // the visitor navigated away while this loaded
  if (j.error) { setMeta('Artist not found — Orbitly', 'This artist page does not exist.'); prof.innerHTML = notFoundHTML('/@' + handle); return; }
  const p = { ...j.seller, avatar: AV_OFFSET + j.seller.avatar };
  setMeta(`${p.name} — ${p.headline} | Orbitly`, `${p.name}: ${p.headline}. ${String(p.bio).replace(/\s+/g, ' ').slice(0, 120)}…`);
  prof.innerHTML = profileHTML(p, j.gigs.map(mapGig), j.reviews || [], j.art || []); spy();
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
function profileHTML(p, gs, reviews, art) {
  const mine = S.user?.seller?.handle === p.handle, from = gs.length ? Math.min(...gs.map(g => g.price)) : 0;
  const since = new Date(p.since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), cat = CATS.find(c => c.id === p.category);
  const site = /^https?:\/\//i.test(p.website || '') ? `<a href="${esc(p.website)}" target="_blank" rel="nofollow noopener noreferrer">${esc(p.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</a>` : '';
  const msgBtn = (cls) => mine ? `<button class="btn btn-ink ${cls}" data-act="edit-profile">${ic('edit')} Edit my page</button>` : `<button class="btn btn-ink ${cls}" data-contact="${esc(p.handle)}">${ic('chat')} ${cls ? 'Send a message' : 'Message ' + esc(p.name.split(' ')[0])}</button>`;
  return `<div class="pf-banner">${bannerSvg(p.accent)}<div class="container" style="position:relative;height:100%"><div class="pf-back"><a href="/" data-nav>${ic('left')} Marketplace</a></div></div></div>
  <div class="container">
    <div class="pf-head">${avE(p.avatar, 'xl', p.handle)}
      <div class="pf-id"><h1>${esc(p.name)}</h1><p class="hl">${esc(p.headline)}</p>
        <div class="pf-meta">${p.reviews ? `<span class="rate">${ic('star', 'fill')}<b>${p.rating.toFixed(1)}</b><small>(${plural(p.reviews, 'review')})</small></span>` : ''}${p.campus ? `<span>${ic('briefcase')}${esc(p.campus)}</span>` : ''}${p.location || p.country ? `<span>${ic('pin')}${esc([p.location, p.country].filter(Boolean).join(', '))}</span>` : ''}<span class="online-txt" data-ptxt="${esc(p.handle)}" ${S.online.has(p.handle) ? '' : 'hidden'}>Online now</span><span>${ic('clock')}Member since ${since}</span></div></div>
      <div class="pf-actions">${msgBtn('')}<button class="btn btn-line" data-share="${esc(p.handle)}">${ic('share')} Share</button></div></div>
    <nav class="pf-nav" id="pfNav" aria-label="Page sections"><a href="#pf-about" data-pf="pf-about">About</a><a href="#pf-work" data-pf="pf-work">Portfolio</a><a href="#pf-services" data-pf="pf-services">Products</a><a href="#pf-reviews" data-pf="pf-reviews">Reviews</a></nav>
    <div class="pf-grid"><div>
      <section class="pf-sec" id="pf-about"><h2>About</h2><p class="pf-about">${esc(p.bio)}</p>${p.skills?.length ? `<div class="skill-row">${p.skills.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}</section>
      <section class="pf-sec" id="pf-work"><h2>Portfolio${art.length ? ` <small>${plural(art.length, 'piece')}</small>` : ''}</h2>${art.length ? `<div class="works">${art.map(a => `<button class="work" data-work="${esc(a.url)}" data-wt="${esc(a.title)}"><img src="${esc(a.url)}" alt="${esc(a.title)}" loading="lazy"><span>${esc(a.title)}</span></button>`).join('')}</div>` : `<div class="empty-s"><b>No artwork uploaded yet</b>${mine ? 'Open your dashboard to add your first piece.' : 'Check back soon.'}</div>`}</section>
      <section class="pf-sec" id="pf-services"><h2>Products${gs.length ? ` <small>${gs.length}</small>` : ''}</h2>${gs.length ? `<div class="pf-gigs">${gs.map(gigCard).join('')}</div>` : `<div class="empty-s"><b>No products listed yet</b>${mine ? 'Open your dashboard to list your first custom product.' : 'You can still send a message to ask about custom work.'}</div>`}</section>
      <section class="pf-sec" id="pf-reviews"><h2>Reviews${p.reviews ? ` <small>${p.rating.toFixed(1)} average from ${plural(p.reviews, 'review')}</small>` : ''}</h2>${reviews.length ? reviews.map(reviewHTML).join('') : `<div class="empty-s"><b>No reviews yet</b>Reviews appear here after a buyer completes an order.</div>`}</section>
    </div>
    <aside class="pf-side"><div class="card side-card"><div class="from">${gs.length ? 'Products start at' : 'Custom work'}</div><div class="amt">${gs.length ? money(from) : 'Ask me'}</div>${msgBtn('btn-block btn-lg')}<button class="btn btn-line btn-block" data-share="${esc(p.handle)}">${ic('link')} Copy page link</button></div>
      <div class="card side-card"><ul class="facts"><li><span>Member since</span><b>${since}</b></li>${p.location ? `<li><span>Location</span><b>${esc(p.location)}</b></li>` : ''}${p.campus ? `<li><span>Campus</span><b>${esc(p.campus)}</b></li>` : ''}<li><span>Products</span><b>${gs.length}</b></li><li><span>Artworks</span><b>${art.length}</b></li>${p.completed ? `<li><span>Orders completed</span><b>${p.completed}</b></li>` : ''}
        ${p.languages?.length ? `<li><span>Languages</span><b>${p.languages.map(esc).join(', ')}</b></li>` : ''}${site ? `<li><span>Website</span><b>${site}</b></li>` : ''}</ul></div>
      ${mine ? '' : `<a class="report-link" href="/contact?report=${esc(p.handle)}" data-nav>${ic('flag')} Report this page</a>`}</aside></div></div>`;
}
function openMessage(handle) {
  if (!S.user) { pending = () => openMessage(handle); return openAuth('login', 'Log in to send a message.'); }
  if (S.user.seller?.handle === handle) return toast("That's your own page");
  openDyn(`<div class="pad"><h2>Send a message</h2><p class="sub">Say what you need. Scope, deadline and budget help sellers reply faster.</p><div id="aErr"></div>
    <form id="msgForm" novalidate data-handle="${esc(handle)}"><label class="field"><span>Message</span><textarea name="text" rows="6" maxlength="2000" placeholder="Hi, I'm looking for…"></textarea></label><button class="btn btn-ink btn-lg btn-block" id="mGo">Send message</button></form></div>`, 'narrow');
}

// ---------------------------------------------------------------- service modal

let current = null;
const artCache = new Map(); // seller handle -> portfolio pieces
async function sellerArt(handle) {
  if (!artCache.has(handle)) { const j = await call('GET', '/api/sellers/' + encodeURIComponent(handle)); artCache.set(handle, j.art || []); }
  return artCache.get(handle);
}
function czState() { // what the buyer has picked right now
  const f = $('#reqForm'); if (!f) return null;
  const d = new FormData(f), art = d.get('artwork') || '';
  return { color: d.get('color'), hex: f.querySelector('.sw.on')?.dataset.hex, size: d.get('size'), qty: Math.max(1, Math.min(50, +d.get('qty') || 1)), artwork: art, url: art ? f.querySelector('input[name=artwork]:checked')?.dataset.url : current.artworkUrl };
}
function czUpdate() {
  const z = czState(); if (!z || !current.product) return;
  $('#mCover').innerHTML = mockup(current.product, z.hex, z.url, { bg: '#ECE9E2', placeholder: true });
  $('#czColor').textContent = z.color; $('#czTotal').textContent = money(current.price * z.qty);
  $('#czQtyNote').textContent = z.qty > 1 ? `${money(current.price)} each` : '';
}
function openGig(id) {
  const g = gById(id); if (!g) return; current = g;
  S.recent = [id, ...S.recent.filter(x => x !== id)].slice(0, 4); store.set('recent', S.recent);
  const own = S.user?.id === g.owner, p = g.product && prodById(g.product);
  const cover = p ? mockup(p.id, p.colors[0][1], g.artworkUrl, { bg: '#ECE9E2', placeholder: true }) : g.artworkUrl ? `<img class="art-img" src="${g.artworkUrl}" alt="">` : coverArt(g.cat, g.id * 5 + 3, g.pal);
  const custom = p ? `<div class="cz">
      <div class="cz-row"><span class="cz-l">Colour: <b id="czColor">${p.colors[0][0]}</b></span><div class="sw-row">${p.colors.map((c, i) => `<button type="button" class="sw ${i ? '' : 'on'}" data-sw="${c[0]}" data-hex="${c[1]}" style="--sw:${c[1]}" aria-label="${c[0]}" title="${c[0]}"></button>`).join('')}</div><input type="hidden" name="color" value="${p.colors[0][0]}"></div>
      <div class="cz-two">${p.sizes.length ? `<label class="field"><span>Size</span><select name="size">${p.sizes.map(z => `<option>${z}</option>`).join('')}</select></label>` : ''}<label class="field"><span>Quantity</span><input name="qty" type="number" min="1" max="50" value="1" inputmode="numeric"></label></div>
      <div class="field"><span>Artwork</span><div class="cz-art" id="czArt"><small>Loading portfolio…</small></div></div>
      <div class="cz-total"><span>Total <small id="czQtyNote"></small></span><b id="czTotal">${money(g.price)}</b></div></div>` : '';
  $('#qv').innerHTML = `<button class="x" id="qvX" aria-label="Close">${ic('x')}</button>
  <div class="m-left"><div class="m-cover" id="mCover">${cover}</div><h2>${g.title}</h2>
    <a class="m-seller" href="/@${g.handle}" data-nav>${avE(g.av, 'md', g.handle)}<div><b>${g.seller}</b><small>${g.headline}${g.campus ? ' · ' + esc(g.campus) : ''}</small></div><span class="view">View portfolio ${ic('right')}</span></a>
    <h4 class="m-h">About this listing</h4><p class="desc pre">${g.desc}</p>
    ${g.included.length ? `<h4 class="m-h">What's included</h4><ul class="feat">${g.included.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}</div>
  <div class="m-right"><div class="m-price-lab">${p ? p.name + ' from' : 'Starting at'}</div><div class="m-price">${money(g.price)}</div>
    <div class="m-meta"><span>${ic('clock')} ${g.days}-day delivery</span>${g.reviews ? `<span class="rate">${ic('star', 'fill')}<b>${g.rating.toFixed(1)}</b><small>(${g.reviews})</small></span>` : ''}<span class="online-txt" data-ptxt="${esc(g.handle)}" ${S.online.has(g.handle) ? '' : 'hidden'}>Artist online</span></div>
    ${own ? `<div class="empty-s" style="margin-top:20px"><b>This is your listing</b>Buyers can request it from here.</div>`
      : `<form id="reqForm" data-gig="${g.id}" data-handle="${esc(g.handle)}" novalidate>${custom}<label class="field"><span>Notes for the artist <em class="opt">(optional)</em></span><textarea name="text" rows="4" maxlength="2000" placeholder="Describe what you want, any text or names to include, and your deadline."></textarea></label><div id="reqErr"></div><button class="btn btn-ink btn-lg btn-block" id="reqGo">Send request</button></form>
        <div class="m-actions"><button class="btn btn-line btn-block" id="askBtn">${ic('chat')} Ask a question first</button></div>`}
    <div class="m-actions"><button class="btn btn-line btn-block" id="shareBtn">${ic('link')} Copy link to artist</button></div>
    <div class="secure">${ic('shield')} ${S.cfg?.payments ? "You pay through Stripe's secure checkout after the artist accepts. Orbitly never sees your card." : "Online payment isn't switched on yet. Agree payment with the artist before any work begins."}</div></div>`;
  $('#qvOv').classList.add('open'); document.body.classList.add('lock');
  if (p && !own) sellerArt(g.handle).then(list => {
    const box = $('#czArt'); if (!box || current?.id !== g.id) return;
    box.innerHTML = list.length ? `<label class="art-opt"><input type="radio" name="artwork" value="" ${g.artwork ? '' : 'checked'} data-url=""><span class="art-none">Artist's choice</span></label>` + list.map(a => `<label class="art-opt"><input type="radio" name="artwork" value="${esc(a.id)}" data-url="${esc(a.url)}" ${g.artwork === a.id ? 'checked' : ''}><img src="${esc(a.url)}" alt="${esc(a.title)}" title="${esc(a.title)}"></label>`).join('') : '<small>This artist has not uploaded any work yet. Describe your idea in the notes.</small>';
    czUpdate();
  });
}
document.addEventListener('click', e => {
  const sw = e.target.closest('[data-sw]'); if (sw) { $$('.sw').forEach(x => x.classList.toggle('on', x === sw)); $('#reqForm [name=color]').value = sw.dataset.sw; czUpdate(); }
  const w = e.target.closest('[data-work]'); if (w) openDyn(`<div class="light"><img src="${esc(w.dataset.work)}" alt="${esc(w.dataset.wt)}"><p>${esc(w.dataset.wt)}</p></div>`, 'wide');
});
document.addEventListener('input', e => { if (e.target.closest('#reqForm') && (e.target.name === 'qty' || e.target.name === 'artwork')) czUpdate(); });
function closeGig() {
  const wasOpen = $('#qvOv').classList.contains('open');
  $('#qvOv').classList.remove('open'); document.body.classList.remove('lock'); if (wasOpen) renderRecent();
}
document.addEventListener('submit', async e => {
  if (e.target.id !== 'reqForm') return; e.preventDefault();
  if (!S.user) { const id = current.id; closeGig(); pending = () => openGig(id); return openAuth('login', 'Log in to send your request.'); }
  const form = e.target, btn = $('#reqGo'); $('#reqErr').innerHTML = ''; btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending';
  const z = czState(), j = await call('POST', '/api/messages', { handle: form.dataset.handle, gigId: +form.dataset.gig, text: new FormData(form).get('text'), ...(current.product ? { color: z.color, size: z.size || '', qty: z.qty, artwork: z.artwork } : {}) });
  if (j.error) { btn.disabled = false; btn.textContent = 'Send request'; $('#reqErr').innerHTML = `<div class="form-err" role="alert">${esc(j.error)}</div>`; return; }
  form.outerHTML = `<div class="sent-card"><span class="ti">${ic('check')}</span><h3>Request sent</h3><p>${current.seller.split(' ')[0]} can see it now. You can follow it under Orders, and chat in Messages.</p><div class="btn-row"><button class="btn btn-ink" data-open-chat="${j.peer.id}">Open conversation</button><button class="btn btn-line" data-act="orders">View orders</button></div></div>`;
  $('#askBtn')?.remove();
});

// ---------------------------------------------------------------- command palette (search button)

const ACTIONS = [
  ['sun', 'Toggle theme', () => $('#themeBtn').click()], ['up', 'Back to top', () => scrollTo({ top: 0, behavior: 'smooth' })],
  ['chat', 'Go to FAQ', () => goHash('faq')], ['briefcase', 'Sell your art', () => openSeller()],
  ['chat', 'Open messages', () => (S.user ? openMessages() : openAuth('login', 'Log in to see your messages.'))],
  ['briefcase', 'Open orders', () => (S.user ? openOrders() : openAuth('login', 'Log in to see your orders.'))]
];
let cmdSel = 0, cmdItems = [];
function paintCmd() {
  const q = $('#cmdIn').value.trim().toLowerCase();
  const gs = G.filter(g => g.title.toLowerCase().includes(q) || g.tags.join(' ').toLowerCase().includes(q)).slice(0, q ? 5 : 3).map(g => ({ ico: ic('search'), t: g.title.replace(/^I will /i, ''), run: () => openGig(g.id) }));
  const ss = S.sellers.filter(s => s.name.toLowerCase().includes(q) || s.headline.toLowerCase().includes(q)).slice(0, q ? 4 : 3).map(s => ({ ico: avatar(AV_OFFSET + s.avatar), t: esc(s.name), run: () => go('/@' + s.handle) }));
  const cats = CATS.filter(c => c.name.toLowerCase().includes(q)).map(c => ({ ico: ic('grid'), t: c.name, run: () => { S.q = ''; setCat(c.id, true); } }));
  const acts = ACTIONS.filter(a => a[1].toLowerCase().includes(q)).map(a => ({ ico: ic(a[0]), t: a[1], run: a[2] }));
  cmdItems = [...gs, ...ss, ...cats, ...acts]; cmdSel = 0; let offset = 0;
  const section = (title, arr) => { const html = arr.length ? `<h6>${title}</h6>` + arr.map((x, i) => `<button class="cmd-item" data-ci="${offset + i}"><span class="ico">${x.ico}</span>${x.t}</button>`).join('') : ''; offset += arr.length; return html; };
  $('#cmdList').innerHTML = cmdItems.length ? section('Services', gs) + section('Sellers', ss) + section('Categories', cats) + section('Actions', acts) : '<div class="empty" style="padding:40px">Nothing found</div>';
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
  if (e.key === 'Escape') { closeCmd(); closeGig(); suggestBox.classList.remove('open'); $$('.pop').forEach(p => p.classList.remove('open')); }
});

// ---------------------------------------------------------------- click handling

document.addEventListener('click', e => {
  const link = e.target.closest('a[data-nav]');
  if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); closeGig(); if (typeof closeDyn === 'function') closeDyn(); return go(link.getAttribute('href')); }
  const scrollLink = e.target.closest('a[data-scroll]'); if (scrollLink) { e.preventDefault(); document.body.classList.remove('menu-open'); return goHash(scrollLink.getAttribute('href').split('#')[1]); }
  if (e.target.closest('[data-act="sell"]')) { e.preventDefault(); return openSeller(); }
  if (e.target.closest('[data-act="orders"]')) { closeGig(); return openOrders(); }
  const prodBtn = e.target.closest('[data-prod]'); if (prodBtn) return setProduct(prodBtn.dataset.prod);
  const campusBtn = e.target.closest('[data-campus]'); if (campusBtn) { S.campus = S.campus === campusBtn.dataset.campus ? '' : campusBtn.dataset.campus; S.shown = 8; campusSig = ''; renderCampus(); renderGigs(); return goHash('gigs'); }
  const cat = e.target.closest('[data-cat]'); if (cat) { S.q = ''; heroInput.value = ''; if (location.pathname !== '/') { history.pushState({}, '', '/'); showHome(); } return setCat(cat.dataset.cat, true); }
  const query = e.target.closest('[data-q]'); if (query) { if (location.pathname !== '/') { history.pushState({}, '', '/'); showHome(); } return setQuery(query.dataset.q); }
  const heart = e.target.closest('[data-fav]'); if (heart) { e.stopPropagation(); return toggleFav(+heart.dataset.fav, heart); }
  const contact = e.target.closest('[data-contact]'); if (contact) return openMessage(contact.dataset.contact);
  const share = e.target.closest('[data-share]'); if (share) { const url = location.origin + '/@' + share.dataset.share; navigator.clipboard?.writeText(url).catch(() => {}); return toast('Link copied', url); }
  if (e.target.closest('[data-act="edit-profile"]')) return openDash('profile');
  const chat = e.target.closest('[data-open-chat]'); if (chat) { closeGig(); return openMessages(chat.dataset.openChat); }
  const recent = e.target.closest('[data-recent]'); if (recent) return openGig(+recent.dataset.recent);
  const clear = e.target.closest('[data-clearf]'); if (clear) return clearFilter(clear.dataset.clearf);
  const section = e.target.closest('[data-pf]'); if (section) { e.preventDefault(); return document.getElementById(section.dataset.pf)?.scrollIntoView({ behavior: 'smooth' }); }
  if (e.target.closest('#skipLink')) { e.preventDefault(); const t = home.hidden ? (prof.hidden ? pageV : prof) : $('#main'); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); return t.scrollIntoView(); }
  const resend = e.target.closest('#resendBtn');
  if (resend) { resend.disabled = true; call('POST', '/api/email/resend', {}).then(j => { resend.disabled = false; j.error ? toast(j.error, '', 'err') : toast('Verification email sent', 'Check your inbox and spam folder'); }); return; }
  if (e.target.id === 'qvX' || e.target.id === 'qvOv') return closeGig();
  if (e.target.closest('#shareBtn')) { const url = location.origin + '/@' + current.handle; navigator.clipboard?.writeText(url).catch(() => {}); return toast('Link copied', url); }
  if (e.target.closest('#askBtn')) { const handle = current.handle; closeGig(); return openMessage(handle); }
  if (e.target.id === 'resetF') { S.q = ''; S.max = 500; $('#priceR').value = 500; updRange(); heroInput.value = ''; return setCat('all'); }
  const card = e.target.closest('.gig'); if (card) openGig(+card.dataset.id);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList?.contains('gig')) openGig(+e.target.dataset.id); });
$('#sellBtn').onclick = $('#sellLink').onclick = () => openSeller();
$('#footSell').onclick = e => { e.preventDefault(); openSeller(); };
$('#footDash').onclick = e => { e.preventDefault(); S.user?.seller ? openDash() : openSeller(); };

// ---------------------------------------------------------------- start up

renderCats(); renderFaq(); renderExamplePage(); renderHero(); renderSellers(); renderProof(); renderStats(); renderGigs(); updRange();
ready = (async () => {
  const st = await call('GET', '/api/state'); if (!st.error) applyState(st);
  await Promise.all([loadMe(), loadGigs(), loadSellers()]);
  if (!pageV.hidden) route(true); // static pages need the site config (contact email etc.)
  connectStream();
})();
route();

// coming back from Stripe's checkout: the webhook is what marks the order paid, so just tell the buyer where to look
{
  const q = new URLSearchParams(location.search), id = q.get('paid') || q.get('unpaid');
  if (id) {
    history.replaceState({}, '', location.pathname);
    ready.then(() => { if (!S.user) return; if (q.get('paid')) { toast('Thanks, your payment is being confirmed', 'It shows as Paid on your order in a few seconds'); openOrders('buying'); } else toast('Payment cancelled', 'Nothing was charged. You can pay from Orders when you are ready.'); });
  }
}
