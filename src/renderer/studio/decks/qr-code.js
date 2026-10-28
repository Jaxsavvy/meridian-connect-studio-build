/* QR code (#123): text -> a scannable QR code as SVG, with no library and no network. Byte mode, error correction
 * level M (about 15% of the code can be damaged), versions 1-10 (up to 213 bytes: plenty for a link).
 * Follows ISO/IEC 18004; the structure mirrors Project Nayuki's reference encoder. Core lane. */
'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MeridianQrCode = api;
})(typeof window === 'undefined' ? null : window, function () {
  const MAX_VERSION = 10;
  const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // level M, by version
  const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const FORMAT_M = 0;   // level M's format bits

  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function rawModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const align = Math.floor(ver / 7) + 2;
      n -= (25 * align - 10) * align - 55;
      if (ver >= 7) n -= 36;
    }
    return n;
  }
  const dataCodewords = ver => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * BLOCKS[ver];

  // Reed-Solomon over GF(2^8) with the QR polynomial 0x11D.
  function mul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function divisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 0x02);
    }
    return r;
  }
  function remainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= mul(c, f); });
    }
    return r;
  }

  function codewords(bytes) {
    let ver = 1;
    const need = v => 4 + (v < 10 ? 8 : 16) + 8 * bytes.length;
    while (ver <= MAX_VERSION && need(ver) > dataCodewords(ver) * 8) ver++;
    if (ver > MAX_VERSION) throw new Error('That text is too long for a QR code.');
    const cap = dataCodewords(ver) * 8, bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push(bit(val, i) ? 1 : 0); };
    put(4, 4);   // byte mode
    put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

    // Split into blocks, add each block's error correction, then interleave.
    const count = BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver) / 8);
    const short = count - raw % count, shortLen = Math.floor(raw / count), div = divisor(eccLen), blocks = [];
    for (let i = 0, k = 0; i < count; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < short ? 0 : 1));
      k += dat.length;
      const ecc = remainder(dat, div);
      if (i < short) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= short) out.push(b[i]); });
    }
    return { ver, out };
  }

  function alignment(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, out = [6];
    for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  /** text -> { size, modules: rows of booleans (true = dark) }. */
  function encode(text) {
    const { ver, out } = codewords(Array.from(new TextEncoder().encode(String(text))));
    const size = ver * 4 + 17;
    const dark = Array.from({ length: size }, () => new Array(size).fill(false));
    const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, on) => { dark[y][x] = on; fixed[y][x] = true; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }   // timing
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {                     // finders
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
    const pos = alignment(ver), last = pos.length - 1;
    pos.forEach((ax, i) => pos.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const format = mask => {
      const data = (FORMAT_M << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i));
      set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i));
      set(8, size - 8, true);
    };
    format(0);   // reserves the format areas
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)); }
    }

    let i = 0;   // data in the zigzag order
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!fixed[y][x] && i < out.length * 8) { dark[y][x] = bit(out[i >>> 3], 7 - (i & 7)); i++; }
      }
    }

    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const flip = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) dark[y][x] = !dark[y][x]; };
    // Penalty: runs of 5+ in a row or column, 2x2 blocks and dark/light balance (any mask scans; this picks a clean one).
    const penalty = () => {
      let p = 0, total = 0;
      for (let a = 0; a < size; a++) for (const row of [true, false]) {
        let run = 0, prev = null;
        for (let b = 0; b < size; b++) {
          const c = row ? dark[a][b] : dark[b][a];
          if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = c; }
        }
      }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (dark[y][x]) total++;
        if (x < size - 1 && y < size - 1 && dark[y][x] === dark[y][x + 1] && dark[y][x] === dark[y + 1][x] && dark[y][x] === dark[y + 1][x + 1]) p += 3;
      }
      return p + Math.floor(Math.abs(total * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      flip(m); format(m);
      const score = penalty();
      if (score < bestScore) { best = m; bestScore = score; }
      flip(m);
    }
    flip(best); format(best);
    return { size, modules: dark };
  }

  /** text -> an SVG string: black on white with the 4-module quiet zone scanners need. Scales to any size. */
  function svg(text) {
    const { size, modules } = encode(text), n = size + 8, d = [];
    modules.forEach((row, y) => row.forEach((on, x) => { if (on) d.push(`M${x + 4} ${y + 4}h1v1h-1z`); }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges">` +
      `<rect width="${n}" height="${n}" fill="#fff"/><path fill="#000" d="${d.join('')}"/></svg>`;
  }

  return { encode, svg };
});
