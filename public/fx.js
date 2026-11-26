// Motion across the site. All of it is decoration: with "reduce motion" on, none of it runs and everything is simply visible.

const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let fxScan = () => {}, confetti = () => {};

if (!CALM) {
  const root = document.documentElement; root.classList.add('fx');

  // elements fly in as they scroll into view, one after another within a group
  const io = new IntersectionObserver(list => list.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); if (e.target.matches('#liveStrip')) countUp(); } }), { threshold: .12 });
  const TARGETS = '.prod, .shot, .s-card, .campus, .work, .qa, .cta-list li, .pf-sec, .foot-top > div, #liveStrip';
  fxScan = () => document.querySelectorAll(TARGETS).forEach((el, i) => { if (el.dataset.fx) return; el.dataset.fx = '1'; if (!el.style.getPropertyValue('--i')) el.style.setProperty('--i', i % 8); el.classList.add('pop-in'); io.observe(el); });

  function countUp() {
    document.querySelectorAll('#liveStrip [data-count]').forEach(b => {
      const end = +b.dataset.count, t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / 900); b.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString(); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  // headings rise word by word
  document.querySelectorAll('.sec-head h2, .how-head h2, .faq-grid h2').forEach(h => {
    let n = 0; const wrap = node => {
      if (node.nodeType === 3) { const f = document.createDocumentFragment(); node.textContent.split(/(\s+)/).forEach(w => { if (!w.trim()) return f.append(w); const s = document.createElement('span'); s.className = 'wd'; s.style.setProperty('--w', n++); s.textContent = w; f.append(s); }); node.replaceWith(f); }
      else [...node.childNodes].forEach(wrap);
    };
    wrap(h); h.classList.add('split'); io.observe(h);
  });

  // paint blobs drifting behind the hero, moving at different speeds as you scroll
  const hero = document.querySelector('.hero');
  if (hero) hero.insertAdjacentHTML('afterbegin', `<div class="blobs" aria-hidden="true">${['#FF5757', '#FAE05A', '#8C7BFF', '#5FD3B3', '#FF9A3C'].map((c, i) => `<i style="--c:${c};--n:${i}"></i>`).join('')}</div>`);
  let ticking = false;
  addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { root.style.setProperty('--sy', Math.min(scrollY, 1400)); ticking = false; }); }, { passive: true });

  if (matchMedia('(hover: hover)').matches) {
    // a soft dot trails the pointer and grows over anything clickable
    const dot = document.createElement('div'); dot.className = 'trail'; document.body.appendChild(dot);
    let x = -100, y = -100, cx = -100, cy = -100, running = false;
    const move = () => { cx += (x - cx) * .18; cy += (y - cy) * .18; dot.style.transform = `translate(${cx}px, ${cy}px)`; if (Math.abs(x - cx) + Math.abs(y - cy) > .3) requestAnimationFrame(move); else running = false; };
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; dot.classList.toggle('big', !!e.target.closest('a, button, label, .prod, .shot')); if (!running) { running = true; requestAnimationFrame(move); } }, { passive: true });

    // buttons lean toward the pointer, cards tilt under it
    document.addEventListener('pointermove', e => {
      const m = e.target.closest('.magnet'); if (m) { const r = m.getBoundingClientRect(); m.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .3}px`; }
      const t = e.target.closest('.shot, .s-card'); if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--tx', ((e.clientY - r.top) / r.height - .5) * -7 + 'deg'); t.style.setProperty('--ty', ((e.clientX - r.left) / r.width - .5) * 9 + 'deg'); }
    }, { passive: true });
    document.addEventListener('pointerout', e => { const m = e.target.closest('.magnet, .shot, .s-card'); if (m && !m.contains(e.relatedTarget)) { m.style.translate = ''; m.style.removeProperty('--tx'); m.style.removeProperty('--ty'); } });
  }

  // ripple on every button press
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .chip, .demo-btn'); if (!b) return;
    const r = b.getBoundingClientRect(), s = document.createElement('span'); s.className = 'ripple';
    s.style.left = e.clientX - r.left + 'px'; s.style.top = e.clientY - r.top + 'px'; b.appendChild(s); setTimeout(() => s.remove(), 650);
  });

  // paint splash when an order is sent
  confetti = () => {
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = Array.from({ length: 80 }, (_, i) => `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--y:${Math.random().toFixed(2)};--r:${Math.round(Math.random() * 720)}deg;--d:${(Math.random() * .25).toFixed(2)}s;--c:${['#FF5757', '#FAE05A', '#8C7BFF', '#5FD3B3', '#FF9A3C'][i % 5]}"></i>`).join('');
    document.body.appendChild(box); setTimeout(() => box.remove(), 2400);
  };

  new MutationObserver(() => fxScan()).observe(document.getElementById('sellerRow'), { childList: true });
  new MutationObserver(() => fxScan()).observe(document.getElementById('campusRow'), { childList: true });
  fxScan();
}
