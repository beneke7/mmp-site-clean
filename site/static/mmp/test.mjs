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

const parallel = `
A = free 0 0
B = free 1 1
L = join A B
P = free 0 2
q = parallel P L
`;
check('parallel degree', degrees(parallel).steps.find((s) => s.name === 'q').degree, 0);

const ideal = `${parallel}\nI = dir L 1`;
const idealData = degrees(ideal).steps.find((s) => s.name === 'I');
check('ideal point degree', idealData.degree, 0);
check('ideal point at infinity', coords(ideal, 0).env.I[2], 0);

const angle = `
A = free 0 1
B = free 0 0
C = free 1 0
L = anglebis A B C
`;
const angleCoords = coords(angle, 0).env.L;
const angleDegree = degrees(angle).steps.find((step) => step.name === 'L');
check('angle bisector line', Math.abs(angleCoords[0] + angleCoords[1]) < 1e-9 && Math.abs(angleCoords[2]) < 1e-9, true);
check('angle bisector degree unavailable', angleDegree.degree, null);

const movingOnConstructedLine = `
A = free 0 0
B = free 1 1
L = join A B
P = online L $t
`;
check('moving point on line', degrees(movingOnConstructedLine).steps.find((s) => s.name === 'P').degree, 1);
const movingCoords = coords(movingOnConstructedLine, 0.5).env.P;
check('moving point lies on line', Math.abs(movingCoords[0] - movingCoords[1]) < 1e-9, true);

const circlesAndTransforms = `
A = free 0 0
B = free 2 0
C = free 0 2
omega = circumcircle A B C
P = circlepoint omega A $t
L = join A B
R = reflectline C L
S = reflectpoint C A
Q = free 3 0
I = invert Q omega
`;
const ct = degrees(circlesAndTransforms);
const ctd = Object.fromEntries(ct.steps.filter((s) => s.name).map((s) => [s.name, s]));
check('circumcircle degree', ctd.omega.degree, 0);
check('circle point degree', ctd.P.degree, 2);
const drawnTransforms = coords(circlesAndTransforms, 0.4).env;
const circleValue = drawnTransforms.omega, circlePoint = drawnTransforms.P;
const circleEquation = circleValue[0] * (circlePoint[0] ** 2 + circlePoint[1] ** 2)
  + circleValue[3] * circlePoint[0] * circlePoint[2]
  + circleValue[4] * circlePoint[1] * circlePoint[2]
  + circleValue[5] * circlePoint[2] ** 2;
check('circle point lies on circle', Math.abs(circleEquation) < 1e-9, true);
check('reflection in line', Math.abs(drawnTransforms.R[1] / drawnTransforms.R[2] + 2) < 1e-9, true);
check('reflection in point', Math.abs(drawnTransforms.S[1] / drawnTransforms.S[2] + 2) < 1e-9, true);
check('circle inversion', Math.abs(drawnTransforms.I[0] / drawnTransforms.I[2] - 1.8) < 1e-9, true);

const offsetCircle = `
O = free 1 1
P = free 3 1
c = circlecenter O P
Q = circlepoint c P 1
`;
const offsetPoint = coords(offsetCircle, 0).env.Q;
const offsetCircleValue = coords(offsetCircle, 0).env.c;
const offsetEquation = offsetCircleValue[0] * (offsetPoint[0] ** 2 + offsetPoint[1] ** 2)
  + offsetCircleValue[3] * offsetPoint[0] * offsetPoint[2]
  + offsetCircleValue[4] * offsetPoint[1] * offsetPoint[2]
  + offsetCircleValue[5] * offsetPoint[2] ** 2;
check('off-center circle point', Math.abs(offsetEquation) < 1e-9, true);

const offsetMoving = `
O = free 1 1
P = free 3 1
c = circlecenter O P
Q = circlepoint c P $t 1
R = circlepoint c P $t -1
`;
const offsetMovingData = degrees(offsetMoving).steps.find((step) => step.name === 'Q');
check('offset circle point degree', offsetMovingData.degree, 2);
const offsetMovingPoint = coords(offsetMoving, 0).env.Q;
const offsetMovingSecond = coords(offsetMoving, 0).env.R;
const offsetMovingValue = coords(offsetMoving, 0).env.c;
const offsetMovingEquation = offsetMovingValue[0] * (offsetMovingPoint[0] ** 2 + offsetMovingPoint[1] ** 2)
  + offsetMovingValue[3] * offsetMovingPoint[0] * offsetMovingPoint[2]
  + offsetMovingValue[4] * offsetMovingPoint[1] * offsetMovingPoint[2]
  + offsetMovingValue[5] * offsetMovingPoint[2] ** 2;
check('offset moving point on circle', Math.abs(offsetMovingEquation) < 1e-9, true);
check('second offset moving point differs', Math.hypot(
  offsetMovingPoint[0] / offsetMovingPoint[2] - offsetMovingSecond[0] / offsetMovingSecond[2],
  offsetMovingPoint[1] / offsetMovingPoint[2] - offsetMovingSecond[1] / offsetMovingSecond[2],
) > 1e-6, true);

const circleIntersections = `
O = free 0 0
U = free 1 0
omega = circlecenter O U
L = free -2 0
R = free 2 0
l = join L R
P = meetlinecircle l omega 0
Q = meetlinecircle l omega 1
V = free 1 0
sigma = circlecenter V O
X = meetcircles omega sigma 0
Y = meetcircles omega sigma 1
`;
const intersections = coords(circleIntersections, 0).env;
const xy = (name) => intersections[name].map((value) => value / intersections[name][2]);
check('line-circle left point', Math.abs(xy('P')[0] + 1) < 1e-9, true);
check('line-circle right point', Math.abs(xy('Q')[0] - 1) < 1e-9, true);
check('circle-circle first point', Math.abs(xy('X')[0] - .5) < 1e-9 && Math.abs(Math.abs(xy('X')[1]) - Math.sqrt(.75)) < 1e-9, true);
check('circle-circle second point', Math.abs(xy('Y')[0] - .5) < 1e-9 && Math.abs(Math.abs(xy('Y')[1]) - Math.sqrt(.75)) < 1e-9, true);
check('intersection degree unavailable', degrees(circleIntersections).steps.find((step) => step.name === 'P').degree, null);

// the same construction, evaluated numerically, is what the picture draws
const drawn = coords(euler, 0.4);
const p = (n) => { const v = drawn.env[n]; return `(${(v[0] / v[2]).toFixed(3)}, ${(v[1] / v[2]).toFixed(3)})`; };
console.log(`  at t = 0.4:  H = ${p('H')}   G = ${p('G')}   O = ${p('O')}`);

console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
