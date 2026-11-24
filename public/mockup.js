// Product mockups drawn as inline SVG, so the colour a buyer picks and the artwork they choose show up right away.
// Needs products.js loaded first. mockup(productId, colour, artUrl, opts) returns an <svg> string.
// The depth comes from an SVG lighting filter (soft diffuse + a small specular highlight) rather than hand-drawn gradients,
// so every product picks up the same believable light from the top left.

function shade(hex, amt) { // amt < 0 darkens, > 0 lightens
  const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round((t - v) * p + v));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
let mockN = 0;
const SAMPLE_PALETTES = [['#F6D55C', '#3CAEA3', '#ED553B', '#20639B', '#173F5F'], ['#FFD6A5', '#FF7B54', '#939B62', '#FFB26B', '#2B2D42'], ['#CDE7B0', '#7FB685', '#426A5A', '#EF6F6C', '#F4E9CD'], ['#BDB2FF', '#FFC6FF', '#9BF6FF', '#FDFFB6', '#3A2E6B']];
// a small abstract pattern as an SVG data URI, so previews have something on them before any artist has uploaded work
function sampleArt(seed) {
  let a = (seed + 1) * 2654435761 >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const pal = SAMPLE_PALETTES[seed % SAMPLE_PALETTES.length]; let g = `<rect width="200" height="200" fill="${pal[0]}"/>`;
  for (let i = 0; i < 9; i++) {
    const c = pal[1 + Math.floor(r() * 4)], x = Math.round(r() * 200), y = Math.round(r() * 200), s = 24 + Math.round(r() * 60), k = Math.floor(r() * 3);
    g += k === 0 ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}"/>` : k === 1 ? `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="${Math.round(r() * 12)}" fill="${c}" transform="rotate(${Math.round(r() * 60)} ${x} ${y})"/>` : `<path d="M${x} ${y - s / 2}L${x + s / 2} ${y + s / 2}L${x - s / 2} ${y + s / 2}Z" fill="${c}"/>`;
  }
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${g}</svg>`);
}

// c = product colour, d = a darker tone of it for seams and handles
const SHAPES = {
  tote: (c, d) => `<path d="M152 122C150 40 250 40 248 122" fill="none" stroke="${d}" stroke-width="12" stroke-linecap="round"/>
    <path d="M102 112 298 112 285 276 115 276Z" fill="${c}"/><path d="M102 112H298V130H102Z" fill="${d}" opacity=".28"/>
    <path d="M108 124H292" stroke="${d}" stroke-width="1.6" stroke-dasharray="5 4" opacity=".75"/><path d="M120 266H280" stroke="${d}" stroke-width="1.4" stroke-dasharray="5 4" opacity=".5"/>`,
  backpack: (c, d) => `<path d="M186 68C186 36 214 36 214 68" fill="none" stroke="${d}" stroke-width="10" stroke-linecap="round"/>
    <path d="M114 124C98 164 98 232 118 266" fill="none" stroke="${d}" stroke-width="15" stroke-linecap="round"/><path d="M286 124C302 164 302 232 282 266" fill="none" stroke="${d}" stroke-width="15" stroke-linecap="round"/>
    <rect x="120" y="58" width="160" height="218" rx="58" fill="${c}"/><path d="M128 112C170 124 230 124 272 112" fill="none" stroke="${d}" stroke-width="2" opacity=".6"/>
    <rect x="140" y="190" width="120" height="74" rx="20" fill="${d}" opacity=".4"/><path d="M146 208H254" stroke="${d}" stroke-width="3" stroke-linecap="round"/><rect x="246" y="202" width="8" height="14" rx="3" fill="${d}"/>`,
  sleeve: (c, d) => `<rect x="68" y="82" width="264" height="148" rx="16" fill="${c}"/><path d="M68 114H332" stroke="${d}" stroke-width="3" opacity=".8"/><path d="M92 98H300" stroke="${d}" stroke-width="2.4" stroke-dasharray="5 4" opacity=".65"/><rect x="294" y="90" width="14" height="22" rx="6" fill="${d}"/>`,
  mouse: (c, d) => `<path d="M200 52C144 52 122 104 122 162 122 230 156 268 200 268 244 268 278 230 278 162 278 104 256 52 200 52Z" fill="${c}"/>
    <path d="M200 52V140M124 144C148 156 252 156 276 144" fill="none" stroke="${d}" stroke-width="3" opacity=".8"/><rect x="192" y="84" width="16" height="36" rx="8" fill="${d}"/><rect x="195" y="90" width="10" height="12" rx="5" fill="#fff" opacity=".35"/>`,
  mousepad: (c, d) => `<rect x="58" y="96" width="284" height="134" rx="18" fill="${c}"/><rect x="66" y="104" width="268" height="118" rx="12" fill="none" stroke="${d}" stroke-width="2" stroke-dasharray="6 5" opacity=".6"/>`,
  case: (c, d) => `<rect x="142" y="36" width="116" height="232" rx="30" fill="${c}"/><rect x="154" y="48" width="50" height="50" rx="14" fill="#14151a" opacity=".82"/><circle cx="170" cy="64" r="9" fill="#2a2d36"/><circle cx="170" cy="64" r="4" fill="#6c7285"/><circle cx="190" cy="84" r="9" fill="#2a2d36"/><circle cx="190" cy="84" r="4" fill="#6c7285"/><rect x="142" y="36" width="116" height="232" rx="30" fill="none" stroke="${d}" stroke-width="3" opacity=".45"/>`,
  tee: (c, d) => `<path d="M136 56 90 82 52 152 96 176 118 144V268H282V144L304 176 348 152 310 82 264 56C250 86 150 86 136 56Z" fill="${c}"/><path d="M150 56C168 92 232 92 250 56" fill="none" stroke="${d}" stroke-width="6" opacity=".9"/><path d="M118 144 112 150M282 144 288 150" stroke="${d}" stroke-width="2" opacity=".5"/><path d="M120 262H280" stroke="${d}" stroke-width="1.4" stroke-dasharray="5 4" opacity=".5"/>`,
  hoodie: (c, d) => `<path d="M130 78 78 100 42 220 88 236 118 158V268H282V158L312 236 358 220 322 100 270 78Z" fill="${c}"/>
    <path d="M146 80C140 30 260 30 254 80 242 108 158 108 146 80Z" fill="${d}" opacity=".7"/><path d="M178 100V136M222 100V136" stroke="${d}" stroke-width="4" stroke-linecap="round"/><circle cx="178" cy="138" r="3.4" fill="${d}"/><circle cx="222" cy="138" r="3.4" fill="${d}"/>
    <path d="M146 214H254L270 262H130Z" fill="${d}" opacity=".32"/><path d="M118 250H282" stroke="${d}" stroke-width="3" opacity=".5"/>`,
  mug: (c, d) => `<path d="M248 114C310 106 310 208 246 202" fill="none" stroke="${c}" stroke-width="18"/><path d="M248 114C310 106 310 208 246 202" fill="none" stroke="#000" stroke-width="18" opacity=".1"/>
    <path d="M104 84H252V224C252 240 240 250 224 250H132C116 250 104 240 104 224Z" fill="${c}"/><ellipse cx="178" cy="84" rx="74" ry="11" fill="${d}" opacity=".55"/><ellipse cx="178" cy="85" rx="64" ry="8" fill="#000" opacity=".18"/>`,
  bottle: (c, d) => `<rect x="170" y="36" width="60" height="32" rx="10" fill="${d}"/><rect x="180" y="62" width="40" height="40" fill="${c}"/><rect x="154" y="90" width="92" height="184" rx="28" fill="${c}"/><rect x="170" y="38" width="60" height="8" rx="4" fill="#fff" opacity=".25"/>`,
  notebook: (c, d) => `<rect x="116" y="46" width="180" height="228" rx="10" fill="${c}"/><rect x="116" y="46" width="20" height="228" rx="6" fill="${d}" opacity=".55"/><rect x="266" y="46" width="9" height="228" fill="${d}" opacity=".6"/><path d="M140 50V270" stroke="#000" stroke-width="1.5" opacity=".18"/>`,
  poster: (c, d) => `<rect x="116" y="40" width="168" height="220" fill="${c}"/><rect x="116" y="40" width="168" height="220" fill="none" stroke="${d}" stroke-width="2" opacity=".6"/><rect x="132" y="56" width="136" height="188" fill="#F6F4EF"/><rect x="132" y="56" width="136" height="6" fill="#000" opacity=".1"/>`
};

function mockup(productId, colour, artUrl, opts = {}) {
  const p = PRODUCTS.find(x => x.id === productId); if (!p) return '';
  const c = colour || p.colors[0][1], d = shade(c, -0.3), [x, y, w, h] = p.area, id = 'mk' + (++mockN);
  const art = artUrl
    ? `<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/></clipPath><g clip-path="url(#${id}c)"><image href="${artUrl}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}s)"/></g>`
    : opts.placeholder ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${shade(c, c === '#F4F3EF' ? -0.4 : 0.45)}" stroke-width="1.5" stroke-dasharray="4 4"/>` : '';
  return `<svg class="mock" viewBox="0 10 400 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(p.name)} preview">
    <defs>
      <filter id="${id}f" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="b"/>
        <feDiffuseLighting in="b" surfaceScale="3.2" diffuseConstant="1.1" lighting-color="#fff" result="dl"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
        <feSpecularLighting in="b" surfaceScale="3.2" specularConstant=".55" specularExponent="22" lighting-color="#fff" result="sl"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting>
        <feComposite in="sl" in2="SourceAlpha" operator="in" result="sp"/>
        <feComposite in="SourceGraphic" in2="dl" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="lit"/>
        <feComposite in="lit" in2="sp" operator="arithmetic" k1="0" k2="1" k3=".45" k4="0"/>
      </filter>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
      <filter id="${id}b" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect x="-400" y="-100" width="1200" height="600" fill="${opts.bg || 'transparent'}"/>
    <ellipse cx="200" cy="280" rx="120" ry="9" fill="#000" opacity=".28" filter="url(#${id}b)"/>
    <g filter="url(#${id}f)">${SHAPES[p.id](c, d)}</g>${art}</svg>`;
}
