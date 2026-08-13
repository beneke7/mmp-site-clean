// applet.js — the student-facing interactive figure and degree worksheet.

import { degrees, coords, parse } from './engine.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const BASE_VIEW = { x0: -3.4, y0: -2.6, w: 6.8, h: 5.2 };
const PROOF_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#6b4c9a', '#b2182b', '#4d9221'];
const el = (tag, attrs = {}) => {
  const node = document.createElementNS(SVGNS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

function expandApplet(box) {
  const pane = document.getElementById('pane');
  const paneBody = pane?.querySelector('.pane-body');
  if (!paneBody) {
    const expanded = box.classList.toggle('is-expanded');
    document.body.classList.toggle('mmp-has-expanded', expanded);
    const button = box.querySelector('[data-act="expand"]');
    if (button) {
      button.textContent = expanded ? 'Close' : 'Expand';
      button.setAttribute('aria-expanded', String(expanded));
    }
    return;
  }
  const copy = box.cloneNode(true);
  copy.dataset.expandedCopy = 'true';
  document.querySelectorAll('.mmp-origin-expanded').forEach((item) => item.classList.remove('mmp-origin-expanded'));
  box.classList.add('mmp-origin-expanded');
  paneBody.replaceChildren(copy);
  document.body.classList.add('mmp-split');
  initApplets(paneBody);
}

function clipLine(a, b, c, view) {
  const { x0, y0, w, h } = view, x1 = x0 + w, y1 = y0 + h, points = [];
  const push = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < x0 - 1e-8 || x > x1 + 1e-8 || y < y0 - 1e-8 || y > y1 + 1e-8) return;
    if (!points.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-8)) points.push([x, y]);
  };
  if (Math.abs(b) > 1e-12) { push(x0, -(a * x0 + c) / b); push(x1, -(a * x1 + c) / b); }
  if (Math.abs(a) > 1e-12) { push(-(b * y0 + c) / a, y0); push(-(b * y1 + c) / a, y1); }
  if (points.length < 2) return null;
  let pair = [points[0], points[1]], longest = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const distance = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
    if (distance > longest) { longest = distance; pair = [points[i], points[j]]; }
  }
  return pair;
}

function circleGeometry(value) {
  if (!value || Math.abs(value[0]) < 1e-12) return null;
  const scale = value[0], dx = value[3] / scale, dy = value[4] / scale, constant = value[5] / scale;
  const x = -dx / 2, y = -dy / 2, radius2 = (dx * dx + dy * dy) / 4 - constant;
  return radius2 > 1e-9 ? { x, y, radius: Math.sqrt(radius2) } : null;
}

