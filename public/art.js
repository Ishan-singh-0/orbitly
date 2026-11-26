/* ============ TWEAK’D — art.js ============
   Procedural illustrations: gig covers, seller portraits, profile banners, icons.
   Everything is inline SVG — no external images. */

// [background, foreground, accent]
const PALS = [
  ['#ECE8FF', '#2E1A8F', '#6D4DF6'],  // 0 violet
  ['#DDF7E6', '#0F4D2C', '#1FB864'],  // 1 green
  ['#FFE3E1', '#8A1C2B', '#F2554D'],  // 2 coral
  ['#DDF0FF', '#0B3A66', '#1D8FE8'],  // 3 sky
  ['#FFF0CC', '#6B3A06', '#F2A20C'],  // 4 amber
  ['#EAEAF0', '#14161F', '#5A6275'],  // 5 slate
  ['#FFE1F1', '#7A1550', '#E8409A'],  // 6 pink
  ['#D6F6F0', '#0B4A44', '#12B5A5']   // 7 teal
];
const ACCENT_NAMES = ['Violet', 'Green', 'Coral', 'Sky', 'Amber', 'Slate', 'Pink', 'Teal'];

function rng(seed) {
  let a = (Math.imul(seed + 1, 2654435761) >>> 0) || 1;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const f1 = n => Math.round(n * 10) / 10;

/* ---------- gig covers (400 x 260) ---------- */
const ART = {
  design(r, [bg, fg, ac]) {
    const rot = Math.round(r() * 40 - 10), v = Math.floor(r() * 4), L = 'ABCDEGKMNRSTW'[Math.floor(r() * 13)];
    const marks = [
      `<circle cx="184" cy="112" r="38" fill="${ac}"/><rect x="198" y="82" width="60" height="60" rx="14" fill="${fg}" opacity=".9" transform="rotate(${rot} 228 112)" style="mix-blend-mode:multiply"/>`,
      `<rect x="154" y="68" width="92" height="92" rx="26" fill="${ac}" transform="rotate(${rot / 3} 200 114)"/><text x="200" y="136" text-anchor="middle" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#fff">${L}</text>`,
      `<rect x="146" y="76" width="108" height="16" rx="8" fill="${fg}"/><rect x="146" y="102" width="76" height="16" rx="8" fill="${ac}"/><rect x="146" y="128" width="92" height="16" rx="8" fill="${fg}" opacity=".35"/><circle cx="254" cy="110" r="10" fill="${ac}"/>`,
      `<path d="M200 66 246 146 154 146Z" fill="${ac}" stroke-linejoin="round"/><circle cx="224" cy="130" r="28" fill="${fg}" opacity=".88" style="mix-blend-mode:multiply"/>`
    ];
    return `<rect x="92" y="42" width="216" height="192" rx="18" fill="${fg}" opacity=".08"/>
      <rect x="92" y="34" width="216" height="192" rx="18" fill="#fff"/>
      <circle cx="200" cy="112" r="64" fill="none" stroke="${fg}" stroke-opacity=".15" stroke-dasharray="3 5"/>
      ${marks[v]}
      <rect x="${v === 2 ? 150 : 140}" y="184" width="${v === 2 ? 100 : 120}" height="9" rx="4.5" fill="${fg}"/>
      <rect x="160" y="201" width="80" height="6" rx="3" fill="${fg}" opacity=".3"/>
      <circle cx="336" cy="70" r="11" fill="${ac}"/><circle cx="336" cy="98" r="11" fill="${fg}"/><circle cx="336" cy="126" r="11" fill="#fff" stroke="${fg}" stroke-opacity=".25"/>`;
  },
  dev(r, [bg, fg, ac]) {
    const cols = [ac, '#94A3B8', '#7DD3FC', '#FDE68A'];
    let lines = '', y = 84;
    for (let i = 0; i < 8; i++) { const ind = [0, 1, 1, 2, 2, 1, 0, 0][i] * 16; lines += `<rect x="${70 + ind}" y="${y}" width="${f1(36 + r() * 120)}" height="8" rx="4" fill="${cols[Math.floor(r() * 4)]}" opacity=".92"/>`; y += 17; }
    return `<rect x="52" y="44" width="296" height="188" rx="16" fill="${fg}" opacity=".12"/>
      <rect x="52" y="34" width="296" height="188" rx="16" fill="#0F1220"/>
      <circle cx="74" cy="56" r="5" fill="#F87171"/><circle cx="91" cy="56" r="5" fill="#FBBF24"/><circle cx="108" cy="56" r="5" fill="#34D399"/>
      ${lines}<rect x="${70 + 16 * 2 + 4}" y="${y - 4}" width="8" height="14" fill="${ac}"/>
      <circle cx="338" cy="206" r="30" fill="${ac}"/><text x="338" y="213" text-anchor="middle" font-family="monospace" font-size="20" font-weight="700" fill="#fff">&lt;/&gt;</text>`;
  },
  video(r, [bg, fg, ac]) {
    const px = Math.round(210 + r() * 100);
    let clips = '', x = 56; const w = [60, 44, 78, 52, 40]; const cc = [ac, fg, ac, fg, ac];
    w.forEach((cw, i) => { clips += `<rect x="${x}" y="206" width="${cw}" height="12" rx="6" fill="${cc[i]}" opacity="${i % 2 ? .55 : .9}"/>`; x += cw + 6; });
    return `<rect x="48" y="30" width="304" height="152" rx="16" fill="${fg}"/>
      <circle cx="${110 + Math.round(r() * 40)}" cy="124" r="52" fill="${ac}" opacity=".6"/>
      <rect x="228" y="62" width="100" height="92" rx="12" fill="#fff" opacity=".13"/>
      <circle cx="200" cy="106" r="28" fill="#fff"/><path d="M191 92l24 14-24 14z" fill="${ac}"/>
      <rect x="48" y="200" width="304" height="24" rx="12" fill="#fff" opacity=".75"/>${clips}
      <rect x="${px}" y="194" width="3" height="36" rx="1.5" fill="${fg}"/><circle cx="${px + 1.5}" cy="194" r="5" fill="${fg}"/>`;
  },
  writing(r, [bg, fg, ac]) {
    let t = '', y = 104;
    for (let i = 0; i < 6; i++) { const w = i === 5 ? 90 : f1(150 + r() * 40); if (i === 1 || i === 3) t += `<rect x="106" y="${y - 3}" width="${f1(w * .55)}" height="14" rx="4" fill="${ac}" opacity=".3"/>`; t += `<rect x="108" y="${y}" width="${w}" height="8" rx="4" fill="${fg}" opacity=".22"/>`; y += 19; }
    return `<rect x="84" y="40" width="232" height="200" rx="16" fill="${fg}" opacity=".08"/>
      <rect x="84" y="30" width="232" height="200" rx="16" fill="#fff"/>
      <rect x="108" y="54" width="116" height="15" rx="7.5" fill="${fg}"/><rect x="108" y="78" width="76" height="8" rx="4" fill="${ac}" opacity=".6"/>${t}
      <text x="276" y="92" font-family="Georgia,serif" font-size="68" fill="${ac}" opacity=".55">“</text>`;
  },
  marketing(r, [bg, fg, ac]) {
    let bars = '', pts = [], x = 74;
    for (let i = 0; i < 7; i++) { const h = f1(26 + i * 15 + r() * 14); bars += `<rect x="${x}" y="${212 - h}" width="26" height="${h}" rx="6" fill="${i === 6 ? ac : fg}" opacity="${i === 6 ? 1 : .16}"/>`; pts.push(`${x + 13},${f1(212 - h - 10)}`); x += 38; }
    return `<rect x="50" y="44" width="300" height="190" rx="16" fill="${fg}" opacity=".08"/>
      <rect x="50" y="34" width="300" height="190" rx="16" fill="#fff"/>${bars}
      <polyline points="${pts.join(' ')}" fill="none" stroke="${ac}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="${i === 6 ? 7 : 4}" fill="${i === 6 ? ac : '#fff'}" stroke="${ac}" stroke-width="3"/>`).join('')}
      <circle cx="318" cy="68" r="20" fill="none" stroke="${ac}" stroke-width="5" opacity=".35"/><circle cx="318" cy="68" r="11" fill="none" stroke="${ac}" stroke-width="5"/><circle cx="318" cy="68" r="3.5" fill="${ac}"/>`;
  },
  music(r, [bg, fg, ac]) {
    let b = '';
    for (let i = 0; i < 34; i++) { const env = Math.sin((i / 33) * Math.PI), h = f1(14 + env * 96 * (.45 + r() * .55)); b += `<rect x="${f1(46 + i * 9.7)}" y="${f1(112 - h / 2)}" width="6" height="${h}" rx="3" fill="${i % 5 === 2 ? ac : fg}" opacity="${i % 5 === 2 ? 1 : .8}"/>`; }
    return `<rect x="30" y="34" width="340" height="156" rx="18" fill="#fff"/>${b}
      <rect x="62" y="206" width="276" height="6" rx="3" fill="${fg}" opacity=".16"/><rect x="62" y="206" width="${Math.round(80 + r() * 120)}" height="6" rx="3" fill="${ac}"/>
      <circle cx="200" cy="228" r="0" fill="${ac}"/>`;
  },
  ai(r, [bg, fg, ac]) {
    const L = [[86, 4], [200, 5], [314, 3]], N = []; let lines = '', nodes = '';
    L.forEach(([x, n], li) => { const gap = 150 / (n), top = 130 - (n - 1) * gap / 2; for (let i = 0; i < n; i++) N.push({ x, y: f1(top + i * gap), li }); });
    N.forEach(a => N.forEach(b => { if (b.li === a.li + 1 && r() > .38) lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${fg}" stroke-opacity=".22" stroke-width="2"/>`; }));
    N.forEach((n, i) => { const hot = r() > .72; nodes += `<circle cx="${n.x}" cy="${n.y}" r="${hot ? 15 : 11}" fill="${hot ? ac : '#fff'}" stroke="${hot ? ac : fg}" stroke-width="3"/>`; });
    return `<rect x="36" y="30" width="328" height="200" rx="18" fill="#fff" opacity=".7"/>${lines}${nodes}
      <path d="M338 36l6 17 17 6-17 6-6 17-6-17-17-6 17-6z" fill="${ac}"/>`;
  },
  biz(r, [bg, fg, ac]) {
    const c = 2 * Math.PI * 46, a = f1(c * (.5 + r() * .25)), b = f1(c * .18);
    let rows = '';
    for (let i = 0; i < 3; i++) rows += `<rect x="216" y="${52 + i * 62}" width="136" height="50" rx="12" fill="#fff"/><rect x="230" y="${66 + i * 62}" width="${f1(40 + r() * 46)}" height="8" rx="4" fill="${fg}" opacity=".25"/><rect x="230" y="${82 + i * 62}" width="${f1(60 + r() * 50)}" height="14" rx="5" fill="${i === 0 ? ac : fg}"/><circle cx="334" cy="${77 + i * 62}" r="8" fill="${ac}" opacity="${.35 + i * .25}"/>`;
    return `<rect x="48" y="38" width="150" height="184" rx="18" fill="#fff"/>
      <circle cx="123" cy="116" r="46" fill="none" stroke="${fg}" stroke-opacity=".1" stroke-width="22"/>
      <circle cx="123" cy="116" r="46" fill="none" stroke="${ac}" stroke-width="22" stroke-dasharray="${a} ${f1(c - a)}" transform="rotate(-90 123 116)"/>
      <circle cx="123" cy="116" r="46" fill="none" stroke="${fg}" stroke-width="22" stroke-dasharray="${b} ${f1(c - b)}" stroke-dashoffset="${-a}" transform="rotate(-90 123 116)"/>
      <rect x="72" y="184" width="102" height="8" rx="4" fill="${fg}" opacity=".2"/>${rows}`;
  }
};
function coverArt(cat, seed = 0, pal) {
  const p = PALS[pal ?? ((seed * 3 + cat.length) % PALS.length)], r = rng(seed * 31 + cat.length);
  const g = (ART[cat] || ART.design)(r, p);
  return `<svg class="art" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true"><rect width="400" height="260" fill="${p[0]}"/><circle cx="${Math.round(310 + r() * 70)}" cy="${Math.round(10 + r() * 40)}" r="${Math.round(100 + r() * 40)}" fill="${p[2]}" opacity=".15"/><circle cx="${Math.round(30 + r() * 40)}" cy="${Math.round(230 + r() * 24)}" r="${Math.round(60 + r() * 30)}" fill="${p[1]}" opacity=".07"/>${g}</svg>`;
}

