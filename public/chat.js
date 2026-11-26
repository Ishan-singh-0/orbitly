// The help assistant. It runs entirely in the browser: it matches your question against what it knows about the site
// and looks up live data (artists, products, your own orders). Nothing you type is sent to an outside service.

const BOT = { open: false, log: [] };
const chatBtn = (label, run) => ({ label, run });
const say = (html, actions = []) => ({ html, actions });

const ORDER_NOW = () => chatBtn('Start an order', () => openRequest());
const KNOWLEDGE = [
  { q: 'Hi hello hey help what can you do', a: () => say('Hi! I can help with ordering, quotes, artists, payments, your account and anything else on Tweak’d. Ask in your own words, or tap one below.') },
  { q: 'how do i order place request customise customize my item thing product start buy', a: () => say('Press <b>Customise my item</b>. Three short tabs: <b>Your item</b> (what you own, colour, artist), <b>Inspiration</b> (pictures, links, a style from their showcase) and <b>Details</b> (what you want, budget, date). The artist then sends you a quote.', [ORDER_NOW()]) },
  { q: 'what is tweakd about this site website platform', a: () => say('Tweak’d lets you get your own things customised by artists, near you or anywhere in the world. Artists show their creations as a showcase; you order something made for you.', [ORDER_NOW()]) },
  { q: 'what products items can be customised bag mouse hoodie shoe sneaker skateboard laptop phone case mug bottle notebook tshirt poster something else', a: () => say(`Anything you own can be requested. Common ones: ${PRODUCTS.map(p => p.name.toLowerCase()).join(', ')}. For sneakers, skateboards or anything not listed, choose <b>Something else</b>.`, [ORDER_NOW(), chatBtn('See the products', () => goHash('cats'))]) },
  { q: 'inspiration pictures images upload photo reference idea sketch tab attach', a: () => say('In the order form, open the <b>Inspiration</b> tab. Add up to 6 images (JPG, PNG or WebP) and some links, and optionally choose a piece from the artist’s showcase. Only you, that artist and admins can see your pictures.', [ORDER_NOW()]) },
  { q: 'price cost how much quote quotation budget charge expensive cheap', a: () => say('Each order is quoted by the artist, so there are no fixed prices. Add your budget in the Details tab. The artist replies with a price and delivery time, and nothing starts until you accept.') },
  { q: 'how long delivery time take shipping deadline days when ready pickup', a: () => say('The artist gives the delivery time with their quote. Add the date you need it in the Details tab. How you hand over your item or receive it (meeting up or by post) is agreed in Messages.') },
  { q: 'payment pay money card stripe upi cash refund secure', a: () => say(S.cfg?.payments ? 'After you accept a quote, a <b>Pay</b> button appears on your order and opens Stripe’s secure checkout. Tweak’d holds the money until you approve the work. For a refund, use the contact form.' : 'Online payment isn’t switched on yet, so you and the artist arrange payment directly. Don’t pay everything upfront to someone you don’t know, and never send card or bank details in messages.') },
  { q: 'my order status track where is progress check orders', a: myOrders },
  { q: 'cancel decline stop change revise revision not happy problem complaint', a: () => say('Before work starts you can cancel a request or say no to a quote from <b>Orders</b>. After delivery you can <b>Ask for changes</b> instead of approving. For anything serious, contact us.', [chatBtn('Open my orders', () => openOrders()), chatBtn('Contact us', () => go('/contact'))]) },
  { q: 'review rating stars feedback', a: () => say('After you approve a finished order, a <b>Leave a review</b> button appears on it. Only customers with completed orders can review, so ratings are real.') },
  { q: 'become artist apply join sell my art portfolio showcase upload approval approved pending creator designer', a: () => say(S.user?.artist === 'approved' ? 'You’re already an approved artist. Manage your showcase from the dashboard.' : S.user?.artist === 'pending' ? 'Your application is waiting for an admin. Add a few pieces to your showcase meanwhile; the admin looks at them.' : 'Create an account and choose <b>Apply to be an artist</b>. Fill in your page and upload some work. An admin approves artist accounts, then your page goes public.', [chatBtn(S.user?.seller ? 'Open my dashboard' : 'Apply now', () => openSeller())]) },
  { q: 'artist artists who list find location city country near me designer available', a: artists },
  { q: 'message chat contact artist talk seller', a: () => say('Open an artist’s page and press <b>Message</b>. Every order also has its own conversation under Messages.', [chatBtn('Open messages', () => (S.user ? openMessages() : openAuth('login', 'Log in to see your messages.')))]) },
  { q: 'account sign up register login log in create', a: () => say('Use <b>Sign up</b> at the top. You need a name, email and password. If email is switched on, confirm your address before ordering.', [chatBtn('Log in', () => openAuth('login')), chatBtn('Create account', () => openAuth('signup'))]) },
  { q: 'forgot password reset cannot log in locked', a: () => say('Use <b>Forgot your password</b> to get a reset link by email. After several wrong attempts an account locks for 15 minutes.', [chatBtn('Reset password', () => go('/forgot'))]) },
  { q: 'two factor 2fa authenticator security safe protect devices recovery codes', a: () => say('In <b>Account settings</b> you can turn on two-step verification with an authenticator app, save recovery codes, and sign out other devices.', [chatBtn('Open settings', () => (S.user ? openSettings() : openAuth('login')))]) },
  { q: 'delete my account data export download privacy information', a: () => say('Account settings lets you download your data or delete your account. The privacy policy explains what is stored.', [chatBtn('Privacy policy', () => go('/privacy'))]) },
  { q: 'demo test try account example', a: () => say(S.cfg?.demo ? `Demo logins: ${S.cfg.demo.map(d => `<br><b>${d.role}</b> ${d.email} / ${d.password}`).join('')}` : 'Demo accounts are not switched on here.') },
  { q: 'admin approve manage console moderation', a: () => say('Admins use the console to approve artists, manage members, orders, payments and reports.', S.user?.admin ? [chatBtn('Open admin console', () => go('/admin'))] : []) },
  { q: 'copyright my design rights own logo character brand allowed rules terms', a: () => say('Artists keep the copyright in their art. Don’t ask for logos, characters or artwork you don’t have the right to use.', [chatBtn('Terms', () => go('/terms'))]) },
  { q: 'currency rupees dollars euro pounds inr usd', a: () => say('Use the currency menu at the top to see prices in USD, INR, EUR or GBP. Quotes are made in USD.') },
  { q: 'dark light theme mode colour of site', a: () => say('The sun and moon button at the top switches themes.', [chatBtn('Switch theme', () => $('#themeBtn').click())]) },
  { q: 'human support person email report abuse scam help me contact team', a: () => say('Email <a class="ulink" href="mailto:tweakd.co@gmail.com">tweakd.co@gmail.com</a> or use the contact form. To report an artist, use “Report this page” on their page.', [chatBtn('Contact form', () => go('/contact'))]) },
  { q: 'thanks thank you bye great awesome cool ok', a: () => say('You’re welcome! Happy tweaking.') }
];

