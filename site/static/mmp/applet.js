// applet.js — turns a construction listing into a figure you can move and a
// worksheet you can fill in. Progressive enhancement: without JS the reader
// still sees the static figure that the PDF uses.

import { degrees, coords, parse } from './engine.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

const VIEW = { x0: -3.4, y0: -2.6, w: 6.8, h: 5.2 };

function clipLine(a, b, c) {
  // a·x + b·y + c = 0 against the view rectangle
  const { x0, y0, w, h } = VIEW, x1 = x0 + w, y1 = y0 + h, pts = [];
  const push = (x, y) => { if (x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9) pts.push([x, y]); };
  if (Math.abs(b) > 1e-12) { push(x0, -(a * x0 + c) / b); push(x1, -(a * x1 + c) / b); }
  if (Math.abs(a) > 1e-12) { push(-(b * y0 + c) / a, y0); push(-(b * y1 + c) / a, y1); }
  return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
}

function render(svg, prog, t, usesCircle) {
  svg.textContent = '';
  let run;
  try { run = coords(prog, t); } catch { return; }

  if (usesCircle) svg.appendChild(el('circle', { cx: 0, cy: 0, r: 1, class: 'mmp-conic' }));

  for (const s of run.steps) {
    if (!s.name || s.hidden) continue;
    const v = s.value;
    if (s.kind === 'line') {
      const seg = clipLine(v[0], v[1], v[2]);
      if (!seg) continue;
      svg.appendChild(el('line', {
        x1: seg[0][0], y1: -seg[0][1], x2: seg[1][0], y2: -seg[1][1],
        class: 'mmp-line',
      }));
    } else {
      if (Math.abs(v[2]) < 1e-9) continue;           // ideal point: nothing to draw
      const x = v[0] / v[2], y = v[1] / v[2];
      if (!isFinite(x) || !isFinite(y)) continue;
      svg.appendChild(el('circle', { cx: x, cy: -y, r: 0.055, class: 'mmp-point' + (s.args.includes('$t') ? ' mmp-free' : '') }));
      const label = el('text', { x: x + 0.1, y: -y - 0.1, class: 'mmp-label' });
      label.textContent = s.name;
      svg.appendChild(label);
    }
  }
}

function stepText(s) {
  if (s.note) return s.note;
  const a = s.args.join(', ');
  return ({
    join: `line through ${a}`, meet: `intersection of ${a}`, polar: `polar of ${a}`,
    midpoint: `midpoint of ${a}`, perpbis: `perpendicular bisector of ${a}`,
    perpline: `through ${s.args[0]}, perpendicular to ${s.args[1]}`,
    dir: `ideal point of ${s.args[0]}`, perpdir: `perpendicular direction to ${s.args[0]}`,
    circle: 'on the fixed conic', free: 'fixed point', on: `on line ${s.args[0]}${s.args[1]}`,
  }[s.op] || `${s.op} ${a}`);
}

export function initApplets(root = document) {
  for (const box of root.querySelectorAll('.mmp[data-applet]')) {
    const srcEl = box.querySelector('script[type="text/mmp"]');
    if (!srcEl) continue;
    const src = srcEl.textContent;
    let prog, computed;
    try { prog = parse(src); computed = degrees(src); }
    catch (err) { box.querySelector('.mmp-error').textContent = 'Construction error: ' + err.message; continue; }

    const usesCircle = prog.some((s) => s.op === 'circle' || s.op === 'polar');
    box.classList.add('is-live');

    const svg = el('svg', { viewBox: `${VIEW.x0} ${-VIEW.y0 - VIEW.h} ${VIEW.w} ${VIEW.h}`, class: 'mmp-canvas' });
    box.querySelector('.mmp-figure').replaceChildren(svg);

    // worksheet
    const list = box.querySelector('.mmp-steps');
    const inputs = new Map();
    for (const s of computed.steps) {
      const li = document.createElement('li');
      if (s.claim) {
        li.className = 'mmp-claim';
        li.innerHTML = `<b>${s.op}</b> ${s.args.join(', ')} — statement degree
          <span class="mmp-answer">${s.statementDegree}</span>,
          so <b>${s.casesNeeded}</b> special cases suffice.`;
      } else {
        const inp = document.createElement('input');
        Object.assign(inp, { type: 'text', inputMode: 'numeric', size: 2, className: 'mmp-input' });
        inp.setAttribute('aria-label', `degree of ${s.name}`);
        inputs.set(inp, s);
        li.append(Object.assign(document.createElement('code'), { textContent: s.name }),
          document.createTextNode(' — ' + stepText(s) + ' '));
        li.append('(', inp, ')');
        if (s.coincidences) {
          const why = document.createElement('span');
          why.className = 'mmp-why';
          why.textContent = `${s.naiveDegree} − ${s.coincidences}`;
          li.append(' ', why);
        }
      }
      list.append(li);
    }

    // animation
    const slider = box.querySelector('.mmp-slider');
    const param = () => Math.tan(parseFloat(slider.value) * Math.PI / 2 * 0.98);
    const draw = () => render(svg, src, param(), usesCircle);
    slider.addEventListener('input', draw);
    draw();

    box.querySelector('[data-act="check"]').addEventListener('click', () => {
      for (const [inp, s] of inputs) {
        const given = inp.value.trim();
        inp.classList.toggle('is-right', given !== '' && Number(given) === s.degree);
        inp.classList.toggle('is-wrong', given !== '' && Number(given) !== s.degree);
      }
      box.classList.add('show-why');
    });
    box.querySelector('[data-act="reveal"]').addEventListener('click', () => {
      for (const [inp, s] of inputs) { inp.value = s.degree; inp.classList.add('is-right'); }
      box.classList.add('show-why');
    });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => initApplets());
