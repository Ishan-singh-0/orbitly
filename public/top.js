// A reload starts at the top of the page. Back and forward inside the site still return you to where you were.
(() => {
  if (!('scrollRestoration' in history)) return;
  const reloaded = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  if (reloaded) {
    history.scrollRestoration = 'manual';
    // a leftover #section in the address would jump straight back down
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    scrollTo({ top: 0, behavior: 'instant' });
  }
  // asks the browser not to restore the position for the page being left, which is what a reload reads
  addEventListener('pagehide', () => { history.scrollRestoration = 'manual'; });
  addEventListener('load', () => setTimeout(() => { history.scrollRestoration = 'auto'; }, 0));
})();
