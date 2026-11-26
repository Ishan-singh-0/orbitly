/* ============ TWEAK’D — pages.js (About, Privacy, Terms, Contact) ============ */
const PAGE_META = {
  about: ['About Tweak’d', 'Why we built Tweak’d: a simple, honest marketplace where independent talent gets its own page and clients get a direct line.'],
  privacy: ['Privacy Policy — Tweak’d', 'What data Tweak’d collects, why, and how you can export or delete it.'],
  terms: ['Terms of Service — Tweak’d', 'The rules for using Tweak’d as a buyer or an artist.'],
  contact: ['Contact — Tweak’d', 'Questions, feedback or need to report something? Get in touch with the Tweak’d team.'],
  forgot: ['Forgot your password? — Tweak’d', 'Reset your Tweak’d password by email.'],
  reset: ['Choose a new password — Tweak’d', 'Choose a new password for your Tweak’d account.'],
  verify: ['Verify your email — Tweak’d', 'Confirm your email address for Tweak’d.']
};
const company = () => esc(S.cfg?.company || 'Tweak’d');
const contactLine = () => S.cfg?.contactEmail ? `email <a class="ulink" href="mailto:${esc(S.cfg.contactEmail)}">${esc(S.cfg.contactEmail)}</a> or use the <a class="ulink" href="/contact" data-nav>contact form</a>` : `use the <a class="ulink" href="/contact" data-nav>contact form</a>`;
const pageShell = (_section, title, inner, updated) => `<div class="container static-page"><h1>${title}</h1>${updated ? `<p class="updated">Last updated ${updated}</p>` : ''}<div class="prose">${inner}</div></div>`;

