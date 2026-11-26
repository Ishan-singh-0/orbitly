// Accounts and everything behind a login: sign in (with two-factor), seller onboarding and dashboard,
// messaging, orders and reviews, account settings. Loaded after app.js and shares its globals.

let authMode = 'login';
const MG = { open: false, peer: null, convs: [] };   // messages window state
const ORD = { open: false, tab: 'buying', data: null }; // orders window state
const MFA = { setup: null, codes: [] };               // two-factor setup state

// ---------------------------------------------------------------- generic modal

const dyn = document.createElement('div');
dyn.className = 'overlay'; dyn.id = 'dynOv';
dyn.innerHTML = '<div class="modal" id="dyn" role="dialog" aria-modal="true" aria-label="Tweak’d"></div>';
document.body.appendChild(dyn);

function openDyn(html, cls) {
  const m = $('#dyn'); m.className = 'modal ' + cls;
  m.innerHTML = `<button class="x" data-closedyn aria-label="Close">${ic('x')}</button>` + html;
  dyn.classList.add('open'); document.body.classList.add('lock');
}
function closeDyn() {
  dyn.classList.remove('open'); MG.open = false; MG.peer = null; ORD.open = false;
  if (!$('#qvOv').classList.contains('open')) document.body.classList.remove('lock');
}
dyn.addEventListener('click', e => { if (e.target === dyn || e.target.closest('[data-closedyn]')) closeDyn(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeDyn(); });

const errBox = msg => { const b = $('#aErr'); if (b) b.innerHTML = msg ? `<div class="form-err" role="alert">${esc(msg)}</div>` : ''; };
const formErr = (form, msg) => { const b = $('.ferr', form); if (b) b.innerHTML = msg ? `<div class="form-err" role="alert">${esc(msg)}</div>` : ''; };
const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? '<span class="spinner"></span> Please wait' : label; };
const catOpts = sel => CATS.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.name}</option>`).join('');
const when = ts => {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Keep keyboard focus inside whichever dialog is open, and give it back when the dialog closes.
const TRAPS = ['#qvOv', '#cmdOv', '#dynOv'];
let lastFocus = null;
const focusables = el => $$('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])', el).filter(e => e.getClientRects().length && !e.closest('[hidden]'));
new MutationObserver(records => records.forEach(r => {
  const el = r.target; if (!TRAPS.includes('#' + el.id)) return;
  const open = el.classList.contains('open'), wasOpen = el.dataset.wasOpen === '1';
  if (open && !wasOpen) {
    el.dataset.wasOpen = '1'; lastFocus = document.activeElement;
    setTimeout(() => { if (el.id === 'cmdOv') return; const f = focusables(el); (f.find(x => !x.matches('.x,[data-closedyn],#qvX')) || f[0])?.focus({ preventScroll: true }); }, 90);
  }
  if (!open && wasOpen) { el.dataset.wasOpen = '0'; if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); }
})).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const el = TRAPS.map(s => $(s)).find(x => x && x.classList.contains('open')); if (!el) return;
  const f = focusables(el); if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// ---------------------------------------------------------------- log in / sign up

function openAuth(mode = 'login', note = '') {
  authMode = mode;
  openDyn(`<div class="pad"><div class="seg" id="seg"><div class="slider"></div><button data-mode="login">Log in</button><button data-mode="signup">Sign up</button></div>
    <h2 id="aTitle"></h2><p class="sub" id="aSub"></p><div id="aErr"></div>
    <form id="authForm" novalidate>
      <label class="field" id="nameF"><span>Full name</span><input name="name" autocomplete="name" maxlength="40" placeholder="Your name"></label>
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@email.com"></label>
      <label class="field"><span>Password</span><input name="password" id="pw" type="password" maxlength="100" placeholder="At least 8 characters"><button type="button" class="eye" id="eye" aria-label="Show password"></button></label>
      <div class="meter" id="meter"><i></i><i></i><i></i><i></i></div>
      <p class="forgot" id="forgot"><a href="/forgot" data-nav class="ulink">Forgot your password?</a></p>
      <button class="btn btn-ink btn-lg btn-block" id="aGo"></button>
      <p class="legal-note" id="legalNote">By creating an account you agree to our <a href="/terms" data-nav class="ulink">Terms</a> and <a href="/privacy" data-nav class="ulink">Privacy Policy</a>.</p>
    </form><div class="switch" id="aSwitch"></div>
    <div class="demo-login" id="demoLogin" hidden></div></div>`, 'narrow');
  paintAuth(note);
  setTimeout(() => $('#authForm input[name=' + (authMode === 'signup' ? 'name' : 'email') + ']')?.focus(), 150);
}
function paintAuth(note = '') {
  const signup = authMode === 'signup';
  $('#seg').classList.toggle('right', signup);
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === authMode));
  $('#aTitle').textContent = signup ? 'Create your account' : 'Log in';
  $('#aSub').textContent = note || (signup ? 'It only takes a minute and it\'s free.' : 'Welcome back.');
  $('#nameF').hidden = !signup; $('#meter').hidden = !signup; $('#legalNote').hidden = !signup; $('#forgot').hidden = signup;
  $('#pw').autocomplete = signup ? 'new-password' : 'current-password';
  $('#eye').innerHTML = ic('lock');
  busy($('#aGo'), false, signup ? 'Create account' : 'Log in');
  const dl = $('#demoLogin'), demo = S.cfg?.demo;
  dl.hidden = !demo;
  if (demo) dl.innerHTML = `<p>Try a demo account</p><div>${demo.map((d, i) => `<button type="button" class="demo-btn" data-demo="${i}"><b>${esc(d.role)}</b><small>${esc(d.about)}</small></button>`).join('')}</div>`;
  $('#aSwitch').innerHTML = signup ? 'Already have an account? <button type="button" data-mode="login">Log in</button>' : 'New here? <button type="button" data-mode="signup">Create an account</button>';
  errBox('');
}
function showMfaStep(token) {
  $('#dyn .pad').innerHTML = `<h2>Two-step verification</h2><p class="sub">Open your authenticator app and enter the 6-digit code for Tweak’d. Lost your phone? Use one of your recovery codes instead.</p><div id="aErr"></div>
    <form id="mfaForm" data-token="${esc(token)}" novalidate><label class="field"><span>Code</span><input name="code" inputmode="text" autocomplete="one-time-code" maxlength="12" autocapitalize="off" spellcheck="false" placeholder="123456"></label><button class="btn btn-ink btn-lg btn-block" id="mGo">Verify and log in</button></form>`;
  $('#mfaForm input').focus();
}
function finishLogin(user, welcome) {
  S.user = user; S.unread = user.unread || 0; S.alerts = user.alerts || 0;
  renderUser(); closeDyn(); connectStream(); rerender(); toast(welcome, '');
  if (pending) { const fn = pending; pending = null; setTimeout(fn, 350); }
}
dyn.addEventListener('click', e => {
  const m = e.target.closest('[data-mode]'); if (m) { authMode = m.dataset.mode; paintAuth(); }
  const dm = e.target.closest('[data-demo]'); if (dm) { const d = S.cfg.demo[+dm.dataset.demo], f = $('#authForm'); f.email.value = d.email; f.password.value = d.password; f.requestSubmit(); }
  if (e.target.closest('#eye')) { const p = $('#pw'); p.type = p.type === 'password' ? 'text' : 'password'; }
});
dyn.addEventListener('input', e => {
  const t = e.target;
  if (t.name === 'bio' && $('#bioN')) $('#bioN').textContent = t.value.length + ' / 800';
  if (t.id === 'pw' || t.name === 'next') {
    const v = t.value, score = Math.min(4, (v.length >= 8) + (v.length >= 12) + (/[a-z]/.test(v) && /[A-Z]/.test(v)) + (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)));
    $$('.meter i', t.closest('form')).forEach((bar, k) => bar.className = k < score ? 'on' + score : '');
  }
  if (t.form?.id === 'profForm') updatePreview();
});
dyn.addEventListener('change', async e => {
  const t = e.target;
  if (t.form?.id === 'profForm') updatePreview();
  if (t.id === 'notifyBox') {
    const j = await call('POST', '/api/account', { notify: t.checked });
    if (j.error) { t.checked = !t.checked; return toast(j.error, '', 'err'); }
    S.user = { ...S.user, ...j.user }; toast(t.checked ? 'Message emails on' : 'Message emails off');
  }
});

// ---------------------------------------------------------------- account menu

const userAvatar = u => u.seller ? avatar(AV_OFFSET + u.seller.avatar) : esc(initials(u.name));
function renderUser() {
  const u = S.user;
  $('#loginBtn').hidden = $('#signupBtn').hidden = !!u; $('#avWrap').hidden = !u; renderVerifyBar();
  if (!u) return;
  $('#avBtn').innerHTML = userAvatar(u);
  $('#avPop').innerHTML = `<div class="who"><span class="avatar md">${userAvatar(u)}</span><div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div></div>
    <button class="menu-item" data-act="messages">${ic('chat')} Messages <span class="count unread-pill" id="msgCount" hidden>0</span></button>
    <button class="menu-item" data-act="orders">${ic('briefcase')} Orders <span class="count unread-pill" id="ordCount" hidden>0</span></button>
    ${u.admin ? `<a class="menu-item" href="/admin" data-nav>${ic('shield')} Admin console</a>` : ''}
    <button class="menu-item" data-act="request">${ic('edit')} New custom order</button>
    ${u.seller ? `<a class="menu-item" href="/@${u.seller.handle}" data-nav>${ic('user')} My artist page</a><button class="menu-item" data-act="dash">${ic('trend')} Artist dashboard${u.artist === 'approved' ? '' : ` <span class="count">${u.artist}</span>`}</button>` : `<button class="menu-item" data-act="sell">${ic('briefcase')} Apply to be an artist</button>`}
    <button class="menu-item" data-act="settings">${ic('gear')} Account settings</button>
    <button class="menu-item" data-act="logout">${ic('logout')} Log out</button>`;
  updateBadge();
}
$('#loginBtn').onclick = () => openAuth('login');
$('#signupBtn').onclick = () => openAuth('signup');
$('#avPop').addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
  $('#avPop').classList.remove('open');
  if (act === 'dash') openDash();
  if (act === 'sell') openSeller();
  if (act === 'messages') openMessages();
  if (act === 'orders') openOrders();
  if (act === 'settings') openSettings();
  if (act === 'request') openRequest();
  if (act === 'logout') {
    await call('POST', '/api/logout', {}); S.user = null; S.unread = 0; S.alerts = 0;
    renderUser(); updateBadge(); closeDyn(); connectStream(); rerender(); toast('Logged out');
  }
});

// ---------------------------------------------------------------- seller onboarding and dashboard

function openSeller() {
  if (!S.user) { pending = openSeller; return openAuth('signup', 'Create a free account first, then apply to be an artist.'); }
  S.user.seller ? openDash() : paintOnboard();
}
function paintOnboard() {
  const handle = slug(S.user.name).slice(0, 24);
  openDyn(`<div class="pad"><h2>Apply to be an artist</h2><p class="sub">Fill in your page and send it for review. An admin approves artist accounts; once approved your page goes public and customers can send you orders.</p><div id="aErr"></div>
    <form id="sellForm" novalidate>
      <label class="field"><span>Your page address</span><div class="pfx"><b>${esc(location.host)}/@</b><input name="handle" maxlength="24" value="${esc(handle)}" autocapitalize="off" spellcheck="false"></div></label>
      <label class="field"><span>Headline</span><input name="headline" maxlength="70" placeholder="Illustrator turning doodles into desk gear"></label>
      <div class="row2"><label class="field"><span>City <em class="opt">(optional)</em></span><input name="location" maxlength="40" placeholder="e.g. Mumbai"></label><label class="field"><span>Country <em class="opt">(optional)</em></span><input name="country" maxlength="40" placeholder="India"></label></div>
      <label class="field"><span>What do you mostly make?</span><select name="category">${catOpts('bags')}</select></label>
      <label class="field"><span>About you</span><textarea name="bio" rows="4" maxlength="800" placeholder="What do you draw or make? What styles are you known for? Who have you worked with?"></textarea><small id="bioN">0 / 800</small></label>
      <button class="btn btn-ink btn-lg btn-block" id="sGo">Send application</button></form></div>`, 'narrow');
}

let dashTab = 'work';
async function refreshMe() { const me = await call('GET', '/api/me'); if (me.user) { S.user = me.user; renderUser(); } }
function statusHTML() {
  const st = S.user.artist, s = S.user.seller;
  if (st === 'approved') return s.works ? '' : '<div class="todo"><b>You are approved.</b> Upload your first piece so customers can see your style.</div>';
  return st === 'rejected' ? '<div class="todo bad"><b>Your application was not approved.</b> Improve your page or showcase, then save “My page” to apply again.</div>'
    : '<div class="todo wait"><b>Waiting for approval.</b> Add a few pieces to your showcase now: the admin looks at them. Your page is private until then.</div>';
}
function dashHead() {
  const u = S.user, s = u.seller;
  return `<div class="pad dash"><div class="dash-head"><span class="avatar lg">${avatar(AV_OFFSET + s.avatar)}</span><div style="flex:1"><h2>${esc(u.name)}</h2><small>${esc(s.headline)}</small></div><a class="btn btn-line btn-sm" href="/@${s.handle}" data-nav>View my page ${ic('upright')}</a></div>
    ${statusHTML()}<div class="tabs" id="tabs"><button data-tab="work">Showcase</button><button data-tab="profile">My page</button></div><div id="dashBody"></div></div>`;
}
function openDash(tab) { if (!S.user?.seller) return openSeller(); dashTab = tab === 'profile' || tab === 'work' ? tab : dashTab; openDyn(dashHead(), 'wide'); paintTab(dashTab); }
dyn.addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) paintTab(t.dataset.tab); });
function paintTab(tab) {
  dashTab = tab; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const body = $('#dashBody'), u = S.user, s = u.seller;
  if (tab === 'work') {
    body.innerHTML = `<p class="sub">Upload your creations. This is your showcase: customers look at it to choose whose style they want on their own things. JPG, PNG or WebP; large images are shrunk for you.</p><div id="aErr"></div>
    <form id="upForm" class="up-form" novalidate><label class="field"><span>Title</span><input name="title" maxlength="60" placeholder="Monstera study, ink and watercolour"></label><label class="field"><span>Image</span><input type="file" id="upFile" accept="image/png,image/jpeg,image/webp"></label><button class="btn btn-ink" id="upGo">Upload</button></form>
    <div id="myWork" class="works dash-works"><small>Loading…</small></div>`;
    paintMyWork();
  }
  if (tab === 'profile') {
    body.innerHTML = `<div class="pv" aria-hidden="true"><div class="pv-ban" id="pvBan">${bannerSvg(s.accent)}</div><div class="pv-body"><span class="avatar lg" id="pvAv">${avatar(AV_OFFSET + s.avatar)}</span><div><b id="pvName">${esc(u.name)}</b><small id="pvHl">${esc(s.headline)}</small><small id="pvLoc">${esc(s.location || '')}</small></div></div></div>
    <div id="aErr"></div><form id="profForm" novalidate>
      <label class="field"><span>Your page address</span><div class="pfx"><b>${esc(location.host)}/@</b><input name="handle" maxlength="24" value="${esc(s.handle)}" autocapitalize="off" spellcheck="false"></div></label>
      <div class="row2"><label class="field"><span>Headline</span><input name="headline" maxlength="70" value="${esc(s.headline)}"></label><label class="field"><span>What you mostly make</span><select name="category">${catOpts(s.category)}</select></label></div>
      <div class="row2"><label class="field"><span>City</span><input name="location" maxlength="40" value="${esc(s.location || '')}" placeholder="e.g. Mumbai"></label><label class="field"><span>Country</span><input name="country" maxlength="40" value="${esc(s.country || '')}" placeholder="India"></label></div>
      <div class="row2"><label class="field"><span>Languages</span><input name="languages" maxlength="80" value="${esc((s.languages || []).join(', '))}" placeholder="English, Hindi"></label></div>
      <label class="field"><span>Skills (comma separated, up to 8)</span><input name="skills" maxlength="200" value="${esc((s.skills || []).join(', '))}" placeholder="Illustration, Lettering, Screen printing"></label>
      <label class="field"><span>Website</span><input name="website" maxlength="100" value="${esc(s.website)}" placeholder="https://yourportfolio.com"></label>
      <label class="field"><span>How should we pay you? <em class="opt">(private)</em></span><input name="payout" maxlength="200" value="${esc(u.payout || '')}" placeholder="UPI ID, PayPal email or bank details note"><small>Only the Tweak’d team can see this. It's used when an order you completed has been paid for online.</small></label>
      <label class="field"><span>About you</span><textarea name="bio" rows="6" maxlength="800">${esc(s.bio)}</textarea><small id="bioN">${s.bio.length} / 800</small></label>
      <div class="field"><span>Banner colour</span><div class="swatches">${PALS.map((p, i) => `<label title="${ACCENT_NAMES[i]}"><input type="radio" name="accent" value="${i}" ${i === s.accent ? 'checked' : ''}><i style="background:${p[1]}"></i></label>`).join('')}</div></div>
      <div class="field"><span>Portrait</span><div class="av-grid">${Array.from({ length: 12 }, (_, i) => `<label><input type="radio" name="avatar" value="${i}" ${i === s.avatar ? 'checked' : ''}>${avE(AV_OFFSET + i)}</label>`).join('')}</div></div>
      <button class="btn btn-ink btn-lg btn-block" id="pGo">Save changes</button></form>`;
  }
}
let myArt = [];
async function loadMyArt() { const j = await call('GET', '/api/sellers/' + S.user.seller.handle); myArt = j.art || []; return myArt; }
async function paintMyWork() {
  await loadMyArt(); const box = $('#myWork'); if (!box) return;
  box.innerHTML = myArt.length ? myArt.map(a => `<div class="work"><img src="${esc(a.url)}" alt="${esc(a.title)}"><span>${esc(a.title)}</span><button class="rm" data-delart="${esc(a.id)}" aria-label="Delete ${esc(a.title)}">${ic('trash')}</button></div>`).join('') : '<div class="empty-s"><b>No artwork yet</b>Upload your first piece above.</div>';
}
// shrink and re-encode in the browser: keeps uploads small, strips camera metadata, and keeps transparency where possible
async function prepareImage(file) {
  const bmp = await createImageBitmap(file);
  for (const max of [1600, 1200, 900]) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.86)); if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    if (blob && blob.size <= 1.4 * 1024 * 1024) return blob;
  }
  throw new Error('That image is too large even after shrinking.');
}
function updatePreview() {
  const f = $('#profForm'); if (!f || !$('#pvBan')) return;
  const accent = +(f.querySelector('input[name=accent]:checked')?.value ?? 0), av = +(f.querySelector('input[name=avatar]:checked')?.value ?? 0);
  $('#pvBan').innerHTML = bannerSvg(accent); $('#pvAv').innerHTML = avatar(AV_OFFSET + av);
  $('#pvHl').textContent = f.headline.value || 'Your headline appears here'; $('#pvLoc').textContent = f.location.value;
}

// ---------------------------------------------------------------- messages

async function openMessages(peerId) {
  if (!S.user) { pending = () => openMessages(peerId); return openAuth('login', 'Log in to see your messages.'); }
  openDyn(`<div class="mg" id="mg"><aside class="mg-side"><h3>Messages</h3><div class="mg-list" id="mgList"><div class="empty-s">Loading…</div></div></aside>
    <section class="mg-main" id="mgMain"><div class="mg-empty"><span class="ti">${ic('chat')}</span><b>Your conversations</b><p>Pick a conversation, or message a seller from their page to start one.</p></div></section></div>`, 'wide msgs');
  MG.open = true; MG.peer = null; await loadConvs();
  if (peerId) openThread(peerId); else if (innerWidth > 800 && MG.convs[0]) openThread(MG.convs[0].peer.id);
}
const peerAv = p => p.avatar !== null && p.avatar !== undefined ? avatar(AV_OFFSET + p.avatar) : esc(initials(p.name));
async function loadConvs() {
  const j = await call('GET', '/api/conversations'); if (j.error || !$('#mgList')) return;
  MG.convs = j.conversations; S.unread = j.unread; updateBadge();
  $('#mgList').innerHTML = j.conversations.length
    ? j.conversations.map(c => `<button class="mg-item ${MG.peer?.id === c.peer.id ? 'on' : ''}" data-peer="${c.peer.id}"><span class="avatar md">${peerAv(c.peer)}</span><span class="mg-t"><b>${esc(c.peer.name)}</b><small>${c.last.mine ? 'You: ' : ''}${esc(c.last.text)}</small></span><span class="mg-m"><time>${when(c.last.created)}</time>${c.unread ? `<i class="unread-pill">${c.unread}</i>` : ''}</span></button>`).join('')
    : '<div class="empty-s"><b>No conversations yet</b>Send a custom order, or message an artist from their page.</div>';
}
function bubble(m) {
  if (m.kind === 'system') return `<div class="sys-msg">${esc(m.text).replace(/\n/g, '<br>')}${m.orderId ? ' <button class="linklike" data-act="orders">View order</button>' : ''}</div>`;
  if (m.kind === 'order') return `<div class="bub ${m.mine ? 'mine' : ''}"><div class="order-card"><span class="oc-l">${ic('briefcase')} Order request</span><b>${esc(m.gigTitle)}</b><small>${m.gigPrice ? `${money(m.gigPrice)} · ${m.gigDays}-day delivery` : 'Waiting for a quote'}</small></div>${m.text ? `<p>${esc(m.text)}</p>` : ''}<time>${when(m.created)}</time></div>`;
  return `<div class="bub ${m.mine ? 'mine' : ''}"><p>${esc(m.text)}</p><time>${when(m.created)}</time></div>`;
}
async function openThread(peerId) {
  const j = await call('GET', '/api/conversations/' + peerId);
  if (j.error || !$('#mgMain')) return toast(j.error || 'Could not open that conversation', '', 'err');
  MG.peer = j.peer; $('#mg').classList.add('thread-open');
  $('#mgMain').innerHTML = `<header class="mg-head"><button class="icon-btn mg-back" data-mgback aria-label="Back to conversations">${ic('left')}</button><span class="avatar">${peerAv(j.peer)}</span><div><b>${esc(j.peer.name)}</b>${j.peer.handle ? `<a class="ulink" href="/@${j.peer.handle}" data-nav>View artist page</a>` : '<small>Customer</small>'}</div></header>
    <div class="mg-msgs" id="mgMsgs">${j.messages.map(bubble).join('') || '<div class="empty-s"><b>Say hello</b>Start the conversation below.</div>'}</div>
    ${j.canReply ? `<form class="mg-compose" id="mgForm" data-peer="${j.peer.id}"><textarea name="text" rows="1" maxlength="2000" placeholder="Write a message…" aria-label="Message"></textarea><button class="btn btn-ink" aria-label="Send">${ic('send')}</button></form>` : '<div class="mg-note">You can reply once this person has messaged you.</div>'}`;
  const box = $('#mgMsgs'); box.scrollTop = box.scrollHeight; $('#mgForm textarea')?.focus(); loadConvs();
}
async function refreshThread() {
  if (!MG.peer || !$('#mgMsgs')) return;
  const j = await call('GET', '/api/conversations/' + MG.peer.id); if (j.error) return;
  const box = $('#mgMsgs'), atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = j.messages.map(bubble).join(''); if (atEnd) box.scrollTop = box.scrollHeight; loadConvs();
}
function liveToast(d, open) { const t = toast(`New message from ${esc(d.fromName)}`, esc(d.text)); t.style.cursor = 'pointer'; t.onclick = open; }
function onLiveMessage(d) {
  if (MG.open) { if (MG.peer && d.peer === MG.peer.id) refreshThread(); else loadConvs(); }
  if (!d.sent && !(MG.open && MG.peer && d.peer === MG.peer.id)) liveToast(d, () => openMessages(d.peer));
}
dyn.addEventListener('click', e => {
  const item = e.target.closest('[data-peer]'); if (item) openThread(item.dataset.peer);
  if (e.target.closest('[data-mgback]')) { $('#mg').classList.remove('thread-open'); MG.peer = null; loadConvs(); }
});
dyn.addEventListener('keydown', e => { if (e.target.closest('#mgForm') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#mgForm').requestSubmit(); } });
dyn.addEventListener('input', e => { const t = e.target; if (t.closest('#mgForm')) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; } });

// ---------------------------------------------------------------- orders and reviews

const ORD_STATUS = { requested: 'Waiting for the artist', quoted: 'Quote received', in_progress: 'In progress', delivered: 'Delivered, awaiting approval', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };
async function openOrders(tab) {
  if (!S.user) { pending = () => openOrders(tab); return openAuth('login', 'Log in to see your orders.'); }
  if (tab) ORD.tab = tab;
  openDyn(`<div class="pad"><h2>Orders</h2><p class="sub">Your custom orders, from first request to finished piece.</p>
    <div class="tabs" id="ordTabs"><button data-ot="buying">My orders</button><button data-ot="selling">Requests for me</button></div><div id="ordBody"><div class="empty-s">Loading…</div></div></div>`, 'wide');
  ORD.open = true; await loadOrders();
}
async function loadOrders() {
  const j = await call('GET', '/api/orders'); if (j.error || !$('#ordBody')) return;
  ORD.data = j; S.alerts = j.alerts; updateBadge();
  const need = list => list.filter(o => (o.role === 'seller' && (o.status === 'requested' || o.status === 'in_progress')) || (o.role === 'buyer' && (o.status === 'delivered' || o.status === 'quoted'))).length;
  $$('#ordTabs button').forEach(b => {
    const n = need(j[b.dataset.ot]); b.classList.toggle('on', b.dataset.ot === ORD.tab);
    b.innerHTML = (b.dataset.ot === 'buying' ? 'My orders' : 'Requests for me') + (n ? ` <span class="n">${n}</span>` : '');
  });
  paintOrders();
}
function paintOrders() {
  const list = ORD.data?.[ORD.tab] || [];
  $('#ordBody').innerHTML = list.length ? list.map(orderCard).join('')
    : `<div class="empty-s"><b>${ORD.tab === 'buying' ? 'Nothing ordered yet' : 'No requests yet'}</b>${ORD.tab === 'buying' ? 'Press “Customise my item” to send your first order.' : 'Customer requests show up here the moment they arrive.'}</div>`;
}
function orderCard(o) {
  const seller = o.role === 'seller', p = o.product && prodById(o.product); let actions = '';
  const opts = [p?.name, o.options.color, o.options.size, o.qty > 1 ? 'Qty ' + o.qty : ''].filter(Boolean).map(esc).join(' · ');
  const payChip = o.pay === 'paid' ? '<span class="pay-chip paid">Paid</span>' : o.pay === 'refunded' ? '<span class="pay-chip">Refunded</span>' : '';
  if (o.canPay) actions += `<button class="btn btn-lime btn-sm" data-pay="${o.id}">Pay ${money(o.total)}</button>`;
  const custom = o.kind === 'custom';
  if (seller && o.status === 'requested') actions += `${custom ? `<button class="btn btn-ink btn-sm" data-oform="quote" data-order="${o.id}">Send a quote</button>` : `<button class="btn btn-ink btn-sm" data-oa="accept" data-order="${o.id}">Accept</button>`}<button class="btn btn-line btn-sm" data-oa="decline" data-order="${o.id}">Decline</button>`;
  if (seller && o.status === 'quoted') actions += `<button class="btn btn-line btn-sm" data-oform="quote" data-order="${o.id}">Change quote</button>`;
  if (!seller && o.status === 'quoted') actions += `<button class="btn btn-pop btn-sm" data-oa="accept_quote" data-order="${o.id}">Accept ${money(o.total)}</button><button class="btn btn-line btn-sm" data-oa="cancel" data-order="${o.id}">No thanks</button>`;
  if (seller && o.status === 'in_progress') actions += `<button class="btn btn-ink btn-sm" data-oform="deliver" data-order="${o.id}">Deliver work</button>`;
  if (!seller && o.status === 'requested') actions += `<button class="btn btn-line btn-sm" data-oa="cancel" data-order="${o.id}">Cancel request</button>`;
  if (!seller && o.status === 'delivered') actions += `<button class="btn btn-ink btn-sm" data-oa="complete" data-order="${o.id}">Approve and complete</button><button class="btn btn-line btn-sm" data-oform="revise" data-order="${o.id}">Ask for changes</button>`;
  if (!seller && o.status === 'completed' && !o.review) actions += `<button class="btn btn-ink btn-sm" data-oform="review" data-order="${o.id}">Leave a review</button>`;
  const stars5 = [5, 4, 3, 2, 1].map(n => `<input type="radio" name="rating" id="rv${o.id}_${n}" value="${n}"><label for="rv${o.id}_${n}" title="${n} star${n > 1 ? 's' : ''}">${ic('star', 'fill')}</label>`).join('');
  return `<article class="ord" data-ord="${o.id}">
    <div class="ord-h"><div><b>${esc(o.gigTitle)}</b><small>${seller ? 'Customer' : 'Artist'}: ${esc(o.peer.name)} · ${o.total ? `${money(o.total)} · ${o.days}-day delivery` : o.budget ? 'Budget ' + money(o.budget) : 'No quote yet'} · ${when(o.created)}</small></div><span class="st st-${o.status}">${ORD_STATUS[o.status]}</span></div>
    ${p ? `<div class="ord-prod"><span class="op-art">${mockup(p.id, (p.colors.find(c => c[0] === o.options.color) || p.colors[0])[1], o.artworkUrl, { bg: '#EADCC2' })}</span><span>${opts}${payChip}</span></div>` : payChip}
    ${o.brief ? `<p class="ord-brief">${esc(o.brief)}</p>` : ''}${o.deadline ? `<p class="ord-meta">${ic('clock')} Needed by ${new Date(o.deadline + 'T00:00').toLocaleDateString()}</p>` : ''}${o.inspiration.length || o.links.length ? `<div class="ord-insp"><b>Inspiration</b><div>${o.inspiration.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Inspiration"></a>`).join('')}</div>${o.links.map(l => `<a class="ulink" href="${esc(l)}" target="_blank" rel="nofollow noopener noreferrer">${esc(l)}</a>`).join('')}</div>` : ''}${o.quoteNote ? `<div class="ord-del"><b>Note with the quote</b><p>${esc(o.quoteNote)}</p></div>` : ''}${o.delivery ? `<div class="ord-del"><b>Delivery note</b><p>${esc(o.delivery)}</p></div>` : ''}
    <div class="ord-act">${actions}<button class="btn btn-line btn-sm" data-open-chat="${o.peer.id}">${ic('chat')} Conversation</button></div>
    <form class="ord-form" data-order="${o.id}" data-action="quote" hidden><div class="ferr"></div><div class="row2"><label class="field"><span>Your price (USD)</span><input name="price" type="number" min="5" max="5000" value="${o.total || o.budget || 25}"></label><label class="field"><span>Ready in (days)</span><input name="days" type="number" min="1" max="90" value="${o.days || 7}"></label></div><label class="field"><span>Note to the customer <em class="opt">(optional)</em></span><textarea name="note" rows="3" maxlength="1000"></textarea></label><button class="btn btn-ink btn-sm">Send quote</button></form>
    <form class="ord-form" data-order="${o.id}" data-action="deliver" hidden><div class="ferr"></div><label class="field"><span>Delivery note: what are you handing over, and where can they get it?</span><textarea name="note" rows="3" maxlength="1000"></textarea></label><button class="btn btn-ink btn-sm">Send delivery</button></form>
    <form class="ord-form" data-order="${o.id}" data-action="revise" hidden><div class="ferr"></div><label class="field"><span>What needs to change?</span><textarea name="note" rows="3" maxlength="1000"></textarea></label><button class="btn btn-ink btn-sm">Send request</button></form>
    <form class="ord-review" data-order="${o.id}" hidden><div class="ferr"></div><div class="star-pick" role="radiogroup" aria-label="Rating">${stars5}</div><label class="field"><span>Your review <em class="opt">(optional)</em></span><textarea name="text" rows="3" maxlength="800" placeholder="What was it like to work with ${esc(o.peer.name.split(' ')[0])}?"></textarea></label><button class="btn btn-ink btn-sm">Post review</button></form>
    ${o.review ? `<div class="ord-rev">${stars(o.review.rating)}${o.review.text ? `<p>${esc(o.review.text)}</p>` : ''}</div>` : ''}</article>`;
}
function onLiveOrder(d) {
  if (MG.open) { if (MG.peer && d.peer === MG.peer.id) refreshThread(); else loadConvs(); }
  if (ORD.open) loadOrders();
  if (!d.self) { const t = toast(esc(d.text), 'Open Orders to take a look'); t.style.cursor = 'pointer'; t.onclick = () => openOrders(); }
}
dyn.addEventListener('click', async e => {
  const tab = e.target.closest('[data-ot]'); if (tab) { ORD.tab = tab.dataset.ot; $$('#ordTabs button').forEach(b => b.classList.toggle('on', b === tab)); return paintOrders(); }
  const payBtn = e.target.closest('[data-pay]');
  if (payBtn) { payBtn.disabled = true; const j = await call('POST', `/api/orders/${payBtn.dataset.pay}/pay`, {}); if (j.error) { payBtn.disabled = false; return toast(j.error, '', 'err'); } return location.assign(j.url); }
  const act = e.target.closest('[data-oa]');
  if (act) {
    act.disabled = true; const j = await call('POST', `/api/orders/${act.dataset.order}/action`, { action: act.dataset.oa });
    if (j.error) { act.disabled = false; return toast(j.error, '', 'err'); }
    toast('Order updated'); return loadOrders();
  }
  const formBtn = e.target.closest('[data-oform]');
  if (formBtn) {
    const card = formBtn.closest('.ord'), kind = formBtn.dataset.oform;
    $$('form', card).forEach(f => { f.hidden = true; });
    const f = kind === 'review' ? $('.ord-review', card) : $(`.ord-form[data-action="${kind}"]`, card); f.hidden = false; $('textarea,input', f)?.focus();
  }
});

