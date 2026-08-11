// engine.js — the degree calculator.
//
// Every MMP construction step is a *polynomial* map on homogeneous coordinates:
// join and meet are cross products, pole-polar is a matrix times a vector,
// midpoints and perpendicular directions are small rational expressions. So the
// whole construction is written once against an abstract ring, and run twice:
//
//   ring = polyRing()  with t = the indeterminate  -> exact degrees
//   ring = realRing    with t = a number           -> coordinates to draw
//
// The degree rule is the whole theory in one line: after each step, divide the
// three homogeneous coordinates by their gcd; the degree is the max of what
// survives. The drop
//
//     #(coincidence) = (naive degree) - (actual degree)
//
// is exactly Zack's lemma's correction term — finite coincidences show up as
// the gcd, coincidences at t = ∞ show up as cancellation of leading
// coefficients, and taking the max degree after gcd-division catches both.
// Nothing has to be counted by hand.

import { P, fadd, fsub, fmul, fneg, finv, padd, psub, pmul, pgcd, pdiv, pdeg, pmonic } from './poly.js';

export function polyRing() {
  return {
    name: 'poly',
    zero: [], one: [1], t: [0, 1],
    add: padd, sub: psub, mul: pmul,
    neg: (a) => psub([], a),
    isZero: (a) => a.length === 0,
    fromRat(n, d = 1) {
      const num = ((n % P) + P) % P, den = ((d % P) + P) % P;
      const v = fmul(num, finv(den));
      return v === 0 ? [] : [v];
    },
    norm3(v) {
      const g = pgcd(pgcd(v[0], v[1]), v[2]);
      if (!g.length) return v;                       // degenerate: all three zero
      if (pdeg(g) > 0) v = v.map((c) => (c.length ? pdiv(c, g) : c));
      return v.map((c) => (c.length ? c : []));
    },
    deg: (v) => Math.max(pdeg(v[0]), pdeg(v[1]), pdeg(v[2])),
  };
}

export const realRing = {
  name: 'real',
  zero: 0, one: 1,
  add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b,
  neg: (a) => -a,
  isZero: (a) => Math.abs(a) < 1e-12,
  fromRat: (n, d = 1) => n / d,
  norm3(v) { const m = Math.max(...v.map(Math.abs)); return m > 0 ? v.map((x) => x / m) : v; },
  deg: () => null,
};

// --- primitive constructions, ring-generic ---

const cross = (R, u, v) => R.norm3([
  R.sub(R.mul(u[1], v[2]), R.mul(u[2], v[1])),
  R.sub(R.mul(u[2], v[0]), R.mul(u[0], v[2])),
  R.sub(R.mul(u[0], v[1]), R.mul(u[1], v[0])),
]);

export function det3(R, a, b, c) {
  const m0 = R.sub(R.mul(b[1], c[2]), R.mul(b[2], c[1]));
  const m1 = R.sub(R.mul(b[0], c[2]), R.mul(b[2], c[0]));
  const m2 = R.sub(R.mul(b[0], c[1]), R.mul(b[1], c[0]));
  return R.add(R.sub(R.mul(a[0], m0), R.mul(a[1], m1)), R.mul(a[2], m2));
}

const midpoint = (R, A, B) => R.norm3([
  R.add(R.mul(A[0], B[2]), R.mul(B[0], A[2])),
  R.add(R.mul(A[1], B[2]), R.mul(B[1], A[2])),
  R.mul(R.fromRat(2), R.mul(A[2], B[2])),
]);

// direction (ideal point) of a line, and the perpendicular direction
const dirOf = (R, l) => R.norm3([l[1], R.neg(l[0]), R.zero]);
const perpDirOf = (R, l) => R.norm3([l[0], l[1], R.zero]);

// pole-polar with respect to the unit circle x^2 + y^2 - z^2 = 0
const polarUnit = (R, Q) => R.norm3([Q[0], Q[1], R.neg(Q[2])]);

// rational degree-2 parametrisation of the unit circle
const circlePoint = (R, s) => R.norm3([
  R.sub(R.one, R.mul(s, s)),
  R.mul(R.fromRat(2), s),
  R.add(R.one, R.mul(s, s)),
]);

