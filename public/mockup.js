// Product mockups drawn as inline SVG. The artwork covers the whole product, because artists can customise all of it.
// Needs products.js loaded first. mockup(productId, colour, artUrl) returns an <svg> string.
// Each product has: `under` (drawn behind), `body` (the full paintable surface, also the clip for the artwork) and
// `over` (seams, hardware and soles drawn on top). One lighting filter then shades fabric and paint together.

function shade(hex, amt) { // amt < 0 darkens, > 0 lightens
  const n = parseInt(hex.slice(1), 16), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round((t - v) * p + v));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
let mockN = 0;

/* ---------- sample designs: painted-looking artwork on a clear background, so the product colour shows through ---------- */
const DESIGN_NAMES = ['Dragon', 'Florals', 'Doodle', 'Waves', 'Lettering', 'Galaxy', 'Shapes', 'Flames'];
const designCache = new Map();
function sampleArt(seed) {
  const key = seed % 40; if (designCache.has(key)) return designCache.get(key);
  let a = (key + 11) * 2654435761 >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const n = v => Math.round(v), pick = list => list[Math.floor(r() * list.length)];
  const kind = key % 8; let g = '';
  if (kind === 0) { // a serpent with scales and spines
    const c = pick(['#D7262E', '#E8B22B', '#19A7A0']), S = 'M262 30C150 40 100 90 150 135S300 190 250 245 110 270 130 330 220 372 300 360';
    g = `<g fill="none" stroke-linecap="round"><path d="${S}" stroke="${c}" stroke-width="46" opacity=".96"/><path d="${S}" stroke="#fff" stroke-opacity=".45" stroke-width="30" stroke-dasharray="3 11"/><path d="${S}" stroke="#14070a" stroke-opacity=".55" stroke-width="52" stroke-dasharray="2 17"/><path d="${S}" stroke="${c}" stroke-width="38"/><path d="${S}" stroke="#fff" stroke-opacity=".5" stroke-width="20" stroke-dasharray="1.5 9"/></g>
      <path d="M248 10l46 6 34 24-30 2 26 22-40-4-20 20-24-26-30-4 26-14-18-20z" fill="${c}"/><circle cx="284" cy="34" r="5" fill="#FFF3C4"/><path d="M318 52q34 4 52 30M312 62q16 26 8 48" stroke="${c}" stroke-width="5" fill="none"/>`;
  } else if (kind === 1) { // embroidered-style flowers
    const petals = ['#C77BA8', '#8FA9D8', '#E9C6D3', '#F2B66D', '#B8577F'], leaves = ['#7E9B6B', '#A7B58A', '#5F7F5C'];
    for (let i = 0; i < 26; i++) { const x = n(r() * 400), y = n(r() * 400), s = 10 + r() * 20, c = pick(petals), rot = n(r() * 360);
      g += `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0q${n(s * 1.4)} ${n(-s * .9)} ${n(s * 2.4)} 0q${n(-s)} ${n(s * .9)} ${n(-s * 2.4)} 0z" fill="${pick(leaves)}" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 2"/>`;
      for (let p = 0; p < 6; p++) g += `<ellipse cx="0" cy="${n(-s * .62)}" rx="${n(s * .32)}" ry="${n(s * .62)}" fill="${c}" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" stroke-dasharray="2 2" transform="rotate(${p * 60})"/>`;
      g += `<circle r="${n(s * .3)}" fill="#F6E3B0" stroke="#A9823F" stroke-width="1.5" stroke-dasharray="1.5 1.5"/></g>`; }
  } else if (kind === 2) { // dense ink doodles
    const ink = '#F8F4EA'; // light ink with a dark edge reads on any product colour
    for (let y = 20; y < 400; y += 44) for (let x = 20; x < 400; x += 44) { const k = Math.floor(r() * 7), s = 14 + r() * 8, rot = n(r() * 360);
      const shape = [`<circle r="${n(s)}"/><circle r="${n(s * .5)}"/>`, `<path d="M${-s} ${s}L0 ${-s}L${s} ${s}Z"/><path d="M${-s / 2} ${s / 2}h${s}"/>`, `<path d="M${-s} 0q${s / 2} ${-s} ${s} 0t${s} 0"/><path d="M${-s} 8q${s / 2} ${-s} ${s} 0t${s} 0"/>`, `<rect x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" rx="3"/><path d="M${-s} ${-s}L${s} ${s}M${-s / 3} ${-s}v${s * 2}"/>`, `<path d="M0 0q8 0 6 8t-14 6q-12-6-4-18t24-6q16 10 6 28"/>`, `<path d="M0 ${-s}l5 ${s * .7}h${s * .8}l${-s * .7} ${s * .5}l4 ${s * .8}l${-s * .6} ${-s * .5}l${-s * .6} ${s * .5}l4 ${-s * .8}l${-s * .7} ${-s * .5}h${s * .8}z"/>`, `<ellipse rx="${n(s)}" ry="${n(s * .55)}"/><circle r="4" fill="${ink}"/>`][k];
      const at = `translate(${n(x + r() * 12)} ${n(y + r() * 12)}) rotate(${rot})`; for (const [col, width] of [['#17131F', 5.6], [ink, 2.4]]) g += `<g transform="${at}" fill="none" stroke="${col}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${shape}</g>`; }
  } else if (kind === 3) { // layered waves
    const pal = pick([['#0B3A66', '#1D8FE8', '#8CCBF5', '#F4F9FF'], ['#5A189A', '#E0559B', '#FFB35C', '#FFE8C2'], ['#0F4D2C', '#1FB864', '#A9E8B8', '#F4FFF4']]);
    for (let i = 0; i < 12; i++) { const y = 20 + i * 34; g += `<path d="M-20 ${y}C60 ${y - 46} 120 ${y + 40} 200 ${y}S340 ${y - 40} 420 ${y}" fill="none" stroke="${pal[i % 4]}" stroke-width="${12 + n(r() * 10)}" stroke-linecap="round" opacity=".95"/>`; }
  } else if (kind === 4) { // chrome-style lettering and chains
    const ink = '#E9ECF2', words = ['TWEAKD', 'ORIGINAL', 'ONE OF ONE', 'HANDMADE', 'NO COPIES'];
    for (let i = 0; i < 7; i++) { const y = 36 + i * 56; g += `<text x="${n(r() * 90)}" y="${y}" transform="rotate(${n(r() * 24 - 12)} 200 ${y})" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="${26 + n(r() * 30)}" fill="none" stroke="${ink}" stroke-width="2">${words[(i + key) % words.length]}</text>`; }
    for (let i = 0; i < 12; i++) g += `<ellipse cx="${30 + i * 31}" cy="${n(200 + Math.sin(i) * 60)}" rx="19" ry="9" fill="none" stroke="${ink}" stroke-width="4" transform="rotate(${i % 2 ? 40 : -10} ${30 + i * 31} ${n(200 + Math.sin(i) * 60)})"/>`;
  } else if (kind === 5) { // night sky
    g = `<defs><radialGradient id="a"><stop offset="0" stop-color="#B45CFF" stop-opacity=".95"/><stop offset="1" stop-color="#B45CFF" stop-opacity="0"/></radialGradient><radialGradient id="b"><stop offset="0" stop-color="#2FD6E8" stop-opacity=".9"/><stop offset="1" stop-color="#2FD6E8" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="#141034"/><circle cx="120" cy="130" r="170" fill="url(#a)"/><circle cx="300" cy="270" r="160" fill="url(#b)"/>`;
    for (let i = 0; i < 130; i++) g += `<circle cx="${n(r() * 400)}" cy="${n(r() * 400)}" r="${(r() * 2.2 + .4).toFixed(1)}" fill="#fff" opacity="${(.4 + r() * .6).toFixed(2)}"/>`;
    g += `<circle cx="270" cy="110" r="42" fill="#FFD98A"/><ellipse cx="270" cy="110" rx="74" ry="14" fill="none" stroke="#FF9A6B" stroke-width="6" transform="rotate(-18 270 110)"/>`;
  } else if (kind === 6) { // bold shapes
    const pal = pick([['#FF5757', '#FAE05A', '#5B45D8', '#17A86B'], ['#ED553B', '#F6D55C', '#3CAEA3', '#20639B']]);
    for (let i = 0; i < 40; i++) { const x = n(r() * 400), y = n(r() * 400), s = 22 + n(r() * 46), c = pick(pal), k = Math.floor(r() * 3);
      g += k === 0 ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}"/>` : k === 1 ? `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" rx="8" fill="${c}" transform="rotate(${n(r() * 60)} ${x} ${y})"/>` : `<path d="M${x} ${y - s / 2}L${x + s / 2} ${y + s / 2}H${x - s / 2}Z" fill="${c}"/>`; }
  } else { // flames licking up from the bottom
    for (const [c, h] of [['#C81E2B', 250], ['#FF6A1A', 190], ['#FFC22E', 120]]) { let d = 'M-10 410'; for (let x = -10; x <= 410; x += 46) d += `C${x + 4} ${n(400 - h * (.5 + r() * .3))} ${x + 44} ${n(400 - h * (.4 + r() * .4))} ${x + 22} ${n(400 - h * (.9 + r() * .45))}C${x + 60} ${n(400 - h * .7)} ${x + 20} ${n(400 - h * .3)} ${x + 46} ${n(400 - h * .2)}`; g += `<path d="${d}L420 410Z" fill="${c}"/>`; }
  }
  const url = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${g}</svg>`);
  designCache.set(key, url); return url;
}

