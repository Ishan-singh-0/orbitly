# Security

No website can honestly be called "unhackable", and this one is no exception. What follows is exactly what Tweak’d
does to protect itself and its users, what **you** must do on the hosting side, and what is still open.
Every protection listed under "Built in" is covered by an automated attack test (228 checks) that was run against the app.

## Built in

### Network & browser
| Protection | Detail |
| --- | --- |
| **Strict Content-Security-Policy** | `script-src 'self'` (no inline or third-party scripts — injected `<script>` and `onerror=` handlers cannot run), `style-src 'self'`, `font-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` on HTTPS |
| **No third-party requests** | Fonts are self-hosted; the page makes zero requests to other origins. Nothing external can track visitors or be compromised to inject code |
| **HSTS** | `Strict-Transport-Security` (1 year, includeSubDomains) whenever served over HTTPS |
| **Clickjacking** | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| **Other headers** | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, mic, geolocation, payment off), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: same-origin` |
| **Host-header validation** | Requests for any host other than your `SITE_URL` host are rejected — blocks host-header poisoning (e.g. poisoned password-reset links) and DNS rebinding |
| **HTTPS enforcement** | `FORCE_HTTPS=1` redirects HTTP → HTTPS to your `SITE_URL` |
| **Methods & files** | Only GET/HEAD/POST/DELETE; static files come from an allow-listed `public/` folder only — source code, `data/`, `.env`, `.git`, `package.json` are unreachable (tested with 15 traversal/probe URLs) |

### Accounts & sessions
| Protection | Detail |
| --- | --- |
| **Password hashing** | scrypt (N=32768, r=8, p=1) with a unique 16-byte salt per user; old hashes are upgraded transparently at next login. Plain passwords are never stored or logged |
| **Password policy** | 8+ characters, blocks common passwords, repeated characters, and passwords containing the user's name or email |
| **Brute-force defence** | 6 failed logins lock an account for 15 minutes **regardless of IP** (stops distributed guessing), plus per-IP limits on login, signup (6/hour), password reset, contact and messaging. Real client IP is read from the right-hand side of `X-Forwarded-For`, so attackers can't dodge limits by spoofing the header |
| **No account enumeration** | Wrong email and wrong password give the same message; "forgot password" always answers the same way; unknown accounts still cost the same hashing time |
| **Sessions** | 256-bit random tokens, stored server-side only as SHA-256 hashes; HttpOnly + SameSite=Lax cookies (`__Host-` prefixed and `Secure` over HTTPS); a fresh token on every login; max 10 per user; all other sessions are revoked on password change/reset; logout invalidates server-side; sessions persist across restarts |
| **Email verification** | Users must verify their address before they can publish services, create a seller page or send messages (single-use, 24h, hashed tokens) |
| **Password reset** | 256-bit single-use tokens, stored hashed, valid 1 hour, rate-limited; links are built from `SITE_URL`, never from the request |
| **Two-step verification** | Optional TOTP (RFC 6238). Secret encrypted with AES-256-GCM at rest, codes can't be replayed, 10 hashed one-time recovery codes, login uses a short-lived signed token between the password and code steps, separate rate limits, and turning it off needs password + code |
| **CAPTCHA** | Self-hosted proof-of-work: the browser must find a SHA-256 hash with leading zero bits. Challenges are HMAC-signed, expire in 5 minutes and are single-use. Required on sign-up, contact and password reset, and on login after repeated failures. It raises the cost of bulk abuse; it does not distinguish humans the way a image CAPTCHA does |
| **Devices** | Users can list active sessions (browser/OS, last seen) and sign out all others |
| **Image uploads** | Raw bytes only on one route; the type comes from the file signature (JPG/PNG/WebP, never SVG), 1.5 MB cap, random file names, 40 pieces per artist, 40 uploads/hour. Files are served with `nosniff` and `Content-Security-Policy: sandbox`, and deleted with the account |
| **Payments** | Card data never touches this server (Stripe hosted Checkout). The webhook verifies Stripe's HMAC signature, rejects timestamps older than 5 minutes, ignores duplicate event ids and checks the amount before marking an order paid. The browser redirect is never treated as proof of payment |
| **Account deletion & export** | Self-service, password-confirmed; deletion removes the user, services, messages and sessions |

### Application
| Protection | Detail |
| --- | --- |
| **CSRF** | SameSite cookies + Origin check + `Sec-Fetch-Site` check + JSON-only content type on every state-changing request |
| **XSS** | Angle brackets and control/bidi characters stripped on input, every value HTML-escaped on output, server-rendered meta tags escaped, JSON-LD escaped, and the CSP blocks inline script even if something slipped through. Tested with stored payloads in names, headlines, bios, locations, skills |
| **Authorization (IDOR)** | Every conversation, export and delete is checked against the logged-in user. Strangers cannot read others' conversations, delete others' services, cold-message buyers or take reserved/existing page addresses |
| **Input validation** | Strict allow-list validation on every field; 30 KB body cap (413 with a clean close); malformed/array/prototype-pollution JSON handled safely |
| **Abuse limits** | 25 services/user, 60 messages/hour/user, email notifications throttled to 1/hour/sender, 5,000 concurrent live connections (12/IP), honeypot on the contact form |
| **Moderation** | Admin API (bearer token, constant-time compare, 404 when disabled) + `tools/admin.js`: list reports, ban/unban, delete users and services. Banned users are signed out and hidden everywhere |
| **Admin console** | `/admin` is available only to accounts flagged admin (never settable through the API, only with `tools/make-admin.js`). In production the admin must have two-step verification on. Every request goes through the same CSRF and rate limits; admin accounts can't be banned or deleted through the console |
| **Artist approval** | Only admins can approve artists. Pending or removed artists are hidden everywhere (pages, gallery, artwork files, sitemap) and cannot receive orders |
| **Inspiration pictures** | Served only to the customer who uploaded them, the artist they were sent to, and admins; never cached; unsent ones are deleted after a day |
| **Audit log** | Sign-ups, failed/locked logins, resets, password changes, deletions and admin actions are written to stdout as JSON lines (no passwords, no message content) |
| **Data at rest** | Data files are written atomically with `0600` permissions; daily backups (14 kept); the server refuses to start rather than overwrite a corrupt database |
| **Crash safety** | On an unexpected exception the server flushes data and exits so your process manager restarts a clean process |
| **Zero dependencies** | No `node_modules` — no supply-chain risk from npm packages |

## What YOU must do (hosting side)

These are outside the application and matter just as much:

1. **Serve over HTTPS only** and set `SITE_URL`, `TRUST_PROXY=1`, `FORCE_HTTPS=1`. Use a platform/proxy that manages certificates (Caddy, Render, Fly, Cloudflare).
2. **Set `SITE_URL`** — without it Host validation and email links are disabled in production (the server warns you).
3. **Keep the machine patched.** Keep Node itself updated (use a current LTS release) and the OS/container base image updated.
4. **Use a firewall** — expose only 80/443. Don't expose the app's port or SSH to the whole internet; use key-based SSH.
5. **Protect secrets.** Keep `RESEND_API_KEY` and `ADMIN_TOKEN` only in your host's secret store. Generate `ADMIN_TOKEN` with 32+ random bytes. Never commit `.env`.
6. **Back up `DATA_DIR` off the server** (the built-in daily copies live on the same disk), and encrypt the disk if your host supports it.
7. **Run the container hardened:** `docker run --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges -v tweakd-data:/data …`
8. **Put a CDN/WAF in front** (e.g. Cloudflare) for volumetric DDoS protection — an application can't absorb network-level floods.
9. **Monitor.** Watch logs for `login_locked`, `admin_denied`, and 5xx spikes; set an uptime check on `/healthz`.
10. **Review the legal pages** with a lawyer, and tell users if you ever have a breach (many jurisdictions require it).

## Known limitations / honest gaps

- **The CAPTCHA is proof-of-work, not human verification.** A determined attacker with compute can pay the cost. Add Cloudflare Turnstile or hCaptcha if you see abuse.
- **2FA is optional** and the QR code was not scanned on a real phone in testing (the manual key and `otpauth://` link are alternatives). Losing both the device and recovery codes requires the admin password-reset tool.
- **Back up `DATA_DIR/secret.key`** (or set `APP_SECRET`). Without it, stored 2FA secrets cannot be decrypted.
- **Sign-up reveals whether an email is registered** ("account already exists"). That's a usability trade-off; it's rate-limited.
- **JSON-file storage** is simple and safe for early traffic but isn't a database: no row-level locking, one instance only. Move to PostgreSQL/SQLite before heavy traffic or multiple servers.
- **Single-process rate limits** live in memory and reset on restart.
- **Inline `style="…"` attributes** remain allowed (`style-src-attr 'unsafe-inline'`) because the UI uses a few; `<style>` blocks and external stylesheets are locked to same-origin.
- **Payments are off until you add Stripe keys.** When on, card data stays with Stripe (PCI SAQ A). Tweak’d then holds customer money until you pay artists out, which is a regulated activity in some countries; read PAYMENTS.md and get advice before going live. Payout and refund actions are manual admin steps.
- **Uploaded images are not scanned** for copyright or inappropriate content. Use the report link and `tools/admin.js delete-user` / `delete-gig` to act on reports.

## Reporting a vulnerability

The site publishes `/.well-known/security.txt` pointing at your contact address. Set `CONTACT_EMAIL`, and respond to reports promptly.