// ---------------------------------------------------------------- account settings

function openSettings() {
  const u = S.user; if (!u) return;
  openDyn(`<div class="pad"><h2>Account settings</h2><p class="sub">Signed in as <b>${esc(u.email)}</b></p>
    <form id="nameForm" novalidate><div class="ferr"></div><label class="field"><span>Name</span><input name="name" maxlength="40" value="${esc(u.name)}"></label><button class="btn btn-line">Save name</button></form>
    ${S.cfg?.mail ? `<hr class="sep"><h3>Email</h3><label class="addon" style="margin-bottom:0"><input type="checkbox" id="notifyBox" ${u.notify ? 'checked' : ''}><span>Email me when I get a new message while I'm offline</span></label>` : ''}
    <hr class="sep"><h3>Two-step verification</h3><div id="mfaBox"></div>
    <hr class="sep"><h3>Change password</h3>
    <form id="pwForm" novalidate><div class="ferr"></div><label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" maxlength="100"></label><label class="field"><span>New password</span><input name="next" type="password" autocomplete="new-password" maxlength="100"></label><div class="meter"><i></i><i></i><i></i><i></i></div><button class="btn btn-line">Update password</button></form>
    <hr class="sep"><h3>Devices</h3><div id="devBox"><p class="sub">Loading…</p></div>
    <hr class="sep"><h3>Your data</h3><p class="sub" style="margin-bottom:14px">Download a copy of everything we hold about you: account, showcase, orders, inspiration pictures, reviews and messages.</p><a class="btn btn-line" href="/api/account/export" download>${ic('download')} Download my data</a>
    <hr class="sep"><h3 class="danger">Delete account</h3><p class="sub" style="margin-bottom:14px">This permanently removes your page, showcase, orders and messages. It can't be undone.</p>
    <form id="delForm" novalidate><div class="ferr"></div><label class="field"><span>Confirm with your password</span><input name="password" type="password" autocomplete="current-password" maxlength="100"></label><button class="btn btn-danger">Delete my account</button></form></div>`, 'narrow');
  renderMfaBox(u.twoFactor ? 'on' : 'off'); loadDevices();
}
function renderMfaBox(state) {
  const box = $('#mfaBox'); if (!box) return;
  if (state === 'off') box.innerHTML = `<p class="sub">Add a second step to your login. After your password you'll also enter a code from an authenticator app, so a stolen password alone isn't enough.</p>
    <form id="mfaStartForm" novalidate><div class="ferr"></div><label class="field"><span>Confirm your password to begin</span><input name="password" type="password" autocomplete="current-password" maxlength="100"></label><button class="btn btn-line">Set up two-step verification</button></form>`;
  if (state === 'setup') {
    const key = MFA.setup.secret.match(/.{1,4}/g).join(' ');
    box.innerHTML = `<div class="mfa-setup"><div class="qr-box">${QR.svg(MFA.setup.uri)}</div><div class="mfa-steps">
      <p><b>1.</b> Scan the code with an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Authy.</p>
      <p class="sub">Can't scan it? Type this key in instead:</p><code class="mfa-key">${key}</code>
      <p class="sub"><a class="ulink" href="${esc(MFA.setup.uri)}">Open it in an authenticator app on this device</a></p>
      <form id="mfaEnableForm" novalidate><div class="ferr"></div><label class="field"><span><b>2.</b> Enter the 6-digit code the app shows</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456"></label><button class="btn btn-ink">Turn on</button> <button type="button" class="btn btn-line" data-mfa="cancel">Cancel</button></form></div></div>`;
    $('#mfaEnableForm input').focus();
  }
  if (state === 'on') box.innerHTML = `<p class="mfa-on">${ic('shield')} Two-step verification is <b>on</b>.</p>
    <div class="btn-row"><button class="btn btn-line btn-sm" data-mfa="regen">New recovery codes</button><button class="btn btn-line btn-sm" data-mfa="off">Turn off</button></div><div id="mfaForm2"></div>`;
  if (state === 'codes') {
    box.innerHTML = `<div class="recovery"><p><b>Save your recovery codes.</b> If you lose your phone, each code lets you log in once. We can't show them again.</p>
      <ul class="codes">${MFA.codes.map(c => `<li class="mono">${c}</li>`).join('')}</ul>
      <div class="btn-row"><button class="btn btn-line btn-sm" data-mfa="copy">Copy</button><button class="btn btn-line btn-sm" data-mfa="download">Download</button><button class="btn btn-ink btn-sm" data-mfa="done">I've saved them</button></div></div>`;
  }
}
async function loadDevices() {
  const j = await call('GET', '/api/sessions'), box = $('#devBox'); if (!box) return;
  if (j.error) { box.innerHTML = `<p class="sub">${esc(j.error)}</p>`; return; }
  box.innerHTML = `<ul class="dev-list">${j.sessions.map(s => `<li><span>${ic('globe')}<b>${esc(s.device)}</b>${s.current ? '<em class="this">This device</em>' : ''}</span><small>${s.created ? 'Signed in ' + new Date(s.created).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</small></li>`).join('')}</ul>
    ${j.sessions.length > 1 ? '<button class="btn btn-line btn-sm" data-devout>Sign out other devices</button>' : ''}`;
}
dyn.addEventListener('click', async e => {
  if (e.target.closest('[data-devout]')) { const j = await call('DELETE', '/api/sessions/others'); if (j.error) return toast(j.error, '', 'err'); toast('Signed out everywhere else'); return loadDevices(); }
  const m = e.target.closest('[data-mfa]')?.dataset.mfa; if (!m) return;
  if (m === 'cancel') { MFA.setup = null; return renderMfaBox('off'); }
  if (m === 'done') { MFA.codes = []; return renderMfaBox('on'); }
  if (m === 'copy') { navigator.clipboard?.writeText(MFA.codes.join('\n')).catch(() => {}); return toast('Recovery codes copied'); }
  if (m === 'download') {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`Tweak’d recovery codes\nEach code works once.\n\n${MFA.codes.join('\n')}\n`], { type: 'text/plain' })); a.download = 'tweakd-recovery-codes.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return;
  }
  if (m === 'off' || m === 'regen') {
    $('#mfaForm2').innerHTML = `<form id="${m === 'off' ? 'mfaOffForm' : 'mfaRegenForm'}" novalidate><div class="ferr"></div><label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" maxlength="100"></label><label class="field"><span>Code from your app (or a recovery code)</span><input name="code" autocomplete="one-time-code" maxlength="12"></label><button class="btn ${m === 'off' ? 'btn-danger' : 'btn-ink'} btn-sm">${m === 'off' ? 'Turn off two-step verification' : 'Make new codes'}</button></form>`;
    $('#mfaForm2 input').focus();
  }
});