const VERIFY_RUNS = {};
const PAGES = {
  about() {
    const pay = !!S.cfg?.payments;
    return pageShell('About', 'Art you can use every day.', `
      <p class="big">Tweak’d is where artists put their work on things people actually use, and where anyone can order a bag, a mouse, a mug or a hoodie made by someone whose portfolio they can see first.</p>
      <p>Plenty of talented artists, especially students, have a portfolio and nowhere to sell it. And plenty of people would rather carry something drawn by a person than something from a catalogue. We wanted to connect the two directly, across campuses and across countries.</p>
      <h2>What you get</h2>
      <ul><li><b>A portfolio page.</b> Every artist gets an address like <span class="mono">/@yourname</span> with their showcase, story and campus. Artist accounts are approved by an admin.</li>
      <li><b>Custom orders.</b> Tell an artist what you own, share your inspiration, and get a quote before anything starts.</li>
      <li><b>Direct conversations.</b> Buyers message artists from their page. Replies arrive in real time.</li>
      <li><b>Simple orders and honest reviews.</b> Requests move from requested to delivered to completed, and only buyers who finished an order can review it.</li></ul>
      <h2>What we're upfront about</h2>
      <p>Tweak’d is new, and we'd rather tell you what it is today than promise things it isn't. Artists are independent people who created their own pages, and they make and ship the products themselves. We don't verify identities. ${pay ? 'Payments are taken through Stripe and held by Tweak’d until you approve the delivery, then paid out to the artist.' : "We don't take payments yet; buyers and artists agree payment directly, so be cautious about paying in full before work begins."}</p>
      <p>Everything you see on Tweak’d, from the number of artists to who's online right now, comes from real activity on the site as it happens.</p>
      <h2>Get involved</h2>
      <p>If you draw, paint, letter or design, <a class="ulink" href="#" data-act="sell">open your artist page</a>. If you want something made, <a class="ulink" href="/#gigs" data-scroll>browse the marketplace</a>. And if you have ideas for how we can do better, we'd love to hear them. ${contactLine().replace(/^./, c => c.toUpperCase())}.</p>`);
  },
  privacy() {
    return pageShell('Legal', 'Privacy policy', `
      <p class="big">We collect the minimum we need to run the marketplace, we never sell your data, and you can export or delete your account at any time.</p>
      <h2>1. Who we are</h2><p>This site is operated by ${company()}. If you have questions about this policy or your data, ${contactLine()}.</p>
      <h2>2. What we collect</h2>
      <ul><li><b>Account details:</b> your name and email address, and a securely hashed version of your password (we never store the password itself).</li>
      <li><b>Order requests:</b> the item you describe, notes, budget, links and inspiration pictures. Pictures are visible only to you, the artist you chose and admins.</li>
      <li><b>Artist page content:</b> if you open an artist page, the headline, bio, campus, country, city, languages, skills, website, listings and the images you upload. This content is public. Uploaded images are re-encoded in your browser, which removes camera metadata such as location.</li>
      <li><b>Payout details:</b> if you sell, you may tell us how to pay you (for example a UPI ID or PayPal email). Only the Tweak’d team can see it.</li>
      <li><b>Payments:</b> when online payment is on, card payments are handled entirely by Stripe on its own checkout page. We never see or store card numbers; we keep the order, amount and Stripe's payment reference.</li>
      <li><b>Messages:</b> the messages and service requests you send and receive. These are visible only to the people in the conversation.</li>
      <li><b>Orders and reviews:</b> the requests you make or receive and their status. A review you leave is public on the seller's page, shown with your first name and last initial.</li>
      <li><b>Security settings:</b> if you turn on two-step verification we store your authenticator secret in encrypted form and your recovery codes as one-way hashes. For each signed-in device we keep a short browser and system description and the sign-in time, so you can review and sign out your devices.</li>
      <li><b>Contact form:</b> your name, email and message if you write to us.</li>
      <li><b>Technical and security data:</b> your IP address is used in memory to prevent abuse (for example, rate limiting sign-in attempts). Security events such as failed sign-ins, password resets and account deletions may be written to our server logs together with an IP address or account ID, and are kept only as long as needed to protect the service.</li></ul>
      <h2>3. Cookies and local storage</h2>
      <p>We use one cookie, <span class="mono">sid</span> (or <span class="mono">__Host-sid</span> on HTTPS), which keeps you signed in. It is strictly necessary, HttpOnly, and expires after 14 days. We also store a few preferences in your browser's local storage (theme, currency, saved favourites and recently viewed services). These never leave your device.</p>
      <p>We do not use advertising cookies, analytics trackers or fingerprinting.</p>
      <h2>4. Third parties</h2>
      <ul><li><b>Stripe</b> processes card payments when online payment is turned on. It receives the amount, order description and your email address, and is subject to its own privacy policy.</li>
      <li><b>Fonts</b> are hosted on our own servers, so your browser doesn't contact Google or any other font provider.</li>
      <li><b>Email delivery:</b> when email is enabled we use a transactional email provider to send verification, password-reset and new-message emails. It receives your email address and name for that purpose only.</li>
      <li><b>Security check:</b> the check on sign-up and contact forms runs in your browser and on our own server. It uses no third-party service and sets no cookies.</li>
      <li><b>ExchangeRate-API:</b> our server fetches currency rates from this service. No user data is sent.</li>
      <li><b>Our hosting provider</b> processes data on our behalf to serve the site.</li></ul>
      <h2>Emails we send</h2>
      <p>We send emails only to confirm your address, reset your password if you ask, and (if you leave this on) to tell you about new messages when you're offline. Message emails never contain the message itself and can be switched off in Account settings.</p>
      <h2>5. How we use your data</h2>
      <p>To create and secure your account, show your artist page and listings, process orders and payments, deliver messages, respond to your questions, keep the site safe, and meet legal obligations. We do not sell your personal data or use it for advertising.</p>
      <h2>6. How long we keep it</h2>
      <p>We keep your data while your account is active. When you delete your account, your profile, listings, uploaded images and messages are removed immediately. Records of paid orders may be kept as long as the law requires for accounting. Routine backups may retain a copy for up to 14 days before being overwritten.</p>
      <h2>7. Your rights</h2>
      <p>You can download a copy of your data or delete your account yourself from <b>Account settings</b> (open your account menu after signing in). You can also update your details there. Depending on where you live you may have further rights, such as to object to or restrict processing, or to complain to your local data protection authority. To exercise any right, ${contactLine()}.</p>
      <h2>8. Security</h2>
      <p>Passwords are hashed with scrypt, sessions use secure HttpOnly cookies, and connections should be served over HTTPS. No system is perfectly secure, so please use a strong, unique password.</p>
      <h2>9. Children</h2><p>Tweak’d is not intended for anyone under 16, and we do not knowingly collect their data.</p>
      <h2>10. Changes</h2><p>If we make material changes we'll update the date below and, where appropriate, tell you on the site.</p>`, '24 November 2026');
  },
  terms() {
    return pageShell('Legal', 'Terms of service', `
      <p class="big">These terms are the agreement between you and ${company()} when you use Tweak’d. Please read them. By creating an account or using the site you agree to them.</p>
      <h2>1. Who can use Tweak’d</h2><p>You must be at least 16 and able to form a binding agreement. If you use Tweak’d for a business, you confirm you can bind that business.</p>
      <h2>2. Your account</h2><p>Keep your password secure and your details accurate. You are responsible for what happens under your account. Tell us promptly if you suspect unauthorised access.</p>
      <h2>3. What Tweak’d is, and isn't</h2>
      <p>Tweak’d is a platform where customers ask artists to customise their things. <b>The artist, not Tweak’d, makes and delivers each product.</b> Artists are independent, not our employees, agents or contractors. We do not verify the identity or qualifications of users or guarantee the quality or delivery of any product. ${S.cfg?.payments ? 'When a buyer pays online, Stripe takes the payment and Tweak’d holds it until the buyer approves the delivery, then pays the artist, minus a platform fee shown before checkout. If an order is not delivered, tell us promptly and we will decide in good faith whether to refund it.' : 'Online payment is not switched on, so buyers and artists arrange payment directly between themselves, at their own risk.'}</p>
      <h2>4. Artists</h2>
      <ul><li>Provide accurate information about yourself and your listings.</li><li>Only upload and sell artwork you created or have the right to use. Do not use other people's characters, logos, brands or photographs without permission.</li><li>You keep the copyright in your art. By accepting an order you allow the buyer to receive and use the finished product, and you allow us to show your work on the site.</li><li>Deliver what you agree with buyers, and handle your own taxes, licences and legal obligations.</li></ul>
      <h2>5. Buyers</h2>
      <ul><li>Look at the artist's portfolio and ask questions before agreeing to anything.</li><li>Custom products are made to order, so check what's included and the delivery time first.</li><li>Be clear about what you need and pay what you agree.</li><li>Be careful about paying in full before work begins, and never share card or banking details inside messages.</li></ul>
      <h2>6. Orders and reviews</h2><p>Requests, acceptance, delivery and approval on Tweak’d are a record of what the buyer and seller agreed between themselves. Reviews must be honest and based on a real order you completed. We may remove reviews that are fake, abusive, or off-topic. ${S.cfg?.payments ? 'Payment disputes are handled as described in section 3.' : 'Tweak’d does not hold or release payments, and does not decide disputes between buyers and artists.'}</p>
      <h2>7. Not allowed</h2>
      <ul><li>Illegal, fraudulent, deceptive or infringing content or services.</li><li>Harassment, hate, threats, adult content involving minors, or malware.</li><li>Spam, scraping, or attempts to disrupt, probe or bypass the security of the site.</li><li>Impersonating others, or creating accounts to evade a suspension.</li></ul>
      <h2>8. Your content</h2><p>You keep ownership of what you publish. You give us a non-exclusive, worldwide licence to host, display and distribute it on and in connection with Tweak’d so the service can work (for example, showing your artist page and portfolio to visitors).</p>
      <h2>9. Reporting and enforcement</h2><p>If you see something that breaks these terms, <a class="ulink" href="/contact" data-nav>tell us</a>. We may remove content, suspend or close accounts at our discretion, with or without notice, to protect the community or comply with the law.</p>
      <h2>10. Ending your account</h2><p>You can delete your account at any time from Account settings. Sections that by their nature should survive (such as disclaimers and limits of liability) will continue to apply.</p>
      <h2>11. Disclaimers</h2><p>Tweak’d is provided "as is" and "as available". To the fullest extent permitted by law we disclaim all warranties, including fitness for a particular purpose, and we do not warrant that the site will be uninterrupted or error-free.</p>
      <h2>12. Limit of liability</h2><p>To the fullest extent permitted by law, ${company()} is not liable for indirect, incidental or consequential losses, or for losses arising from dealings between users. Nothing in these terms limits liability that cannot be limited by law.</p>
      <h2>13. Changes</h2><p>We may update these terms. If changes are material we'll update the date below, and continued use means you accept the new terms.</p>
      <h2>14. Governing law and contact</h2><p>These terms are governed by the laws of the place where ${company()} is established, and the courts there have jurisdiction, unless mandatory consumer law says otherwise. Questions? ${contactLine().replace(/^./, c => c.toUpperCase())}.</p>`, '24 November 2026');
  },
  contact() {
    const rep = new URLSearchParams(location.search).get('report');
    return pageShell('Contact', 'Get in touch.', `
      <p class="big">${rep ? `You're reporting <b class="mono">/@${esc(rep)}</b>. Tell us what's wrong and we'll look into it.` : 'Questions, feedback, or something to report? Write to us and we will reply by email.'}</p>
      ${S.cfg?.contactEmail ? `<p>You can also email <a class="ulink" href="mailto:${esc(S.cfg.contactEmail)}">${esc(S.cfg.contactEmail)}</a>.</p>` : ''}
      <form class="contact-form" id="contactForm" novalidate>
        <div id="cErr"></div>
        <div class="row2"><label class="field"><span>Your name</span><input name="name" maxlength="60" autocomplete="name"></label><label class="field"><span>Email</span><input name="email" type="email" maxlength="120" autocomplete="email"></label></div>
        <label class="field"><span>Subject</span><input name="subject" maxlength="100" value="${rep ? 'Report: /@' + esc(rep) : ''}"></label>
        <label class="field"><span>Message</span><textarea name="message" rows="7" maxlength="3000" placeholder="How can we help?"></textarea></label>
        <input class="hp" name="company_site" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn-ink btn-lg" id="cGo">Send message</button>
      </form>`);
  },
  forgot() {
    if (S.cfg && !S.cfg.mail) return pageShell('Account', 'Forgot your password?', `<p class="big">Password reset by email isn't switched on for this site yet.</p><p>Please <a class="ulink" href="/contact" data-nav>contact us</a> from the email address on your account and we'll help you get back in.</p>`);
    return pageShell('Account', 'Forgot your password?', `<p class="big">Enter the email address you signed up with and we'll send you a link to choose a new password.</p>
      <form class="contact-form narrow-form" id="forgotForm" novalidate><div class="ferr"></div><label class="field"><span>Email</span><input name="email" type="email" maxlength="120" autocomplete="email"></label><button class="btn btn-ink btn-lg">Send reset link</button></form>`);
  },
  reset() {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (!token) return pageShell('Account', 'Reset link needed', `<p class="big">This page needs a reset link from your email.</p><p><a class="ulink" href="/forgot" data-nav>Request a new link</a></p>`);
    return pageShell('Account', 'Choose a new password.', `<p class="big">Pick something long and unique. You'll be signed out everywhere else.</p>
      <form class="contact-form narrow-form" id="resetForm" data-token="${esc(token)}" novalidate><div class="ferr"></div><label class="field"><span>New password</span><input name="password" type="password" autocomplete="new-password" maxlength="100"></label><div class="meter"><i></i><i></i><i></i><i></i></div><label class="field"><span>Confirm new password</span><input name="confirm" type="password" autocomplete="new-password" maxlength="100"></label><button class="btn btn-ink btn-lg">Update password</button></form>`);
  },
  verify() {
    const token = new URLSearchParams(location.search).get('token') || '';
    if (token) setTimeout(async () => {
      const out = $('#verifyOut'); if (!out) return; const j = await (VERIFY_RUNS[token] ||= call('POST', '/api/email/verify', { token })); // run once per token, even if the page re-renders
      out.innerHTML = j.error ? `<div class="sent-card"><span class="ti err">${ic('x')}</span><h3>Couldn't verify</h3><p>${esc(j.error)}</p><a class="btn btn-ink" href="/" data-nav>Go to Tweak’d</a></div>`
        : `<div class="sent-card"><span class="ti">${ic('check')}</span><h3>Email verified</h3><p>Thanks! You can now publish listings and send messages.</p><a class="btn btn-ink" href="/" data-nav>Continue to Tweak’d</a></div>`;
      if (!j.error) loadMe();
    }, 50);
    return pageShell('Account', 'Verifying your email…', token ? '<div id="verifyOut"><div class="sent-card"><span class="spinner"></span><p>One moment…</p></div></div>' : `<p class="big">This page needs a verification link from your email.</p>`);
  }
};

