// Tidies up the welcome curtain (see welcome.css): releases the page when it starts to open, removes it afterwards,
// and lets a click, key press or the Skip button jump straight to the opening.
(() => {
  const w = document.getElementById('welcome'); if (!w) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OPEN = calm ? 900 : 2450, DONE = calm ? 1350 : 3550;
  let timers = [];
  const done = () => { w.remove(); removeEventListener('keydown', skip); };
  const schedule = (open, end) => { timers.forEach(clearTimeout); timers = [setTimeout(() => w.classList.add('opening'), open), setTimeout(done, end)]; };
  function skip() {
    if (w.classList.contains('opening')) return;
    w.getAnimations({ subtree: true }).forEach(a => { if (a.effect.getTiming().iterations !== Infinity && a.currentTime < 2300) a.currentTime = 2300; });
    schedule(150, 1250);
  }
  schedule(OPEN, DONE);
  w.addEventListener('click', skip); addEventListener('keydown', skip);
})();