// ---------------------------------------------------------------- form submits

const forms = {
  async authForm(f) {
    const fd = new FormData(f), signup = authMode === 'signup', btn = $('#aGo');
    const body = { email: fd.get('email'), password: fd.get('password') }; if (signup) body.name = fd.get('name');
    if (!body.email || !body.password || (signup && !body.name)) return errBox('Please fill in every field.');
    errBox(''); busy(btn, true);
    const j = await callC(signup ? '/api/signup' : '/api/login', body, { always: signup });
    if (j.error) { busy(btn, false, signup ? 'Create account' : 'Log in'); return errBox(j.error); }
    if (j.mfa) return showMfaStep(j.token);
    finishLogin(j.user, signup ? `Welcome, ${j.user.name.split(' ')[0]}` : 'Welcome back');
  },
  async mfaForm(f) {
    const btn = $('#mGo'); errBox(''); busy(btn, true);
    const j = await call('POST', '/api/login/2fa', { token: f.dataset.token, code: new FormData(f).get('code') });
    if (j.error) { busy(btn, false, 'Verify and log in'); return errBox(j.error); }
    finishLogin(j.user, 'Welcome back');
  },
  async sellForm(f) { return saveSeller(f, $('#sGo')); },
  async profForm(f) { return saveSeller(f, $('#pGo')); },
  async upForm(f) {
    const file = $('#upFile').files[0], btn = $('#upGo'); errBox('');
    if (!file) return errBox('Choose an image first.');
    busy(btn, true);
    try {
      const blob = await prepareImage(file);
      const r = await fetch('/api/art?title=' + encodeURIComponent(new FormData(f).get('title') || file.name.replace(/\.[^.]+$/, '')), { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob, credentials: 'same-origin' });
      const j = await r.json().catch(() => ({ error: 'The upload failed.' })); if (j.error) throw new Error(j.error);
      sellerWorks.delete(S.user.seller.handle); await Promise.all([loadSellers(), loadGallery(), refreshMe()]); rerender(); toast('Artwork added', S.user.artist === 'approved' ? 'It is on your page and in the gallery' : 'The admin can see it with your application'); openDash('work');
    } catch (e) { busy(btn, false, 'Upload'); errBox(e.message || 'The upload failed.'); }
  },
  async msgForm(f) {
    const btn = $('#mGo'); errBox(''); busy(btn, true);
    const j = await call('POST', '/api/messages', { handle: f.dataset.handle, text: new FormData(f).get('text') });
    if (j.error) { busy(btn, false, 'Send message'); return errBox(j.error); }
    closeDyn(); const t = toast('Message sent', 'Click to open the conversation'); t.style.cursor = 'pointer'; t.onclick = () => openMessages(j.peer.id);
  },
  async mgForm(f) {
    const box = $('textarea', f), text = box.value.trim(); if (!text) return;
    box.disabled = true; const j = await call('POST', '/api/messages', { to: f.dataset.peer, text }); box.disabled = false;
    if (j.error) return toast(j.error, '', 'err');
    box.value = ''; box.style.height = 'auto'; box.focus(); refreshThread();
  },
  async nameForm(f) {
    const j = await call('POST', '/api/account', { name: new FormData(f).get('name') }); if (j.error) return formErr(f, j.error);
    formErr(f, ''); S.user = { ...S.user, ...j.user }; renderUser(); toast('Name updated'); await Promise.all([loadGallery(), loadSellers()]);
  },
  async pwForm(f) {
    const fd = new FormData(f), j = await call('POST', '/api/account', { current: fd.get('current'), next: fd.get('next') }); if (j.error) return formErr(f, j.error);
    formErr(f, ''); f.reset(); $$('.meter i', f).forEach(i => i.className = ''); toast('Password updated', 'Your other devices were signed out'); loadDevices();
  },
  async delForm(f) {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return;
    const j = await call('DELETE', '/api/account', { password: new FormData(f).get('password') }); if (j.error) return formErr(f, j.error);
    S.user = null; S.unread = 0; S.alerts = 0; renderUser(); updateBadge(); closeDyn(); connectStream();
    await Promise.all([loadGallery(), loadSellers()]); if (!prof.hidden) go('/'); toast('Account deleted', 'Your data has been removed');
  },
  async mfaStartForm(f) {
    const j = await call('POST', '/api/2fa/setup', { password: new FormData(f).get('password') }); if (j.error) return formErr(f, j.error);
    MFA.setup = j; renderMfaBox('setup');
  },
  async mfaEnableForm(f) {
    const j = await call('POST', '/api/2fa/enable', { code: new FormData(f).get('code') }); if (j.error) return formErr(f, j.error);
    S.user = { ...S.user, ...j.user }; MFA.setup = null; MFA.codes = j.recovery; renderMfaBox('codes'); toast('Two-step verification is on');
  },
  async mfaOffForm(f) {
    const fd = new FormData(f), j = await call('POST', '/api/2fa/disable', { password: fd.get('password'), code: fd.get('code') }); if (j.error) return formErr(f, j.error);
    S.user = { ...S.user, ...j.user }; renderMfaBox('off'); toast('Two-step verification is off');
  },
  async mfaRegenForm(f) {
    const fd = new FormData(f), j = await call('POST', '/api/2fa/recovery', { password: fd.get('password'), code: fd.get('code') }); if (j.error) return formErr(f, j.error);
    MFA.codes = j.recovery; renderMfaBox('codes');
  }
};
async function saveSeller(f, btn) {
  const data = Object.fromEntries(new FormData(f)), isNew = f.id === 'sellForm', label = btn.textContent; errBox(''); busy(btn, true);
  if (isNew) { data.accent = Math.floor(Math.random() * 8); data.avatar = Math.floor(Math.random() * 12); }
  const j = await call('POST', '/api/seller', data); if (j.error) { busy(btn, false, label); return errBox(j.error); }
  S.user = { ...S.user, ...j.user }; renderUser(); await Promise.all([loadGallery(), loadSellers()]); rerender();
  if (isNew) { toast(j.user.artist === 'approved' ? 'Your artist page is live' : 'Application sent', j.user.artist === 'approved' ? location.host + '/@' + j.user.seller.handle : 'Add some work while an admin reviews it'); dashTab = 'work'; openDash('work'); return; }
  busy(btn, false, label); toast('Page updated', 'Your changes are live');
  if (!prof.hidden && location.pathname !== '/@' + j.user.seller.handle) go('/@' + j.user.seller.handle, true);
}
dyn.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  if (f.classList.contains('ord-form') || f.classList.contains('ord-review')) {
    const review = f.classList.contains('ord-review'), fd = new FormData(f);
    const j = review ? await call('POST', `/api/orders/${f.dataset.order}/review`, { rating: fd.get('rating'), text: fd.get('text') })
      : await call('POST', `/api/orders/${f.dataset.order}/action`, { action: f.dataset.action, note: fd.get('note'), price: fd.get('price'), days: fd.get('days') });
    if (j.error) return formErr(f, j.error);
    toast(review ? 'Review posted' : 'Order updated'); return loadOrders();
  }
  if (forms[f.id]) forms[f.id](f);
});
dyn.addEventListener('click', async e => {
  const da = e.target.closest('[data-delart]');
  if (da) { if (!confirm('Delete this artwork?')) return; const r = await call('DELETE', '/api/art/' + da.dataset.delart); if (r.error) return toast(r.error, '', 'err'); sellerWorks.delete(S.user.seller.handle); await Promise.all([loadGallery(), loadSellers(), refreshMe()]); rerender(); openDash('work'); return toast('Artwork deleted'); }
});
