/* Minimal QR code generator (byte mode, error-correction level M, versions 1–10, ≈200 characters).
   Used only to draw the two-factor setup code, so it never needs a network request. Output is an inline SVG string. */
const QR = (() => {
  const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // level M, indexed by version
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = v => (rawModules(v) >> 3) - ECC_PER_BLOCK[v] * BLOCKS[v];

  // --- Reed–Solomon over GF(256), polynomial 0x11D
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
  const divisor = deg => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
  const remainder = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); } return r; };

  function encodeData(bytes, v) {
    const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, v >= 10 ? 16 : 8); bytes.forEach(b => put(b, 8));
    const cap = dataCodewords(v) * 8; put(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    const out = []; for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2)); return out;
  }
  function interleave(data, v) {
    const nb = BLOCKS[v], eccLen = ECC_PER_BLOCK[v], raw = rawModules(v) >> 3, shortCount = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = divisor(eccLen), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - eccLen + (i < shortCount ? 0 : 1)); k += dat.length; const ecc = remainder(dat, div); if (i < shortCount) dat.push(0); blocks.push(dat.concat(ecc)); }
    const out = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= shortCount) out.push(b[i]); }); return out;
  }

  function build(text) {
    const bytes = [...new TextEncoder().encode(text)]; let v = 1; while (v <= 10 && dataCodewords(v) * 8 < 4 + (v >= 10 ? 16 : 8) + bytes.length * 8) v++;
    if (v > 10) throw new Error('QR text too long');
    const size = v * 4 + 17, mod = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const pos = ALIGN[v], n = pos.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
    const bit = (x, i) => ((x >>> i) & 1) !== 0;
    const drawFormat = mask => { // level M = 0b00
      const data = (0 << 3) | mask; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i)); set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i)); set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); const bits = (v << 12) | rem; for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)); } }
    const codewords = interleave(encodeData(bytes, v), v); let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!fn[y][x] && i < codewords.length * 8) { mod[y][x] = bit(codewords[i >>> 3], 7 - (i & 7)); i++; } } }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => { // runs + 2x2 blocks + dark balance (simplified version of the spec's scoring)
      let p = 0; for (let y = 0; y < size; y++) for (const horiz of [true, false]) { let run = 1; for (let k = 1; k < size; k++) { const a = horiz ? mod[y][k] : mod[k][y], b = horiz ? mod[y][k - 1] : mod[k - 1][y]; if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
      const dark = mod.flat().filter(Boolean).length; return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const s = penalty(); if (s < bestScore) { best = m; bestScore = s; } apply(m); }
    apply(best); drawFormat(best);
    return { size, mod, version: v, mask: best };
  }

  function svg(text, { quiet = 4, dark = '#0E1015', light = '#FFFFFF' } = {}) {
    const { size, mod } = build(text), full = size + quiet * 2; let d = '';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    return `<svg class="qr-svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${full}" height="${full}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }
  return { build, svg };
})();
if (typeof module !== 'undefined') module.exports = QR;
