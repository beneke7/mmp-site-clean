// engine.js — the degree calculator.
//
// Most MMP construction steps are *polynomial* maps on homogeneous coordinates:
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
// Nothing has to be counted by hand. Angle bisectors are the deliberate
// exception: normalized directions use square roots, so they are real-only
// constructions and have no polynomial degree.

import { P, fadd, fsub, fmul, fneg, finv, padd, psub, pmul, pgcd, pdiv, pdeg, pmonic } from './poly.js';

const NUMBER = /^(-?\d+)(?:\/(-?\d+))?$/;
const FIELD_PRIME = BigInt(P);

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
    norm(v) {
      const g = v.reduce((a, b) => pgcd(a, b));
      if (!g.length) return v;                       // degenerate: all three zero
      if (pdeg(g) > 0) v = v.map((c) => (c.length ? pdiv(c, g) : c));
      return v.map((c) => (c.length ? c : []));
    },
    norm3(v) { return this.norm(v); },
    deg: (v) => Math.max(...v.map(pdeg)),
  };
}

export const realRing = {
  name: 'real',
  zero: 0, one: 1,
  add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b,
  neg: (a) => -a,
  isZero: (a) => Math.abs(a) < 1e-12,
  fromRat: (n, d = 1) => n / d,
  norm(v) { const m = Math.max(...v.map(Math.abs)); return m > 0 ? v.map((x) => x / m) : v; },
  norm3(v) { return this.norm(v); },
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

const unitCircle = (R) => [R.one, R.zero, R.one, R.zero, R.zero, R.neg(R.one)];

const conicAt = (R, conic, point) => {
  const [A, B, C, D, E, F] = conic, [x, y, z] = point;
  return R.add(R.add(
    R.add(R.mul(A, R.mul(x, x)), R.mul(B, R.mul(x, y))),
    R.add(R.mul(C, R.mul(y, y)), R.mul(D, R.mul(x, z))),
  ), R.add(R.mul(E, R.mul(y, z)), R.mul(F, R.mul(z, z))));
};

const circleDiscriminant = (R, conic) => {
  const [A, , , D, E, F] = conic;
  return R.sub(R.add(R.mul(D, D), R.mul(E, E)), R.mul(R.fromRat(4), R.mul(A, F)));
};

// Circle equation: A(x² + y²) + Dxz + Eyz + Fz² = 0.
const circleCenter = (R, O, P) => {
  const ox = O[0], oy = O[1], oz = O[2];
  const px = P[0], py = P[1], pz = P[2];
  const rx = R.sub(R.mul(oz, px), R.mul(ox, pz));
  const ry = R.sub(R.mul(oz, py), R.mul(oy, pz));
  const pz2 = R.mul(pz, pz), oz2 = R.mul(oz, oz);
  const A = R.mul(pz2, oz2);
  const D = R.neg(R.mul(R.fromRat(2), R.mul(pz2, R.mul(oz, ox))));
  const E = R.neg(R.mul(R.fromRat(2), R.mul(pz2, R.mul(oz, oy))));
  const F = R.sub(R.mul(pz2, R.add(R.mul(ox, ox), R.mul(oy, oy))), R.add(R.mul(rx, rx), R.mul(ry, ry)));
  return R.norm([A, R.zero, A, D, E, F]);
};

const circleThroughThree = (R, A, B, C) => {
  const row = (P) => [R.mul(P[0], P[2]), R.mul(P[1], P[2]), R.mul(P[2], P[2])];
  const rows = [row(A), row(B), row(C)];
  const rhs = (P) => R.neg(R.add(R.mul(P[0], P[0]), R.mul(P[1], P[1])));
  const q = [rhs(A), rhs(B), rhs(C)];
  const lead = det3(R, ...rows);
  const D = det3(R,
    [q[0], rows[0][1], rows[0][2]],
    [q[1], rows[1][1], rows[1][2]],
    [q[2], rows[2][1], rows[2][2]]);
  const E = det3(R,
    [rows[0][0], q[0], rows[0][2]],
    [rows[1][0], q[1], rows[1][2]],
    [rows[2][0], q[2], rows[2][2]]);
  const F = det3(R,
    [rows[0][0], rows[0][1], q[0]],
    [rows[1][0], rows[1][1], q[1]],
    [rows[2][0], rows[2][1], q[2]]);
  return R.norm([lead, R.zero, lead, D, E, F]);
};

const polarCircle = (R, Q, conic) => {
  const [A, B, , D, E, F] = conic;
  const half = R.fromRat(1, 2);
  return R.norm3([
    R.add(R.add(R.mul(A, Q[0]), R.mul(R.mul(half, B), Q[1])), R.mul(R.mul(half, D), Q[2])),
    R.add(R.add(R.mul(R.mul(half, B), Q[0]), R.mul(A, Q[1])), R.mul(R.mul(half, E), Q[2])),
    R.add(R.add(R.mul(R.mul(half, D), Q[0]), R.mul(R.mul(half, E), Q[1])), R.mul(F, Q[2])),
  ]);
};

// Rational parametrisation from a known point P on the circle. R=(1,t,0)
// is the moving direction; the second intersection with the circle is returned.
const circlePointOn = (R, conic, P, t) => {
  const [A, B, , D, E, F] = conic;
  const two = R.fromRat(2), half = R.fromRat(1, 2);
  const qR = R.add(R.add(A, R.mul(B, t)), R.mul(A, R.mul(t, t)));
  const bilinear = R.add(
    R.add(
      R.add(R.mul(A, P[0]), R.mul(R.mul(half, B), R.add(R.mul(P[0], t), P[1]))),
      R.mul(A, R.mul(P[1], t)),
    ),
    R.add(R.mul(R.mul(half, D), P[2]), R.mul(R.mul(half, E), R.mul(P[2], t))),
  );
  return R.norm3([
    R.sub(R.mul(P[0], qR), R.mul(two, bilinear)),
    R.sub(R.mul(P[1], qR), R.mul(two, R.mul(t, bilinear))),
    R.mul(P[2], qR),
  ]);
};

const reflectLine = (R, P, l) => {
  const [a, b, c] = l;
  return R.norm3([
    R.add(R.add(R.mul(R.sub(R.mul(b, b), R.mul(a, a)), P[0]), R.mul(R.neg(R.mul(R.fromRat(2), R.mul(a, b))), P[1])), R.mul(R.neg(R.mul(R.fromRat(2), R.mul(a, c))), P[2])),
    R.add(R.add(R.mul(R.neg(R.mul(R.fromRat(2), R.mul(a, b))), P[0]), R.mul(R.sub(R.mul(a, a), R.mul(b, b)), P[1])), R.mul(R.neg(R.mul(R.fromRat(2), R.mul(b, c))), P[2])),
    R.mul(R.add(R.mul(a, a), R.mul(b, b)), P[2]),
  ]);
};

const reflectPoint = (R, P, O) => R.norm3([
  R.sub(R.mul(R.fromRat(2), R.mul(O[0], P[2])), R.mul(P[0], O[2])),
  R.sub(R.mul(R.fromRat(2), R.mul(O[1], P[2])), R.mul(P[1], O[2])),
  R.mul(O[2], P[2]),
]);

const invertUnit = (R, P) => R.norm3([
  R.mul(P[0], P[2]), R.mul(P[1], P[2]), R.add(R.mul(P[0], P[0]), R.mul(P[1], P[1])),
]);

const invertCircle = (R, P, conic) => {
  const [A, , , D, E, F] = conic;
  const X = R.add(R.mul(R.fromRat(2), R.mul(A, P[0])), R.mul(D, P[2]));
  const Y = R.add(R.mul(R.fromRat(2), R.mul(A, P[1])), R.mul(E, P[2]));
  const S = R.add(R.mul(X, X), R.mul(Y, Y));
  const radiusTerm = R.sub(R.add(R.mul(D, D), R.mul(E, E)), R.mul(R.fromRat(4), R.mul(A, F)));
  return R.norm3([
    R.add(R.neg(R.mul(D, S)), R.mul(radiusTerm, R.mul(X, P[2]))),
    R.add(R.neg(R.mul(E, S)), R.mul(radiusTerm, R.mul(Y, P[2]))),
    R.mul(R.mul(R.fromRat(2), A), S),
  ]);
};

// P + s·Q : a degree-1 point on the line PQ
const linComb = (R, A, B, s) => R.norm3([
  R.add(A[0], R.mul(s, B[0])),
  R.add(A[1], R.mul(s, B[1])),
  R.add(A[2], R.mul(s, B[2])),
]);

// A point on the line ax + by + c = 0, parametrised without division.
const linePoint = (R, l, s) => R.norm3([
  R.sub(R.mul(l[1], s), R.mul(l[0], l[2])),
  R.sub(R.neg(R.mul(l[0], s)), R.mul(l[1], l[2])),
  R.add(R.mul(l[0], l[0]), R.mul(l[1], l[1])),
]);

// Internal angle bisector of angle ABC. Normalizing the two rays is
// intentionally kept in the real renderer; the polynomial degree engine marks
// this operation as non-polynomial instead of pretending the radicals vanish.
const angleBisector = (R, A, B, C) => {
  const points = [A, B, C].map((P) => [P[0] / P[2], P[1] / P[2]]);
  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return noPoint();
  const [[ax, ay], [bx, by], [cx, cy]] = points;
  const ux = ax - bx, uy = ay - by, vx = cx - bx, vy = cy - by;
  const uLength = Math.hypot(ux, uy), vLength = Math.hypot(vx, vy);
  if (uLength < 1e-12 || vLength < 1e-12) return noPoint();
  let dx = ux / uLength + vx / vLength, dy = uy / uLength + vy / vLength;
  if (Math.hypot(dx, dy) < 1e-12) { dx = ux / uLength - vx / vLength; dy = uy / uLength - vy / vLength; }
  return R.norm3([R.fromRat(-dy), R.fromRat(dx), R.fromRat(bx * dy - by * dx)]);
};

const circleData = (conic) => {
  const [A, , , D, E, F] = conic;
  if (Math.abs(A) < 1e-12) return null;
  const x = -D / (2 * A), y = -E / (2 * A);
  const radius2 = x * x + y * y - F / A;
  return radius2 >= -1e-10 ? { x, y, radius2 } : null;
};

const noPoint = () => [NaN, NaN, NaN];

const meetLineCircle = (R, line, conic, branch) => {
  const circle = circleData(conic), [a, b, c] = line;
  const norm2 = a * a + b * b;
  if (!circle || norm2 < 1e-12) return noPoint();
  const signedDistance = a * circle.x + b * circle.y + c;
  const x = circle.x - a * signedDistance / norm2;
  const y = circle.y - b * signedDistance / norm2;
  const h2 = circle.radius2 - signedDistance * signedDistance / norm2;
  if (h2 < -1e-10) return noPoint();
  const h = Math.sqrt(Math.max(0, h2) / norm2) * (Number(branch) === 1 ? -1 : 1);
  return R.norm3([x - b * h, y + a * h, 1]);
};

const meetCircles = (R, first, second, branch) => {
  const A = circleData(first), B = circleData(second);
  if (!A || !B) return noPoint();
  const dx = B.x - A.x, dy = B.y - A.y, distance = Math.hypot(dx, dy);
  if (distance < 1e-12) return noPoint();
  const along = (A.radius2 - B.radius2 + distance * distance) / (2 * distance);
  const h2 = A.radius2 - along * along;
  if (h2 < -1e-10) return noPoint();
  const h = Math.sqrt(Math.max(0, h2)) * (Number(branch) === 1 ? -1 : 1);
  return R.norm3([
    A.x + along * dx / distance - h * dy / distance,
    A.y + along * dy / distance + h * dx / distance,
    1,
  ]);
};

const NON_POLYNOMIAL = Symbol('non-polynomial intersection');

const KIND = {
  free: 'point', on: 'point', online: 'point', circle: 'point', meet: 'point', midpoint: 'point',
  circlepoint: 'point', meetlinecircle: 'point', meetcircles: 'point', reflectline: 'point', reflectpoint: 'point', invert: 'point',
  dir: 'point', perpdir: 'point',
  join: 'line', polar: 'line', perpline: 'line', perpbis: 'line', anglebis: 'line',
  parallel: 'line', unitcircle: 'conic', circlecenter: 'conic', circumcircle: 'conic',
};

const ARGS = {
  free: ['number', 'number'], circle: ['number', '?number'], unitcircle: [],
  circlecenter: ['point', 'point'], circumcircle: ['point', 'point', 'point'],
  circlepoint: ['conic', 'point', 'number', '?number'],
  on: ['point', 'point', 'number'], online: ['line', 'number', '?number'],
  join: ['point', 'point'], meet: ['line', 'line'],
  meetlinecircle: ['line', 'conic', 'branch'], meetcircles: ['conic', 'conic', 'branch'],
  polar: ['point', '?conic'], midpoint: ['point', 'point'],
  dir: ['line', '?branch'], perpdir: ['line'], perpline: ['point', 'line'], parallel: ['point', 'line'],
  perpbis: ['point', 'point'], anglebis: ['point', 'point', 'point'],
  reflectline: ['point', 'line'], reflectpoint: ['point', 'point'], invert: ['point', '?conic'],
};

const CLAIM_ARGS = {
  collinear: ['point', 'point', 'point'],
  concurrent: ['line', 'line', 'line'],
};

const fail = (st, message) => { throw new Error(`line ${st.line}: ${message}`); };

function validateNumber(st, token) {
  if (token === '$t') return;
  const m = NUMBER.exec(token);
  if (!m) fail(st, `expected a number, got ${token}`);
  const numerator = BigInt(m[1]), denominator = BigInt(m[2] || '1');
  if (denominator === 0n) fail(st, 'fraction denominator is zero');
  if (denominator % FIELD_PRIME === 0n) fail(st, `fraction denominator vanishes in F_${P}`);
  if (numerator !== 0n && numerator % FIELD_PRIME === 0n) fail(st, `number ${token} vanishes in F_${P}`);
  if (!Number.isSafeInteger(Number(numerator)) || !Number.isSafeInteger(Number(denominator))) {
    fail(st, `number ${token} is too large for an exact construction`);
  }
}

function validateArgs(st, expected, objects) {
  const required = expected.filter((kind) => !kind.startsWith('?')).length;
  if (st.args.length < required || st.args.length > expected.length) {
    fail(st, `${st.op} needs ${required}${required === expected.length ? '' : `–${expected.length}`} arguments`);
  }
  st.args.forEach((arg, i) => {
    const kind = expected[i].replace(/^\?/, '');
    if (kind === 'number') return validateNumber(st, arg);
    if (kind === 'branch') {
      if (!/^[01]$/.test(arg)) fail(st, 'intersection branch must be 0 or 1');
      return;
    }
    const actual = objects.get(arg);
    if (!actual) fail(st, `undefined object: ${arg}`);
    if (actual !== kind) fail(st, `${arg} is a ${actual}, but ${st.op} needs a ${kind}`);
  });
}

function validate(prog) {
  const objects = new Map();
  for (const st of prog) {
    const expected = st.claim ? CLAIM_ARGS[st.op] : ARGS[st.op];
    if (!expected) fail(st, `unknown ${st.claim ? 'claim' : 'construction'}: ${st.op}`);
    if (!st.claim && objects.has(st.name)) fail(st, `duplicate object: ${st.name}`);
    validateArgs(st, expected, objects);
    if (st.claim && new Set(st.args).size !== st.args.length) fail(st, 'claim objects must be distinct');
    if (!st.claim) objects.set(st.name, KIND[st.op]);
  }
  return prog;
}

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
  for (const [index, raw] of src.split('\n').entries()) {
    const hash = raw.indexOf('#');
    const body = (hash >= 0 ? raw.slice(0, hash) : raw).trim();
    const note = hash >= 0 ? raw.slice(hash + 1).trim() : '';
    if (!body) continue;
    if (/^claim(?:\s|$)/.test(body)) {
      const [, op, ...args] = body.split(/\s+/);
      prog.push({ claim: true, op, args, note, line: index + 1 });
    } else {
      const m = /^(\w+)\s*=\s*(\w+)\s*(.*)$/.exec(body);
      if (!m) throw new Error(`line ${index + 1}: cannot parse ${raw.trim()}`);
      prog.push({ name: m[1], op: m[2], args: m[3].split(/\s+/).filter(Boolean), note, line: index + 1 });
    }
  }
  return validate(prog);
}

