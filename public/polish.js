// Polish layer: scroll-linked and pointer-linked motion. All decoration; skipped entirely with "reduce motion" on.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const one = s => document.querySelector(s), all = s => [...document.querySelectorAll(s)];
  const hover = matchMedia('(hover: hover)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const bar = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'scroll-bar' }));
  bar.setAttribute('aria-hidden', 'true');

  // ---- header pill: follows the pointer, otherwise rests on the section being read
  const links = one('#navLinks'), pill = document.createElement('span');
  let current = null, pointed = null;
  pill.className = 'nav-pill'; pill.setAttribute('aria-hidden', 'true'); links?.appendChild(pill);
  const placePill = () => {
    const t = pointed || current;
    pill.classList.toggle('on', !!t);
    if (t) { pill.style.width = t.offsetWidth + 'px'; pill.style.height = t.offsetHeight + 'px'; pill.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`; }
  };
  links?.addEventListener('pointerover', e => { const t = e.target.closest('a, button'); if (t) { pointed = t; placePill(); } });
  links?.addEventListener('pointerleave', () => { pointed = null; placePill(); });

  // ---- everything that depends on scroll position, once per frame
  const hero = one('.hero'), steps = one('.steps');
  let queued = false;
  const frame = () => {
    queued = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    const home = !one('#homeView').hidden;
    if (home && hero && y < 1400) hero.style.setProperty('--hp', Math.round(y));
    if (home && steps) {
      const r = steps.getBoundingClientRect(), p = clamp((innerHeight * .72 - r.top) / r.height, 0, 1);
      steps.style.setProperty('--p', p.toFixed(3));
      for (const li of steps.children) li.classList.toggle('lit', li.getBoundingClientRect().top < innerHeight * .72);
    }
    const banner = one('#profileView:not([hidden]) .pf-banner');
    if (banner && y < 600) banner.style.setProperty('--bp', Math.round(y));
    let found = null;
    if (home) for (const a of all('#navLinks a[data-scroll]')) {
      const sec = one('#' + a.getAttribute('href').split('#')[1]);
      if (sec) { const r = sec.getBoundingClientRect(); if (r.top < innerHeight * .45 && r.bottom > innerHeight * .45) found = a; }
    }
    if (found !== current) { current = found; placePill(); }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };

  // ---- the scrolling word bands speed up while the page is moving, then ease back
  let lastY = scrollY, speed = 1, easing = false;
  const bands = () => all('.marquee-in').flatMap(el => el.getAnimations());
  const settle = () => {
    speed += (1 - speed) * .06;
    if (Math.abs(speed - 1) < .03) { speed = 1; easing = false; }
    bands().forEach(a => a.updatePlaybackRate(speed));
    if (easing) requestAnimationFrame(settle);
  };
  addEventListener('scroll', () => {
    speed = Math.max(speed, 1 + Math.min(Math.abs(scrollY - lastY) / 14, 4)); lastY = scrollY;
    if (!easing) { easing = true; requestAnimationFrame(settle); }
    queue();
  }, { passive: true });
  addEventListener('resize', () => { queue(); placePill(); }, { passive: true });

  // ---- light under the pointer on cards
  if (hover) document.addEventListener('pointermove', e => {
    const c = e.target.closest?.('.prod, .s-card'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });

  // ---- new content: blur images in as they load
  const dress = root => {
    root.querySelectorAll('.shot-img img, .work img').forEach(img => {
      if (img.dataset.pl) return; img.dataset.pl = '1';
      if (img.complete) return;
      img.classList.add('img-wait');
      const done = () => img.classList.remove('img-wait');
      img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
    });
  };
  const views = ['#homeView', '#profileView', '#pageView'].map(one).filter(Boolean);
  const watcher = new MutationObserver(list => {
    for (const m of list) {
      // moving between pages: the incoming page rises into place
      if (m.type === 'attributes') { if (m.target.hidden === false && m.oldValue !== null) m.target.animate([{ opacity: 0, translate: '0 22px' }, { opacity: 1, translate: '0 0' }], { duration: 480, easing: 'cubic-bezier(.2,.7,.2,1)' }); }
      else dress(m.target);
    }
    queue();
  });
  views.forEach(v => { watcher.observe(v, { childList: true, subtree: true }); watcher.observe(v, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true }); dress(v); });

  const word = one('.foot-word');
  if (word && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => word.classList.toggle('lit', e.isIntersecting), { threshold: .35 }).observe(word);

  frame();
})();
