// poly.js — polynomial arithmetic over F_p.
//
// Why a finite field: MMP degrees are degrees of polynomials in the time
// parameter t, after cancelling common factors. Doing that in exact rational
// (or Gaussian-rational) arithmetic blows coefficients up fast; floating point
// makes gcd meaningless. Over F_p everything is exact, cheap, and the degree we
// get equals the characteristic-0 degree for all but a measure-zero set of
// choices of the fixed points. Run twice with different fixed points to be sure.
//
// p is chosen ≡ 1 (mod 4) so that i = sqrt(-1) exists in F_p — the circle points
// (1 : ±i : 0) have to be real inhabitants of the field or the whole method
// collapses.

export const P = 998244353;               // 119·2^23 + 1, prime, ≡ 1 (mod 4)
const PB = 998244353n;

export const fadd = (a, b) => (a + b) % P;
export const fsub = (a, b) => (a - b + P) % P;
export const fmul = (a, b) => Number((BigInt(a) * BigInt(b)) % PB);
export const fneg = (a) => (P - a) % P;

export function fpow(a, e) {
  let r = 1; a %= P;
  while (e > 0) { if (e & 1) r = fmul(r, a); a = fmul(a, a); e = Math.floor(e / 2); }
  return r;
}
export const finv = (a) => fpow(a, P - 2);

// i = sqrt(-1). 3 is a primitive root mod 998244353.
export const I = fpow(3, (P - 1) / 4);

// --- polynomials: arrays of coefficients, lowest power first, [] is zero ---

const trim = (a) => { let n = a.length; while (n > 0 && a[n - 1] === 0) n--; return n === a.length ? a : a.slice(0, n); };

export const pdeg = (a) => a.length - 1;            // -1 for the zero polynomial
export const pIsZero = (a) => a.length === 0;

export function padd(a, b) {
  const n = Math.max(a.length, b.length), r = new Array(n).fill(0);
  for (let i = 0; i < n; i++) r[i] = fadd(a[i] || 0, b[i] || 0);
  return trim(r);
}
export function psub(a, b) {
  const n = Math.max(a.length, b.length), r = new Array(n).fill(0);
  for (let i = 0; i < n; i++) r[i] = fsub(a[i] || 0, b[i] || 0);
  return trim(r);
}
export function pmul(a, b) {
  if (!a.length || !b.length) return [];
  const r = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      r[i + j] = fadd(r[i + j], fmul(a[i], b[j]));
  return trim(r);
}
export const pmonic = (a) => {
  if (!a.length) return a;
  const c = finv(a[a.length - 1]);
  return a.map((x) => fmul(x, c));
};

function divmod(a, b) {
  if (!b.length) throw new Error('divide by zero polynomial');
  a = a.slice();
  const db = pdeg(b), lb = finv(b[db]);
  const q = new Array(Math.max(0, a.length - db)).fill(0);
  while (a.length && a.length - 1 >= db) {
    const d = a.length - 1 - db, c = fmul(a[a.length - 1], lb);
    q[d] = c;
    for (let i = 0; i <= db; i++) a[i + d] = fsub(a[i + d], fmul(c, b[i]));
    a = trim(a);
  }
  return [trim(q), a];
}
export const pdiv = (a, b) => divmod(a, b)[0];
export const pmod = (a, b) => divmod(a, b)[1];

export function pgcd(a, b) {
  a = a.slice(); b = b.slice();
  while (b.length) { const r = pmod(a, b); a = b; b = r; }
  return pmonic(a);
}

// Roots in F_p, by brute force over a small search set — only used to *name*
// coincidence times in the UI ("AB = BC when D = F"), never for the degree.
export function proots(a, candidates) {
  const out = [];
  for (const c of candidates) {
    let v = 0;
    for (let i = a.length - 1; i >= 0; i--) v = fadd(fmul(v, c), a[i]);
    if (v === 0) out.push(c);
  }
  return out;
}
