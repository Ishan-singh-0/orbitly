// A short guided tour for new visitors: a spotlight moves from part to part with a plain explanation of each.
// It is offered once (remembered in this browser) and can be replayed from the menu, the footer or the help assistant.

const TOUR_STEPS = [
  ['.logo', 'Welcome to Tweak’d', 'Here you get your own things customised by artists. This tour takes under a minute. The logo always brings you home.'],
  ['.hero-cta [data-act="request"]', 'Start an order', 'Press this, pick what you own, add your inspiration pictures and notes, and send it to an artist.'],
  ['#heroArt', 'Preview ideas', 'This rotates through products. Tap a product or a colour to try it, then “Customise mine”.'],
  ['#cats .sec-head', 'Pick your thing', 'Scroll here to choose a product. If yours isn’t listed, choose “Something else”.'],
  ['#gallery .sec-head', 'See the artists’ work', 'A showcase of real pieces. Like a style? Order in that style, or open the artist’s page.'],
  ['#how .how-head', 'How an order goes', 'You send a request, the artist replies with a quote, and work starts only when you accept it.'],
  ['#sellers .sec-head', 'Meet the artists', 'Open any page to see their showcase. Want to join? Apply to be an artist and an admin reviews it.'],
  ['#avWrap, #signupBtn', 'Your account', 'Sign up here. After that, this menu holds your Orders, Messages and settings.'],
  ['#botFab', 'Stuck? Ask', 'The helper answers questions about ordering, payments and your account, and can replay this tour.']
];

const TOUR = { i: 0, steps: [], root: null };
const tourVisible = el => el && !el.hidden && el.getClientRects().length > 0;
const tourTarget = sel => sel.split(',').map(s => document.querySelector(s.trim())).find(tourVisible);

function startTour() {
  endTour(false); $('#tourOffer')?.remove();
  if (typeof closeDyn === 'function') closeDyn(); closeCmd(); toggleChat(false); document.body.classList.remove('menu-open');
  if (location.pathname !== '/') { history.pushState({}, '', '/'); showHome(); }
  TOUR.steps = TOUR_STEPS.filter(s => tourTarget(s[0])); TOUR.i = 0;
  const root = document.createElement('div'); root.className = 'tour'; root.id = 'tour';
  root.innerHTML = '<div class="tour-hole" aria-hidden="true"></div><div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle"><small></small><h3 id="tourTitle"></h3><p></p><div class="tour-dots" aria-hidden="true"></div><div class="tour-btns"><button type="button" class="tour-skip">Skip</button><span></span><button type="button" class="btn btn-line btn-sm tour-back">Back</button><button type="button" class="btn btn-pop btn-sm tour-next">Next</button></div></div>';
  document.body.appendChild(root); TOUR.root = root; document.body.classList.add('touring');
  root.addEventListener('click', e => {
    e.stopPropagation();
    if (e.target.closest('.tour-next')) return TOUR.i + 1 < TOUR.steps.length ? showStep(TOUR.i + 1) : endTour(true);
    if (e.target.closest('.tour-back')) return showStep(Math.max(0, TOUR.i - 1));
    if (e.target.closest('.tour-skip')) endTour(true);
  });
  showStep(0);
}
function showStep(i) {
  TOUR.i = i; const [sel, title, text] = TOUR.steps[i], el = tourTarget(sel), root = TOUR.root;
  if (!el) return endTour(true);
  root.querySelector('small').textContent = `Step ${i + 1} of ${TOUR.steps.length}`;
  root.querySelector('h3').textContent = title; root.querySelector('p').textContent = text;
  root.querySelector('.tour-dots').innerHTML = TOUR.steps.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('');
  root.querySelector('.tour-back').hidden = !i; root.querySelector('.tour-next').textContent = i + 1 === TOUR.steps.length ? 'Finish' : 'Next';
  // make sure the part being explained is on screen (fixed items such as the header need no scrolling)
  const pinned = el.closest('.nav, .bot');
  if (!pinned) {
    const r = el.getBoundingClientRect(), phone = innerWidth < 700, top = scrollY + r.top - (phone ? 90 : Math.max(90, (innerHeight - Math.min(r.height, innerHeight * .6)) / 2));
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  }
  el.classList.add('seen'); el.querySelectorAll('.wd, .pop-in').forEach(n => n.closest('.by-word')?.classList.add('seen'));
  placeTour(); setTimeout(placeTour, 350); setTimeout(placeTour, 900);
  root.querySelector('.tour-next').focus({ preventScroll: true });
}
function placeTour() {
  const root = TOUR.root; if (!root) return;
  const el = tourTarget(TOUR.steps[TOUR.i][0]); if (!el) return;
  const r = el.getBoundingClientRect(), pad = 8, hole = root.querySelector('.tour-hole'), card = root.querySelector('.tour-card');
  const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(innerWidth - x - 4, r.width + pad * 2), h = Math.min(innerHeight - y - 4, r.height + pad * 2);
  Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  if (innerWidth < 700) { // phones: the card sits at whichever end is further from the highlighted part
    const lower = y + h / 2 < innerHeight / 2;
    Object.assign(card.style, { left: '12px', right: '12px', width: 'auto', top: lower ? 'auto' : '12px', bottom: lower ? '12px' : 'auto' });
    return;
  }
  const cw = 340, ch = card.offsetHeight, below = y + h + 14 + ch < innerHeight, above = y - ch - 14 > 0;
  const top = below ? y + h + 14 : above ? y - ch - 14 : Math.max(12, innerHeight - ch - 12);
  const left = below || above ? Math.min(Math.max(12, x), innerWidth - cw - 12) : x + w + 14 + cw < innerWidth ? x + w + 14 : Math.max(12, x - cw - 14);
  Object.assign(card.style, { width: cw + 'px', left: left + 'px', right: 'auto', top: top + 'px', bottom: 'auto' });
}
function endTour(done) {
  TOUR.root?.remove(); TOUR.root = null; document.body.classList.remove('touring');
  if (done) { store.set('toured', true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}
addEventListener('resize', placeTour); addEventListener('scroll', placeTour, { passive: true });
addEventListener('keydown', e => {
  if (!TOUR.root) return;
  if (e.key === 'Escape') endTour(true);
  if (e.key === 'ArrowRight') TOUR.root.querySelector('.tour-next').click();
  if (e.key === 'ArrowLeft' && TOUR.i) showStep(TOUR.i - 1);
});
document.addEventListener('click', e => { if (e.target.closest('[data-tour]')) { e.preventDefault(); startTour(); } });

// offer the tour to first-time visitors, once the welcome curtain is gone
function offerTour() {
  if (store.get('toured', false) || location.pathname !== '/' || TOUR.root) return;
  if (document.getElementById('welcome')) return setTimeout(offerTour, 600);
  const box = document.createElement('div'); box.className = 'tour-offer'; box.id = 'tourOffer';
  box.innerHTML = '<div><b>New here?</b><small>Take a one-minute tour of the site.</small></div><button type="button" class="btn btn-pop btn-sm" data-tour>Show me</button><button type="button" class="tour-no" aria-label="No thanks">' + ic('x') + '</button>';
  document.body.appendChild(box);
  box.querySelector('.tour-no').onclick = () => { store.set('toured', true); box.remove(); };
}
setTimeout(offerTour, 3800);