document.addEventListener('submit', async e => {
  const f = e.target, id = f.id; if (id !== 'forgotForm' && id !== 'resetForm') return; e.preventDefault();
  const err = m => { $('.ferr', f).innerHTML = m ? `<div class="form-err" role="alert">${esc(m)}</div>` : ''; }; err('');
  const b = $('button.btn', f), label = b.textContent; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Please wait';
  if (id === 'forgotForm') {
    const j = await callC('/api/password/forgot', { email: new FormData(f).get('email') }); b.disabled = false; b.textContent = label;
    if (j.error) return err(j.error);
    f.outerHTML = `<div class="sent-card"><span class="ti">${ic('mail')}</span><h3>Check your inbox</h3><p>If an account exists for that address, we've sent a reset link. It's valid for one hour.</p></div>`;
  } else {
    const fd = new FormData(f), pw = fd.get('password'); if (pw !== fd.get('confirm')) { b.disabled = false; b.textContent = label; return err("The two passwords don't match."); }
    const j = await call('POST', '/api/password/reset', { token: f.dataset.token, password: pw }); b.disabled = false; b.textContent = label;
    if (j.error) return err(j.error);
    f.outerHTML = `<div class="sent-card"><span class="ti">${ic('check')}</span><h3>Password updated</h3><p>You can now log in with your new password.</p><button class="btn btn-ink" id="loginAfterReset">Log in</button></div>`;
    $('#loginAfterReset').onclick = () => { go('/'); openAuth('login'); };
  }
});
document.addEventListener('input', e => {
  if (e.target.form?.id === 'resetForm' && e.target.name === 'password') {
    const v = e.target.value, sc = Math.min(4, (v.length >= 8) + (v.length >= 12) + (/[a-z]/.test(v) && /[A-Z]/.test(v)) + (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)));
    $$('.meter i', e.target.form).forEach((i, k) => i.className = k < sc ? 'on' + sc : '');
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'contactForm') return; e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), b = $('#cGo'); $('#cErr').innerHTML = '';
  b.disabled = true; b.innerHTML = '<span class="spinner"></span> Sending';
  const j = await callC('/api/contact', f);
  if (j.error) { b.disabled = false; b.textContent = 'Send message'; $('#cErr').innerHTML = `<div class="form-err" role="alert">${esc(j.error)}</div>`; return; }
  e.target.outerHTML = `<div class="sent-card"><span class="ti">${ic('check')}</span><h3>Message sent</h3><p>Thanks — we'll reply to the email you gave us as soon as we can.</p></div>`;
});