// P + s·Q : a degree-1 point on the line PQ
const linComb = (R, A, B, s) => R.norm3([
  R.add(A[0], R.mul(s, B[0])),
  R.add(A[1], R.mul(s, B[1])),
  R.add(A[2], R.mul(s, B[2])),
]);

const KIND = {
  free: 'point', on: 'point', circle: 'point', meet: 'point', midpoint: 'point',
  dir: 'point', perpdir: 'point',
  join: 'line', polar: 'line', perpline: 'line', perpbis: 'line',
};

// --- the construction language ---
//
//   name = op arg...            one object per line, in construction order
//   claim collinear A B C
//   claim concurrent e f g
//
// Numbers are integers or fractions (3, -2, 5/7). `$t` is the animated
// parameter. Text after `#` is a comment and is shown to the reader as the
// prose for that construction step.

export function parse(src) {
  const prog = [];
  for (const raw of src.split('\n')) {
    const hash = raw.indexOf('#');
    const body = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
    const note = hash >= 0 ? raw.slice(hash + 1).trim() : '';
    if (!body) continue;
    if (body.startsWith('claim ')) {
      const [, op, ...args] = body.split(/\s+/);
      prog.push({ claim: true, op, args, note });
    } else {
      const m = /^(\w+)\s*=\s*(\w+)\s*(.*)$/.exec(body);
      if (!m) throw new Error('cannot parse line: ' + raw);
      prog.push({ name: m[1], op: m[2], args: m[3].split(/\s+/).filter(Boolean), note });
    }
  }
  return prog;
}

export function run(prog, R, tval) {
  const env = Object.create(null);
  const steps = [];
  const obj = (s) => { if (!(s in env)) throw new Error('undefined object: ' + s); return env[s]; };
  const num = (s) => {
    if (s === '$t') return tval;
    const m = /^(-?\d+)(?:\/(-?\d+))?$/.exec(s);
    if (!m) throw new Error('expected a number, got: ' + s);
    return R.fromRat(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 1);
  };
  const degOf = (s) => (R.deg ? R.deg(obj(s)) : null);

  for (const st of prog) {
    if (st.claim) {
      const [a, b, c] = st.args.map(obj);
      const d = det3(R, a, b, c);
      const predicted = st.args.reduce((s, n) => s + degOf(n), 0);
      steps.push({
        ...st, kind: 'claim',
        statementDegree: predicted,
        alwaysTrue: R.isZero(d),
        casesNeeded: predicted + 1,
        value: d,
      });
      continue;
    }
    let v, naive = null;
    switch (st.op) {
      case 'free':      v = R.norm3([num(st.args[0]), num(st.args[1]), R.one]); break;
      case 'circle':    v = circlePoint(R, num(st.args[0])); break;
      case 'on':        v = linComb(R, obj(st.args[0]), obj(st.args[1]), num(st.args[2])); naive = Math.max(degOf(st.args[0]), degOf(st.args[1]) + 1); break;
      case 'join':
      case 'meet':      v = cross(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'polar':     v = polarUnit(R, obj(st.args[0])); naive = degOf(st.args[0]); break;
      case 'midpoint':  v = midpoint(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'dir':       v = dirOf(R, obj(st.args[0])); naive = degOf(st.args[0]); break;
      case 'perpdir':   v = perpDirOf(R, obj(st.args[0])); naive = degOf(st.args[0]); break;
      case 'perpline':  v = cross(R, obj(st.args[0]), perpDirOf(R, obj(st.args[1]))); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'perpbis': {
        const A = obj(st.args[0]), B = obj(st.args[1]);
        v = cross(R, midpoint(R, A, B), perpDirOf(R, cross(R, A, B)));
        naive = null; break;
      }
      default: throw new Error('unknown construction: ' + st.op);
    }
    env[st.name] = v;
    const deg = R.deg ? R.deg(v) : null;
    steps.push({
      ...st, kind: KIND[st.op] || 'point', value: v, degree: deg,
      naiveDegree: naive,
      coincidences: naive === null || deg === null ? null : naive - deg,
    });
  }
  return { env, steps };
}

export const degrees = (src) => run(parse(src), polyRing(), polyRing().t);
export const coords = (src, t) => run(parse(src), realRing, t);