async function myOrders() {
  if (!S.user) return say('Log in and I can tell you where your orders are.', [chatBtn('Log in', () => openAuth('login'))]);
  const j = await call('GET', '/api/orders'); if (j.error) return say('I couldn’t load your orders just now.');
  const all = [...j.buying, ...j.selling].slice(0, 4);
  if (!all.length) return say('You have no orders yet.', [ORDER_NOW()]);
  return say('Your latest orders:' + all.map(o => `<br>• ${esc(o.gigTitle)} — <b>${ORD_STATUS[o.status]}</b>${o.total ? ' (' + money(o.total) + ')' : ''}`).join(''), [chatBtn('Open orders', () => openOrders(j.buying.length ? 'buying' : 'selling'))]);
}
function artists(text) {
  const t = text.toLowerCase(), place = S.places.find(c => c.name.toLowerCase().split(', ').some(part => t.includes(part)));
  const list = S.sellers.filter(s => !place || s.place === place.name).slice(0, 4);
  if (!list.length) return say('No approved artists yet. Check back soon.');
  return say(`${place ? 'Artists in ' + esc(place.name) : 'Some of our artists'}:` + list.map(s => `<br>• <b>${esc(s.name)}</b> — ${esc(s.headline)}`).join(''), list.slice(0, 3).map(s => chatBtn(s.name.split(' ')[0] + '’s page', () => go('/@' + s.handle))));
}

