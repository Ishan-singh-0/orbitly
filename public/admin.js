// Admin console at /admin. Only works for users with the admin flag (the server checks every request; this is just the UI).
// Uses the same /api/admin endpoints as tools/admin.js.

let ADM = { tab: 'artists', data: null, money: null };
const usd = cents => '$' + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };

async function showAdmin() {
  setView('page'); setMeta('Admin — Tweak’d', 'Management console.'); scrollTo(0, 0);
  await ready;
  if (!S.user?.admin) {
    pageV.innerHTML = S.user ? notFoundHTML('/admin') : `<div class="container nf"><div><p class="kicker">Admin</p><h1>Sign in to continue</h1><p class="lead">The management console is only for Tweak’d admins.</p><div class="btn-row"><button class="btn btn-ink btn-lg" id="admLogin">Log in</button></div></div></div>`;
    $('#admLogin')?.addEventListener('click', () => { pending = showAdmin; openAuth('login', 'Log in to open the admin console.'); });
    return;
  }
  pageV.innerHTML = '<div class="container adm"><div class="empty-s">Loading…</div></div>';
  await loadAdmin(); paintAdmin();
}
async function loadAdmin() {
  const [a, m] = await Promise.all([call('GET', '/api/admin/overview'), call('GET', '/api/admin/orders')]);
  if (a.error) { pageV.innerHTML = `<div class="container nf"><div><p class="kicker">Admin</p><h1>${esc(a.error)}</h1><p class="lead">In production, admin accounts must have two-step verification switched on.</p></div></div>`; return false; }
  ADM.data = a; ADM.money = m.error ? { orders: [], feePercent: 0 } : m; return true;
}
function paintAdmin() {
  const d = ADM.data; if (!d) return;
  const c = d.counts, waiting = (d.artists || []).filter(a => a.status === 'pending').length, tabs = [['artists', 'Artist approvals' + (waiting ? ` (${waiting})` : '')], ['overview', 'Overview'], ['people', 'People'], ['orders', 'Orders'], ['money', 'Payments'], ['reports', 'Reports' + (c.reports ? ` (${c.reports})` : '')]];
  const stat = (n, l) => `<div class="adm-stat"><b>${n}</b><span>${l}</span></div>`;
  let body = '';
  if (ADM.tab === 'overview') body = `<div class="adm-stats">${stat(c.users, 'Members')}${stat(c.sellers, 'Artists')}${stat(waiting, 'Waiting approval')}${stat(c.art, 'Artworks')}${stat(c.orders, 'Orders')}${stat(usd(c.paidCents), 'Paid volume')}${stat(c.online, 'Online now')}${stat(c.reports, 'Open reports')}</div>
    <div class="adm-two"><div><h3>Newest members</h3>${userTable(d.users.slice(0, 6), true)}</div><div><h3>Latest orders</h3>${orderTable(d.orders.slice(0, 6))}</div></div>`;
  if (ADM.tab === 'people') body = `<input class="adm-q" id="admQ" placeholder="Filter by name, email or handle" aria-label="Filter people">${userTable(d.users)}`;
  if (ADM.tab === 'artists') {
    const group = (title, st, empty) => { const list = d.artists.filter(x => x.status === st); return `<h3>${title} <small>${list.length}</small></h3>` + (list.length ? `<div class="adm-artists">${list.map(x => `<article class="adm-artist"><div class="adm-a-head"><div><b>${esc(x.name)}</b><small>${esc(x.email)}${x.place ? ' · ' + esc(x.place) : ''}</small></div><span class="adm-pill ${st === 'approved' ? 'ok' : st === 'rejected' ? 'bad' : 'due'}">${st}</span></div><p><b>${esc(x.headline)}</b><br>${esc(x.bio)}</p><div class="adm-works">${x.works.length ? x.works.map(w => `<img src="${esc(w)}" alt="Work by ${esc(x.name)}" loading="lazy">`).join('') : '<small>No artwork uploaded yet.</small>'}</div><div class="btn-row">${st !== 'approved' ? `<button class="btn btn-ink btn-sm" data-adm="approve" data-id="${x.id}">Approve as artist</button>` : ''}${st !== 'rejected' ? `<button class="btn btn-line btn-sm" data-adm="reject" data-id="${x.id}">${st === 'approved' ? 'Remove artist access' : 'Reject'}</button>` : ''}<a class="btn btn-line btn-sm" href="/@${esc(x.handle)}" data-nav>View page</a></div></article>`).join('')}</div>` : `<div class="empty-s">${empty}</div>`); };
    body = '<p class="sub">Only accounts you approve here are artists: their page becomes public and customers can order from them.</p>' + group('Waiting for approval', 'pending', '<b>No applications waiting</b>New ones appear here.') + group('Approved artists', 'approved', 'None yet.') + group('Not approved', 'rejected', 'None.');
  }
  if (ADM.tab === 'orders') body = orderTable(d.orders);
  if (ADM.tab === 'money') { const o = ADM.money.orders; body = `<p class="sub">Platform fee: <b>${ADM.money.feePercent}%</b>. Payouts to artists are recorded here after you have paid them yourself.</p>` + (o.length ? `<table class="adm-t"><thead><tr><th>Order</th><th>Paid</th><th>Fee</th><th>Owed to artist</th><th>Pay to</th><th>Status</th><th></th></tr></thead><tbody>${o.map(x => `<tr><td>#${x.id} ${esc(x.title)}<small>${esc(x.seller || '')}</small></td><td>${usd(x.totalCents)}</td><td>${usd(x.fee)}</td><td>${usd(x.payout)}</td><td>${esc(x.payoutTo || '(none given)')}</td><td><span class="adm-pill ${x.pay}">${x.pay}</span>${x.payoutDone ? '<span class="adm-pill ok">paid out</span>' : x.pay === 'paid' && x.status === 'completed' ? '<span class="adm-pill due">ready to pay out</span>' : ''}</td><td class="r">${x.pay === 'paid' && x.status === 'completed' && !x.payoutDone ? `<button class="btn btn-ink btn-sm" data-adm="payout" data-id="${x.id}">Mark paid out</button>` : ''}${x.pay === 'paid' && !x.payoutDone ? ` <button class="btn btn-line btn-sm" data-adm="refund" data-id="${x.id}">Refund</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-s"><b>No paid orders yet</b>' + (S.cfg?.payments ? 'Paid orders will appear here.' : 'Online payment is switched off. Add Stripe keys to turn it on.') + '</div>'); }
  if (ADM.tab === 'reports') body = d.contact.length ? d.contact.map(r => `<article class="adm-rep"><div><b>${esc(r.subject || '(no subject)')}</b><small>${esc(r.name)} · ${esc(r.email)} · ${ago(r.created)}</small></div><p>${esc(r.message)}</p><button class="btn btn-line btn-sm" data-adm="dismiss" data-id="${r.id}">Dismiss</button></article>`).join('') : '<div class="empty-s"><b>Nothing to review</b>Reports and contact messages show up here.</div>';
  pageV.innerHTML = `<div class="container adm"><header class="adm-head"><div><p class="kicker">Management</p><h1>Admin console</h1></div><button class="btn btn-line btn-sm" data-adm="reload">${ic('refresh')} Refresh</button></header>
    <nav class="adm-tabs">${tabs.map(([k, l]) => `<button class="${ADM.tab === k ? 'on' : ''}" data-adm="tab" data-id="${k}">${l}</button>`).join('')}</nav>${body}</div>`;
}
const userTable = (users, compact) => `<table class="adm-t" id="admUsers"><thead><tr><th>Member</th><th>Page</th><th>Status</th>${compact ? '' : '<th>Joined</th>'}<th></th></tr></thead><tbody>${users.map(u => `<tr data-q="${esc((u.name + ' ' + u.email + ' ' + (u.handle || '')).toLowerCase())}"><td>${esc(u.name)}<small>${esc(u.email)}</small></td><td>${u.handle ? `<a class="ulink" href="/@${esc(u.handle)}" data-nav>@${esc(u.handle)}</a>` : '—'}</td><td>${u.admin ? '<span class="adm-pill ok">admin</span>' : ''}${u.banned ? '<span class="adm-pill bad">banned</span>' : ''}${u.verified ? '' : '<span class="adm-pill">unverified</span>'}${u.twoFactor ? '<span class="adm-pill">2FA</span>' : ''}</td>${compact ? '' : `<td>${ago(u.created)}</td>`}<td class="r">${u.admin ? '' : `<button class="btn btn-line btn-sm" data-adm="${u.banned ? 'unban' : 'ban'}" data-id="${u.id}">${u.banned ? 'Unban' : 'Ban'}</button> <button class="btn btn-line btn-sm" data-adm="deluser" data-id="${u.id}">Delete</button>`}</td></tr>`).join('')}</tbody></table>`;
const orderTable = orders => orders.length ? `<table class="adm-t"><thead><tr><th>#</th><th>Order</th><th>Buyer → Artist</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders.map(o => `<tr><td>${o.id}</td><td>${esc(o.title)}</td><td>${esc(o.buyer)} → ${esc(o.seller)}</td><td>${o.total ? usd(o.total * 100) : '<small>Not quoted</small>'}</td><td><span class="adm-pill">${esc(o.status.replace(/_/g, ' '))}</span>${o.pay === 'paid' ? '<span class="adm-pill ok">paid</span>' : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-s"><b>No orders yet</b></div>';

pageV.addEventListener('click', async e => {
  const b = e.target.closest('[data-adm]'); if (!b) return; const { adm: act, id } = b.dataset;
  if (act === 'tab') { ADM.tab = id; return paintAdmin(); }
  if (act === 'reload') { await loadAdmin(); return paintAdmin(); }
  const ask = { reject: 'Reject or remove this artist? Their page will be hidden.', deluser: 'Delete this user and everything they own? This cannot be undone.', refund: 'Refund this order through Stripe?', payout: 'Mark this order as paid out to the artist?' }[act];
  if (ask && !confirm(ask)) return;
  const r = act === 'ban' || act === 'unban' ? await call('POST', `/api/admin/users/${id}/ban`, { banned: act === 'ban' })
    : act === 'deluser' ? await call('DELETE', `/api/admin/users/${id}`) : act === 'delgig' ? await call('DELETE', `/api/admin/gigs/${id}`)
    : act === 'approve' || act === 'reject' ? await call('POST', `/api/admin/artists/${id}`, { status: act === 'approve' ? 'approved' : 'rejected' })
    : act === 'dismiss' ? await call('DELETE', `/api/admin/contact/${id}`) : act === 'payout' ? await call('POST', `/api/admin/orders/${id}/payout`, {}) : act === 'refund' ? await call('POST', `/api/admin/orders/${id}/refund`, {}) : null;
  if (r?.error) return toast(r.error, '', 'err');
  toast('Done'); await loadAdmin(); paintAdmin();
});
pageV.addEventListener('input', e => {
  if (e.target.id !== 'admQ') return; const q = e.target.value.trim().toLowerCase();
  $$('#admUsers tbody tr').forEach(tr => { tr.hidden = !!q && !tr.dataset.q.includes(q); });
});
