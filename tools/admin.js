#!/usr/bin/env node
// Tweak’d admin CLI — talks to the protected admin API (enabled only when ADMIN_TOKEN is set on the server, 32+ chars).
//   ADMIN_TOKEN=... ADMIN_URL=https://your-domain.com node tools/admin.js <command>
// Commands:
//   overview                  counts + newest users, listings and contact/report messages
//   reports                   list contact-form and report messages
//   ban <userId>              suspend a user (signs them out, hides their page and listings)
//   unban <userId>
//   delete-user <userId>      permanently delete a user and all their data
//   delete-gig <listingId>
//   dismiss <reportId>        delete a contact/report message
//   payments                  paid orders: what each artist is owed, and whether it has been paid out
//   payout <orderId>          record that you paid the artist (only for paid + completed orders)
//   refund <orderId>          refund a paid order through Stripe (not after payout)
const BASE = (process.env.ADMIN_URL || 'http://localhost:5180').replace(/\/+$/, ''), TOKEN = process.env.ADMIN_TOKEN || '';
const [cmd, arg] = process.argv.slice(2);
if (!TOKEN) { console.error('Set ADMIN_TOKEN (the same value as on the server).'); process.exit(1); }
async function call(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) { console.error(`Error ${r.status}: ${j.error || 'request failed'}`); process.exit(1); } return j;
}
const when = t => new Date(t).toISOString().replace('T', ' ').slice(0, 16);
const inr = paise => '₹' + (paise / 100).toLocaleString('en-IN');
(async () => {
  if (cmd === 'overview') {
    const j = await call('GET', '/api/admin/overview'); console.log('COUNTS', j.counts);
    console.log('\nNEWEST USERS'); j.users.slice(0, 15).forEach(u => console.log(`  ${u.id}  ${u.name} <${u.email}> ${u.handle ? '@' + u.handle : ''}${u.banned ? '  [BANNED]' : ''}${u.verified ? '' : '  [unverified]'}`));
    console.log('\nNEWEST LISTINGS'); j.services.slice(0, 15).forEach(g => console.log(`  #${g.id}  ₹${g.price}  ${g.title}  (owner ${g.owner})`));
  } else if (cmd === 'reports') {
    const j = await call('GET', '/api/admin/overview'); if (!j.contact.length) return console.log('No messages.');
    j.contact.forEach(c => console.log(`#${c.id}  ${when(c.created)}  ${c.name} <${c.email}>\n   Subject: ${c.subject || '(none)'}\n   ${c.message.replace(/\n/g, '\n   ')}\n`));
  } else if (cmd === 'ban' || cmd === 'unban') { if (!arg) return console.error('Need a user id.'); console.log(await call('POST', `/api/admin/users/${arg}/ban`, { banned: cmd === 'ban' })); }
  else if (cmd === 'delete-user') { if (!arg) return console.error('Need a user id.'); console.log(await call('DELETE', `/api/admin/users/${arg}`)); }
  else if (cmd === 'delete-gig') { if (!arg) return console.error('Need a listing id.'); console.log(await call('DELETE', `/api/admin/gigs/${arg}`)); }
  else if (cmd === 'dismiss') { if (!arg) return console.error('Need a report id.'); console.log(await call('DELETE', `/api/admin/contact/${arg}`)); }
  else if (cmd === 'payments') {
    const j = await call('GET', '/api/admin/orders'); if (!j.orders.length) return console.log('No paid orders yet.');
    console.log(`Platform fee: ${j.feePercent}%\n`);
    j.orders.forEach(o => console.log(`#${o.id}  ${o.pay.toUpperCase().padEnd(8)} ${o.status.padEnd(11)} paid ${inr(o.totalCents)}  fee ${inr(o.fee)}  owed ${inr(o.payout)}  ${o.seller}  pay to: ${o.payoutTo || '(none given)'}  ${o.payoutDone ? 'PAID OUT ' + when(o.payoutDone) : o.pay === 'paid' && o.status === 'completed' ? '<-- ready to pay out' : ''}`));
  }
  else if (cmd === 'payout') { if (!arg) return console.error('Need an order id.'); console.log(await call('POST', `/api/admin/orders/${arg}/payout`, {})); }
  else if (cmd === 'refund') { if (!arg) return console.error('Need an order id.'); console.log(await call('POST', `/api/admin/orders/${arg}/refund`, {})); }
  else console.log('Usage: node tools/admin.js overview | reports | ban <id> | unban <id> | delete-user <id> | delete-gig <id> | dismiss <id> | payments | payout <orderId> | refund <orderId>');
})();
