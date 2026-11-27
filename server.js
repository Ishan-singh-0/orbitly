'use strict';
/* Tweak’d server — zero runtime dependencies (Node 18+).
   Static files, JSON API, real-time stream (SSE), email, admin API, SEO, security hardening.
   Configuration is via environment variables — see .env.example and SECURITY.md */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const { promisify } = require('util'); const scrypt = promisify(crypto.scrypt);

/* ---------------------------------------------------------------- config */
const PROD = process.env.NODE_ENV === 'production';
const PORT = +process.env.PORT || 5180;
const HOST = process.env.HOST || (PROD ? '0.0.0.0' : '127.0.0.1');
const SITE_URL = (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PROXY_HOPS = Math.max(1, +process.env.TRUST_PROXY_HOPS || 1);
const FORCE_HTTPS = process.env.FORCE_HTTPS === '1';
const COMPANY = process.env.COMPANY_NAME || 'Tweak’d';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'tweakd.co@gmail.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Tweak’d <noreply@localhost>';
const MAIL_ON = !!RESEND_API_KEY || !PROD; // outside production, emails go to a local outbox so flows can be tested
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PUB = path.join(__dirname, 'public');
const DB_FILE = path.join(DATA_DIR, 'db.json'), SES_FILE = path.join(DATA_DIR, 'sessions.json'), BAK_DIR = path.join(DATA_DIR, 'backups'), OUT_DIR = path.join(DATA_DIR, 'outbox');
fs.mkdirSync(BAK_DIR, { recursive: true, mode: 0o700 }); try { fs.chmodSync(DATA_DIR, 0o700); } catch {}
const ALLOWED_HOSTS = new Set([...(SITE_URL ? [new URL(SITE_URL).host.toLowerCase()] : []), ...String(process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)]);
if (PROD && !ALLOWED_HOSTS.size) console.warn('[security] SITE_URL / ALLOWED_HOSTS not set — Host header is not being validated. Set SITE_URL in production.');
if (ADMIN_TOKEN && ADMIN_TOKEN.length < 32) { console.error('[security] ADMIN_TOKEN must be at least 32 characters. Admin API disabled.'); }
const ADMIN_ON = ADMIN_TOKEN.length >= 32;

const { PRODUCTS, PRODUCT_GROUPS } = require('./public/products.js');
const CATS = PRODUCT_GROUPS.map(g => g.id);
const productOf = id => PRODUCTS.find(p => p.id === id);
// Online payments are only switched on when both Stripe values are set. Otherwise the site says plainly that it can't take payment.
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '', STRIPE_HOOK = process.env.STRIPE_WEBHOOK_SECRET || '', STRIPE_API = (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/$/, '');
const PAY_ON = !!STRIPE_KEY && !!STRIPE_HOOK;
const FEE_PCT = Math.max(0, Math.min(40, +(process.env.PLATFORM_FEE_PERCENT || 10)));
const UP_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UP_DIR, { recursive: true, mode: 0o700 });
const RESERVED = new Set(['admin', 'api', 'www', 'support', 'tweakd', 'help', 'about', 'login', 'signup', 'settings', 'static', 'root', 'team', 'contact', 'privacy', 'terms', 'security', 'staff', 'moderator', 'official', 'forgot', 'reset', 'verify', 'fonts', 'billing', 'payments', 'press', 'jobs', 'careers']);
const SESSION_MS = 14 * 24 * 3600e3, MAX_SESSIONS = 10;
const KDF = { N: 32768, r: 8, p: 1 }, LEGACY_KDF = { N: 16384, r: 8, p: 1 };
const COMMON_PW = new Set(['password', 'password1', 'password12', 'password123', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'qwertyuiop', '11111111', '00000000', 'iloveyou', 'iloveyou1', 'admin123', 'administrator', 'welcome1', 'welcome123', 'letmein1', 'letmein123', 'abc12345', 'abcd1234', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'monkey123', 'dragon123', 'football1', 'baseball1', 'sunshine1', 'princess1', 'superman1', 'trustno1', 'changeme', 'changeme1', 'tweakd123', 'tweakd1', 'test1234', 'test12345', 'asdfghjk', 'zxcvbnm1', '1q2w3e4r', '1qaz2wsx', 'qazwsxedc', '987654321', '123123123', 'a1b2c3d4']);

/* ------------------------------------------------------- demo accounts
   On in local development (set DEMO_SEED=0 to turn off) and in production only with DEMO_SEED=1. Creates a buyer, an artist (with a portfolio and four listings) and an admin so the whole site
   can be tried without signing up. They are labelled as demo accounts everywhere and are never created automatically. */
const DEMO_ON = process.env.DEMO_SEED === '1' || (!PROD && process.env.DEMO_SEED !== '0'); // on by default in local development, never in production unless asked
const DEMO_LIST = [
  { role: 'Buyer', name: 'Demo Buyer', email: 'buyer@tweakd.demo', password: 'Buyer-Demo-2026', about: 'Browse, customise and order' },
  { role: 'Artist', name: 'Demo Artist', email: 'artist@tweakd.demo', password: 'Artist-Demo-2026', about: 'Portfolio, listings and incoming orders' },
  { role: 'Pending artist', name: 'Demo Applicant', email: 'applicant@tweakd.demo', password: 'Applicant-Demo-2026', about: 'Application waiting for approval' },
  { role: 'Admin', name: 'Demo Admin', email: 'admin@tweakd.demo', password: 'Admin-Demo-2026', about: 'Management console at /admin' }
];

/* ------------------------------------------------------------- database */
let db = { users: [], gigs: [], messages: [], contact: [], orders: [], reviews: [], art: [], inspo: [], hooks: [], nextGig: 1, nextMsg: 1, nextContact: 1, nextOrder: 1, nextReview: 1 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
catch (e) { if (e.code !== 'ENOENT') { console.error('FATAL: cannot read database (refusing to overwrite):', e.message); process.exit(1); } }
// artists must be approved by an admin before their page is public
db.users.forEach(u => { if (u.seller && !u.artist) u.artist = 'pending'; });
const isArtist = u => !!(u && u.seller && u.artist === 'approved' && !u.banned);
// older records had a separate campus field; it is folded into location
db.users.forEach(u => { const x = u.seller; if (x && 'campus' in x) { if (!x.location && x.campus) x.location = x.campus; delete x.campus; } });
const placeOf = x => [x?.location, x?.country].filter(Boolean).join(', ');
const sessions = new Map(); // sha256(token) -> {uid, exp}
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(SES_FILE, 'utf8')))) if (v.exp > Date.now()) sessions.set(k, v); } catch {}
let saveTimer = null, sesDirty = false, dataVersion = 1;
const writeAtomic = (f, obj) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(obj), { mode: 0o600 }); fs.renameSync(t, f); };
function flush() { clearTimeout(saveTimer); saveTimer = null; writeAtomic(DB_FILE, db); if (sesDirty) { writeAtomic(SES_FILE, Object.fromEntries(sessions)); sesDirty = false; } }
const save = () => { if (!saveTimer) saveTimer = setTimeout(flush, 250); };
function backup() {
  try {
    if (!fs.existsSync(DB_FILE)) return;
    fs.copyFileSync(DB_FILE, path.join(BAK_DIR, `db-${new Date().toISOString().slice(0, 10)}.json`)); try { fs.chmodSync(path.join(BAK_DIR, `db-${new Date().toISOString().slice(0, 10)}.json`), 0o600); } catch {}
    fs.readdirSync(BAK_DIR).filter(f => f.startsWith('db-')).sort().slice(0, -14).forEach(f => fs.unlinkSync(path.join(BAK_DIR, f)));
  } catch (e) { console.error('backup failed:', e.message); }
}
backup(); setInterval(backup, 24 * 3600e3).unref();
setInterval(() => { const old = db.inspo.filter(a => !a.order && a.created < Date.now() - 864e5); if (!old.length) return; old.forEach(a => { try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} }); db.inspo = db.inspo.filter(a => !old.includes(a)); save(); }, 3600e3).unref();

/* --------------------------------------------------------------- helpers */
const cleanText = (s, max) => String(s ?? '').replace(/[<>]/g, '').replace(/[^\S\n]+/g, ' ').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const clean = (s, max) => cleanText(s, max).replace(/\n+/g, ' ');
const list = (v, n, len) => (Array.isArray(v) ? v : String(v || '').split(',')).map(t => clean(t, len)).filter(Boolean).slice(0, n);
const lines = (v, n, len) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(t => clean(t, len)).filter(Boolean).slice(0, n);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const tEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const describeUA = ua => { ua = String(ua || ''); const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'; const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown device'; return `${b} on ${o}`; };

