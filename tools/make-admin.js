#!/usr/bin/env node
// Give an existing account admin rights (or take them away). Stop the server first, because it keeps the database in memory.
//   node tools/make-admin.js you@example.com          make admin
//   node tools/make-admin.js you@example.com remove   remove admin
// In production the console at /admin also requires that account to have two-step verification switched on.
const fs = require('fs'), path = require('path');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')), DB = path.join(DATA_DIR, 'db.json');
const [email, mode] = process.argv.slice(2);
if (!email) { console.error('Usage: node tools/make-admin.js <email> [remove]'); process.exit(1); }
const db = JSON.parse(fs.readFileSync(DB, 'utf8')), u = db.users.find(x => x.email === email.toLowerCase());
if (!u) { console.error('No account with that email.'); process.exit(1); }
if (mode === 'remove') delete u.admin; else u.admin = true;
fs.writeFileSync(DB + '.tmp', JSON.stringify(db), { mode: 0o600 }); fs.renameSync(DB + '.tmp', DB);
console.log(`${u.email} is ${u.admin ? 'now an admin' : 'no longer an admin'}.`);
