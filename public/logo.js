// The animated Tweak’d logo. The pages ship a plain <img> and wordmark; this swaps in an inline SVG so it can move:
// the tile pops in, the "t" is drawn stroke by stroke, a drop of paint lands as the apostrophe, then the colours drift.
// Styling and timing live in logo.css. Without JavaScript the static logo.svg stays.
(() => {
  let n = 0;
  const mark = () => {
    const id = 'tw' + (++n);
    return `<svg class="tw-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A2A"/><stop offset=".5" stop-color="#FF4F26"/><stop offset="1" stop-color="#D61F73"/></linearGradient>
        <radialGradient id="${id}y"><stop offset="0" stop-color="#FFE45C" stop-opacity=".95"/><stop offset="1" stop-color="#FFE45C" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}v"><stop offset="0" stop-color="#6A2BFF" stop-opacity=".9"/><stop offset="1" stop-color="#6A2BFF" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}p"><stop offset="0" stop-color="#FF2E9A" stop-opacity=".85"/><stop offset="1" stop-color="#FF2E9A" stop-opacity="0"/></radialGradient>
        <clipPath id="${id}c"><rect width="64" height="64" rx="19"/></clipPath>
      </defs>
      <g class="tw-tile">
        <g clip-path="url(#${id}c)">
          <rect width="64" height="64" fill="url(#${id}g)"/>
          <circle class="tw-blob a" cx="10" cy="8" r="30" fill="url(#${id}y)"/>
          <circle class="tw-blob b" cx="58" cy="60" r="34" fill="url(#${id}v)"/>
          <circle class="tw-blob c" cx="60" cy="14" r="22" fill="url(#${id}p)"/>
          <path class="tw-gleam" d="M-30 -10h14L4 74h-14z" fill="#fff" opacity=".28"/>
        </g>
        <rect x=".7" y=".7" width="62.6" height="62.6" rx="18.4" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="1.4"/>
        <g class="tw-t">
          <path class="tw-stem" pathLength="1" d="M24 15.5V39c0 7.4 5.4 11.6 12.2 10.2 2.6-.55 4.7-1.8 6.3-3.5"/>
          <g class="tw-slider"><path class="tw-bar" pathLength="1" d="M15 27h20.5"/></g>
        </g>
        <g class="tw-hop"><g class="tw-drop">
          <path d="M47.4 11.5c4 0 7 3 7 7.1 0 6.3-4.1 11.1-9.8 13.4-1 .4-1.800-.75-1.05-1.5 1.900-1.9 3-3.8 3.35-5.7-3.2-.5-5.5-3.15-5.5-6.45 0-3.9 2.6-6.85 6-6.85z" fill="#150D1F"/>
          <ellipse cx="44.8" cy="15.8" rx="1.5" ry="2.3" transform="rotate(35 44.8 15.8)" fill="#fff" opacity=".7"/>
        </g></g>
        <g class="tw-splash" fill="#150D1F"><circle cx="55.5" cy="34" r="1.9"/><circle cx="39.5" cy="34.5" r="1.3"/><circle cx="58" cy="26" r="1.1"/><circle cx="51" cy="39" r="1"/></g>
      </g>
    </svg>`;
  };
  const word = () => `<span class="tw-word" aria-hidden="true">${[...'tweak’d'].map((c, k) => `<span class="tw-l${c === '’' ? ' ap' : ''}" style="--k:${k}"><span>${c}</span></span>`).join('')}</span>`;
  document.querySelectorAll('.logo').forEach(el => {
    const img = el.querySelector('.logo-img'), text = el.querySelector('.word'); if (!img || !text) return;
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Tweak’d');
    img.outerHTML = mark(); text.outerHTML = word();
  });
})();