/* app secret: signs short-lived tokens and encrypts 2FA secrets. Persisted so restarts don't invalidate anything. */
let APP_SECRET = process.env.APP_SECRET || '';
if (!APP_SECRET) {
  const kf = path.join(DATA_DIR, 'secret.key');
  try { APP_SECRET = fs.readFileSync(kf, 'utf8').trim(); } catch { APP_SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(kf, APP_SECRET, { mode: 0o600 }); }
}
const hmac = s => crypto.createHmac('sha256', APP_SECRET).update(s).digest('base64url');
const signTok = o => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + hmac('t.' + b); };
const readTok = t => { const [b, s] = String(t || '').split('.'); if (!b || !s || !tEq(hmac('t.' + b), s)) return null; try { const o = JSON.parse(Buffer.from(b, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; } };
const ENC_KEY = crypto.createHash('sha256').update('totp-key:' + APP_SECRET).digest();
function encrypt(buf) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv), ct = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64'); }
function decrypt(s) { const b = Buffer.from(s, 'base64'), d = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]); }
const isHttps = req => !!req.socket.encrypted || (TRUST_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',').pop().trim() === 'https');
function clientIp(req) {
  if (TRUST_PROXY) { const parts = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean); if (parts.length) return parts[Math.max(0, parts.length - PROXY_HOPS)]; }
  return req.socket.remoteAddress || 'unknown';
}
const hostOf = req => String(req.headers.host || '').toLowerCase();
const baseUrl = req => SITE_URL || `${isHttps(req) ? 'https' : 'http'}://${hostOf(req) || 'localhost'}`;
const linkBase = req => SITE_URL || (PROD ? '' : baseUrl(req)); // never build email links from an untrusted Host header in production
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
function audit(ev, o = {}) { console.log(JSON.stringify({ t: new Date().toISOString(), ev, ...o })); }
function send(res, code, obj, headers = {}) {
  const body = Buffer.from(JSON.stringify(obj)); const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers };
  if (res.acceptsGzip && body.length > 1024) { res.writeHead(code, { ...h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }); return res.end(zlib.gzipSync(body)); }
  res.writeHead(code, h); res.end(body);
}
const fail = (res, code, error, extra = {}) => send(res, code, { error, ...extra });
function readBody(req) {
  return new Promise((ok, no) => {
    if (+req.headers['content-length'] > 30000) return no(new Error('too big'));
    let n = 0, dead = false; const chunks = [];
    req.on('data', c => { if (dead) return; n += c.length; if (n > 30000) { dead = true; chunks.length = 0; no(new Error('too big')); } else chunks.push(c); });
    req.on('end', () => { try { const v = JSON.parse(Buffer.concat(chunks).toString() || '{}'); ok(v && typeof v === 'object' && !Array.isArray(v) ? v : {}); } catch { no(new Error('bad json')); } });
    req.on('error', no);
  });
}
function readRaw(req, max) {
  return new Promise((ok, no) => {
    if (+req.headers['content-length'] > max) return no(new Error('too big'));
    let n = 0, dead = false; const chunks = [];
    req.on('data', c => { if (dead) return; n += c.length; if (n > max) { dead = true; chunks.length = 0; no(new Error('too big')); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', no);
  });
}
// Stripe's API wants form encoding with bracketed keys: {a:{b:1}} -> a[b]=1
function formEncode(o, prefix = '', out = []) {
  for (const [k, v] of Object.entries(o)) { const key = prefix ? `${prefix}[${k}]` : k; if (v && typeof v === 'object') formEncode(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(v)); }
  return out;
}
async function stripe(pathName, body) {
  const r = await fetch(STRIPE_API + pathName, { method: 'POST', headers: { Authorization: 'Bearer ' + STRIPE_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: formEncode(body).join('&'), signal: AbortSignal.timeout(15e3) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || 'Stripe error ' + r.status); return j;
}
function verifyStripeSig(raw, header) {
  const parts = String(header || '').split(',').map(x => x.trim().split('=')), t = (parts.find(x => x[0] === 't') || [])[1];
  if (!t || Math.abs(Date.now() - +t * 1000) > 5 * 60e3) return false;
  const want = crypto.createHmac('sha256', STRIPE_HOOK).update(t + '.').update(raw).digest('hex');
  return parts.some(x => x[0] === 'v1' && x[1] && tEq(x[1], want));
}
const imageKind = b => b.length > 12 && (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpg' : b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? 'png' : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null);
const cookie = (req, name) => { const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '=')); return m ? m.slice(name.length + 1) : null; };

/* a tiny PNG writer, used only to make the demo artist's portfolio images */
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngChunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function makePng(w, h, pixel) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = pixel(x, y), o = y * (w * 4 + 1) + 1 + x * 4; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
function demoArt(seed) {
  const pals = [['#F6D55C', '#3CAEA3', '#ED553B', '#20639B', '#173F5F'], ['#FFD6A5', '#FF7B54', '#939B62', '#FFB26B', '#2B2D42'], ['#CDE7B0', '#7FB685', '#426A5A', '#EF6F6C', '#F4E9CD'], ['#BDB2FF', '#FFC6FF', '#9BF6FF', '#FDFFB6', '#3A2E6B']][seed % 4];
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); let a = (seed + 7) * 2654435761 >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const shapes = Array.from({ length: 11 }, () => ({ k: Math.floor(r() * 3), x: r() * 360, y: r() * 360, s: 40 + r() * 90, c: rgb(pals[1 + Math.floor(r() * 4)]) })), bg = rgb(pals[0]);
  return makePng(360, 360, (x, y) => { let c = bg; for (const q of shapes) { const dx = x - q.x, dy = y - q.y; if (q.k === 0 ? dx * dx + dy * dy < q.s * q.s / 4 : q.k === 1 ? Math.abs(dx) < q.s / 2 && Math.abs(dy) < q.s / 2 : dy > -q.s / 2 && dy < q.s / 2 && Math.abs(dx) < (dy + q.s / 2) / 2) c = q.c; } return c; });
}
async function seedDemo() {
  const made = {};
  for (const d of DEMO_LIST) {
    let u = db.users.find(x => x.email === d.email);
    if (!u) { u = { id: crypto.randomUUID(), name: d.name, email: d.email, seller: null, created: Date.now(), verified: true, notify: false, demo: true }; await setPw(u, d.password); db.users.push(u); made[d.role] = u; }
    if (d.role === 'Admin') u.admin = true;
  }
  const applications = [['applicant@tweakd.demo', 'demo-applicant', 'pending', 'Demo application waiting for the admin', 4, 7]];
  for (const [email, handle, status, headline, accent, avatar] of applications) {
    const x = db.users.find(y => y.email === email); if (!x || x.seller) continue;
    x.seller = { handle, headline, category: 'paper', bio: 'This is a demo artist account, here so you can see how an application looks from this side and in the admin console.', location: 'Delhi', website: '', country: 'India', payout: '', accent, avatar, languages: [], skills: ['Sketching'], since: Date.now() };
    x.artist = status;
    for (let i = 4; i < 6; i++) { const id = crypto.randomBytes(8).toString('hex'), file = id + '.png'; fs.writeFileSync(path.join(UP_DIR, file), demoArt(i + accent), { mode: 0o600 }); db.art.push({ id, owner: x.id, title: 'Sketch ' + (i - 3), file, created: Date.now() }); }
  }
  const artist = made.Artist; if (!artist) { save(); return; }
  artist.artist = 'approved';
  artist.seller = { handle: 'demo-artist', headline: 'Demo artist account, to try the artist tools', category: 'tech', bio: 'This is a demo account created so you can try the artist side of Tweak’d: the dashboard and showcase. Its artwork is generated by the site, not by a real person.', location: 'Delhi', website: '', country: 'India', payout: '', accent: 2, avatar: 3, languages: ['English'], skills: ['Pattern', 'Illustration'], since: Date.now() };
  const arts = [];
  for (let i = 0; i < 4; i++) { const id = crypto.randomBytes(8).toString('hex'), file = id + '.png'; fs.writeFileSync(path.join(UP_DIR, file), demoArt(i), { mode: 0o600 }); const rec = { id, owner: artist.id, title: ['Bloom pattern', 'Tile study', 'Peaks', 'Garden shapes'][i], file, created: Date.now() }; db.art.push(rec); arts.push(rec); }
  const buyer = made.Buyer;
  if (buyer) { // one request waiting for a quote, so both sides have something to try
    const now = Date.now(), order = { id: db.nextOrder++, kind: 'custom', gigId: 0, gigTitle: 'Custom tote bag: my plain canvas bag', product: 'tote', item: 'my plain canvas bag', options: { color: 'Sand' }, qty: 1, price: 0, total: 0, days: 0, budget: 25, deadline: '', links: [], inspiration: [], buyer: buyer.id, seller: artist.id, status: 'requested', pay: 'unpaid', created: now, updated: now, brief: 'Could you paint a small garden on the front, with "Tuesday" written underneath? I will drop the bag off this week.' };
    db.orders.push(order);
    db.messages.push({ id: db.nextMsg++, from: buyer.id, to: artist.id, text: order.brief, kind: 'order', gigId: 0, gigTitle: order.gigTitle, gigPrice: 0, gigDays: 0, orderId: order.id, created: now, read: false });
    for (const [product, item, status, price, days, brief, extra] of [
      ['mouse', 'my old grey mouse', 'quoted', 24, 5, 'Paint small planets on the buttons, please.', { quoteNote: 'I can do this with sealed acrylics.' }],
      ['hoodie', 'my black hoodie', 'delivered', 40, 8, 'A mountain line drawing across the back.', { delivery: 'Finished. Pick it up at the library desk.' }],
      ['bottle', 'my steel water bottle', 'completed', 18, 4, 'A wave pattern all the way round.', { delivery: 'Done and handed over.' }]
    ]) {
      const t = Date.now() - 864e5, o = { ...order, id: db.nextOrder++, gigTitle: `Custom ${productOf(product).name.toLowerCase()}: ${item}`, product, item, options: {}, price, total: price, days, brief, budget: 0, status, created: t, updated: t, ...extra };
      db.orders.push(o);
      db.messages.push({ id: db.nextMsg++, from: buyer.id, to: artist.id, text: brief, kind: 'order', gigId: 0, gigTitle: o.gigTitle, gigPrice: price, gigDays: days, orderId: o.id, created: t, read: true });
    }
  }
  save(); bump(); console.log('[demo] demo accounts created: buyer, artist, pending artist, admin');
}

/* ------------------------------------------------------- founding artists
   Real artists who are part of the project. Their photos live in showcase/<handle>/ in the repository; each start
   copies new ones into their portfolio and removes ones that were deleted. Without a login configured
   (ANIRUDH_EMAIL + ANIRUDH_PASSWORD) the page is a showcase that points to Instagram. FEATURED_ARTISTS=0 turns this off. */
const FEATURED = [{ env: 'ANIRUDH', name: 'Anirudh Sondhi', handle: 'anirudh-sondhi', instagram: 'courtesy_of_cube',
  headline: '“I art :)” · Ani', category: 'apparel', skills: ['Ink doodle art', 'Hand-painted clothing', 'Custom footwear', 'Illustration'],
  bio: 'Anirudh Sondhi, known as Ani, posts as @courtesy_of_cube. His work runs from dense hand-drawn ink doodles to painted pieces, and the sample projects here take that onto things you can wear: painted denim, lettered boots and jersey designs.' }];
async function seedFeatured() {
  for (const f of FEATURED) {
    const email = String(process.env[f.env + '_EMAIL'] || '').toLowerCase(), pw = String(process.env[f.env + '_PASSWORD'] || '');
    let u = db.users.find(x => x.featured === f.handle);
    if (!u) {
      if (db.users.some(x => x.seller?.handle === f.handle || (email && x.email === email))) continue;
      u = { id: crypto.randomUUID(), name: f.name, email: email || f.handle + '@artists.invalid', seller: { handle: f.handle, location: '', country: '', website: '', payout: '', accent: 2, avatar: 3, languages: [], since: Date.now() }, artist: 'approved', created: Date.now(), verified: true, notify: false, featured: f.handle };
      await setPw(u, crypto.randomBytes(24).toString('hex')); db.users.push(u);
    }
    const canLogin = !!(email && pw.length >= 10);
    if (canLogin) { u.email = email; if (!(await checkPw(u, pw)) && !u.claimed) await setPw(u, pw); u.claimed = true; }
    u.contactOnly = !u.claimed;
    if (!u.claimed) Object.assign(u.seller, { headline: f.headline, category: f.category, skills: f.skills, bio: f.bio, instagram: f.instagram }); // until he can edit it himself
    const dir = path.join(__dirname, 'showcase', f.handle);
    let files = []; try { files = fs.readdirSync(dir).filter(n => /\.(jpe?g|png|webp)$/i.test(n)).sort().slice(0, 40); } catch {}
    db.art.filter(a => a.owner === u.id && a.source && !files.includes(a.source)).forEach(a => { try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} db.art.splice(db.art.indexOf(a), 1); });
    for (const name of files) {
      if (db.art.some(a => a.owner === u.id && a.source === name && fs.existsSync(path.join(UP_DIR, a.file)))) continue;
      const raw = fs.readFileSync(path.join(dir, name)), kind = imageKind(raw);
      if (!kind || raw.length > 4 * 1024 * 1024) { console.warn('[showcase] skipped ' + name + ' (not a JPG/PNG/WebP under 4 MB)'); continue; }
      db.art = db.art.filter(a => !(a.owner === u.id && a.source === name));
      const id = crypto.randomBytes(8).toString('hex'), file = id + '.' + kind; fs.writeFileSync(path.join(UP_DIR, file), raw, { mode: 0o600 });
      const title = name.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ').trim();
      db.art.push({ id, owner: u.id, title: clean(title ? title[0].toUpperCase() + title.slice(1) : 'Sample project', 60), file, source: name, created: Date.now() });
    }
  }
  save(); bump();
}

/* ------------------------------------------------------------ rate limit */
const buckets = new Map();
function limited(key, max, windowMs = 10 * 60e3) {
  const now = Date.now(); let b = buckets.get(key);
  if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  return ++b.n > max;
}
const failures = new Map(); // account lockout: email -> {n, reset}
const LOCK_AFTER = 6, LOCK_MS = 15 * 60e3;
const lockedOut = email => { const f = failures.get(email); return !!f && f.reset > Date.now() && f.n >= LOCK_AFTER; };
function noteFailure(email) { const now = Date.now(); let f = failures.get(email); if (!f || f.reset < now) f = { n: 0, reset: now + LOCK_MS }; f.n++; failures.set(email, f); return f; }
setInterval(() => { const n = Date.now(); for (const [k, b] of buckets) if (b.reset < n) buckets.delete(k); for (const [k, f] of failures) if (f.reset < n) failures.delete(k); }, 60e3).unref();

/* ------------------------------------------------------------- passwords */
const kdfOf = u => u.kdf || LEGACY_KDF;
const hashPw = (pw, salt, k = KDF) => scrypt(pw, salt, 64, { N: k.N, r: k.r, p: k.p, maxmem: 128 * k.N * k.r * 2 + (1 << 20) });
const DUMMY_SALT = crypto.randomBytes(16);
async function checkPw(u, pw) { // constant-ish time whether or not the user exists
  const h = await hashPw(String(pw).slice(0, 100), u ? Buffer.from(u.salt, 'hex') : DUMMY_SALT, u ? kdfOf(u) : KDF);
  return !!u && crypto.timingSafeEqual(h, Buffer.from(u.hash, 'hex'));
}
async function setPw(u, pw) { const salt = crypto.randomBytes(16); u.salt = salt.toString('hex'); u.kdf = KDF; u.hash = (await hashPw(pw, salt)).toString('hex'); }
function weakPw(pw, email, name) {
  if (pw.length < 8) return 'Password must be at least 8 characters.'; if (pw.length > 100) return 'Password must be 100 characters or fewer.';
  const l = pw.toLowerCase();
  if (COMMON_PW.has(l) || /^(.)\1+$/.test(pw) || /^(0123|1234|abcd|qwer)/i.test(pw) && pw.length < 12) return 'That password is too common. Choose something harder to guess.';
  if (email && (l.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4)) return "Your password shouldn't contain your email address.";
  if (name && name.length >= 4 && l.includes(name.toLowerCase().replace(/\s+/g, ''))) return "Your password shouldn't contain your name.";
  return null;
}

/* ------------------------------------------------- CAPTCHA (self-hosted proof of work) */
// The browser must find a number n so that SHA-256(salt:n) starts with `bits` zero bits. Costs a real browser
// a fraction of a second, but makes mass sign-ups/spam expensive. No third party, no cookies, no tracking.
const CAPTCHA_ON = process.env.CAPTCHA !== 'off';
const CAPTCHA_BITS = Math.min(24, Math.max(8, +process.env.CAPTCHA_BITS || 18));
const capUsed = new Map();
const lzBits = buf => { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; };
function makeChallenge(ip) {
  const salt = crypto.randomBytes(16).toString('hex'), exp = Date.now() + 5 * 60e3, bits = CAPTCHA_BITS + (limited('capiss:' + ip, 25) ? 2 : 0);
  return { salt, exp, bits, sig: hmac(`cap.${salt}.${exp}.${bits}`) };
}
function verifyCaptcha(p) {
  if (!p || typeof p !== 'object') return false;
  const { salt, exp, bits, sig, n } = p;
  if (typeof salt !== 'string' || !/^[a-f0-9]{32}$/.test(salt) || !Number.isInteger(exp) || !Number.isInteger(bits) || typeof sig !== 'string' || !Number.isInteger(n) || n < 0) return false;
  if (exp < Date.now() || bits < CAPTCHA_BITS || bits > 26 || capUsed.has(salt) || !tEq(hmac(`cap.${salt}.${exp}.${bits}`), sig)) return false;
  if (lzBits(crypto.createHash('sha256').update(`${salt}:${n}`).digest()) < bits) return false;
  capUsed.set(salt, exp); return true; // each solved challenge works exactly once
}
const needCap = b => CAPTCHA_ON && !verifyCaptcha(b && b.captcha);
const capFail = res => fail(res, 400, 'Please complete the security check and try again.', { code: 'captcha' });
setInterval(() => { const n = Date.now(); for (const [k, e] of capUsed) if (e < n) capUsed.delete(k); }, 60e3).unref();

/* ------------------------------------------------------------ two-factor (TOTP, RFC 6238) */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = buf => { let bits = '', out = ''; for (const x of buf) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const hotp = (key, step) => { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(step)); const h = crypto.createHmac('sha1', key).update(m).digest(), o = h[19] & 15; return String((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0'); };
function checkTotp(secretBuf, code, lastStep) { const now = Math.floor(Date.now() / 30000); for (const d of [0, -1, 1]) { const s = now + d; if (s > lastStep && tEq(hotp(secretBuf, s), code)) return s; } return 0; } // returns the matched time-step (0 = no match); a step can't be reused
const RC_ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const newRecoveryCodes = () => Array.from({ length: 10 }, () => { let c = ''; for (const b of crypto.randomBytes(8)) c += RC_ALPHA[b % RC_ALPHA.length]; return c.slice(0, 4) + '-' + c.slice(4); });
const rcHash = c => sha('rc.' + String(c).toLowerCase().replace(/[^a-z0-9]/g, ''));
function verifySecondFactor(u, raw) { // authenticator code OR a one-time recovery code; mutates u on success
  const code = String(raw || '').trim().toLowerCase().replace(/[\s-]/g, '');
  if (/^\d{6}$/.test(code)) { const s = checkTotp(decrypt(u.totp.enc), code, u.totp.last || 0); if (s) { u.totp.last = s; return true; } return false; }
  if (code.length === 8) { const h = rcHash(code), i = (u.totp.recovery || []).findIndex(x => tEq(x, h)); if (i >= 0) { u.totp.recovery.splice(i, 1); return true; } }
  return false;
}

/* --------------------------------------------------------------- sessions */
const SID = secure => (secure ? '__Host-sid' : 'sid');
const readSid = req => cookie(req, '__Host-sid') || cookie(req, 'sid');
function startSession(req, u) {
  const token = newToken(), mine = [...sessions].filter(([, v]) => v.uid === u.id).sort((a, b) => a[1].exp - b[1].exp);
  while (mine.length >= MAX_SESSIONS) sessions.delete(mine.shift()[0]);
  sessions.set(sha(token), { uid: u.id, exp: Date.now() + SESSION_MS, created: Date.now(), ua: String(req.headers['user-agent'] || '').slice(0, 200) }); sesDirty = true; save();
  const s = isHttps(req); return `${SID(s)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${s ? '; Secure' : ''}`;
}
function userOf(req) {
  const t = readSid(req); if (!t) return null; const k = sha(t), s = sessions.get(k); if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(k); sesDirty = true; return null; }
  const u = db.users.find(x => x.id === s.uid); return u && !u.banned ? u : null;
}
const dropSessions = (uid, keep) => { for (const [k, v] of sessions) if (v.uid === uid && k !== keep) sessions.delete(k); sesDirty = true; save(); };
const clearCookies = req => { const s = isHttps(req); return s ? ['__Host-sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'] : ['sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0']; };
setInterval(() => { const n = Date.now(); for (const [k, v] of sessions) if (v.exp < n) { sessions.delete(k); sesDirty = true; } }, 3600e3).unref();

/* ----------------------------------------------------------------- email */
function mailHtml(subject, text) {
  const body = esc(text).split(/\n{2,}/).map(p => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#5B3DF5">$1</a>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#F6F4EF;padding:32px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0E1015"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E5E0D5;border-radius:16px;padding:32px"><div style="font-weight:700;font-size:20px;margin-bottom:22px">Tweak’d</div><h1 style="font-size:20px;margin:0 0 16px">${esc(subject)}</h1>${body}</div></body></html>`;
}
async function sendMail({ to, subject, text }) {
  subject = String(subject).replace(/[\r\n]+/g, ' ').slice(0, 150);
  if (RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text, html: mailHtml(subject, text) }), signal: AbortSignal.timeout(10000) });
      if (!r.ok) audit('mail_failed', { status: r.status }); else audit('mail_sent', { kind: subject.slice(0, 40) });
    } catch (e) { audit('mail_failed', { error: e.message }); }
  } else if (!PROD) {
    try { fs.mkdirSync(OUT_DIR, { recursive: true }); fs.writeFileSync(path.join(OUT_DIR, `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}\n`); } catch {}
    console.log(`[mail:dev] to=${to} subject="${subject}" (saved to data/outbox)`);
  }
}
async function sendVerification(req, u) {
  const base = linkBase(req); if (!base) return audit('mail_skipped', { why: 'SITE_URL not set' });
  const token = newToken(); u.verify = { h: sha(token), exp: Date.now() + 24 * 3600e3 }; save();
  await sendMail({ to: u.email, subject: 'Verify your email address', text: `Hi ${u.name.split(' ')[0]},\n\nWelcome to Tweak’d! Please confirm your email address by opening this link (valid for 24 hours):\n\n${base}/verify?token=${token}\n\nIf you didn't create an account, you can ignore this email.` });
}
const lastNotify = new Map();

/* ---------------------------------------------------- live exchange rates */
const rates = { USD: 1, INR: 83, EUR: 0.92, GBP: 0.79 }; let ratesAt = null;
async function refreshRates() {
  try {
    const j = await (await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(8000) })).json();
    if (j.result === 'success') { for (const k of ['INR', 'EUR', 'GBP']) if (j.rates[k] > 0) rates[k] = j.rates[k]; ratesAt = Date.now(); }
  } catch { /* keep last known rates */ }
}
refreshRates(); setInterval(refreshRates, 6 * 3600e3).unref();

