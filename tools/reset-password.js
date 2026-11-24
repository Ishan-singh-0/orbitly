// Emergency password reset for a user, for when email reset isn't available.
// IMPORTANT: stop the server first — a running server keeps the database in memory and would overwrite this change.
//   node tools/reset-password.js user@example.com "a-new-long-password"
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [email, pw] = process.argv.slice(2);
if (!email || !pw || pw.length < 8) { console.error('Usage: node tools/reset-password.js <email> <new password (8+ chars)>'); process.exit(1); }
const dir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')), file = path.join(dir, 'db.json');
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
const u = db.users.find(x => x.email === email.toLowerCase().trim());
if (!u) { console.error('No user with that email.'); process.exit(1); }
const KDF = { N: 32768, r: 8, p: 1 }, salt = crypto.randomBytes(16);
u.salt = salt.toString('hex'); u.kdf = KDF; u.hash = crypto.scryptSync(pw, salt, 64, { N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 128 * KDF.N * KDF.r * 2 + (1 << 20) }).toString('hex'); u.reset = null;
fs.writeFileSync(file + '.tmp', JSON.stringify(db), { mode: 0o600 }); fs.renameSync(file + '.tmp', file);
try { fs.unlinkSync(path.join(dir, 'sessions.json')); } catch {}
console.log('Password updated for', u.email, '— all sessions cleared. Start the server again.');
