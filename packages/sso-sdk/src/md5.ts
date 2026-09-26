// Small dependency-free MD5 implementation for the SSO signing contract.
export function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const words = new Uint32Array(((bytes.length + 72) >>> 6) * 16);
  for (let i = 0; i < bytes.length; i++) words[i >>> 2] |= bytes[i] << ((i & 3) * 8);
  words[bytes.length >>> 2] |= 0x80 << ((bytes.length & 3) * 8);
  words[words.length - 2] = bytes.length * 8;
  let a = 0x67452301; let b = 0xefcdab89; let c = 0x98badcfe; let d = 0x10325476;
  const k = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const s = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const rot = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let offset = 0; offset < words.length; offset += 16) {
    let aa = a; let bb = b; let cc = c; let dd = d;
    for (let i = 0; i < 64; i++) {
      let f: number; let g: number;
      if (i < 16) { f = (bb & cc) | (~bb & dd); g = i; }
      else if (i < 32) { f = (dd & bb) | (~dd & cc); g = (5 * i + 1) % 16; }
      else if (i < 48) { f = bb ^ cc ^ dd; g = (3 * i + 5) % 16; }
      else { f = cc ^ (bb | ~dd); g = (7 * i) % 16; }
      const round = i >>> 4;
      const shift = s[round * 4 + (i % 4)];
      const next = (aa + f + k[i] + words[offset + g]) >>> 0;
      aa = dd; dd = cc; cc = bb; bb = (bb + rot(next, shift)) >>> 0;
    }
    a = (a + aa) >>> 0; b = (b + bb) >>> 0; c = (c + cc) >>> 0; d = (d + dd) >>> 0;
  }
  return [a, b, c, d].map((word) => Array.from({ length: 4 }, (_, i) => ((word >>> (i * 8)) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