/* ------------------------------------------------------- real-time stream */
const clients = new Set(); // {res, uid, ip}
let stateTimer = null;
const publicUsers = () => db.users.filter(u => !u.banned);
function stateObj() {
  const onlineIds = new Set([...clients].map(c => c.uid).filter(Boolean)), pu = publicUsers();
  return {
    v: dataVersion,
    stats: { members: pu.length, sellers: pu.filter(isArtist).length, artworks: db.art.filter(a => isArtist(db.users.find(u => u.id === a.owner))).length, services: db.gigs.filter(g => !isBanned(g.owner)).length, online: onlineIds.size },
    online: pu.filter(u => isArtist(u) && onlineIds.has(u.id)).map(u => u.seller.handle),
    places: Object.entries(pu.filter(u => isArtist(u) && placeOf(u.seller)).reduce((m, u) => (m[placeOf(u.seller)] = (m[placeOf(u.seller)] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 24).map(([name, artists]) => ({ name, artists })),
    rates: { ...rates, updated: ratesAt },
    config: { company: COMPANY, contactEmail: CONTACT_EMAIL, siteUrl: SITE_URL, mail: MAIL_ON, captcha: CAPTCHA_ON, payments: PAY_ON }
  };
}
const isBanned = uid => !!db.users.find(u => u.id === uid)?.banned;
const emit = (c, ev, data) => { try { c.res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} };
function scheduleState() { if (stateTimer) return; stateTimer = setTimeout(() => { stateTimer = null; const s = stateObj(); clients.forEach(c => emit(c, 'state', s)); }, 700); }
const bump = () => { dataVersion++; scheduleState(); };
const notifyUser = (uid, ev, data) => clients.forEach(c => { if (c.uid === uid) emit(c, ev, data); });
setInterval(() => clients.forEach(c => { try { c.res.write(': ping\n\n'); } catch {} }), 25e3).unref();

/* -------------------------------------------------------------- shapes */
const avg = rs => rs.length ? Math.round(rs.reduce((a, r) => a + r.rating, 0) / rs.length * 10) / 10 : 0;
const sellerStats = uid => { const rs = db.reviews.filter(r => r.seller === uid); return { rating: avg(rs), reviews: rs.length, completed: db.orders.filter(o => o.seller === uid && o.status === 'completed').length }; };
const gigStats = id => { const rs = db.reviews.filter(r => r.gig === id); return { rating: avg(rs), reviews: rs.length }; };
const alertsFor = uid => db.orders.filter(o => (o.seller === uid && (o.status === 'requested' || o.status === 'in_progress')) || (o.buyer === uid && (o.status === 'delivered' || o.status === 'quoted'))).length;
const reviewsFor = uid => db.reviews.filter(r => r.seller === uid).slice(-30).reverse().map(r => { const b = db.users.find(x => x.id === r.buyer), g = db.gigs.find(x => x.id === r.gig), n = (b?.name || 'Former member').split(' '); return { rating: r.rating, text: r.text, created: r.created, service: g?.title || db.orders.find(o => o.id === r.order)?.gigTitle || 'a service', buyer: n.length > 1 ? `${n[0]} ${n[n.length - 1][0]}.` : n[0] }; });
const orderOut = (o, uid) => { const peerId = o.buyer === uid ? o.seller : o.buyer, p = db.users.find(x => x.id === peerId), rv = db.reviews.find(r => r.order === o.id); return { id: o.id, gigId: o.gigId, gigTitle: o.gigTitle, kind: o.kind || 'listing', item: o.item || '', budget: o.budget || 0, deadline: o.deadline || '', links: o.links || [], quoteNote: o.quoteNote || '', inspiration: (o.inspiration || []).map(id => '/api/inspiration/' + id), price: o.price, qty: o.qty || 1, total: o.total || o.price, product: o.product || '', options: o.options || {}, artworkUrl: o.options?.artwork ? (db.art.find(a => a.id === o.options.artwork) ? '/uploads/' + db.art.find(a => a.id === o.options.artwork).file : '') : '', pay: o.pay || 'unpaid', canPay: PAY_ON && o.buyer === uid && (o.pay || 'unpaid') === 'unpaid' && ['in_progress', 'delivered'].includes(o.status) && (o.total || o.price) > 0, days: o.days, status: o.status, created: o.created, updated: o.updated, role: o.buyer === uid ? 'buyer' : 'seller', peer: p ? peerOut(p) : { id: peerId, name: 'Former member', handle: '', avatar: null, accent: 0 }, brief: o.brief || '', delivery: o.delivery || '', review: rv ? { rating: rv.rating, text: rv.text } : null }; };
const isOnline = uid => [...clients].some(c => c.uid === uid);
const sellerOut = u => ({ handle: u.seller.handle, name: u.name, headline: u.seller.headline, category: u.seller.category, bio: u.seller.bio, location: u.seller.location || '', languages: u.seller.languages || [], skills: u.seller.skills || [], website: u.seller.website || '', instagram: u.seller.instagram || '', contactOnly: !!u.contactOnly, country: u.seller.country || '', place: placeOf(u.seller), works: db.art.filter(a => a.owner === u.id).length, accent: u.seller.accent || 0, avatar: u.seller.avatar || 0, since: u.seller.since, services: db.gigs.filter(g => g.owner === u.id).length, online: isOnline(u.id), ...sellerStats(u.id) });
const unreadFor = uid => db.messages.filter(m => m.to === uid && !m.read).length;
const pub = u => ({ id: u.id, name: u.name, email: u.email, seller: u.seller ? sellerOut(u) : null, unread: unreadFor(u.id), verified: !!u.verified, needsVerify: MAIL_ON && !u.verified, notify: u.notify !== false, twoFactor: !!u.totp?.enabled, admin: !!u.admin, artist: u.seller ? u.artist || 'pending' : 'none', alerts: alertsFor(u.id), payout: u.seller?.payout || '' });
const artOut = a => ({ id: a.id, title: a.title, url: '/uploads/' + a.file, created: a.created });
const gigOut = g => { const o = db.users.find(u => u.id === g.owner), s = o?.seller, aw = g.artwork && db.art.find(a => a.id === g.artwork); return { id: g.id, owner: g.owner, title: g.title, category: g.category, price: g.price, days: g.days, description: g.description || '', included: g.included || [], tags: g.tags || [], created: g.created, product: g.product || '', artwork: aw ? aw.id : '', artworkUrl: aw ? '/uploads/' + aw.file : '', country: s?.country || '', place: placeOf(s), seller: o?.name || 'Seller', handle: s?.handle || '', headline: s?.headline || '', avatar: s?.avatar || 0, accent: s?.accent || 0, ...gigStats(g.id) }; };
const peerOut = u => ({ id: u.id, name: u.name, handle: u.seller?.handle || '', avatar: u.seller ? u.seller.avatar : null, accent: u.seller?.accent || 0 });
// accepts "name", "@name" or a profile link (tracking parameters are dropped); '' if empty, null if not Instagram
function instaHandle(v) {
  const t = clean(v, 200).replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '');
  return !t ? '' : /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : null;
}
function parseProfile(b, me) {
  const handle = clean(b.handle, 24).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,23}$/.test(handle)) return { error: 'Your page address must be 3–24 letters, numbers or dashes.' };
  if (RESERVED.has(handle) && me.seller?.handle !== handle) return { error: 'That address is reserved. Try another.' };
  if (db.users.some(u => u.id !== me.id && u.seller?.handle === handle)) return { error: 'That page address is already taken.' };
  const headline = clean(b.headline, 70), category = String(b.category), bio = cleanText(b.bio, 800), location = clean(b.location, 40);
  if (headline.length < 5) return { error: 'Add a headline (at least 5 characters).' };
  if (!CATS.includes(category)) return { error: 'Pick a category.' };
  if (bio.length < 20) return { error: 'Tell buyers a bit more about you (20+ characters).' };
  const website = clean(b.website, 100), country = clean(b.country, 40);
  const instagram = instaHandle(b.instagram);
  if (instagram === null) return { error: 'Enter your Instagram username or profile link.' };
  if (website && !/^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(website)) return { error: 'Website must start with http:// or https://' };
  const payout = 'payout' in b ? clean(b.payout, 200) : (me.seller?.payout || '');
  const accent = Math.max(0, Math.min(7, Math.round(+b.accent) || 0)), avatar = Math.max(0, Math.min(11, Math.round(+b.avatar) || 0));
  return { value: { handle, headline, category, bio, location, website, instagram, country, payout, accent, avatar, languages: list(b.languages, 5, 20), skills: list(b.skills, 8, 24) } };
}
const needVerify = (res, u) => { if (MAIL_ON && !u.verified) { fail(res, 403, 'Please verify your email address first. Check your inbox, or request a new link from the banner at the top of the page.', { code: 'unverified' }); return true; } return false; };
function removeUser(uid) {
  db.inspo.filter(a => a.owner === uid).forEach(a => { try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} }); db.inspo = db.inspo.filter(a => a.owner !== uid);
  db.art.filter(a => a.owner === uid).forEach(a => { try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} }); db.art = db.art.filter(a => a.owner !== uid);
  db.gigs = db.gigs.filter(g => g.owner !== uid); db.messages = db.messages.filter(x => x.from !== uid && x.to !== uid); db.users = db.users.filter(x => x.id !== uid);
  db.orders = db.orders.filter(o => o.buyer !== uid && o.seller !== uid);
  // pictures attached to orders that just disappeared must go too
  db.inspo.filter(a => a.order && !db.orders.some(o => o.id === a.order)).forEach(a => { try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} }); db.inspo = db.inspo.filter(a => !a.order || db.orders.some(o => o.id === a.order)); db.reviews = db.reviews.filter(r => r.buyer !== uid && r.seller !== uid);
  dropSessions(uid); save(); bump();
}