/* ---------- the products ---------- */
const seam = (path, d, w = 1.8, op = .75) => `<path d="${path}" fill="none" stroke="${d}" stroke-width="${w}" stroke-dasharray="5 4" opacity="${op}"/>`;
const strap = (path, c, w) => `<path d="${path}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;

const SHAPES = {
  tote: (c, d) => ({ under: strap('M152 122C150 40 250 40 248 122', d, 12), body: 'M102 112 298 112 285 276 115 276Z',
    over: `<path d="M102 112H298V130H102Z" fill="#000" opacity=".14"/>${seam('M108 124H292', d)}${seam('M120 266H280', d, 1.4, .5)}` }),
  backpack: (c, d) => ({ under: `${strap('M186 68C186 36 214 36 214 68', d, 10)}${strap('M114 124C98 164 98 232 118 266', d, 15)}${strap('M286 124C302 164 302 232 282 266', d, 15)}`,
    body: 'M178 58H222C256 58 280 84 280 118V250C280 266 268 276 252 276H148C132 276 120 266 120 250V118C120 84 144 58 178 58Z',
    over: `<path d="M128 112C170 124 230 124 272 112" fill="none" stroke="#000" stroke-width="2" opacity=".3"/><rect x="140" y="190" width="120" height="74" rx="20" fill="#000" opacity=".12" stroke="${d}" stroke-width="1.5"/><path d="M146 208H254" stroke="${d}" stroke-width="3" stroke-linecap="round"/><rect x="246" y="202" width="8" height="14" rx="3" fill="#c9ccd3"/>` }),
  sleeve: (c, d) => ({ body: 'M84 82H316Q332 82 332 98V214Q332 230 316 230H84Q68 230 68 214V98Q68 82 84 82Z',
    over: `<path d="M68 114H332" stroke="#000" stroke-width="3" opacity=".28"/>${seam('M92 98H300', d, 2.4, .65)}<rect x="294" y="90" width="14" height="22" rx="6" fill="#c9ccd3"/>` }),
  mouse: (c, d) => ({ body: 'M200 52C144 52 122 104 122 162 122 230 156 268 200 268 244 268 278 230 278 162 278 104 256 52 200 52Z',
    over: `<path d="M200 52V140M124 144C148 156 252 156 276 144" fill="none" stroke="#000" stroke-width="3" opacity=".38"/><rect x="192" y="84" width="16" height="36" rx="8" fill="#2b2d35"/><rect x="195" y="90" width="10" height="12" rx="5" fill="#fff" opacity=".35"/>` }),
  mousepad: (c, d) => ({ body: 'M76 96H324Q342 96 342 114V212Q342 230 324 230H76Q58 230 58 212V114Q58 96 76 96Z', over: seam('M70 108H330V218H70Z', d, 2, .6) }),
  case: (c, d) => ({ body: 'M172 36H228Q258 36 258 66V238Q258 268 228 268H172Q142 268 142 238V66Q142 36 172 36Z',
    over: `<rect x="154" y="48" width="50" height="50" rx="14" fill="#14151a" opacity=".9"/><circle cx="170" cy="64" r="9" fill="#2a2d36"/><circle cx="170" cy="64" r="4" fill="#6c7285"/><circle cx="190" cy="84" r="9" fill="#2a2d36"/><circle cx="190" cy="84" r="4" fill="#6c7285"/><rect x="142" y="36" width="116" height="232" rx="30" fill="none" stroke="${d}" stroke-width="3" opacity=".45"/>` }),
  tee: (c, d) => ({ body: 'M136 56 90 82 52 152 96 176 118 144V268H282V144L304 176 348 152 310 82 264 56C250 86 150 86 136 56Z',
    over: `<path d="M150 56C168 92 232 92 250 56" fill="none" stroke="${d}" stroke-width="7"/><path d="M118 144 116 96M282 144 284 96" stroke="#000" stroke-width="1.6" opacity=".22" fill="none"/>${seam('M120 262H280', d, 1.4, .55)}` }),
  jersey: (c, d) => ({ body: 'M146 50 92 74 58 142 100 162 122 126C128 178 114 232 118 274H282C286 232 272 178 278 126L300 162 342 142 308 74 254 50C240 80 160 80 146 50Z',
    over: `<path d="M158 52C172 84 228 84 242 52" fill="none" stroke="${d}" stroke-width="6"/><path d="M62 134 104 154M338 134 296 154" stroke="${d}" stroke-width="8"/><path d="M128 130C134 180 120 232 124 270M272 130C266 180 280 232 276 270" stroke="${d}" stroke-width="3" fill="none" opacity=".8"/>` }),
  hoodie: (c, d) => ({ body: 'M130 78 78 100 42 220 88 236 118 158V268H282V158L312 236 358 220 322 100 270 78C262 40 138 40 130 78Z',
    over: `<path d="M150 82C146 40 254 40 250 82 236 108 164 108 150 82Z" fill="#000" opacity=".3" stroke="${d}" stroke-width="2"/><path d="M178 102V140M222 102V140" stroke="#EDEAE2" stroke-width="4" stroke-linecap="round"/><path d="M146 214H254L270 262H130Z" fill="none" stroke="#000" stroke-width="2" opacity=".35"/><path d="M118 250H282M46 206 92 222M354 206 308 222" stroke="#000" stroke-width="3" opacity=".25"/>` }),
  jeans: (c, d) => ({ body: 'M142 30H258L266 62 284 272H222L206 140 200 112 194 140 178 272H116L134 62Z',
    over: `<path d="M139 46H261" stroke="#000" stroke-width="2" opacity=".35"/>${seam('M140 40H260M140 52H260', '#D8B36A', 1.6, .85)}<path d="M200 50V112M200 62Q216 66 214 90Q210 100 200 104M150 54Q152 84 134 92M250 54Q248 84 266 92" fill="none" stroke="#D8B36A" stroke-width="1.6" opacity=".85"/>${seam('M132 90 124 266M268 90 276 266M121 262H178M222 262H279', '#D8B36A', 1.4, .75)}<circle cx="200" cy="46" r="4.5" fill="#C9A15A"/><path d="M160 30v18M200 30v10M240 30v18" stroke="${d}" stroke-width="5"/>` }),
  boots: (c, d) => ({ body: 'M128 58H206C208 96 214 132 232 156 262 182 320 184 338 214 344 226 342 240 336 246H108C98 238 100 220 108 204 126 170 132 128 128 58Z',
    over: `<path d="M102 242H338Q350 244 346 262Q344 270 332 270H114Q100 270 100 258Z" fill="#17161a"/><path d="M122 270v-8M148 270v-8M174 270v-8M200 270v-8M226 270v-8M252 270v-8M278 270v-8M304 270v-8" stroke="#44424a" stroke-width="9"/><path d="M104 244H340" stroke="#C9A15A" stroke-width="3" stroke-dasharray="6 4"/><rect x="124" y="46" width="86" height="22" rx="10" fill="#222128"/><path d="M206 76 188 96M210 98 192 118M218 120 200 140M230 142 212 160M248 160 232 176" stroke="#E8E4DA" stroke-width="3.4" stroke-linecap="round"/>${[[206, 76], [210, 98], [218, 120], [230, 142], [248, 160], [188, 96], [192, 118], [200, 140], [212, 160], [232, 176]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#c9ccd3" stroke="#55585f"/>`).join('')}<path d="M120 232C138 206 150 196 176 194M300 244C300 222 316 208 336 214" fill="none" stroke="#000" stroke-width="2" opacity=".3"/>` }),
  mug: (c, d) => ({ under: `<path d="M248 114C310 106 310 208 246 202" fill="none" stroke="${c}" stroke-width="18"/><path d="M248 114C310 106 310 208 246 202" fill="none" stroke="#000" stroke-width="18" opacity=".1"/>`,
    body: 'M104 84H252V224C252 240 240 250 224 250H132C116 250 104 240 104 224Z', over: `<ellipse cx="178" cy="84" rx="74" ry="11" fill="${d}"/><ellipse cx="178" cy="85" rx="64" ry="8" fill="#000" opacity=".35"/>` }),
  bottle: (c, d) => ({ under: `<rect x="170" y="36" width="60" height="32" rx="10" fill="#3a3b42"/>`, body: 'M180 62H220V92C236 94 246 104 246 118V248C246 264 234 274 218 274H182C166 274 154 264 154 248V118C154 104 164 94 180 92Z',
    over: '<rect x="170" y="38" width="60" height="8" rx="4" fill="#fff" opacity=".25"/>' }),
  notebook: (c, d) => ({ body: 'M126 46H286Q296 46 296 56V264Q296 274 286 274H126Q116 274 116 264V56Q116 46 126 46Z',
    over: `<rect x="116" y="46" width="20" height="228" rx="6" fill="#000" opacity=".22"/><rect x="266" y="46" width="9" height="228" fill="#1b1a1f"/><path d="M140 50V270" stroke="#000" stroke-width="1.5" opacity=".25"/>` }),
  poster: (c, d) => ({ under: `<rect x="116" y="40" width="168" height="220" fill="${c}"/><rect x="116" y="40" width="168" height="220" fill="none" stroke="#000" stroke-width="2" opacity=".3"/>`, body: 'M132 56H268V244H132Z', fill: '#F6F4EF', over: '<rect x="132" y="56" width="136" height="6" fill="#000" opacity=".1"/>' })
};

function mockup(productId, colour, artUrl, opts = {}) {
  const p = PRODUCTS.find(x => x.id === productId); if (!p || !SHAPES[p.id]) return '';
  const c = colour || p.colors[0][1], d = shade(c, -0.3), s = SHAPES[p.id](c, d), id = 'mk' + (++mockN);
  // the artwork spans the whole paintable surface
  const art = artUrl ? `<g clip-path="url(#${id}c)"><image href="${artUrl}" x="40" y="26" width="320" height="260" preserveAspectRatio="xMidYMid slice"/></g>` : '';
  return `<svg class="mock" viewBox="0 10 400 280" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(p.name)} preview">
    <defs>
      <clipPath id="${id}c"><path d="${s.body}"/></clipPath>
      <filter id="${id}f" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 .55 0" result="grey"/>
        <feBlend in="SourceGraphic" in2="grey" mode="soft-light" result="cloth0"/><feComposite in="cloth0" in2="SourceAlpha" operator="in" result="cloth"/>
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="b"/>
        <feDiffuseLighting in="b" surfaceScale="3.2" diffuseConstant="1.1" lighting-color="#fff" result="dl"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
        <feSpecularLighting in="b" surfaceScale="3.2" specularConstant=".5" specularExponent="22" lighting-color="#fff" result="sl"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting>
        <feComposite in="sl" in2="SourceAlpha" operator="in" result="sp"/>
        <feComposite in="cloth" in2="dl" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="lit"/>
        <feComposite in="lit" in2="sp" operator="arithmetic" k1="0" k2="1" k3=".45" k4="0"/>
      </filter>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".3" stop-color="#fff" stop-opacity=".1"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
      <filter id="${id}b" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect x="-400" y="-100" width="1200" height="600" fill="${opts.bg || 'transparent'}"/>
    <ellipse cx="200" cy="280" rx="120" ry="9" fill="#000" opacity=".28" filter="url(#${id}b)"/>
    <g filter="url(#${id}f)">${s.under || ''}<path d="${s.body}" fill="${s.fill || c}"/>${art}<path d="${s.body}" fill="url(#${id}s)"/>${s.over || ''}</g></svg>`;
}
