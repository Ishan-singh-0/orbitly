// Small, restrained motion: sections fade up as they scroll into view, and the hero product leans toward the pointer.
// Everything here is cosmetic; with reduced motion or no IntersectionObserver the page simply shows everything.
(() => {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }
  const art = document.getElementById('heroArt');
  if (art && !calm && matchMedia('(hover: hover)').matches) {
    art.addEventListener('pointermove', e => {
      const r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      art.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg'); art.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
    });
    art.addEventListener('pointerleave', () => { art.style.setProperty('--ry', '0deg'); art.style.setProperty('--rx', '0deg'); });
  }
})();