export function run(prog, R, tval) {
  const env = Object.create(null);
  const steps = [];
  const obj = (s) => { if (!(s in env)) throw new Error('undefined object: ' + s); return env[s]; };
  const num = (s) => {
    if (s === '$t') return tval;
    const m = NUMBER.exec(s);
    if (!m) throw new Error('expected a number, got: ' + s);
    const n = Number(m[1]), d = Number(m[2] || '1');
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new Error('invalid number: ' + s);
    return R.fromRat(n, d);
  };
  const degOf = (s) => (R.deg ? R.deg(obj(s)) : null);
  const parameterDegree = (...args) => args.includes('$t') ? 1 : 0;

  for (const st of prog) {
    if (st.claim) {
      if (st.args.some((name) => env[name] === NON_POLYNOMIAL)) {
        steps.push({ ...st, kind: 'claim', statementDegree: null, alwaysTrue: null, casesNeeded: null, value: null, unsupported: true });
        continue;
      }
      const [a, b, c] = st.args.map(obj);
      const d = det3(R, a, b, c);
      const predicted = R.name === 'poly' ? st.args.reduce((s, n) => s + degOf(n), 0) : null;
      steps.push({
        ...st, kind: 'claim',
        statementDegree: predicted,
        alwaysTrue: R.isZero(d),
        casesNeeded: predicted === null ? null : predicted + 1,
        value: d,
      });
      continue;
    }
    if (st.args.some((name) => env[name] === NON_POLYNOMIAL) || (R.name === 'poly' && ['meetlinecircle', 'meetcircles', 'anglebis'].includes(st.op))) {
      env[st.name] = NON_POLYNOMIAL;
      steps.push({ ...st, kind: KIND[st.op] || 'point', value: NON_POLYNOMIAL, degree: null, naiveDegree: null, coincidences: null, unsupported: true });
      continue;
    }
    let v, naive = null;
    switch (st.op) {
      case 'free':      v = R.norm3([num(st.args[0]), num(st.args[1]), R.one]); break;
      case 'circle':    v = circlePoint(R, R.add(num(st.args[0]), st.args[1] ? num(st.args[1]) : R.zero)); break;
      case 'unitcircle': v = unitCircle(R); break;
      case 'circlecenter': v = circleCenter(R, obj(st.args[0]), obj(st.args[1])); naive = 2 * (degOf(st.args[0]) + degOf(st.args[1])); break;
      case 'circumcircle': v = circleThroughThree(R, obj(st.args[0]), obj(st.args[1]), obj(st.args[2])); naive = 2 * st.args.reduce((sum, name) => sum + degOf(name), 0); break;
      case 'circlepoint': {
        const conic = obj(st.args[0]), point = obj(st.args[1]);
        if (R.name === 'poly' && !R.isZero(conicAt(R, conic, point))) {
          fail(st, `${st.args[1]} must lie on ${st.args[0]} for circlepoint`);
        }
        v = circlePointOn(R, conic, point, R.add(num(st.args[2]), st.args[3] ? num(st.args[3]) : R.zero));
        naive = degOf(st.args[0]) + degOf(st.args[1]) + 2 * parameterDegree(st.args[2], st.args[3]); break;
      }
      case 'on':        v = linComb(R, obj(st.args[0]), obj(st.args[1]), num(st.args[2])); naive = Math.max(degOf(st.args[0]), degOf(st.args[1]) + parameterDegree(st.args[2])); break;
      case 'online': {
        const degree = degOf(st.args[0]), parameter = parameterDegree(st.args[1], st.args[2]);
        v = linePoint(R, obj(st.args[0]), R.add(num(st.args[1]), st.args[2] ? num(st.args[2]) : R.zero));
        naive = Math.max(2 * degree, degree + parameter); break;
      }
      case 'join':
      case 'meet':      v = cross(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'meetlinecircle': v = meetLineCircle(R, obj(st.args[0]), obj(st.args[1]), st.args[2]); break;
      case 'meetcircles': v = meetCircles(R, obj(st.args[0]), obj(st.args[1]), st.args[2]); break;
      case 'polar':     v = st.args[1] ? polarCircle(R, obj(st.args[0]), obj(st.args[1])) : polarUnit(R, obj(st.args[0])); naive = st.args[1] ? degOf(st.args[0]) + degOf(st.args[1]) : degOf(st.args[0]); break;
      case 'midpoint':  v = midpoint(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'dir':       v = dirOf(R, obj(st.args[0])); naive = degOf(st.args[0]); break;
      case 'perpdir':   v = perpDirOf(R, obj(st.args[0])); naive = degOf(st.args[0]); break;
      case 'perpline':  v = cross(R, obj(st.args[0]), perpDirOf(R, obj(st.args[1]))); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'parallel':  v = cross(R, obj(st.args[0]), dirOf(R, obj(st.args[1]))); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'perpbis': {
        const A = obj(st.args[0]), B = obj(st.args[1]);
        v = cross(R, midpoint(R, A, B), perpDirOf(R, cross(R, A, B)));
        naive = null; break;
      }
      case 'anglebis': v = angleBisector(R, obj(st.args[0]), obj(st.args[1]), obj(st.args[2])); naive = null; break;
      case 'reflectline': v = reflectLine(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + 2 * degOf(st.args[1]); break;
      case 'reflectpoint': v = reflectPoint(R, obj(st.args[0]), obj(st.args[1])); naive = degOf(st.args[0]) + degOf(st.args[1]); break;
      case 'invert': v = st.args[1] ? invertCircle(R, obj(st.args[0]), obj(st.args[1])) : invertUnit(R, obj(st.args[0])); naive = st.args[1] ? 2 * degOf(st.args[0]) + 3 * degOf(st.args[1]) : 2 * degOf(st.args[0]); break;
      default: throw new Error('unknown construction: ' + st.op);
    }
    if (R.name === 'poly' && v.every(R.isZero)) fail(st, `${st.name} is undefined for generic $t`);
    if (R.name === 'poly' && ['circlecenter', 'circumcircle'].includes(st.op)
      && (R.isZero(v[0]) || R.isZero(circleDiscriminant(R, v)))) {
      fail(st, `${st.name} is not a proper circle for generic $t`);
    }
    env[st.name] = v;
    const deg = R.deg ? R.deg(v) : null;
    if (naive !== null && deg !== null && naive < deg) naive = null;
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