/* ------------------------------------------------------------------- API */
async function api(req, res, url) {
  const m = req.method, p = url.pathname, ip = clientIp(req);
  if (limited('api:' + ip, 900) && p !== '/api/stream') return fail(res, 429, 'Too many requests. Please slow down.');

  /* Stripe calls this directly: no cookies, no Origin. It is trusted only because the signature checks out. */
  if (p === '/api/stripe/webhook' && m === 'POST') {
    if (!PAY_ON) return fail(res, 404, 'Not found.');
    const raw = await readRaw(req, 200000);
    if (!verifyStripeSig(raw, req.headers['stripe-signature'])) { audit('stripe_bad_signature', { ip }); return fail(res, 400, 'Bad signature.'); }
    let ev; try { ev = JSON.parse(raw.toString()); } catch { return fail(res, 400, 'Bad payload.'); }
    if (!ev?.id || db.hooks.includes(ev.id)) return send(res, 200, { received: true, duplicate: true });
    const obj = ev.data?.object || {};
    if (ev.type === 'checkout.session.completed') {
      const o = db.orders.find(x => x.id === +obj.client_reference_id);
      if (o && o.pay !== 'paid' && obj.payment_status === 'paid' && obj.currency === 'usd' && obj.amount_total === (o.total || o.price) * 100) {
        o.pay = 'paid'; o.paidAt = Date.now(); o.paymentIntent = String(obj.payment_intent || ''); o.updated = Date.now();
        db.messages.push({ id: db.nextMsg++, from: o.buyer, to: o.seller, text: 'Payment received. Tweak’d holds it until the buyer approves the delivery.', kind: 'system', orderId: o.id, created: Date.now(), read: false });
        audit('order_paid', { order: o.id });
        for (const id of [o.buyer, o.seller]) notifyUser(id, 'order', { id: o.id, status: o.status, text: 'Payment received', alerts: alertsFor(id), unread: unreadFor(id), peer: id === o.buyer ? o.seller : o.buyer, self: false });
      } else if (o && o.pay !== 'paid') audit('stripe_amount_mismatch', { order: o.id });
    } else if (ev.type === 'charge.refunded') {
      const o = db.orders.find(x => x.paymentIntent && x.paymentIntent === obj.payment_intent);
      if (o) { o.pay = 'refunded'; o.updated = Date.now(); audit('order_refunded', { order: o.id }); }
    }
    db.hooks.push(ev.id); if (db.hooks.length > 500) db.hooks.shift(); save(); bump();
    return send(res, 200, { received: true });
  }

  if (m !== 'GET' && m !== 'HEAD') { // CSRF + content-type guards
    const o = req.headers.origin; if (o) { let h; try { h = new URL(o).host.toLowerCase(); } catch { h = ''; } if (h !== hostOf(req)) return fail(res, 403, 'Bad origin'); }
    const sfs = req.headers['sec-fetch-site']; if (sfs && sfs !== 'same-origin' && sfs !== 'none') return fail(res, 403, 'Cross-site request blocked');
    const ctype = req.headers['content-type'] || '', isUpload = (p === '/api/art' || p === '/api/inspiration') && ctype.startsWith('application/octet-stream'); // only these routes takes raw bytes; browsers can't send that type cross-site without a preflight
    if (m !== 'DELETE' && !isUpload && !ctype.startsWith('application/json')) return fail(res, 415, 'JSON only');
  }

  /* ----- admin (bearer token; invisible when not configured) ----- */
  if (p.startsWith('/api/admin/')) {
    const au = userOf(req), sessAdmin = !!(au && au.admin && (!PROD || au.totp?.enabled || au.demo));
    if (PROD && sessAdmin && au.demo && m !== 'GET') return fail(res, 403, 'The demo admin is read-only. Run your own copy to try the actions.');
    if (!ADMIN_ON && !sessAdmin) return fail(res, 404, 'Not found.');
    if (limited('admin:' + ip, 120)) return fail(res, 429, 'Too many requests.');
    if (!sessAdmin) {
      const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!ADMIN_ON || !tEq(sha(tok), sha(ADMIN_TOKEN))) { audit('admin_denied', { ip }); return fail(res, 401, 'Unauthorized.'); }
    }
    // the public demo admin sees the console, but not other people's email addresses, messages or payout details
    const masked = PROD && sessAdmin && au.demo, hide = e => masked && !/@tweakd\.demo$/.test(e) ? String(e).replace(/^(.).*(@.*)$/, '$1•••$2') : e;
    if (p === '/api/admin/overview' && m === 'GET') return send(res, 200, {
      counts: { users: db.users.length, sellers: db.users.filter(u => u.seller).length, services: db.gigs.length, messages: db.messages.length, reports: db.contact.length, orders: db.orders.length, art: db.art.length, paidCents: db.orders.filter(o => o.pay === 'paid').reduce((a, o) => a + (o.total || o.price) * 100, 0), online: new Set([...clients].map(c => c.uid).filter(Boolean)).size },
      orders: db.orders.slice(-100).reverse().map(o => ({ id: o.id, title: o.gigTitle, status: o.status, pay: o.pay || 'unpaid', total: o.total || o.price, buyer: db.users.find(x => x.id === o.buyer)?.name || '—', seller: db.users.find(x => x.id === o.seller)?.name || '—', created: o.created })),
      artists: db.users.filter(x => x.seller).sort((a, b) => b.seller.since - a.seller.since).slice(0, 200).map(x => ({ id: x.id, name: x.name, email: hide(x.email), handle: x.seller.handle, headline: x.seller.headline, bio: x.seller.bio, place: placeOf(x.seller), status: x.artist || 'pending', works: db.art.filter(a => a.owner === x.id).slice(-6).map(a => '/uploads/' + a.file) })),
      users: db.users.slice(-200).reverse().map(u => ({ id: u.id, name: u.name, email: hide(u.email), handle: u.seller?.handle || null, verified: !!u.verified, banned: !!u.banned, admin: !!u.admin, twoFactor: !!u.totp?.enabled, created: u.created })),
      services: db.gigs.slice(-200).reverse().map(g => ({ id: g.id, owner: g.owner, title: g.title, price: g.price, product: g.product || '', created: g.created })),
      contact: (masked ? [] : db.contact.slice(-100)).reverse().map(c => ({ id: c.id, name: c.name, email: c.email, subject: c.subject, message: c.message, created: c.created }))
    });
    let mm;
    if ((mm = p.match(/^\/api\/admin\/artists\/([\w-]{8,64})$/)) && m === 'POST') {
      const x = db.users.find(y => y.id === mm[1] && y.seller); if (!x) return fail(res, 404, 'No artist application for that user.'); const b = await readBody(req), status = String(b.status);
      if (!['approved', 'rejected', 'pending'].includes(status)) return fail(res, 400, 'Status must be approved, rejected or pending.');
      x.artist = status; save(); bump(); audit('admin_artist', { user: x.id, status }); notifyUser(x.id, 'artist', { status }); return send(res, 200, { ok: true, status });
    }
    if ((mm = p.match(/^\/api\/admin\/users\/([\w-]{8,64})\/ban$/)) && m === 'POST') {
      const u = db.users.find(x => x.id === mm[1]); if (!u) return fail(res, 404, 'No such user.'); if (u.admin) return fail(res, 403, 'Admin accounts cannot be banned here.'); const b = await readBody(req); u.banned = b.banned !== false;
      if (u.banned) dropSessions(u.id); save(); bump(); audit('admin_ban', { user: u.id, banned: u.banned }); return send(res, 200, { ok: true, banned: u.banned });
    }
    if ((mm = p.match(/^\/api\/admin\/users\/([\w-]{8,64})$/)) && m === 'DELETE') { const tu = db.users.find(x => x.id === mm[1]); if (!tu) return fail(res, 404, 'No such user.'); if (tu.admin) return fail(res, 403, 'Admin accounts cannot be deleted here.'); removeUser(mm[1]); audit('admin_delete_user', { user: mm[1] }); return send(res, 200, { ok: true }); }
    if ((mm = p.match(/^\/api\/admin\/gigs\/(\d+)$/)) && m === 'DELETE') { const i = db.gigs.findIndex(g => g.id === +mm[1]); if (i < 0) return fail(res, 404, 'No such service.'); db.gigs.splice(i, 1); save(); bump(); audit('admin_delete_gig', { gig: +mm[1] }); return send(res, 200, { ok: true }); }
    // money: what has been paid, what is owed to artists, mark payouts done, refund
    const owed = o => { const fee = Math.round((o.total || o.price) * FEE_PCT), cents = (o.total || o.price) * 100; return { fee, payout: cents - fee }; };
    if (p === '/api/admin/orders' && m === 'GET') return send(res, 200, { feePercent: FEE_PCT, orders: db.orders.filter(o => o.pay === 'paid' || o.pay === 'refunded').slice(-200).reverse().map(o => { const s = db.users.find(x => x.id === o.seller); return { id: o.id, title: o.gigTitle, status: o.status, pay: o.pay, totalCents: (o.total || o.price) * 100, ...owed(o), seller: s?.name, payoutTo: masked ? '' : s?.seller?.payout || '', payoutDone: o.payoutAt || null, paidAt: o.paidAt }; }) });
    if ((mm = p.match(/^\/api\/admin\/orders\/(\d+)\/payout$/)) && m === 'POST') {
      const o = db.orders.find(x => x.id === +mm[1]); if (!o) return fail(res, 404, 'No such order.');
      if (o.pay !== 'paid' || o.status !== 'completed') return fail(res, 409, 'Only paid, completed orders can be paid out.'); if (o.payoutAt) return fail(res, 409, 'Already paid out.');
      o.payoutAt = Date.now(); save(); audit('admin_payout', { order: o.id, ...owed(o) }); return send(res, 200, { ok: true, ...owed(o) });
    }
    if ((mm = p.match(/^\/api\/admin\/orders\/(\d+)\/refund$/)) && m === 'POST') {
      const o = db.orders.find(x => x.id === +mm[1]); if (!o) return fail(res, 404, 'No such order.');
      if (o.pay !== 'paid' || !o.paymentIntent) return fail(res, 409, 'Nothing to refund.'); if (o.payoutAt) return fail(res, 409, 'Already paid out to the artist.');
      try { await stripe('/v1/refunds', { payment_intent: o.paymentIntent }); } catch (e) { return fail(res, 502, e.message); }
      o.pay = 'refunded'; o.updated = Date.now(); save(); bump(); audit('admin_refund', { order: o.id }); return send(res, 200, { ok: true });
    }
    if ((mm = p.match(/^\/api\/admin\/contact\/(\d+)$/)) && m === 'DELETE') { db.contact = db.contact.filter(c => c.id !== +mm[1]); save(); return send(res, 200, { ok: true }); }
    return fail(res, 404, 'Not found.');
  }

  const u0 = userOf(req);

  if (p === '/api/state' && m === 'GET') return send(res, 200, stateObj());
  if (p === '/api/stream' && m === 'GET') {
    if (clients.size >= 5000 || [...clients].filter(c => c.ip === ip).length >= 12) return fail(res, 429, 'Too many connections');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n'); const c = { res, uid: u0?.id || null, ip }; clients.add(c); emit(c, 'state', stateObj()); if (c.uid) scheduleState();
    req.on('close', () => { clients.delete(c); if (c.uid) scheduleState(); }); return;
  }
  if (p === '/api/me' && m === 'GET') return send(res, 200, { user: u0 ? pub(u0) : null });
  if (p === '/api/gigs' && m === 'GET') return send(res, 200, { gigs: db.gigs.filter(g => isArtist(db.users.find(u => u.id === g.owner))).map(gigOut).reverse() });
  if (p === '/api/gallery' && m === 'GET') return send(res, 200, { works: db.art.slice().reverse().sort((x, y) => { const rank = a => { const o = db.users.find(u => u.id === a.owner); return o?.featured ? 0 : o?.demo ? 2 : 1; }; return rank(x) - rank(y) || (rank(x) === 0 ? x.created - y.created : 0); }).map(a => { const o = db.users.find(u => u.id === a.owner); return isArtist(o) && { ...artOut(a), handle: o.seller.handle, artist: o.name, contactOnly: !!o.contactOnly, instagram: o.seller.instagram || '', place: placeOf(o.seller), avatar: o.seller.avatar || 0 }; }).filter(Boolean).slice(0, 60) });
  if (p === '/api/sellers' && m === 'GET') return send(res, 200, { sellers: publicUsers().filter(isArtist).sort((a, b) => b.seller.since - a.seller.since).slice(0, 200).map(sellerOut) });
  const sp = p.match(/^\/api\/sellers\/([a-z0-9-]{3,24})$/);
  if (sp && m === 'GET') {
    const u = publicUsers().find(x => x.seller?.handle === sp[1]); if (!u || !(isArtist(u) || u0?.id === u.id || u0?.admin)) return fail(res, 404, 'Artist not found.');
    return send(res, 200, { seller: sellerOut(u), gigs: db.gigs.filter(g => g.owner === u.id).map(gigOut).reverse(), reviews: reviewsFor(u.id), art: db.art.filter(a => a.owner === u.id).map(artOut).reverse() });
  }

  if (p === '/api/signup' && m === 'POST') {
    if (limited('auth:' + ip, 15)) return fail(res, 429, 'Too many attempts. Try again in a few minutes.');
    if (limited('signup:' + ip, 6, 3600e3)) return fail(res, 429, 'Too many accounts created from your network. Please try again later.');
    const b = await readBody(req), name = clean(b.name, 40), email = clean(b.email, 120).toLowerCase(), pw = String(b.password || '');
    if (needCap(b)) return capFail(res);
    if (name.length < 2) return fail(res, 400, 'Please enter your name.');
    if (!emailOk(email)) return fail(res, 400, "That email doesn't look right.");
    const weak = weakPw(pw, email, name); if (weak) return fail(res, 400, weak);
    if (db.users.some(x => x.email === email)) return fail(res, 409, 'An account with this email already exists.');
    const u = { id: crypto.randomUUID(), name, email, seller: null, created: Date.now(), verified: false, notify: true }; await setPw(u, pw);
    if (db.users.some(x => x.email === email)) return fail(res, 409, 'An account with this email already exists.');
    db.users.push(u); save(); scheduleState(); audit('signup', { user: u.id, ip });
    if (MAIL_ON) sendVerification(req, u).catch(() => {});
    return send(res, 201, { user: pub(u) }, { 'Set-Cookie': startSession(req, u) });
  }
  if (p === '/api/login' && m === 'POST') {
    if (limited('auth:' + ip, 15)) return fail(res, 429, 'Too many attempts. Try again in a few minutes.');
    const b = await readBody(req), email = clean(b.email, 120).toLowerCase(), pw = String(b.password || '').slice(0, 100);
    if (lockedOut(email)) { audit('login_locked', { ip }); return fail(res, 429, 'Too many failed attempts for this account. Try again in 15 minutes, or reset your password.'); }
    const fe = failures.get(email), fi = failures.get('ip:' + ip), now0 = Date.now(); // after a couple of misses, ask for the security check
    if (((fe && fe.reset > now0 && fe.n >= 2) || (fi && fi.reset > now0 && fi.n >= 4)) && needCap(b)) return capFail(res);
    const u = db.users.find(x => x.email === email), ok = await checkPw(u, pw);
    if (!ok) { const f = noteFailure(email); noteFailure('ip:' + ip); audit('login_failed', { ip, n: f.n }); return fail(res, 401, 'Wrong email or password.'); }
    if (u.banned) { audit('login_banned', { user: u.id }); return fail(res, 403, 'This account has been suspended. Contact us if you think this is a mistake.'); }
    if (kdfOf(u).N < KDF.N) { await setPw(u, pw); save(); } // transparently upgrade old hashes
    if (u.totp?.enabled) return send(res, 200, { mfa: true, token: signTok({ k: 'mfa', uid: u.id, exp: Date.now() + 5 * 60e3 }) }); // password was right; now the second factor
    failures.delete(email); failures.delete('ip:' + ip);
    return send(res, 200, { user: pub(u) }, { 'Set-Cookie': startSession(req, u) });
  }
  if (p === '/api/login/2fa' && m === 'POST') {
    if (limited('mfa:' + ip, 20)) return fail(res, 429, 'Too many attempts. Try again in a few minutes.');
    const b = await readBody(req), t = readTok(b.token), u = t && t.k === 'mfa' && db.users.find(x => x.id === t.uid);
    if (!u || u.banned || !u.totp?.enabled) return fail(res, 401, 'Your login session expired. Please log in again.');
    if (limited('mfauid:' + u.id, 8)) { audit('mfa_locked', { user: u.id, ip }); return fail(res, 429, 'Too many wrong codes. Wait 10 minutes and try again.'); }
    if (!verifySecondFactor(u, b.code)) { audit('mfa_failed', { user: u.id, ip }); return fail(res, 401, "That code isn't right. Check your authenticator app, or use a recovery code."); }
    save(); failures.delete(u.email); failures.delete('ip:' + ip); audit('login_mfa', { user: u.id });
    return send(res, 200, { user: pub(u) }, { 'Set-Cookie': startSession(req, u) });
  }
  if (p === '/api/captcha' && m === 'GET') { if (limited('capreq:' + ip, 60)) return fail(res, 429, 'Too many requests.'); return send(res, 200, makeChallenge(ip)); }
  if (p === '/api/logout' && m === 'POST') {
    const t = readSid(req); if (t) { sessions.delete(sha(t)); sesDirty = true; save(); }
    return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookies(req) });
  }
  if (p === '/api/password/forgot' && m === 'POST') {
    if (limited('forgot:' + ip, 5, 3600e3)) return fail(res, 429, 'Too many requests. Please try again later.');
    if (!MAIL_ON) return fail(res, 503, 'Email is not enabled on this site yet. Please contact us to reset your password.');
    const b = await readBody(req), email = clean(b.email, 120).toLowerCase(), u = db.users.find(x => x.email === email && !x.banned);
    if (needCap(b)) return capFail(res);
    if (u && !limited('forgot-acct:' + u.id, 3, 3600e3)) {
      const base = linkBase(req);
      if (base) { const token = newToken(); u.reset = { h: sha(token), exp: Date.now() + 3600e3 }; save(); sendMail({ to: u.email, subject: 'Reset your password', text: `Hi ${u.name.split(' ')[0]},\n\nSomeone (hopefully you) asked to reset your Tweak’d password. Open this link within one hour to choose a new one:\n\n${base}/reset?token=${token}\n\nIf you didn't ask for this, you can safely ignore this email — your password won't change.` }).catch(() => {}); audit('reset_requested', { user: u.id }); }
      else audit('mail_skipped', { why: 'SITE_URL not set' });
    }
    return send(res, 200, { ok: true }); // identical response whether or not the account exists
  }
  if (p === '/api/password/reset' && m === 'POST') {
    if (limited('reset:' + ip, 10, 3600e3)) return fail(res, 429, 'Too many attempts. Please try again later.');
    const b = await readBody(req), token = String(b.token || ''), u = db.users.find(x => x.reset && x.reset.exp > Date.now() && tEq(x.reset.h, sha(token)));
    if (u?.demo) return fail(res, 403, 'This is a shared demo account.');
    if (!u) return fail(res, 400, 'This reset link is invalid or has expired. Request a new one.');
    const weak = weakPw(String(b.password || ''), u.email, u.name); if (weak) return fail(res, 400, weak);
    await setPw(u, String(b.password)); u.reset = null; u.verified = true; failures.delete(u.email); dropSessions(u.id); save(); audit('password_reset', { user: u.id });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/email/verify' && m === 'POST') {
    if (limited('verify:' + ip, 20, 3600e3)) return fail(res, 429, 'Too many attempts.');
    const b = await readBody(req), token = String(b.token || ''), u = db.users.find(x => x.verify && x.verify.exp > Date.now() && tEq(x.verify.h, sha(token)));
    if (!u) return fail(res, 400, 'This verification link is invalid or has expired. Request a new one from your account.');
    u.verified = true; u.verify = null; save(); bump(); notifyUser(u.id, 'verified', {}); return send(res, 200, { ok: true });
  }
  if (p === '/api/contact' && m === 'POST') {
    if (limited('contact:' + ip, 5, 3600e3)) return fail(res, 429, 'Too many messages. Please try again later.');
    const b = await readBody(req); if (b.company_site) return send(res, 201, { ok: true }); // honeypot field: silently accept bots
    if (needCap(b)) return capFail(res);
    const name = clean(b.name, 60), email = clean(b.email, 120).toLowerCase(), subject = clean(b.subject, 100), message = cleanText(b.message, 3000);
    if (name.length < 2) return fail(res, 400, 'Please enter your name.'); if (!emailOk(email)) return fail(res, 400, 'Enter a valid email so we can reply.');
    if (message.length < 10) return fail(res, 400, 'Please write a little more.');
    db.contact.push({ id: db.nextContact++, name, email, subject, message, created: Date.now() }); if (db.contact.length > 2000) db.contact.splice(0, db.contact.length - 2000);
    save(); audit('contact', { id: db.nextContact - 1 });
    if (MAIL_ON) sendMail({ to: CONTACT_EMAIL, subject: `Contact form: ${subject || 'new message'}`, text: `From: ${name} <${email}>\n\n${message}` }).catch(e => console.error('contact forward failed:', e.message));
    return send(res, 201, { ok: true });
  }

  const u = u0; if (!u) return fail(res, 401, 'Please log in first.');

  /* account */
  if (p === '/api/email/resend' && m === 'POST') {
    if (!MAIL_ON) return fail(res, 503, 'Email is not enabled on this site.'); if (u.verified) return send(res, 200, { ok: true });
    if (limited('resend:' + u.id, 3, 3600e3)) return fail(res, 429, 'Please wait a bit before requesting another email.');
    await sendVerification(req, u); return send(res, 200, { ok: true });
  }
  if (p === '/api/account' && m === 'POST') { // rename, notification preference and/or change password
    if (u.demo) return fail(res, 403, 'This is a shared demo account, so its login details cannot be changed.');
    const b = await readBody(req);
    if (b.name !== undefined) { const n = clean(b.name, 40); if (n.length < 2) return fail(res, 400, 'Please enter your name.'); u.name = n; }
    if (b.notify !== undefined) u.notify = !!b.notify;
    if (b.next !== undefined) {
      if (limited('pw:' + u.id, 8)) return fail(res, 429, 'Too many attempts.');
      const next = String(b.next), weak = weakPw(next, u.email, u.name); if (weak) return fail(res, 400, weak);
      if (!(await checkPw(u, b.current))) return fail(res, 401, 'Your current password is wrong.');
      await setPw(u, next); dropSessions(u.id, sha(readSid(req))); audit('password_changed', { user: u.id });
    }
    save(); bump(); return send(res, 200, { user: pub(u) });
  }
  if (p === '/api/account/export' && m === 'GET') {
    const { salt, hash, kdf, verify, reset, totp, totpPending, ...me } = u;
    return send(res, 200, { exportedAt: new Date().toISOString(), account: { ...me, twoFactor: !!totp?.enabled }, services: db.gigs.filter(g => g.owner === u.id), messages: db.messages.filter(x => x.from === u.id || x.to === u.id), orders: db.orders.filter(o => o.buyer === u.id || o.seller === u.id), reviews: db.reviews.filter(r => r.buyer === u.id || r.seller === u.id), showcase: db.art.filter(a => a.owner === u.id).map(artOut), inspiration: db.inspo.filter(a => a.owner === u.id).map(a => ({ url: '/api/inspiration/' + a.id, created: a.created })) }, { 'Content-Disposition': 'attachment; filename="my-tweakd-data.json"' });
  }
  if (p === '/api/account' && m === 'DELETE') {
    if (u.demo) return fail(res, 403, 'This is a shared demo account, so its login details cannot be changed.');
    const b = await readBody(req).catch(() => ({})); if (limited('pw:' + u.id, 8)) return fail(res, 429, 'Too many attempts.');
    if (!(await checkPw(u, b.password))) return fail(res, 401, 'Password is wrong.');
    removeUser(u.id); audit('account_deleted', { user: u.id }); return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookies(req) });
  }

  /* two-factor authentication */
  if (p === '/api/2fa/setup' && m === 'POST') {
    if (u.demo) return fail(res, 403, 'This is a shared demo account, so its login details cannot be changed.');
    if (limited('pw:' + u.id, 8)) return fail(res, 429, 'Too many attempts.');
    const b = await readBody(req); if (u.totp?.enabled) return fail(res, 400, 'Two-factor authentication is already on.');
    if (!(await checkPw(u, b.password))) return fail(res, 401, 'Your password is wrong.');
    const secret = crypto.randomBytes(20); u.totpPending = { enc: encrypt(secret), exp: Date.now() + 15 * 60e3 }; save();
    const s32 = b32enc(secret);
    return send(res, 200, { secret: s32, uri: `otpauth://totp/${encodeURIComponent('Tweak’d')}:${encodeURIComponent(u.email)}?secret=${s32}&issuer=${encodeURIComponent('Tweak’d')}` });
  }
  if (p === '/api/2fa/enable' && m === 'POST') {
    if (limited('mfaen:' + u.id, 10)) return fail(res, 429, 'Too many attempts.');
    const b = await readBody(req), pend = u.totpPending; if (!pend || pend.exp < Date.now()) return fail(res, 400, 'Setup expired. Start again.');
    const step = checkTotp(decrypt(pend.enc), String(b.code || '').replace(/\s/g, ''), 0);
    if (!step) return fail(res, 400, "That code isn't right. Check the clock on your phone and try again.");
    const codes = newRecoveryCodes(); u.totp = { enc: pend.enc, enabled: true, last: step, recovery: codes.map(rcHash) }; u.totpPending = null; save(); audit('2fa_enabled', { user: u.id });
    return send(res, 200, { ok: true, recovery: codes, user: pub(u) });
  }
  if ((p === '/api/2fa/disable' || p === '/api/2fa/recovery') && m === 'POST') {
    if (!u.totp?.enabled) return fail(res, 400, 'Two-factor authentication is not on.');
    if (limited('pw:' + u.id, 8) || limited('mfauid:' + u.id, 8)) return fail(res, 429, 'Too many attempts.');
    const b = await readBody(req); if (!(await checkPw(u, b.password))) return fail(res, 401, 'Your password is wrong.');
    if (!verifySecondFactor(u, b.code)) return fail(res, 401, "That code isn't right.");
    if (p.endsWith('disable')) { u.totp = null; save(); audit('2fa_disabled', { user: u.id }); return send(res, 200, { ok: true, user: pub(u) }); }
    const codes = newRecoveryCodes(); u.totp.recovery = codes.map(rcHash); save(); return send(res, 200, { ok: true, recovery: codes });
  }

  /* signed-in devices */
  if (p === '/api/sessions' && m === 'GET') {
    const me = sha(readSid(req));
    return send(res, 200, { sessions: [...sessions].filter(([, v]) => v.uid === u.id).sort((a, b) => (b[1].created || 0) - (a[1].created || 0)).map(([k, v]) => ({ current: k === me, created: v.created || null, device: describeUA(v.ua) })) });
  }
  if (p === '/api/sessions/others' && m === 'DELETE') { dropSessions(u.id, sha(readSid(req))); audit('sessions_revoked', { user: u.id }); return send(res, 200, { ok: true }); }

  /* orders & reviews */
  if (p === '/api/orders' && m === 'GET') {
    const mine = db.orders.filter(o => o.buyer === u.id || o.seller === u.id).sort((a, b) => b.updated - a.updated).slice(0, 200).map(o => orderOut(o, u.id));
    return send(res, 200, { buying: mine.filter(o => o.role === 'buyer'), selling: mine.filter(o => o.role === 'seller'), alerts: alertsFor(u.id) });
  }
  const oa = p.match(/^\/api\/orders\/(\d+)\/(action|review)$/);
  if (oa && m === 'POST') {
    if (limited('ord:' + u.id, 60, 3600e3)) return fail(res, 429, 'Slow down a little.');
    const o = db.orders.find(x => x.id === +oa[1] && (x.buyer === u.id || x.seller === u.id)); if (!o) return fail(res, 404, 'Order not found.');
    const b = await readBody(req), now = Date.now(), peerId = o.buyer === u.id ? o.seller : o.buyer;
    if (oa[2] === 'review') {
      if (o.buyer !== u.id) return fail(res, 403, 'Only the buyer can review an order.'); if (o.status !== 'completed') return fail(res, 409, 'You can review once the order is completed.');
      if (db.reviews.some(r => r.order === o.id)) return fail(res, 409, 'You already reviewed this order.');
      const rating = Math.round(+b.rating), text = cleanText(b.text, 800); if (!(rating >= 1 && rating <= 5)) return fail(res, 400, 'Choose a rating from 1 to 5.');
      db.reviews.push({ id: db.nextReview++, order: o.id, gig: o.gigId, seller: o.seller, buyer: o.buyer, rating, text, created: now }); save(); bump();
      notifyUser(peerId, 'order', { id: o.id, status: o.status, text: `${u.name.split(' ')[0]} left you a ${rating}-star review`, alerts: alertsFor(peerId), unread: unreadFor(peerId), peer: u.id });
      return send(res, 201, { ok: true });
    }
    const a = String(b.action), note = cleanText(b.note, 1000), isSeller = o.seller === u.id;
    const T = { accept: ['seller', o.kind === 'custom' ? [] : ['requested'], 'in_progress', 'accepted the request'], decline: ['seller', ['requested', 'quoted'], 'declined', 'declined the request'], quote: ['seller', o.kind === 'custom' ? ['requested', 'quoted'] : [], 'quoted', 'sent a quote'], accept_quote: ['buyer', ['quoted'], 'in_progress', 'accepted the quote'], deliver: ['seller', ['in_progress'], 'delivered', 'delivered the work', true], cancel: ['buyer', ['requested', 'quoted'], 'cancelled', 'cancelled the request'], complete: ['buyer', ['delivered'], 'completed', 'approved the delivery'], revise: ['buyer', ['delivered'], 'in_progress', 'asked for changes', true] }[a];
    if (!T) return fail(res, 400, 'Unknown action.'); if ((T[0] === 'seller') !== isSeller) return fail(res, 403, "You can't do that on this order.");
    if (!T[1].includes(o.status)) return fail(res, 409, "This order can't be changed from its current state.");
    if (T[4] && note.length < 5) return fail(res, 400, 'Add a short note (at least 5 characters).');
    if (a === 'quote') {
      const price = Math.round(+b.price), days = Math.round(+b.days);
      if (!(price >= 5 && price <= 5000)) return fail(res, 400, 'Quote between 5 and 5000 USD.');
      if (!(days >= 1 && days <= 90)) return fail(res, 400, 'Delivery must be 1–90 days.');
      Object.assign(o, { price, total: price, days, quoteNote: note });
    }
    o.status = T[2]; o.updated = now; if (a === 'deliver') o.delivery = note;
    db.messages.push({ id: db.nextMsg++, from: u.id, to: peerId, text: `${u.name} ${T[3]}${a === 'quote' ? ` of $${o.total}, ready in ${o.days} days` : ''}.${note ? '\n' + note : ''}`, kind: 'system', orderId: o.id, created: now, read: false });
    save(); bump(); audit('order_' + a, { order: o.id, user: u.id });
    for (const id of [u.id, peerId]) notifyUser(id, 'order', { id: o.id, status: o.status, text: id === u.id ? 'Order updated' : `${u.name.split(' ')[0]} ${T[3]}`, alerts: alertsFor(id), unread: unreadFor(id), peer: id === u.id ? peerId : u.id, self: id === u.id });
    return send(res, 200, { ok: true, order: orderOut(o, u.id) });
  }

  /* payment: send the buyer to Stripe's hosted checkout. Card details never touch this server. */
  const pay = p.match(/^\/api\/orders\/(\d+)\/pay$/);
  if (pay && m === 'POST') {
    if (!PAY_ON) return fail(res, 501, "Online payment isn't switched on for this site yet. Agree payment with the artist directly.");
    if (limited('pay:' + u.id, 20, 3600e3)) return fail(res, 429, 'Too many attempts. Try again later.');
    const o = db.orders.find(x => x.id === +pay[1] && x.buyer === u.id); if (!o) return fail(res, 404, 'Order not found.');
    if ((o.pay || 'unpaid') !== 'unpaid') return fail(res, 409, 'This order is already paid.');
    if (!['in_progress', 'delivered'].includes(o.status)) return fail(res, 409, 'You can pay once the artist has accepted the order.');
    const base = SITE_URL || (PROD ? '' : baseUrl(req)); if (!base) return fail(res, 500, 'The site address is not configured.');
    try {
      const s = await stripe('/v1/checkout/sessions', { mode: 'payment', client_reference_id: o.id, customer_email: u.email, success_url: `${base}/?paid=${o.id}`, cancel_url: `${base}/?unpaid=${o.id}`, 'line_items': { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: (o.total || o.price) * 100, product_data: { name: `${o.gigTitle}${o.qty > 1 ? ' × ' + o.qty : ''}` } } } }, metadata: { order: o.id } });
      return send(res, 200, { url: s.url });
    } catch (e) { audit('stripe_error', { order: o.id, msg: e.message }); return fail(res, 502, "We couldn't reach the payment provider. Please try again in a moment."); }
  }

  /* inspiration images for a custom order: private to the buyer, the chosen artist and admins */
  if (p === '/api/inspiration' && m === 'POST') {
    if (needVerify(res, u)) return;
    if (limited('insp:' + u.id, 30, 3600e3)) return fail(res, 429, 'Too many uploads. Try again later.');
    if (db.inspo.filter(a => a.owner === u.id && !a.order).length >= 12) return fail(res, 400, 'You have too many unsent images. Remove some first.');
    const raw = await readRaw(req, 1.5 * 1024 * 1024), kind = imageKind(raw); if (!kind) return fail(res, 400, 'Upload a JPG, PNG or WebP image.');
    const id = crypto.randomBytes(16).toString('hex'), file = `i-${id}.${kind}`;
    fs.writeFileSync(path.join(UP_DIR, file), raw, { mode: 0o600 });
    db.inspo.push({ id, owner: u.id, file, order: null, created: Date.now() }); save(); return send(res, 201, { id, url: '/api/inspiration/' + id });
  }
  const insp = p.match(/^\/api\/inspiration\/([a-f0-9]{32})$/);
  if (insp) {
    const a = db.inspo.find(x => x.id === insp[1]), o = a?.order && db.orders.find(x => x.id === a.order);
    if (!a || !(a.owner === u.id || o?.seller === u.id || u.admin)) return fail(res, 404, 'Not found.');
    if (m === 'GET') { res.writeHead(200, { 'Content-Type': 'image/' + (a.file.endsWith('jpg') ? 'jpeg' : a.file.split('.').pop()), 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" }); return fs.createReadStream(path.join(UP_DIR, a.file)).on('error', () => res.end()).pipe(res); }
    if (m === 'DELETE') { if (a.owner !== u.id || a.order) return fail(res, 403, 'That image is part of a sent request.'); db.inspo.splice(db.inspo.indexOf(a), 1); try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {} save(); return send(res, 200, { ok: true }); }
  }
  if (p === '/api/requests' && m === 'POST') {
    if (needVerify(res, u)) return;
    if (limited('req:' + u.id, 15, 3600e3)) return fail(res, 429, 'Too many requests sent. Try again later.');
    const b = await readBody(req), to = publicUsers().find(x => isArtist(x) && !x.contactOnly && x.seller.handle === String(b.handle));
    if (!to) return fail(res, 404, 'Choose an artist.'); if (to.id === u.id) return fail(res, 400, "You can't order from yourself.");
    const product = String(b.product || ''), prod = product && product !== 'other' ? productOf(product) : null;
    if (product !== 'other' && !prod) return fail(res, 400, 'Choose what you want customised.');
    const item = clean(b.item, 80), brief = cleanText(b.brief, 1500), color = clean(b.color, 30), budget = Math.max(0, Math.min(5000, Math.round(+b.budget) || 0)), deadline = /^\d{4}-\d{2}-\d{2}$/.test(b.deadline) ? b.deadline : '';
    if (item.length < 3) return fail(res, 400, 'Describe your item in a few words.');
    if (brief.length < 15) return fail(res, 400, 'Tell the artist what you want (at least 15 characters).');
    const links = lines(b.links, 5, 200).filter(l => /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(l));
    const ids = [...new Set(Array.isArray(b.inspiration) ? b.inspiration.map(String) : [])].slice(0, 6), pics = ids.map(i => db.inspo.find(x => x.id === i && x.owner === u.id && !x.order));
    if (pics.some(x => !x)) return fail(res, 400, 'One of the inspiration images is no longer available. Add it again.');
    const ref = String(b.reference || ''); if (ref && !db.art.some(a => a.id === ref && a.owner === to.id)) return fail(res, 400, "That artwork isn't in this artist's portfolio.");
    if (db.orders.filter(o => o.buyer === u.id && o.seller === to.id && ['requested', 'quoted'].includes(o.status)).length >= 3) return fail(res, 409, 'You already have three requests waiting with this artist.');
    const title = `Custom ${prod ? prod.name.toLowerCase() : 'item'}: ${item}`.slice(0, 100), now = Date.now();
    const order = { id: db.nextOrder++, kind: 'custom', gigId: 0, gigTitle: title, product: prod ? prod.id : '', item, options: { ...(color ? { color } : {}), ...(ref ? { artwork: ref } : {}) }, qty: 1, price: 0, total: 0, days: 0, budget, deadline, links, inspiration: ids, buyer: u.id, seller: to.id, status: 'requested', pay: 'unpaid', created: now, updated: now, brief };
    db.orders.push(order); pics.forEach(x => { x.order = order.id; });
    db.messages.push({ id: db.nextMsg++, from: u.id, to: to.id, text: brief, kind: 'order', gigId: 0, gigTitle: title, gigPrice: 0, gigDays: 0, orderId: order.id, created: now, read: false });
    save(); bump(); audit('custom_request', { order: order.id, user: u.id });
    notifyUser(to.id, 'message', { peer: u.id, fromName: u.name, text: 'Custom request: ' + item, unread: unreadFor(to.id), alerts: alertsFor(to.id) });
    return send(res, 201, { ok: true, order: orderOut(order, u.id), peer: peerOut(to) });
  }

  /* portfolio images. Raw bytes in the body; the file type is decided by the bytes, never by the name or header. */
  if (p === '/api/art' && m === 'POST') {
    if (!u.seller || !['approved', 'pending'].includes(u.artist)) return fail(res, 403, 'Apply to be an artist first.'); if (needVerify(res, u)) return;
    if (limited('up:' + u.id, 40, 3600e3)) return fail(res, 429, 'Too many uploads. Try again later.');
    if (db.art.filter(a => a.owner === u.id).length >= 40) return fail(res, 400, 'Portfolio limit reached (40 pieces). Delete one first.');
    const raw = await readRaw(req, 1.5 * 1024 * 1024), kind = imageKind(raw); if (!kind) return fail(res, 400, 'Upload a JPG, PNG or WebP image.');
    const id = crypto.randomBytes(8).toString('hex'), file = `${id}.${kind}`;
    fs.writeFileSync(path.join(UP_DIR, file), raw, { mode: 0o600 });
    const a = { id, owner: u.id, title: clean(url.searchParams.get('title') || '', 60) || 'Untitled', file, created: Date.now() };
    db.art.push(a); save(); bump(); audit('art_upload', { user: u.id, bytes: raw.length }); return send(res, 201, { art: artOut(a) });
  }
  const artDel = p.match(/^\/api\/art\/([a-f0-9]{16})$/);
  if (artDel && m === 'DELETE') {
    const i = db.art.findIndex(a => a.id === artDel[1]); if (i < 0) return fail(res, 404, 'Not found.'); if (db.art[i].owner !== u.id) return fail(res, 403, 'Not your artwork.');
    const [a] = db.art.splice(i, 1); try { fs.unlinkSync(path.join(UP_DIR, a.file)); } catch {}
    db.gigs.forEach(g => { if (g.artwork === a.id) g.artwork = ''; }); save(); bump(); return send(res, 200, { ok: true });
  }

  /* seller profile */
  if (p === '/api/seller' && m === 'POST') {
    if (needVerify(res, u)) return;
    const b = await readBody(req), r = parseProfile(b, u); if (r.error) return fail(res, 400, r.error);
    u.seller = { ...r.value, since: u.seller?.since || Date.now() }; if (u.artist !== 'approved') { if (u.artist !== 'pending') audit('artist_applied', { user: u.id }); u.artist = 'pending'; } save(); bump(); return send(res, 200, { user: pub(u) });
  }

  /* services */
  if (p === '/api/gigs' && m === 'POST') {
    if (!isArtist(u)) return fail(res, 403, 'Only approved artists can list products.'); if (needVerify(res, u)) return;
    if (limited('gig:' + u.id, 30, 3600e3)) return fail(res, 429, 'Too many services published. Try again later.');
    const b = await readBody(req), title = clean(b.title, 90), category = String(b.category), price = Math.round(+b.price), days = Math.round(+b.days);
    const description = cleanText(b.description, 1200), included = lines(b.included, 6, 90), tags = list(b.tags, 3, 16).map(t => t.replace(/^#/, ''));
    const product = String(b.product || ''), artwork = String(b.artwork || '');
    if (title.length < 10) return fail(res, 400, 'Title needs at least 10 characters.');
    if (product && !productOf(product)) return fail(res, 400, 'Pick a product from the list.');
    if (artwork && !db.art.some(a => a.id === artwork && a.owner === u.id)) return fail(res, 400, 'Choose a cover from your own portfolio.');
    if (!CATS.includes(category)) return fail(res, 400, 'Pick a category.');
    if (!(price >= 5 && price <= 5000)) return fail(res, 400, 'Price must be between 5 and 5000 USD.');
    if (!(days >= 1 && days <= 60)) return fail(res, 400, 'Delivery must be 1–60 days.');
    if (description.length < 30) return fail(res, 400, 'Describe your service in at least 30 characters.');
    if (db.gigs.filter(g => g.owner === u.id).length >= 25) return fail(res, 400, 'Service limit reached (25).');
    const g = { id: db.nextGig++, owner: u.id, title, category: product ? productOf(product).group : category, price, days, description, included, tags, product, artwork, created: Date.now() };
    db.gigs.push(g); save(); bump(); return send(res, 201, { gig: gigOut(g) });
  }
  const del = p.match(/^\/api\/gigs\/(\d+)$/);
  if (del && m === 'DELETE') {
    const i = db.gigs.findIndex(g => g.id === +del[1]);
    if (i < 0) return fail(res, 404, 'Not found.'); if (db.gigs[i].owner !== u.id) return fail(res, 403, 'Not your service.');
    db.gigs.splice(i, 1); save(); bump(); return send(res, 200, { ok: true });
  }

  /* messaging */
  if (p === '/api/messages' && m === 'POST') {
    if (needVerify(res, u)) return;
    if (limited('msg:' + u.id, 60, 3600e3)) return fail(res, 429, 'Slow down a little — you can send up to 60 messages an hour.');
    const b = await readBody(req), text = cleanText(b.text, 2000);
    const to = b.to ? db.users.find(x => x.id === String(b.to) && !x.banned) : publicUsers().find(x => x.seller?.handle === String(b.handle));
    if (!to) return fail(res, 404, 'Recipient not found.'); if (to.contactOnly) return fail(res, 403, 'Please contact this artist on Instagram.'); if (to.id === u.id) return fail(res, 400, "You can't message yourself.");
    const talked = db.messages.some(x => x.from === to.id && x.to === u.id);
    if (!isArtist(to) && !talked) return fail(res, 403, "You can't message this person.");
    let gig = null;
    if (b.gigId) {
      gig = db.gigs.find(g => g.id === +b.gigId && g.owner === to.id); if (!gig) return fail(res, 404, 'That service no longer exists.');
      if (db.orders.some(o => o.buyer === u.id && o.gigId === gig.id && ['requested', 'in_progress', 'delivered'].includes(o.status))) return fail(res, 409, 'You already have an open order for this service. Continue it from Orders.');
    }
    if (!gig && text.length < 1) return fail(res, 400, 'Write a message first.');
    const msg = { id: db.nextMsg++, from: u.id, to: to.id, text, kind: gig ? 'order' : 'message', created: Date.now(), read: false };
    if (gig) {
      msg.gigId = gig.id; msg.gigTitle = gig.title; msg.gigPrice = gig.price; msg.gigDays = gig.days;
      // what the buyer picked on a customisable product: colour and size must be real options, artwork must be the artist's own
      const prod = gig.product && productOf(gig.product), options = {};
      if (prod) {
        const color = String(b.color || ''), size = String(b.size || ''), art = String(b.artwork || '');
        if (color) { if (!prod.colors.some(c => c[0] === color)) return fail(res, 400, 'Pick one of the colours shown.'); options.color = color; }
        if (prod.sizes.length) { if (!prod.sizes.includes(size)) return fail(res, 400, 'Pick a size.'); options.size = size; }
        if (art) { if (!db.art.some(a => a.id === art && a.owner === to.id)) return fail(res, 400, 'That artwork is not in this artist\'s portfolio.'); options.artwork = art; }
      }
      const qty = Math.max(1, Math.min(50, Math.round(+b.qty) || 1));
      Object.assign(msg, { qty, options });
      const order = { id: db.nextOrder++, gigId: gig.id, gigTitle: gig.title, product: gig.product || '', options, qty, price: gig.price, total: gig.price * qty, days: gig.days, buyer: u.id, seller: to.id, status: 'requested', pay: 'unpaid', created: Date.now(), updated: Date.now(), brief: text.slice(0, 500) };
      db.orders.push(order); msg.orderId = order.id;
    }
    db.messages.push(msg); save();
    notifyUser(to.id, 'message', { peer: u.id, fromName: u.name, text: gig ? `Service request: ${gig.title}` : text.slice(0, 120), unread: unreadFor(to.id), alerts: alertsFor(to.id) });
    notifyUser(u.id, 'message', { peer: to.id, sent: true, unread: unreadFor(u.id) });
    // email nudge: only to verified, opted-in recipients who are offline, at most once an hour per sender
    const k = `${to.id}:${u.id}`;
    if (MAIL_ON && to.verified && to.notify !== false && !isOnline(to.id) && !(lastNotify.get(k) > Date.now() - 3600e3) && linkBase(req)) {
      lastNotify.set(k, Date.now());
      sendMail({ to: to.email, subject: `New message from ${u.name}`, text: `Hi ${to.name.split(' ')[0]},\n\n${u.name} sent you a ${gig ? 'service request' : 'message'} on Tweak’d. Log in to read and reply:\n\n${linkBase(req)}\n\nYou can turn these emails off any time in Account settings.` }).catch(() => {});
    }
    return send(res, 201, { ok: true, peer: peerOut(to) });
  }
  if (p === '/api/conversations' && m === 'GET') {
    const by = new Map();
    for (const x of db.messages) { if (x.from !== u.id && x.to !== u.id) continue; const peer = x.from === u.id ? x.to : x.from; const c = by.get(peer) || { last: null, unread: 0 }; c.last = x; if (x.to === u.id && !x.read) c.unread++; by.set(peer, c); }
    const out = [...by].map(([id, c]) => { const pu = db.users.find(x => x.id === id); return pu && { peer: peerOut(pu), last: { text: c.last.kind === 'order' ? `Service request: ${c.last.gigTitle}` : c.last.text.slice(0, 100), created: c.last.created, mine: c.last.from === u.id }, unread: c.unread }; }).filter(Boolean).sort((a, b) => b.last.created - a.last.created);
    return send(res, 200, { conversations: out, unread: unreadFor(u.id) });
  }
  const cv = p.match(/^\/api\/conversations\/([\w-]{8,64})$/);
  if (cv && m === 'GET') {
    const peer = db.users.find(x => x.id === cv[1]); if (!peer) return fail(res, 404, 'Not found.');
    let changed = false; const msgs = db.messages.filter(x => (x.from === u.id && x.to === peer.id) || (x.from === peer.id && x.to === u.id));
    if (!msgs.length) return fail(res, 404, 'Not found.'); // only participants of an existing conversation can open it
    msgs.forEach(x => { if (x.to === u.id && !x.read) { x.read = true; changed = true; } }); if (changed) { save(); notifyUser(u.id, 'unread', { unread: unreadFor(u.id) }); }
    return send(res, 200, { peer: peerOut(peer), canReply: !peer.banned && !!(peer.seller || msgs.some(x => x.from === peer.id)), messages: msgs.slice(-200).map(x => ({ id: x.id, mine: x.from === u.id, text: x.text, kind: x.kind, gigId: x.gigId, gigTitle: x.gigTitle, gigPrice: x.gigPrice, gigDays: x.gigDays, orderId: x.orderId, created: x.created })) });
  }
  return fail(res, 404, 'Not found.');
}

/* -------------------------------------------------------------- static/SEO */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const fileCache = new Map();
function getFile(name) {
  if (name.includes('\0')) return null; const fp = path.join(PUB, name); if (!fp.startsWith(PUB + path.sep)) return null; const ext = path.extname(fp); if (!MIME[ext]) return null;
  let st; try { st = fs.statSync(fp); } catch { return null; } if (!st.isFile()) return null;
  let c = fileCache.get(fp);
  if (!c || c.mtime !== st.mtimeMs) { const buf = fs.readFileSync(fp); c = { mtime: st.mtimeMs, buf, ext, type: MIME[ext], etag: '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 20) + '"', gz: /^\.(html|css|js|svg|txt|webmanifest)$/.test(ext) && buf.length > 800 ? zlib.gzipSync(buf) : null }; fileCache.set(fp, c); }
  return c;
}
function serveFile(req, res, c, name) {
  const long = /\.(woff2)$/.test(c.ext), h = { 'Content-Type': c.type, ETag: c.etag, Vary: 'Accept-Encoding', 'Cache-Control': long ? 'public, max-age=31536000, immutable' : /\.(jpg|png|ico|svg|webmanifest)$/.test(c.ext) ? 'public, max-age=86400' : 'no-cache' };
  if (req.headers['if-none-match'] === c.etag) { res.writeHead(304, h); return res.end(); }
  if (c.gz && res.acceptsGzip) { res.writeHead(200, { ...h, 'Content-Encoding': 'gzip' }); return res.end(req.method === 'HEAD' ? undefined : c.gz); }
  res.writeHead(200, h); res.end(req.method === 'HEAD' ? undefined : c.buf);
}
const STATIC_META = {
  '/': ['Tweak’d — Your things, customised by artists', 'Get your bag, mouse, hoodie or anything else customised by artists. Share your inspiration, get a quote, and make it yours.'],
  '/about': ['About Tweak’d', 'Why we built Tweak’d: a place where artists put their work on everyday products and anyone can order them.'],
  '/privacy': ['Privacy Policy — Tweak’d', 'What data Tweak’d collects, why, and how you can export or delete it.'],
  '/terms': ['Terms of Service — Tweak’d', 'The rules for using Tweak’d as a buyer or an artist.'],
  '/contact': ['Contact — Tweak’d', 'Questions, feedback or need to report something? Get in touch with the Tweak’d team.'],
  '/forgot': ['Forgot your password? — Tweak’d', 'Reset your Tweak’d password by email.'],
  '/reset': ['Choose a new password — Tweak’d', 'Choose a new password for your Tweak’d account.'],
  '/verify': ['Verify your email — Tweak’d', 'Confirm your email address for Tweak’d.'],
  '/admin': ['Admin — Tweak’d', 'Management console.']
};
const NOINDEX = new Set(['/forgot', '/reset', '/verify', '/admin']);
function metaFor(req, pathname) {
  const base = baseUrl(req); let title, desc, type = 'website', ld = null, status = 200, noindex = NOINDEX.has(pathname);
  const sm = pathname.match(/^\/@([a-z0-9-]{3,24})\/?$/);
  if (STATIC_META[pathname]) {
    [title, desc] = STATIC_META[pathname];
    if (pathname === '/' && SITE_URL) ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'Tweak’d', url: SITE_URL }, { '@type': 'WebSite', name: 'Tweak’d', url: SITE_URL }] };
  } else if (sm) {
    const u = publicUsers().find(x => isArtist(x) && x.seller.handle === sm[1]);
    if (u) {
      const s = u.seller; title = `${u.name} — ${s.headline} | Tweak’d`; desc = `${u.name}${placeOf(s) ? ' (' + placeOf(s) + ')' : ''}: ${s.headline}. ${s.bio.replace(/\s+/g, ' ').slice(0, 130)}…`; type = 'profile';
      ld = { '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@type': 'Person', name: u.name, description: s.headline, url: `${base}/@${s.handle}`, ...(s.location ? { homeLocation: { '@type': 'Place', name: s.location } } : {}), ...(s.website ? { sameAs: [s.website] } : {}) } };
    } else { status = 404; noindex = true; title = 'Artist not found — Tweak’d'; desc = 'This artist page does not exist.'; }
  } else { status = 404; noindex = true; title = 'Page not found — Tweak’d'; desc = 'This page does not exist.'; }
  const url = base + (pathname === '/' ? '' : pathname.replace(/\/+$/, '')), hasImg = !!getFile('og.jpg');
  const tags = `<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(url || base + '/')}">`}
<meta property="og:site_name" content="Tweak’d"><meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url || base + '/')}">${hasImg ? `<meta property="og:image" content="${esc(base)}/og.jpg">` : ''}
<meta name="twitter:card" content="${hasImg ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">${hasImg ? `<meta name="twitter:image" content="${esc(base)}/og.jpg">` : ''}${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}`;
  return { status, tags };
}
function serveShell(req, res, pathname) {
  const f = getFile('index.html'); if (!f) { res.writeHead(500); return res.end('Missing index.html'); }
  const { status, tags } = metaFor(req, pathname), html = Buffer.from(f.buf.toString().replace('<!--META-->', () => tags));
  const h = { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
  if (res.acceptsGzip) { res.writeHead(status, { ...h, 'Content-Encoding': 'gzip' }); return res.end(req.method === 'HEAD' ? undefined : zlib.gzipSync(html)); }
  res.writeHead(status, h); res.end(req.method === 'HEAD' ? undefined : html);
}
function sitemap(req) {
  const base = baseUrl(req), urls = ['/', '/about', '/contact', '/privacy', '/terms', ...publicUsers().filter(isArtist).map(u => '/@' + u.seller.handle)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${esc(base + (u === '/' ? '/' : u))}</loc></url>`).join('\n')}\n</urlset>\n`;
}

/* ---------------------------------------------------------------- server */
function securityHeaders(res, https) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin'); res.setHeader('X-Permitted-Cross-Domain-Policies', 'none'); res.setHeader('Origin-Agent-Cluster', '?1');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" + (https ? '; upgrade-insecure-requests' : ''));
  if (https) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
const server = http.createServer(async (req, res) => {
  const t0 = Date.now(); res.acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const https = isHttps(req); securityHeaders(res, https);
  if (PROD) res.on('finish', () => { if (req.url !== '/healthz') console.log(`${req.method} ${req.url.split('?')[0]} ${res.statusCode} ${Date.now() - t0}ms`); });
  try {
    const url = new URL(req.url, 'http://x'), p = url.pathname;
    if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    const host = hostOf(req); // Host header validation: stops host-header poisoning and DNS-rebinding
    if (ALLOWED_HOSTS.size ? !ALLOWED_HOSTS.has(host) : (!PROD && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Invalid host'); }
    if (FORCE_HTTPS && !https) { res.writeHead(301, { Location: `${SITE_URL || 'https://' + host}${req.url}` }); return res.end(); }
    if (p.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    if (p === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /forgot\nDisallow: /reset\nDisallow: /verify\nDisallow: /admin\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`); }
    if (p === '/sitemap.xml') { res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' }); return res.end(sitemap(req)); }
    if (p === '/.well-known/security.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end(`Contact: ${CONTACT_EMAIL ? 'mailto:' + CONTACT_EMAIL : baseUrl(req) + '/contact'}\nExpires: ${new Date(Date.now() + 365 * 864e5).toISOString()}\nPreferred-Languages: en\nCanonical: ${baseUrl(req)}/.well-known/security.txt\n`); }
    if (p === '/index.html') { res.writeHead(301, { Location: '/' }); return res.end(); }
    const up = p.match(/^\/uploads\/([a-f0-9]{16}\.(?:jpg|png|webp))$/);
    if (up) {
      const a = db.art.find(x => x.file === up[1]), owner = a && db.users.find(x => x.id === a.owner), viewer = a && userOf(req);
      if (!a || !(isArtist(owner) || viewer?.id === a.owner || viewer?.admin)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      const type = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[up[1].split('.')[1]];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': isArtist(owner) ? 'public, max-age=86400' : 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(path.join(UP_DIR, up[1])).on('error', () => res.end()).pipe(res);
    }
    if (path.extname(p)) { const f = getFile(decodeURIComponent(p).replace(/^\/+/, '')); if (f) return serveFile(req, res, f); res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    return serveShell(req, res, p.length > 1 ? p.replace(/\/+$/, '') : p);
  } catch (e) {
    if (e.message !== 'too big' && e.message !== 'bad json') console.error('[error]', req.method, (req.url || '').split('?')[0], e.message);
    if (!res.headersSent) { if (e.message === 'too big') res.setHeader('Connection', 'close'); fail(res, e.message === 'too big' ? 413 : 400, e.message === 'too big' ? 'Request too large.' : 'Bad request.'); }
  }
});
server.headersTimeout = 20e3; server.requestTimeout = 30e3; server.keepAliveTimeout = 65e3; server.maxHeadersCount = 60;
server.listen(PORT, HOST, () => console.log(`Tweak’d ${PROD ? '(production) ' : ''}running → http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${MAIL_ON && !RESEND_API_KEY ? '  [email: dev outbox]' : RESEND_API_KEY ? '  [email: Resend]' : '  [email: off]'}${ADMIN_ON ? '  [admin API on]' : ''}`));
const shutdown = sig => { console.log(`\n${sig} received — saving and exiting`); try { flush(); } catch (e) { console.error(e); } process.exit(0); };
// a demo account that is no longer offered is removed from existing databases
db.users.filter(u => u.demo && u.email === 'declined@tweakd.demo').forEach(u => removeUser(u.id));
if (process.env.FEATURED_ARTISTS !== '0') seedFeatured().catch(e => console.error('founding artists:', e.message));
if (DEMO_ON) seedDemo().catch(e => console.error('demo seed failed:', e.message));
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => { console.error('FATAL uncaught exception:', e); try { flush(); } catch {} process.exit(1); }); // let the supervisor restart a clean process
process.on('unhandledRejection', e => console.error('unhandled rejection:', e));