/* ---------- avatars ---------- */
const SKIN = ['#F5D0B0', '#E8B58C', '#C98A5B', '#8E5A36', '#F7DCC2', '#B87850'];
const HAIR = ['#1B1713', '#3A281D', '#6A4526', '#C79A2D', '#7C1F3E', '#273248', '#BFC4CC', '#101010'];
const BGS = ['#DDD6FE', '#C7F2D4', '#FFD0CF', '#C2E4FB', '#FDE9A9', '#FAD1E8', '#A8EFE4', '#E1E4EA'];
const CLOTH = ['#3B2A8C', '#14633A', '#9F2234', '#0B5586', '#8A4B08', '#8A1D5B', '#171B2C', '#0F6B63'];
function avatar(seed = 0) {
  const r = rng(seed * 17 + 3), pick = a => a[Math.floor(r() * a.length)];
  const skin = pick(SKIN), hair = pick(HAIR), bg = pick(BGS), cl = pick(CLOTH), style = Math.floor(r() * 6);
  let back = '', front = '';
  if (style === 1 || style === 4) back = `<path d="M28 46C24 74 28 84 38 86L40 52Z M72 46C76 74 72 84 62 86L60 52Z" fill="${hair}"/>`;
  if (style === 2) back = `<circle cx="50" cy="15" r="10" fill="${hair}"/>`;
  front = style === 3 ? `<path d="M29 42C29 20 71 20 71 42Z" fill="${hair}"/><rect x="28" y="38" width="44" height="7" rx="3.5" fill="${cl}"/>`
    : style === 5 ? `<circle cx="34" cy="30" r="9" fill="${hair}"/><circle cx="50" cy="24" r="10" fill="${hair}"/><circle cx="66" cy="30" r="9" fill="${hair}"/><circle cx="29" cy="42" r="7" fill="${hair}"/><circle cx="71" cy="42" r="7" fill="${hair}"/>`
      : `<path d="M31 45C29 25 40 17 50 17C62 17 72 25 69 45C66 35 59 31 50 31C41 31 34 35 31 45Z" fill="${hair}"/>`;
  return `<svg class="av-svg" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>${back}
    <path d="M12 100C12 76 32 68 50 68C68 68 88 76 88 100Z" fill="${cl}"/><rect x="43" y="56" width="14" height="18" rx="6" fill="${skin}"/>
    <ellipse cx="50" cy="45" rx="17" ry="19" fill="${skin}"/>${front}
    <circle cx="43" cy="47" r="1.9" fill="#1B1713"/><circle cx="57" cy="47" r="1.9" fill="#1B1713"/><path d="M44.5 55.5Q50 60 55.5 55.5" fill="none" stroke="#1B1713" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}
const avatarEl = (seed, cls = '') => `<span class="avatar ${cls}">${avatar(seed)}</span>`;

/* ---------- profile banner ---------- */
function bannerSvg(accent = 0) {
  const [bg, fg, ac] = PALS[accent % PALS.length];
  return `<svg class="banner-art" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="1200" height="240" fill="${fg}"/>
    <circle cx="980" cy="60" r="260" fill="${ac}" opacity=".55"/>
    <circle cx="140" cy="260" r="200" fill="${ac}" opacity=".25"/>
    <g fill="none" stroke="#fff" stroke-opacity=".16"><circle cx="980" cy="60" r="120"/><circle cx="980" cy="60" r="200"/><circle cx="980" cy="60" r="290"/><circle cx="980" cy="60" r="390"/></g>
    <circle cx="1068" cy="38" r="7" fill="#fff" opacity=".9"/><circle cx="780" cy="62" r="5" fill="#fff" opacity=".6"/></svg>`;
}

/* ---------- icons (sprite is injected once) ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  heart: '<path d="M12 20.5s-8-4.9-9.4-10.3C1.7 6.8 3.9 4 7 4c2.1 0 3.8 1.1 5 3 1.2-1.9 2.9-3 5-3 3.1 0 5.3 2.8 4.4 6.2C20 15.6 12 20.5 12 20.5z"/>',
  star: '<path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.2l-5.7 3.1 1.1-6.3L2.8 9.5l6.4-.9z"/>',
  check: '<path d="m4.5 12.5 5 5L19.5 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="M5 12h14m-6-6 6 6-6 6"/>', left: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  up: '<path d="M12 19V5m-6 6 6-6 6 6"/>', upright: '<path d="M7 17 17 7M8 7h9v9"/>',
  pin: '<path d="M12 21s7-6.1 7-11.4A7 7 0 0 0 5 9.6C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3c-3.2 3.2-3.2 14.8 0 18"/>',
  chat: '<path d="M4 5.5h16v11H9.5L5 20.5v-4H4z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  share: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v7h14v-7"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  bag: '<path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>',
  moon: '<path d="M20 14.6A8 8 0 1 1 9.4 4a6.4 6.4 0 0 0 10.6 10.6z"/>', x: '<path d="m6 6 12 12M18 6 6 18"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  shield: '<path d="M12 3 4.5 6v6c0 4.7 3.2 7.8 7.5 9 4.3-1.2 7.5-4.3 7.5-9V6z"/><path d="m8.8 12.2 2.3 2.3 4.2-4.5"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>', award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14 -1.5 7 5-3 5 3-1.5-7"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9.5 4.5H5v15h4.5M15.5 8l4 4-4 4M19.5 12h-10"/>', grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/>', briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 13h17"/>',
  trend: '<path d="m3.5 17 6-6 4 4 7-8M15 7h5.5v5.5"/>', verified: '<path d="m12 2.5 2.4 1.7 2.9-.2 1 2.7 2.5 1.5-.8 2.8.8 2.8-2.5 1.5-1 2.7-2.9-.2L12 21.5l-2.4-1.7-2.9.2-1-2.7-2.5-1.5.8-2.8-.8-2.8 2.5-1.5 1-2.7 2.9.2z" fill="currentColor" stroke="none"/><path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="#fff" stroke-width="2"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 3 5.6 1.3 5.6 4.3 0 1.2-1.2 2.1-2.9 2.1-1.4 0-2.5-.6-3-1.6M12 6v1.8M12 16.2V18"/>'
};
Object.assign(ICONS, {
  send: '<path d="M4 12 20 4l-5 16-3.5-6.5z"/><path d="m11.5 13.5 8-9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  download: '<path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.9c1.9.7 3 2.2 3 4.6"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>'
});
function injectSprite() {
  if (document.getElementById('sprite')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.id = 'sprite'; s.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
  document.body.prepend(s);
}
const ic = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
