// figure.mjs — render a construction to a static SVG.
//
//     node tools/figure.mjs applets/gergonne.mmp figs/gergonne.svg [t]
//
// The point of this is that the static figure and the interactive figure come
// from the same construction, so they can never disagree. If you'd rather draw
// figures by hand in GeoGebra, ignore this file — build.py doesn't care where
// figs/<name>.* came from.
import { readFileSync, writeFileSync } from 'node:fs';
import { coords, parse } from '../site/static/mmp/engine.js';

const [, , input, output, tArg] = process.argv;
if (!input || !output) {
  console.error('usage: node tools/figure.mjs <construction.mmp> <out.svg> [t]');
  process.exit(2);
}
const t = tArg ? parseFloat(tArg) : 0.35;
const src = readFileSync(input, 'utf8');
const prog = parse(src);
const usesCircle = prog.some((s) => s.op === 'circle' || s.op === 'polar');

const V = { x0: -3.4, y0: -2.6, w: 6.8, h: 5.2 };
const clip = (a, b, c) => {
  const x1 = V.x0 + V.w, y1 = V.y0 + V.h, pts = [];
  const push = (x, y) => { if (x >= V.x0 - 1e-9 && x <= x1 + 1e-9 && y >= V.y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]); };
  if (Math.abs(b) > 1e-12) { push(V.x0, -(a * V.x0 + c) / b); push(x1, -(a * x1 + c) / b); }
  if (Math.abs(a) > 1e-12) { push(-(b * V.y0 + c) / a, V.y0); push(-(b * y1 + c) / a, y1); }
  return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
};

const run = coords(src, t);
const out = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${V.x0} ${-V.y0 - V.h} ${V.w} ${V.h}" width="680" height="520">`,
  '<style>.c{fill:none;stroke:#8a9099;stroke-width:.012}.l{stroke:#1f5d8c;stroke-width:.012}'
  + '.p{fill:#1b1d21}.f{fill:#9a4a12}.t{font:.16px sans-serif;fill:#5f6672}</style>',
];
if (usesCircle) out.push('<circle class="c" cx="0" cy="0" r="1"/>');
for (const s of run.steps) {
  if (!s.name) continue;
  const v = s.value;
  if (s.kind === 'line') {
    const seg = clip(v[0], v[1], v[2]);
    if (seg) out.push(`<line class="l" x1="${seg[0][0].toFixed(4)}" y1="${(-seg[0][1]).toFixed(4)}" x2="${seg[1][0].toFixed(4)}" y2="${(-seg[1][1]).toFixed(4)}"/>`);
  } else if (Math.abs(v[2]) > 1e-9) {
    const x = v[0] / v[2], y = -v[1] / v[2];
    if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 40 || Math.abs(y) > 40) continue;
    out.push(`<circle class="${s.args.includes('$t') ? 'f' : 'p'}" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}" r="0.055"/>`);
    out.push(`<text class="t" x="${(x + 0.1).toFixed(4)}" y="${(y - 0.1).toFixed(4)}">${s.name}</text>`);
  }
}
out.push('</svg>');
writeFileSync(output, out.join('\n') + '\n');
console.log(`wrote ${output} (t = ${t})`);
