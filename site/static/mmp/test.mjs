// test.mjs — run with `node test.mjs`. Checks the engine against two
// animations that are worked out by hand in the notes.
import { degrees, coords } from './engine.js';
import { I, fmul, fadd, P } from './poly.js';

let failures = 0;
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(28)} ${got}${ok ? '' : `  (expected ${want})`}`);
};

// sanity: i really is a square root of -1 in F_p
check('i^2 = -1', fmul(I, I), P - 1);

// ---------------------------------------------------------------- Gergonne
// Incircle animation, §5.2 of the contestants' notes: fix A, E, F and the
// incircle, animate D on the incircle with degree 2, prove AD, BE, CF concur.
const gergonne = `
E  = circle 3          # tangency point on CA, fixed
F  = circle -2         # tangency point on AB, fixed
D  = circle $t         # the animated point, degree 2 on the incircle
AB = polar F           # side AB is the polar of F
AC = polar E
BC = polar D           # side BC is the polar of D
A  = meet AB AC
B  = meet AB BC
C  = meet AC BC
AD = join A D
BE = join B E
CF = join C F
claim concurrent AD BE CF
`;

console.log('\nGergonne point (incircle animation)');
const g = degrees(gergonne);
const gd = Object.fromEntries(g.steps.filter((s) => s.name).map((s) => [s.name, s]));
check('deg D', gd.D.degree, 2);
check('deg BC', gd.BC.degree, 2);
check('deg B', gd.B.degree, 1);
check('#(AB = BC)', gd.B.coincidences, 1);
check('deg C', gd.C.degree, 1);
check('deg AD', gd.AD.degree, 2);
check('deg BE', gd.BE.degree, 1);
check('#(B = E)', gd.BE.coincidences, 0);
check('deg CF', gd.CF.degree, 1);
const gc = g.steps.find((s) => s.claim);
check('statement degree', gc.statementDegree, 4);
check('special cases needed', gc.casesNeeded, 5);
check('statement holds', gc.alwaysTrue, true);

// ------------------------------------------------------------------- Euler
// §9.3: A, B and line BC fixed, C moves on BC with degree 1. Show H, G, O
// are collinear.
const euler = `
A   = free 2 7
B   = free 0 0
Bx  = free 1 0
C   = on B Bx $t       # degree 1 along line BC
BC  = join B C
CA  = join C A
hA  = perpline A BC    # altitude from A
hB  = perpline B CA    # altitude from B
H   = meet hA hB       # orthocenter
pAB = perpbis A B
pBC = perpbis B C
O   = meet pAB pBC     # circumcenter
Mbc = midpoint B C
Mab = midpoint A B
m1  = join A Mbc
m2  = join C Mab
G   = meet m1 m2       # centroid
claim collinear H G O
`;

console.log('\nEuler line (two sides fixed)');
const e = degrees(euler);
for (const s of e.steps.filter((s) => s.name && 'HGO'.includes(s.name))) {
  console.log(`  deg ${s.name} = ${s.degree}` + (s.coincidences != null ? `  (naive ${s.naiveDegree}, reduced by ${s.coincidences})` : ''));
}
const ec = e.steps.find((s) => s.claim);
console.log(`  statement degree ${ec.statementDegree} -> ${ec.casesNeeded} special cases needed`);
check('H, G, O collinear', ec.alwaysTrue, true);

// the same construction, evaluated numerically, is what the picture draws
const drawn = coords(euler, 0.4);
const p = (n) => { const v = drawn.env[n]; return `(${(v[0] / v[2]).toFixed(3)}, ${(v[1] / v[2]).toFixed(3)})`; };
console.log(`  at t = 0.4:  H = ${p('H')}   G = ${p('G')}   O = ${p('O')}`);

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