function pointXY(value) {
  if (!value || Math.abs(value[2]) < 1e-9) return null;
  const x = value[0] / value[2], y = value[1] / value[2];
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function labelPosition(x, y, text, occupied, line, units) {
  const width = Math.max(4, text.length * (line ? 7 : 8)) * units;
  const height = (line ? 13 : 15) * units;
  const gap = 8 * units;
  const candidates = line
    ? [[gap, -gap], [gap, 2 * gap], [-width - gap, -gap], [-width - gap, 2 * gap]]
    : [[10 * units, -12 * units], [10 * units, 18 * units], [-width - 10 * units, -12 * units], [-width - 10 * units, 18 * units], [14 * units, 4 * units]];
  const overlaps = (rect) => occupied.some((other) => rect.x < other.x + other.w && rect.x + rect.w > other.x && rect.y < other.y + other.h && rect.y + rect.h > other.y);
  for (const [dx, dy] of candidates) {
    const tx = x + dx, ty = y + dy, rect = { x: tx - 2 * units, y: ty - height, w: width, h: height * 1.2 };
    if (!overlaps(rect)) { occupied.push(rect); return [tx, ty]; }
  }
  return [x + candidates[0][0], y + candidates[0][1]];
}

function addDegreeBadge(layer, x, y, degree, color, occupied, units) {
  const radius = 7 * units, offset = 2.5 * radius;
  const candidates = [[x, y], [x + offset, y], [x, y - offset], [x, y + offset], [x - offset, y]];
  const overlaps = (cx, cy) => occupied.some((other) => cx - radius < other.x + other.w && cx + radius > other.x && cy - radius < other.y + other.h && cy + radius > other.y);
  const [cx, cy] = candidates.find(([px, py]) => !overlaps(px, py)) || candidates[0];
  occupied.push({ x: cx - radius, y: cy - radius, w: 2 * radius, h: 2 * radius });
  layer.append(
    el('circle', { cx, cy, r: radius, class: 'mmp-degree-ring', style: `--degree-color:${color}` }),
    Object.assign(el('text', { x: cx, y: cy, class: 'mmp-degree', 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `--degree-color:${color};font-size:${11 * units}px` }), { textContent: String(degree) }),
  );
}

function roleFor(name, degreeNames, claimNames, colors) {
  return colors.has(name) ? 'colored' : claimNames.has(name) ? 'important' : degreeNames.has(name) ? 'colored' : 'supporting';
}

function degreeColorMap(computed) {
  const names = computed.steps.filter((step) => step.name && step.degree != null && step.degree > 0).map((step) => step.name);
  return new Map(names.map((name, index) => [name, PROOF_COLORS[index % PROOF_COLORS.length]]));
}

function render(svg, src, prog, t, computed, view, showDegrees) {
  svg.textContent = '';
  svg.setAttribute('viewBox', `${view.x0} ${-(view.y0 + view.h)} ${view.w} ${view.h}`);
  const run = coords(src, t);

  const claimNames = new Set(computed.steps.filter((step) => step.claim).flatMap((step) => step.args));
  const degreeNames = new Set(computed.steps.filter((step) => step.name && step.degree != null && step.degree > 0).map((step) => step.name));
  const colors = degreeColorMap(computed);
  const degreeData = new Map(computed.steps.filter((step) => step.name).map((step) => [step.name, step]));
  const units = view.w / Math.max(1, svg.getBoundingClientRect().width || 600);
  const occupied = [];
  const conicLayer = el('g'), lineLayer = el('g'), pointLayer = el('g'), labelLayer = el('g'), degreeLayer = el('g');
  svg.append(conicLayer, lineLayer, pointLayer, labelLayer, degreeLayer);
  if (prog.some((step) => step.op === 'polar' && !step.args[1])) {
    conicLayer.appendChild(el('circle', { cx: 0, cy: 0, r: 1, class: 'mmp-conic mmp-supporting' }));
  }

  for (const step of run.steps) {
    if (!step.name || step.hidden) continue;
    const role = roleFor(step.name, degreeNames, claimNames, colors);
    const color = colors.get(step.name);
    const style = color ? `--object-color:${color}` : '';
    const classes = `mmp-${role}`;
    if (step.kind === 'conic') {
      const circle = circleGeometry(step.value);
      if (circle) conicLayer.appendChild(el('circle', { cx: circle.x, cy: -circle.y, r: circle.radius, class: `mmp-conic ${classes}`, style }));
      continue;
    }
    if (step.kind === 'line') {
      const segment = clipLine(step.value[0], step.value[1], step.value[2], view);
      if (!segment) continue;
      lineLayer.appendChild(el('line', { x1: segment[0][0], y1: -segment[0][1], x2: segment[1][0], y2: -segment[1][1], class: `mmp-line ${classes}`, style }));
      if (degreeNames.has(step.name) || claimNames.has(step.name)) {
        const args = step.args.map((name) => pointXY(run.env[name])).filter(Boolean);
        const anchor = args.length > 1 ? [(args[0][0] + args[1][0]) / 2, (args[0][1] + args[1][1]) / 2] : args[0] || [(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2];
        const [x, y] = labelPosition(anchor[0], -anchor[1], step.name, occupied, true, units);
        const label = Object.assign(el('text', { x, y, class: `mmp-label ${classes}`, style: `${style};font-size:${13 * units}px` }), { textContent: step.name });
        labelLayer.appendChild(label);
        const degree = degreeData.get(step.name)?.degree;
        if (showDegrees && degree != null && degreeNames.has(step.name)) addDegreeBadge(degreeLayer, x + Math.max(4, step.name.length * 7) * units + 4 * units, y - 2 * units, degree, color, occupied, units);
      }
      continue;
    }
    const point = pointXY(step.value);
    if (!point) continue;
    const [x, y] = point;
    pointLayer.appendChild(el('circle', { cx: x, cy: -y, r: 5 * units, class: `mmp-point ${classes}${step.args.includes('$t') ? ' mmp-animated' : ''}`, style }));
    const [labelX, labelY] = labelPosition(x, -y, step.name, occupied, false, units);
    labelLayer.appendChild(Object.assign(el('text', { x: labelX, y: labelY, class: `mmp-label ${classes}`, style: `${style};font-size:${15 * units}px` }), { textContent: step.name }));
    const degree = degreeData.get(step.name)?.degree;
    if (showDegrees && degree != null && degreeNames.has(step.name)) addDegreeBadge(degreeLayer, labelX + Math.max(4, step.name.length * 8) * units + 4 * units, labelY - 2 * units, degree, color, occupied, units);
  }
}

function stepText(step) {
  if (step.note) return step.note;
  const args = step.args.join(', ');
  return ({
    join: `line through ${args}`, meet: `intersection of ${args}`, polar: `polar of ${args}`,
    midpoint: `midpoint of ${args}`, perpbis: `perpendicular bisector of ${args}`,
    perpline: `through ${step.args[0]}, perpendicular to ${step.args[1]}`,
    circle: 'point on the unit circle', circlepoint: `point on ${step.args[0]}`,
    circlecenter: `circle through ${args}`, circumcircle: `circle through ${args}`,
    free: 'fixed point', on: `on line ${args}`, online: `on line ${step.args[0]}`,
  }[step.op] || `${step.op} ${args}`);
}

function pointAt(event, svg, view) {
  const rect = svg.getBoundingClientRect();
  return {
    x: view.x0 + (event.clientX - rect.left) / rect.width * view.w,
    y: view.y0 + (1 - (event.clientY - rect.top) / rect.height) * view.h,
  };
}

export function initApplets(root = document) {
  for (const box of root.querySelectorAll('.mmp[data-applet]')) {
    const srcEl = box.querySelector('script[type="text/mmp"]');
    if (!srcEl) continue;
    const src = srcEl.textContent;
    let prog, computed;
    try { prog = parse(src); computed = degrees(src); }
    catch (error) { box.querySelector('.mmp-error').textContent = 'Construction error: ' + error.message; continue; }

    box.classList.add('is-live');
    const svg = el('svg', { class: 'mmp-canvas', role: 'img', 'aria-label': 'Interactive geometric construction' });
    box.querySelector('.mmp-figure').replaceChildren(svg);
    const claimNames = new Set(computed.steps.filter((step) => step.claim).flatMap((step) => step.args));
    const focus = new Set(computed.focus?.length
      ? computed.focus
      : computed.steps.filter((step) => step.name && (step.degree > 0 || claimNames.has(step.name))).map((step) => step.name));
    const colors = degreeColorMap(computed);
    const list = box.querySelector('.mmp-steps');
    const inputs = new Map();
    let view = { ...BASE_VIEW };
    let showDegrees = box.dataset.degreesShown === 'true';
    let pan = null;

    const slider = box.querySelector('.mmp-slider');
    const parameter = () => Math.tan(parseFloat(slider.value) * Math.PI / 2 * 0.98);
    const draw = () => {
      try { render(svg, src, prog, parameter(), computed, view, showDegrees); }
      catch (error) { box.querySelector('.mmp-error').textContent = `Applet error: ${error.message}`; console.error(error); }
    };

    function renderWorksheet() {
      list.replaceChildren();
      inputs.clear();
      for (const step of computed.steps) {
        if (!step.claim && !focus.has(step.name)) continue;
        const row = document.createElement('li');
        if (step.claim) {
          row.className = 'mmp-claim';
          row.innerHTML = `<b>${step.op} ${step.args.join(', ')}</b> — statement degree ${step.statementDegree}, so ${step.casesNeeded} special cases suffice.`;
        } else {
          row.className = 'mmp-step mmp-focus';
          const name = Object.assign(document.createElement('code'), { textContent: step.name });
          if (colors.has(step.name)) name.style.color = colors.get(step.name);
          row.append(name, document.createTextNode(' — ' + stepText(step) + ' ('));
          const input = Object.assign(document.createElement('input'), { type: 'text', inputMode: 'numeric', size: 2, className: 'mmp-input' });
          input.setAttribute('aria-label', `degree of ${step.name}`);
          inputs.set(input, step);
          row.append(input, ')');
          if (step.coincidences) {
            const why = Object.assign(document.createElement('span'), { className: 'mmp-why', textContent: `${step.naiveDegree} − ${step.coincidences}` });
            row.append(' ', why);
          }
        }
        list.append(row);
      }
    }

    slider.addEventListener('input', draw);
    svg.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pan = { x: event.clientX, y: event.clientY, view: { ...view } };
      svg.classList.add('is-panning');
      svg.setPointerCapture?.(event.pointerId);
    });
    svg.addEventListener('pointermove', (event) => {
      if (!pan) return;
      const rect = svg.getBoundingClientRect();
      view = { ...pan.view, x0: pan.view.x0 - (event.clientX - pan.x) * pan.view.w / rect.width, y0: pan.view.y0 + (event.clientY - pan.y) * pan.view.h / rect.height };
      draw();
    });
    const endPan = () => { pan = null; svg.classList.remove('is-panning'); };
    svg.addEventListener('pointerup', endPan);
    svg.addEventListener('pointercancel', endPan);
    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const before = pointAt(event, svg, view);
      const factor = Math.min(1.12, Math.max(.89, Math.exp(event.deltaY * .0008)));
      const width = Math.min(28, Math.max(1.4, view.w * factor));
      const height = view.h * width / view.w;
      view = { w: width, h: height, x0: before.x - (before.x - view.x0) * width / view.w, y0: before.y - (before.y - view.y0) * height / view.h };
      draw();
    }, { passive: false });

    const expand = box.querySelector('[data-act="expand"]');
    if (box.dataset.expandedCopy === 'true') expand?.remove();
    else expand?.addEventListener('click', () => expandApplet(box));
    box.querySelector('[data-act="check"]')?.addEventListener('click', () => {
      for (const [input, step] of inputs) {
        const given = input.value.trim(), right = given !== '' && step.degree != null && Number(given) === Number(step.degree);
        input.classList.toggle('is-right', right);
        input.classList.toggle('is-wrong', given !== '' && !right);
      }
      box.classList.add('show-why');
    });
    box.querySelector('[data-act="reveal"]')?.addEventListener('click', () => {
      showDegrees = true;
      box.dataset.degreesShown = 'true';
      for (const [input, step] of inputs) { input.value = step.degree ?? ''; input.classList.add('is-right'); }
      box.classList.add('show-why');
      draw();
    });
    renderWorksheet();
    draw();
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => initApplets());
if (typeof document !== 'undefined') document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const box = document.querySelector('.mmp.is-expanded');
  if (!box) return;
  box.classList.remove('is-expanded');
  document.body.classList.remove('mmp-has-expanded');
  const button = box.querySelector('[data-act="expand"]');
  if (button) { button.textContent = 'Expand'; button.setAttribute('aria-expanded', 'false'); }
});