const STOP = new Set('a an the is are am i my me do does can could will to of in on for and or it this that with how what where when you your we be have has get please there'.split(' '));
const words = t => t.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || [];
const stem = w => w.replace(/(ing|ed|es|s)$/, '');
function bestAnswer(text) {
  const asked = words(text).filter(w => !STOP.has(w)).map(stem);
  if (!asked.length) return KNOWLEDGE[0];
  let best = null, top = 0;
  for (const k of KNOWLEDGE) {
    const bag = k.bag || (k.bag = new Set(words(k.q).map(stem)));
    const score = asked.reduce((n, w) => n + (bag.has(w) ? 1 + w.length / 20 : w.length > 4 && [...bag].some(b => b.startsWith(w.slice(0, 5))) ? .6 : 0), 0);
    if (score > top) { top = score; best = k; }
  }
  return top >= .6 ? best : null;
}

const chatBox = document.createElement('div'); chatBox.className = 'bot';
chatBox.innerHTML = `<div class="bot-panel" id="botPanel" role="dialog" aria-label="Help assistant" aria-hidden="true">
    <header><span class="bot-face"><i></i><i></i></span><div><b>Tweak’d helper</b><small>Automated assistant · instant answers</small></div><button type="button" id="botClose" aria-label="Close help">${ic('x')}</button></header>
    <div class="bot-log" id="botLog" aria-live="polite"></div>
    <div class="bot-chips" id="botChips">${['How do I order?', 'Where is my order?', 'What can be customised?', 'Become an artist', 'Payments'].map(c => `<button type="button">${c}</button>`).join('')}</div>
    <form id="botForm"><input id="botIn" maxlength="300" placeholder="Ask anything about Tweak’d…" aria-label="Your question" autocomplete="off"><button aria-label="Send">${ic('send')}</button></form>
  </div>
  <button type="button" class="bot-fab" id="botFab" aria-label="Open help" aria-expanded="false"><span class="bot-face"><i></i><i></i></span><em>Need help?</em></button>`;
document.body.appendChild(chatBox);

function addMessage(who, html, actions = []) {
  const log = $('#botLog'), m = document.createElement('div'); m.className = 'bot-msg ' + who; m.innerHTML = `<div>${html}</div>`;
  if (actions.length) { const row = document.createElement('p'); for (const a of actions) { const b = document.createElement('button'); b.type = 'button'; b.textContent = a.label; b.onclick = () => { if (innerWidth < 640) toggleChat(false); a.run(); }; row.appendChild(b); } m.appendChild(row); }
  log.appendChild(m); log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
}
async function ask(text) {
  addMessage('me', esc(text));
  const typing = document.createElement('div'); typing.className = 'bot-msg it typing'; typing.innerHTML = '<div><i></i><i></i><i></i></div>'; $('#botLog').appendChild(typing); typing.scrollIntoView({ block: 'nearest' });
  const k = bestAnswer(text);
  const [answer] = await Promise.all([k ? k.a(text) : say('I’m not sure about that one. Try rephrasing, or send it to the team.', [chatBtn('Contact form', () => go('/contact'))]), new Promise(r => setTimeout(r, 450))]);
  typing.remove(); addMessage('it', answer.html, answer.actions);
}
function toggleChat(open = !BOT.open) {
  BOT.open = open; chatBox.classList.toggle('open', open);
  $('#botPanel').setAttribute('aria-hidden', String(!open)); $('#botFab').setAttribute('aria-expanded', String(open));
  if (open) { if (!$('#botLog').childElementCount) { const hello = KNOWLEDGE[0].a(); addMessage('it', hello.html); } setTimeout(() => $('#botIn').focus(), 250); }
}
const openChat = () => toggleChat(true);
$('#botFab').onclick = () => toggleChat(); $('#botClose').onclick = () => toggleChat(false);
$('#botForm').onsubmit = e => { e.preventDefault(); const v = $('#botIn').value.trim(); if (!v) return; $('#botIn').value = ''; ask(v); };
$('#botChips').onclick = e => { const b = e.target.closest('button'); if (b) ask(b.textContent); };
chatBox.addEventListener('click', e => e.stopPropagation());
addEventListener('keydown', e => { if (e.key === 'Escape' && BOT.open) toggleChat(false); });
