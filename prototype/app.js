import { coords, degrees } from '../site/static/mmp/engine.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const BASE_VIEW = { x0: -3.4, y0: -2.6, w: 6.8, h: 5.2 };
let VIEW = { ...BASE_VIEW };
const PROOF_COLORS = ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9', '#6b4c9a', '#b2182b', '#4d9221', '#8c510a', '#1b9e77', '#7570b3', '#e7298a', '#a6761d'];
const $ = (id) => document.getElementById(id);
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVGNS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

const OUTPUT_KIND = {
  free: 'point', circle: 'point', circlepoint: 'point', on: 'point', online: 'point', meet: 'point', midpoint: 'point',
  meetlinecircle: 'point', meetcircles: 'point', reflectline: 'point', reflectpoint: 'point', invert: 'point',
  join: 'line', perpline: 'line', perpbis: 'line', anglebis: 'line', parallel: 'line', dir: 'point', perpdir: 'point', polar: 'line',
  unitcircle: 'conic', circlecenter: 'conic', circumcircle: 'conic',
};

const TOOLS = [
  { group: 'Points', id: 'move', label: 'Move / drag', icon: 'move', action: 'move' },
  { group: 'Points', id: 'fixed', label: 'Fixed point', icon: 'point', action: 'fixed', op: 'free' },
  { group: 'Points', id: 'on-line', label: 'Moving point · line', icon: 'point-line', action: 'moving-line', op: 'online', pick: ['line'] },
  { group: 'Points', id: 'on-circle', label: 'Moving point · circle', icon: 'circle-point', action: 'moving-circle', op: 'circlepoint', pick: ['conic'] },

  { group: 'Lines', id: 'segment', label: 'Segment', icon: 'segment', action: 'pick', op: 'join', shape: 'segment', pick: ['point', 'point'] },
  { group: 'Lines', id: 'line', label: 'Line', icon: 'line', action: 'pick', op: 'join', shape: 'line', pick: ['point', 'point'] },
  { group: 'Lines', id: 'ray', label: 'Ray', icon: 'ray', action: 'pick', op: 'join', shape: 'ray', pick: ['point', 'point'] },

  { group: 'Construct', id: 'intersection', label: 'Intersection', icon: 'intersection', action: 'intersection' },
  { group: 'Construct', id: 'midpoint', label: 'Midpoint', icon: 'midpoint', action: 'pick', op: 'midpoint', pick: ['point', 'point'] },
  { group: 'Construct', id: 'perpendicular', label: 'Perpendicular', icon: 'perpendicular', action: 'pick', op: 'perpline', pick: ['point', 'line'] },
  { group: 'Construct', id: 'bisector', label: 'Perpendicular bisector', icon: 'bisector', action: 'pick', op: 'perpbis', pick: ['point', 'point'] },
  { group: 'Construct', id: 'parallel', label: 'Parallel', icon: 'parallel', action: 'pick', op: 'parallel', pick: ['point', 'line'] },
  { group: 'Construct', id: 'direction', label: 'Direction', icon: 'direction', action: 'pick', op: 'dir', pick: ['line'] },
  { group: 'Construct', id: 'perp-direction', label: 'Perpendicular direction', icon: 'perpendicular', action: 'pick', op: 'perpdir', pick: ['line'] },

  { group: 'Transform', id: 'reflect-line', label: 'Reflect · line', icon: 'reflect-line', action: 'pick', op: 'reflectline', pick: ['point', 'line'] },
  { group: 'Transform', id: 'reflect-point', label: 'Reflect · point', icon: 'reflect-point', action: 'pick', op: 'reflectpoint', pick: ['point', 'point'] },
  { group: 'Transform', id: 'invert', label: 'Invert · circle', icon: 'invert', action: 'pick', op: 'invert', pick: ['point', 'conic'] },

  { group: 'Circle / angle', id: 'fixed-conic', label: 'Unit circle', icon: 'circle', action: 'conic', op: 'unitcircle' },
  { group: 'Circle / angle', id: 'tangent', label: 'Polar / tangent', icon: 'tangent', action: 'pick', op: 'polar', pick: ['point', 'conic'] },
  { group: 'Circle / angle', id: 'angle-bisector', label: 'Angle bisector', icon: 'angle', action: 'pick', op: 'anglebis', pick: ['point', 'point', 'point'] },
  { group: 'Circle / angle', id: 'circle-center', label: 'Circle · center', icon: 'circle', action: 'pick', op: 'circlecenter', pick: ['point', 'point'] },
  { group: 'Circle / angle', id: 'circumcircle', label: 'Circumcircle', icon: 'circumcircle', action: 'pick', op: 'circumcircle', pick: ['point', 'point', 'point'] },
];

const TOOL_BY_ID = new Map(TOOLS.map((tool) => [tool.id, tool]));

const EXAMPLE = {
  points: [],
  steps: [
    { name: 'omega', op: 'unitcircle', tool: 'fixed-conic', args: [], note: 'reference circle' },
    { name: 'E', op: 'circle', tool: 'on-circle', args: ['3'], note: 'fixed tangency point' },
    { name: 'F', op: 'circle', tool: 'on-circle', args: ['-2'], note: 'fixed tangency point' },
    { name: 'D', op: 'circle', tool: 'on-circle', args: ['$t'], note: 'animated point' },
    { name: 'AB', op: 'polar', tool: 'tangent', args: ['F', 'omega'] },
    { name: 'AC', op: 'polar', tool: 'tangent', args: ['E', 'omega'] },
    { name: 'BC', op: 'polar', tool: 'tangent', args: ['D', 'omega'] },
    { name: 'A', op: 'meet', tool: 'intersection', args: ['AB', 'AC'] },
    { name: 'B', op: 'meet', tool: 'intersection', args: ['AB', 'BC'] },
    { name: 'C', op: 'meet', tool: 'intersection', args: ['AC', 'BC'] },
    { name: 'AD', op: 'join', tool: 'line', args: ['A', 'D'] },
    { name: 'BE', op: 'join', tool: 'line', args: ['B', 'E'] },
    { name: 'CF', op: 'join', tool: 'line', args: ['C', 'F'] },
  ],
  focus: ['D', 'BC', 'A', 'B', 'C', 'AD', 'BE', 'CF'],
  claim: { op: 'concurrent', args: ['AD', 'BE', 'CF'] },
};

let state;
const undoStack = [];
const redoStack = [];
let sidebarResize = null;

function rational(value) {
  const text = String(value).trim();
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(text) || !text.includes('.')) return text;
  const [whole, fraction] = text.split('.');
  const sign = whole.startsWith('-') ? -1 : 1;
  const numerator = sign * (Math.abs(Number(whole)) * 10 ** fraction.length + Number(fraction));
  const denominator = 10 ** fraction.length;
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  const divisor = gcd(numerator, denominator);
  const n = numerator / divisor, d = denominator / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

function freshState() {
  return {
    points: EXAMPLE.points.map((p) => ({ ...p })),
    steps: EXAMPLE.steps.map((s) => ({ ...s, args: [...s.args] })),
    focus: new Set(EXAMPLE.focus),
    claim: { op: EXAMPLE.claim.op, args: [...EXAMPLE.claim.args] },
    answers: Object.create(null),
    t: 2, picks: [], hover: null, dragging: null, panning: null, suppressClick: false, selectedTool: 'move',
    previewStep: null, showDegrees: new Set(), degreeDefaults: false, sidebarOpen: true,
  };
}

function snapshotState() {
  return {
    points: state.points.map((point) => ({ ...point })),
    steps: state.steps.map((step) => ({ ...step, args: [...step.args] })),
    focus: [...state.focus],
    claim: { op: state.claim.op, args: [...state.claim.args] },
    answers: { ...state.answers },
    t: state.t,
    showDegrees: [...state.showDegrees],
    degreeDefaults: state.degreeDefaults,
  };
}

function restoreState(snapshot) {
  const current = state;
  state = {
    ...current,
    points: snapshot.points.map((point) => ({ ...point })),
    steps: snapshot.steps.map((step) => ({ ...step, args: [...step.args] })),
    focus: new Set(snapshot.focus),
    claim: { op: snapshot.claim.op, args: [...snapshot.claim.args] },
    answers: Object.assign(Object.create(null), snapshot.answers),
    t: snapshot.t,
    showDegrees: new Set(snapshot.showDegrees || []),
    degreeDefaults: Boolean(snapshot.degreeDefaults),
    picks: [], hover: null, dragging: null, panning: null, suppressClick: false,
  };
  setSliderFromT();
  VIEW = { ...BASE_VIEW };
  $('stepSlider').value = Number.isFinite(state.previewStep) ? state.previewStep : state.steps.length;
  renderPalette(); renderToolHelp(); refresh();
}

function checkpoint() {
  undoStack.push(snapshotState());
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

function undo() {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  redoStack.push(snapshotState());
  restoreState(snapshot);
}

function redo() {
  const snapshot = redoStack.pop();
  if (!snapshot) return;
  undoStack.push(snapshotState());
  restoreState(snapshot);
}

function source() {
  const lines = state.points.map((p) => `${p.name} = free ${rational(p.x)} ${rational(p.y)}`);
  lines.push(...state.steps.map((s) => {
    const args = s.args.map((arg, index) => (
      s.op === 'circle' || (s.op === 'on' && index === 2) || (s.op === 'online' && index === 1) || (s.op === 'circlepoint' && index >= 2)
    ) ? rational(arg) : arg);
    return `${s.name} = ${s.op} ${args.join(' ')}${s.note ? ` # ${s.note}` : ''}`;
  }));
  if (state.claim.args.length === 3 && state.claim.args.every(Boolean)) {
    lines.push(`claim ${state.claim.op} ${state.claim.args.join(' ')}`);
  }
  return lines.join('\n');
}

function constructionJSON() {
  return JSON.stringify({
    version: 1,
    points: state.points,
    steps: state.steps,
    focus: [...state.focus],
    claim: state.claim,
    answers: state.answers,
    t: state.t,
  }, null, 2) + '\n';
}

function result() {
  try { return { data: degrees(source()), error: '' }; }
  catch (error) { return { data: null, error: error.message }; }
}

function objects() {
  const list = state.points.map((p) => ({ name: p.name, kind: 'point' }));
  for (const s of state.steps) list.push({ name: s.name, kind: OUTPUT_KIND[s.op] || 'point' });
  return list;
}

function choices(kind) {
  return objects().filter((object) => object.kind === kind);
}

function nextName(kind) {
  const used = new Set(objects().map((object) => object.name));
  if (kind === 'conic') {
    let index = 1;
    while (used.has(index === 1 ? 'omega' : `omega${index}`)) index++;
    return index === 1 ? 'omega' : `omega${index}`;
  }
  const alphabet = kind === 'line' ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const name of alphabet) if (!used.has(name)) return name;
  let index = 1;
  while (used.has(`${kind === 'line' ? 'l' : 'P'}${index}`)) index++;
  return `${kind === 'line' ? 'l' : 'P'}${index}`;
}

function pointFromEvent(event) {
  const point = $('canvas').createSVGPoint();
  point.x = event.clientX; point.y = event.clientY;
  const local = point.matrixTransform($('canvas').getScreenCTM().inverse());
  return { x: local.x, y: -local.y };
}

function viewUnitsPerPixel() {
  const rect = $('canvas').getBoundingClientRect();
  return Math.max(VIEW.w / (rect.width || 1), VIEW.h / (rect.height || 1));
}

function pointPickRadius() {
  return 15 * viewUnitsPerPixel();
}

function resetView() {
  VIEW = { ...BASE_VIEW };
}

function setView() {
  const rect = $('canvas').getBoundingClientRect();
  if (rect.width && rect.height) {
    const aspect = rect.width / rect.height;
    if (aspect > VIEW.w / VIEW.h) {
      const width = VIEW.h * aspect;
      VIEW = { ...VIEW, x0: VIEW.x0 - (width - VIEW.w) / 2, w: width };
    } else {
      const height = VIEW.w / aspect;
      VIEW = { ...VIEW, y0: VIEW.y0 - (height - VIEW.h) / 2, h: height };
    }
  }
  $('canvas').setAttribute('viewBox', `${VIEW.x0} ${VIEW.y0} ${VIEW.w} ${VIEW.h}`);
}

function shortNumber(value) {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function setSliderFromT() {
  const value = Math.atan(state.t) / (Math.PI / 2 * .98);
  $('slider').value = Math.max(-1, Math.min(1, value));
  updateRange($('slider'));
}

function updateRange(input) {
  const min = Number(input.min), max = Number(input.max), value = Number(input.value);
  const progress = max > min ? (value - min) / (max - min) * 100 : 0;
  input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, progress))}%`);
}

function engineStep(data, name) {
  return data?.steps.find((step) => step.name === name);
}

function expected(data, name) {
  const step = engineStep(data, name);
  return state.answers[name] ?? step?.degree ?? null;
}

function clipLine(a, b, c) {
  const { x0, y0, w, h } = VIEW;
  const x1 = x0 + w, mathY0 = -(y0 + h), mathY1 = -y0, points = [];
  const push = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < x0 - 1e-8 || x > x1 + 1e-8 || y < mathY0 - 1e-8 || y > mathY1 + 1e-8) return;
    if (!points.some(([px, py]) => Math.hypot(px - x, py - y) < 1e-8)) points.push([x, y]);
  };
  if (Math.abs(b) > 1e-12) { push(x0, -(a * x0 + c) / b); push(x1, -(a * x1 + c) / b); }
  if (Math.abs(a) > 1e-12) { push(-(b * mathY0 + c) / a, mathY0); push(-(b * mathY1 + c) / a, mathY1); }
  if (points.length < 2) return null;
  let farthest = [points[0], points[1]], distance = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const next = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
    if (next > distance) { distance = next; farthest = [points[i], points[j]]; }
  }
  return farthest;
}

function pointXY(value) {
  if (!value || Math.abs(value[2]) < 1e-9) return null;
  return [value[0] / value[2], value[1] / value[2]];
}

function circleGeometry(value) {
  if (!value || Math.abs(value[0]) < 1e-9) return null;
  const scale = value[0];
  const dx = value[3] / scale, dy = value[4] / scale, constant = value[5] / scale;
  const center = { x: -dx / 2, y: -dy / 2 };
  const radius2 = (dx * dx + dy * dy) / 4 - constant;
  return radius2 > 1e-9 ? { ...center, radius: Math.sqrt(radius2) } : null;
}

function nearestCirclePoint(value, point) {
  const circle = circleGeometry(value);
  if (!circle) return null;
  const dx = point.x - circle.x, dy = point.y - circle.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-8) return null;
  return {
    point: { x: circle.x + dx * circle.radius / distance, y: circle.y + dy * circle.radius / distance },
    distance: Math.abs(distance - circle.radius),
  };
}

function circleParameter(point, value) {
  const circle = circleGeometry(value) || { x: 0, y: 0, radius: 1 };
  const x = (point.x - circle.x) / circle.radius, y = (point.y - circle.y) / circle.radius;
  const denominator = 1 + x;
  return Math.abs(denominator) > 1e-8 ? y / denominator : Math.sign(y || 1) * 30;
}

function circleChordParameter(anchorValue, point) {
  const anchor = pointXY(anchorValue);
  if (!anchor) return 0;
  const dx = point.x - anchor[0], dy = point.y - anchor[1];
  return Math.abs(dx) > 1e-8 ? dy / dx : Math.sign(dy || 1) * 30;
}

function phaseFor(parameter) {
  return shortNumber(parameter - state.t);
}

function withPhase(args, parameter) {
  const phase = phaseFor(parameter);
  return Math.abs(phase) < 1e-8 ? args : [...args, String(phase)];
}

function circleAnchor(step) {
  if (step?.op === 'circlecenter') return step.args[1];
  if (step?.op === 'circumcircle') return step.args[0];
  return null;
}

function displayLine(step, value, drawn, shape) {
  if (shape !== 'segment' && shape !== 'ray') return clipLine(value[0], value[1], value[2]);
  const first = pointXY(drawn.env[step.args[0]]), second = pointXY(drawn.env[step.args[1]]);
  if (!first || !second) return clipLine(value[0], value[1], value[2]);
  if (shape === 'segment') return [first, second];
  const full = clipLine(value[0], value[1], value[2]);
  if (!full) return null;
  const direction = [second[0] - first[0], second[1] - first[1]];
  const end = full.filter(([x, y]) => (x - first[0]) * direction[0] + (y - first[1]) * direction[1] >= -1e-8)
    .sort((a, b) => ((b[0] - first[0]) ** 2 + (b[1] - first[1]) ** 2) - ((a[0] - first[0]) ** 2 + (a[1] - first[1]) ** 2))[0];
  return end ? [first, end] : full;
}

function nearestLinePoint(step, value, drawn, point, shape) {
  const a = value[0], b = value[1], c = value[2];
  const norm = a * a + b * b;
  if (norm < 1e-12) return null;
  const error = (a * point.x + b * point.y + c) / norm;
  const projected = { x: point.x - a * error, y: point.y - b * error };
  if (shape === 'segment' || shape === 'ray') {
    const first = pointXY(drawn.env[step.args[0]]), second = pointXY(drawn.env[step.args[1]]);
    if (!first || !second) return null;
    const dx = second[0] - first[0], dy = second[1] - first[1];
    const length2 = dx * dx + dy * dy;
    const along = length2 ? ((projected.x - first[0]) * dx + (projected.y - first[1]) * dy) / length2 : 0;
    if (shape === 'segment' && (along < 0 || along > 1)) return null;
    if (shape === 'ray' && along < 0) return null;
  }
  return { point: projected, distance: Math.abs(error) * Math.sqrt(norm) };
}

function snapPoint(point, excludedName) {
  let best = null;
  const consider = (candidate) => {
    if (candidate && (!best || candidate.distance < best.distance)) best = candidate;
  };
  let drawn;
  try { drawn = coords(source(), state.t); } catch { return point; }
  const stateSteps = new Map(state.steps.map((step) => [step.name, step]));
  for (const step of drawn.steps) {
    const definition = stateSteps.get(step.name);
    if (step.name === excludedName || definition?.args.includes(excludedName)) continue;
    if (step.kind === 'point') {
      const candidate = pointXY(step.value);
      if (candidate) consider({ point: { x: candidate[0], y: candidate[1] }, distance: Math.hypot(point.x - candidate[0], point.y - candidate[1]) });
    }
    if (step.kind === 'line') consider(nearestLinePoint(step, step.value, drawn, point, TOOL_BY_ID.get(definition?.tool)?.shape || 'line'));
    if (step.kind === 'conic') consider(nearestCirclePoint(step.value, point));
  }
  const intersection = nearestIntersection(point);
  if (intersection) consider({ point: { x: intersection.point[0], y: intersection.point[1] }, distance: intersection.distance });
  const tolerance = Math.min(.2, Math.max(.08, 12 * viewUnitsPerPixel()));
  return best && best.distance <= tolerance ? best.point : point;
}

function nearestIntersection(point) {
  // ponytail: O(n²) probe scan per snap; cache locus pairs if constructions grow large.
  const loci = state.steps.filter((step) => ['line', 'conic'].includes(OUTPUT_KIND[step.op]));
  if (loci.length < 2) return null;
  const probes = [];
  const used = new Set(objects().map((object) => object.name));
  let probeIndex = 0;
  const probeName = () => {
    while (used.has(`__pick${probeIndex}`)) probeIndex++;
    const name = `__pick${probeIndex++}`;
    used.add(name);
    return name;
  };
  for (let first = 0; first < loci.length; first++) for (let second = first + 1; second < loci.length; second++) {
    const a = loci[first], b = loci[second];
    const aKind = OUTPUT_KIND[a.op] === 'line' ? 'line' : 'conic';
    const bKind = OUTPUT_KIND[b.op] === 'line' ? 'line' : 'conic';
    let op = 'meet', args = [a.name, b.name], count = 1;
    if (aKind === 'line' && bKind === 'conic') { op = 'meetlinecircle'; count = 2; }
    else if (aKind === 'conic' && bKind === 'line') { op = 'meetlinecircle'; args = [b.name, a.name]; count = 2; }
    else if (aKind === 'conic' && bKind === 'conic') { op = 'meetcircles'; count = 2; }
    for (let branch = 0; branch < count; branch++) probes.push({ name: probeName(), op, args, branch, count });
  }
  if (!probes.length) return null;
  const base = source().split('\n').filter((line) => !line.startsWith('claim ')).join('\n');
  let drawn;
  try { drawn = coords(`${base}\n${probes.map((probe) => `${probe.name} = ${probe.op} ${probe.args.join(' ')}${probe.count === 1 ? '' : ` ${probe.branch}`}`).join('\n')}`, state.t); } catch { return null; }
  let best = null;
  for (const probe of probes) {
    const candidate = pointXY(drawn.env[probe.name]);
    if (!candidate) continue;
    const distance = Math.hypot(point.x - candidate[0], point.y - candidate[1]);
    if (!best || distance < best.distance) best = { ...probe, point: candidate, distance };
  }
  return best && best.distance <= pointPickRadius() ? best : null;
}

function draggableObject(name) {
  const point = state.points.find((item) => item.name === name);
  if (point) return { kind: 'free', object: point };
  const step = state.steps.find((item) => item.name === name);
  if (step?.op === 'circle' || step?.op === 'circlepoint') return { kind: 'circle', object: step };
  return null;
}

function updateDraggedPoint(drag, point) {
  if (drag.kind === 'free') {
    const snapped = snapPoint(point, drag.name);
    drag.object.x = shortNumber(snapped.x);
    drag.object.y = shortNumber(snapped.y);
  } else {
    const drawn = coords(source(), state.t);
    const parameter = drag.object.op === 'circlepoint'
      ? circleChordParameter(drawn.env[drag.object.args[1]], point)
      : circleParameter(point, [1, 0, 1, 0, 0, -1]);
    const index = drag.object.op === 'circlepoint' ? 2 : 0;
    if (drag.object.args[index] === '$t') {
      drag.object.args[index + 1] = String(phaseFor(parameter));
    } else {
      drag.object.args[index] = String(shortNumber(parameter));
    }
  }
  renderVisuals();
}

function renderPreview(canvas, drawn) {
  const tool = TOOL_BY_ID.get(state.selectedTool);
  if (!state.hover || !['segment', 'line', 'ray'].includes(tool?.id) || state.picks.length !== 1) return;
  const start = pointXY(drawn.env[state.picks[0]]);
  if (!start) return;
  const preview = svgEl('line', {
    x1: start[0], y1: -start[1], x2: state.hover.x, y2: -state.hover.y,
    class: 'construction-preview',
  });
  canvas.appendChild(preview);
}

function visibleNames() {
  let visible = new Set(objects().map((object) => object.name));
  if (Number.isFinite(state.previewStep)) {
    const preview = new Set(state.points.map((point) => point.name));
    state.steps.slice(0, state.previewStep).forEach((step) => preview.add(step.name));
    visible = new Set([...visible].filter((name) => preview.has(name)));
  }
  return visible;
}

function proofFocus() {
  return new Set([...state.focus, ...state.claim.args]);
}

function proofColorMap() {
  return new Map(objects().filter((object) => state.showDegrees.has(object.name)).map((object, index) => [object.name, PROOF_COLORS[index] || `hsl(${(index * 137.5) % 360} 68% 36%)`]));
}

function lineLabelAnchor(step, drawn, segment) {
  if (step.op === 'anglebis') {
    const vertex = pointXY(drawn.env[step.args[1]]);
    if (vertex) return vertex;
  }
  const points = step.args.map((name) => pointXY(drawn.env[name])).filter(Boolean);
  if (points.length > 1) return [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
  if (points.length) return points[0];
  return [(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2];
}

function labelPosition(x, y, text, occupied, line = false, unitsPerPixel = 1) {
  const width = Math.max(4, text.length * (line ? 7 : 8)) * unitsPerPixel;
  const height = (line ? 13 : 15) * unitsPerPixel;
  const gap = 8 * unitsPerPixel;
  const candidates = line
    ? [[gap, -gap], [gap, 2 * gap], [-width - gap, -gap], [-width - gap, 2 * gap]]
    : [[10 * unitsPerPixel, -12 * unitsPerPixel], [10 * unitsPerPixel, 18 * unitsPerPixel], [-width - 10 * unitsPerPixel, -12 * unitsPerPixel], [-width - 10 * unitsPerPixel, 18 * unitsPerPixel], [14 * unitsPerPixel, 4 * unitsPerPixel], [-width - 14 * unitsPerPixel, 4 * unitsPerPixel]];
  const overlaps = (rect) => occupied.some((other) => rect.x < other.x + other.w && rect.x + rect.w > other.x && rect.y < other.y + other.h && rect.y + rect.h > other.y);
  for (const [dx, dy] of candidates) {
    const tx = x + dx, ty = y + dy;
    const rect = { x: tx - 2 * unitsPerPixel, y: ty - height, w: width, h: height * 1.2 };
    if (!overlaps(rect)) { occupied.push(rect); return [tx, ty]; }
  }
  const [dx, dy] = candidates[0];
  occupied.push({ x: x + dx - 2 * unitsPerPixel, y: y + dy - height, w: width, h: height * 1.2 });
  return [x + dx, y + dy];
}

function labelStyle(color, size, unitsPerPixel) {
  return `${color ? `--object-color:${color};` : ''}font-size:${size * unitsPerPixel}px`;
}

function renderCanvas(computed) {
  const canvas = $('canvas');
  canvas.textContent = '';
  canvas.classList.toggle('move-tool', state.selectedTool === 'move');
  setView();
  $('stepSlider').max = state.steps.length;
  $('stepSlider').value = Number.isFinite(state.previewStep) ? state.previewStep : state.steps.length;
  updateRange($('slider')); updateRange($('stepSlider'));
  $('stepValue').textContent = Number.isFinite(state.previewStep) ? `${state.previewStep}/${state.steps.length}` : 'all';
  if (!computed) return;
  let drawn;
  try { drawn = coords(source(), state.t); } catch { return; }
  const shapeHits = [], pointHits = [];
  const conicLayer = svgEl('g'), lineLayer = svgEl('g'), pointLayer = svgEl('g'), labelLayer = svgEl('g');
  canvas.append(conicLayer, lineLayer, pointLayer, labelLayer);

  const visible = visibleNames();
  const stateSteps = new Map(state.steps.map((item) => [item.name, item]));
  const proof = proofFocus();
  const proofColors = proofColorMap();
  const occupiedLabels = [];
  const rect = canvas.getBoundingClientRect();
  const unitsPerPixel = Math.max(VIEW.w / (rect.width || 1), VIEW.h / (rect.height || 1));
  const pointRadius = 4 * unitsPerPixel;
  const focusedPointRadius = 5.5 * unitsPerPixel;
  const pointHitRadius = pointPickRadius();
  for (const step of drawn.steps) {
    if (!step.name || !visible.has(step.name)) continue;
    const value = step.value;
    const focused = state.focus.has(step.name);
    const relevant = proof.has(step.name);
    const color = proofColors.get(step.name);
    const visualRole = color ? ' proof-object' : relevant ? ' important' : ' supporting';
    const labelTone = color ? ' colored' : relevant ? ' important' : '';
    const showDegree = state.showDegrees.has(step.name);
    const labelled = focused || showDegree;
    if (step.kind === 'conic') {
      const circle = circleGeometry(value);
      if (!circle) continue;
      conicLayer.appendChild(svgEl('circle', {
        cx: circle.x, cy: -circle.y, r: circle.radius,
        class: `construction-conic${visualRole}${focused ? ' focused' : ''}${state.picks.includes(step.name) ? ' selected' : ''}`,
        style: color ? `--object-color:${color}` : '',
      }));
      shapeHits.push(svgEl('circle', {
        cx: circle.x, cy: -circle.y, r: circle.radius,
        class: 'object-hit locus-hit', 'data-object': step.name, 'data-kind': 'conic',
      }));
      continue;
    }
    if (step.kind === 'line') {
      const definition = stateSteps.get(step.name);
      const tool = TOOL_BY_ID.get(definition?.tool);
      const segment = displayLine(step, value, drawn, tool?.shape || 'line');
      if (!segment) continue;
      lineLayer.appendChild(svgEl('line', {
        x1: segment[0][0], y1: -segment[0][1], x2: segment[1][0], y2: -segment[1][1],
        class: `construction-line${visualRole}${focused ? ' focused' : ''}${state.picks.includes(step.name) ? ' selected' : ''}`,
        style: color ? `--object-color:${color}` : '',
      }));
      if (labelled) {
        const anchor = lineLabelAnchor(step, drawn, segment);
        const x = anchor[0], y = -anchor[1];
        const text = step.name;
        const [labelX, labelY] = labelPosition(x, y, text, occupiedLabels, true, unitsPerPixel);
        const label = svgEl('text', { x: labelX, y: labelY, class: `object-label line-label${labelTone}`, style: labelStyle(color, 13, unitsPerPixel) });
        label.textContent = text;
        labelLayer.appendChild(label);
        if (showDegree && expected(computed, step.name) != null) addDegreeBadge(labelLayer, labelX + Math.max(4, text.length * 7) * unitsPerPixel + 4 * unitsPerPixel, labelY - 2 * unitsPerPixel, expected(computed, step.name), color || 'var(--muted)', occupiedLabels, unitsPerPixel);
      }
      shapeHits.push(svgEl('line', {
        x1: segment[0][0], y1: -segment[0][1], x2: segment[1][0], y2: -segment[1][1],
        class: 'object-hit line-hit', 'data-object': step.name, 'data-kind': 'line',
      }));
      continue;
    }
    if (Math.abs(value[2]) < 1e-9) continue;
    const x = value[0] / value[2], y = value[1] / value[2];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    pointLayer.appendChild(svgEl('circle', {
      cx: x, cy: -y, r: focused ? focusedPointRadius : pointRadius,
      class: `construction-point${visualRole}${focused ? ' focused' : ''}${step.args.includes('$t') ? ' animated' : ''}${state.picks.includes(step.name) ? ' selected' : ''}`,
      style: color ? `--object-color:${color}` : '',
    }));
    if (visible.has(step.name)) {
      const text = step.name;
      const [labelX, labelY] = labelPosition(x, -y, text, occupiedLabels, false, unitsPerPixel);
      const label = svgEl('text', { x: labelX, y: labelY, class: `object-label${labelTone}`, style: labelStyle(color, 15, unitsPerPixel) });
      label.textContent = text;
      labelLayer.appendChild(label);
      if (showDegree && expected(computed, step.name) != null) addDegreeBadge(labelLayer, labelX + Math.max(4, text.length * 8) * unitsPerPixel + 4 * unitsPerPixel, labelY - 2 * unitsPerPixel, expected(computed, step.name), color || 'var(--muted)', occupiedLabels, unitsPerPixel);
    }
    pointHits.push(svgEl('circle', {
      cx: x, cy: -y, r: focused ? 17 * unitsPerPixel : pointHitRadius,
      class: 'object-hit point-hit', 'data-object': step.name, 'data-kind': 'point',
    }));
  }
  renderPreview(canvas, drawn);
  shapeHits.concat(pointHits).forEach((target) => canvas.appendChild(target));
}

function addDegreeBadge(layer, x, y, degree, color, occupied, unitsPerPixel) {
  const text = String(degree);
  const radius = 7 * unitsPerPixel;
  const offset = 2.5 * radius;
  const candidates = [[x, y], [x + offset, y], [x, y - offset], [x, y + offset], [x - offset, y]];
  const overlaps = (cx, cy) => {
    const rect = { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
    return occupied.some((other) => rect.x < other.x + other.w && rect.x + rect.w > other.x && rect.y < other.y + other.h && rect.y + rect.h > other.y);
  };
  const [cx, cy] = candidates.find(([candidateX, candidateY]) => !overlaps(candidateX, candidateY)) || candidates[0];
  const rect = { x: cx - radius, y: cy - radius, w: radius * 2, h: radius * 2 };
  occupied.push(rect);
  layer.append(
    svgEl('circle', { cx, cy, r: radius, class: 'degree-badge-ring', style: `--degree-color:${color}` }),
    Object.assign(svgEl('text', { x: cx, y: cy, class: 'degree-badge', 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `--degree-color:${color};font-size:${11 * unitsPerPixel}px` }), { textContent: text }),
  );
}

function renderVisuals(computed = result()) {
  renderCanvas(computed.data);
  return computed;
}

function clearStepPreview() {
  const changed = Number.isFinite(state.previewStep);
  state.previewStep = null;
  return changed;
}

function removeObject(name) {
  checkpoint();
  const removed = new Set([name]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of state.steps) {
      if (!removed.has(step.name) && step.args.some((arg) => removed.has(arg))) {
        removed.add(step.name);
        changed = true;
      }
    }
  }
  state.points = state.points.filter((point) => !removed.has(point.name));
  state.steps = state.steps.filter((step) => !removed.has(step.name));
  for (const objectName of removed) {
    state.focus.delete(objectName);
    state.showDegrees.delete(objectName);
    delete state.answers[objectName];
  }
  state.picks = [];
  const available = claimChoices(state.claim.op).map((object) => object.name);
  state.claim.args = available.slice(0, 3);
  toast(removed.size > 1 ? `Deleted ${name} and ${removed.size - 1} dependent objects.` : `Deleted ${name}.`);
  refresh(); renderToolHelp();
}

function renderSteps(computed) {
  const list = $('steps');
  list.textContent = '';
  const map = new Map(computed?.steps.filter((step) => step.name).map((step) => [step.name, step]) || []);
  const proofColors = proofColorMap();
  const construction = [
    ...state.points.map((point) => ({ ...point, op: 'free', tool: 'fixed', args: [point.x, point.y], index: -1 })),
    ...state.steps.map((step, index) => ({ ...step, index })),
  ];
  for (const step of construction) {
    const row = document.createElement('div');
    const color = proofColors.get(step.name);
    row.className = `step-row${color ? ' proof-object' : ''}${state.focus.has(step.name) ? ' focused' : ''}${Number.isFinite(state.previewStep) && step.index >= 0 && step.index < state.previewStep ? ' previewed' : ''}${Number.isFinite(state.previewStep) && step.index === state.previewStep - 1 ? ' current' : ''}`;
    if (color) row.style.setProperty('--object-color', color);
    const degree = map.get(step.name)?.degree;
    const tool = TOOL_BY_ID.get(step.tool);
    const text = tool ? tool.label.toLowerCase() : step.op;
    const main = Object.assign(document.createElement('div'), { className: 'step-main' });
    const relevance = Object.assign(document.createElement('input'), { type: 'checkbox', checked: state.focus.has(step.name), className: 'proof-toggle', ariaLabel: `Show ${step.name} in the student problem` });
    relevance.title = 'Show in student problem';
    relevance.addEventListener('change', () => {
      checkpoint();
      relevance.checked ? state.focus.add(step.name) : state.focus.delete(step.name);
      refresh();
    });
    const degreeToggle = Object.assign(document.createElement('input'), { type: 'checkbox', checked: state.showDegrees.has(step.name), className: 'degree-toggle', ariaLabel: `Show the degree of ${step.name}` });
    degreeToggle.title = 'Show degree on canvas';
    degreeToggle.disabled = degree == null;
    degreeToggle.addEventListener('change', () => {
      checkpoint();
      degreeToggle.checked ? state.showDegrees.add(step.name) : state.showDegrees.delete(step.name);
      refresh();
    });
    main.append(relevance, degreeToggle, Object.assign(document.createElement('code'), { textContent: step.name }), Object.assign(document.createElement('span'), { textContent: text }));
    const meta = Object.assign(document.createElement('div'), { className: 'step-meta' });
    const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'remove', textContent: '×', ariaLabel: `Remove ${step.name}` });
    remove.addEventListener('click', () => removeObject(step.name));
    meta.append(Object.assign(document.createElement('b'), { textContent: degree ?? '—' }), remove);
    row.append(main, meta);
    list.append(row);
  }
}

const ICONS = {
  move: '<svg viewBox="0 0 32 20"><path d="M16 2v16M10 8l6-6 6 6M10 12l6 6 6-6M2 10h28M8 4 2 10l6 6M24 4l6 6-6 6"/></svg>',
  point: '<svg viewBox="0 0 32 20"><circle class="point" cx="16" cy="10" r="3"/></svg>',
  'point-line': '<svg viewBox="0 0 32 20"><line x1="3" y1="15" x2="29" y2="5"/><circle class="point" cx="16" cy="10" r="3"/></svg>',
  'circle-point': '<svg viewBox="0 0 32 20"><circle cx="16" cy="10" r="7"/><circle class="point" cx="21" cy="5" r="3"/></svg>',
  segment: '<svg viewBox="0 0 32 20"><line x1="6" y1="15" x2="26" y2="5"/><circle class="point" cx="6" cy="15" r="2.5"/><circle class="point" cx="26" cy="5" r="2.5"/></svg>',
  line: '<svg viewBox="0 0 32 20"><line x1="2" y1="17" x2="30" y2="3"/><circle class="point" cx="10" cy="13" r="2.5"/><circle class="point" cx="22" cy="7" r="2.5"/></svg>',
  ray: '<svg viewBox="0 0 32 20"><line x1="7" y1="15" x2="30" y2="3"/><circle class="point" cx="7" cy="15" r="2.5"/><circle class="point" cx="16" cy="10" r="2.5"/></svg>',
  intersection: '<svg viewBox="0 0 32 20"><line x1="3" y1="16" x2="29" y2="4"/><line x1="5" y1="4" x2="27" y2="16"/><circle class="point" cx="16" cy="10" r="3"/></svg>',
  midpoint: '<svg viewBox="0 0 32 20"><line x1="5" y1="14" x2="27" y2="6"/><circle class="point" cx="5" cy="14" r="2.5"/><circle class="point" cx="16" cy="10" r="2.5"/><circle class="point" cx="27" cy="6" r="2.5"/></svg>',
  perpendicular: '<svg viewBox="0 0 32 20"><line x1="3" y1="15" x2="29" y2="5"/><line x1="16" y1="3" x2="16" y2="17"/><circle class="point" cx="16" cy="10" r="2.5"/></svg>',
  bisector: '<svg viewBox="0 0 32 20"><line x1="4" y1="14" x2="28" y2="6"/><line x1="16" y1="3" x2="16" y2="17"/><circle class="point" cx="4" cy="14" r="2.5"/><circle class="point" cx="28" cy="6" r="2.5"/></svg>',
  parallel: '<svg viewBox="0 0 32 20"><line x1="3" y1="6" x2="29" y2="2"/><line x1="3" y1="17" x2="29" y2="13"/><circle class="point" cx="10" cy="16" r="2.5"/></svg>',
  direction: '<svg viewBox="0 0 32 20"><line x1="5" y1="15" x2="27" y2="5"/><path d="m22 5 5 0-3 4"/></svg>',
  'reflect-line': '<svg viewBox="0 0 32 20"><line x1="16" y1="2" x2="16" y2="18" stroke-dasharray="2 1.5"/><path d="M11 6h10" stroke-dasharray="2 1.5"/><circle class="point" cx="8" cy="6" r="2.5"/><circle class="point" cx="24" cy="6" r="2.5"/></svg>',
  'reflect-point': '<svg viewBox="0 0 32 20"><path d="M8 5 24 15" stroke-dasharray="2 1.5"/><circle class="point" cx="8" cy="5" r="2.5"/><circle cx="16" cy="10" r="2"/><circle class="point" cx="24" cy="15" r="2.5"/></svg>',
  invert: '<svg viewBox="0 0 32 20"><circle cx="16" cy="10" r="7"/><path d="M16 10h12" stroke-dasharray="2 1.5"/><circle class="point" cx="28" cy="10" r="2.4"/><circle class="point" cx="20" cy="10" r="2.4"/><path d="m25 7-4 3 4 3"/></svg>',
  tangent: '<svg viewBox="0 0 32 20"><circle cx="12" cy="10" r="6"/><line x1="3" y1="17" x2="22" y2="3"/><circle class="point" cx="16" cy="5" r="2.5"/></svg>',
  angle: '<svg viewBox="0 0 32 20"><path d="M5 16 16 4l11 12"/><path d="M11 10a7 7 0 0 1 10 0"/></svg>',
  circle: '<svg viewBox="0 0 32 20"><circle cx="16" cy="10" r="7"/><circle class="point" cx="16" cy="10" r="2.5"/></svg>',
  circumcircle: '<svg viewBox="0 0 32 20"><circle cx="16" cy="10" r="7"/><circle class="point" cx="9" cy="14" r="2.5"/><circle class="point" cx="22" cy="14" r="2.5"/><circle class="point" cx="17" cy="3" r="2.5"/></svg>',
};

function renderPalette() {
  const palette = $('toolPalette');
  palette.textContent = '';
  const groups = [...new Set(TOOLS.map((tool) => tool.group))];
  for (const groupName of groups) {
    const group = document.createElement('div');
    group.className = 'tool-group';
    group.append(Object.assign(document.createElement('h4'), { textContent: groupName }));
    const grid = document.createElement('div');
    grid.className = 'tool-grid';
    for (const tool of TOOLS.filter((item) => item.group === groupName)) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = `tool-button${state.selectedTool === tool.id ? ' selected' : ''}`;
      button.disabled = Boolean(tool.disabled);
      button.title = tool.disabled ? 'Not implemented in the polynomial engine yet' : tool.label;
      button.innerHTML = `<span class="tool-icon">${ICONS[tool.icon]}</span><span>${tool.label}</span>`;
      button.addEventListener('click', () => {
        clearStepPreview();
        state.selectedTool = tool.id;
        state.picks = []; state.hover = null; state.suppressClick = false;
        if (tool.action === 'conic' && !state.steps.some((step) => step.op === tool.op)) addStep(tool, []);
        renderPalette(); renderToolHelp(); refresh();
      });
      grid.append(button);
    }
    group.append(grid); palette.append(group);
  }
}

function renderToolHelp() {
  const tool = TOOL_BY_ID.get(state.selectedTool) || TOOLS[0];
  const help = $('toolHelp');
  const picked = state.picks.length;
  let text = `${tool.label} · `;
  if (tool.action === 'move') text += 'drag fixed points or fixed conic points';
  else if (tool.action === 'fixed') text += 'click empty canvas or an intersection';
  else if (tool.action === 'conic') text += 'click the tool to add a named unit circle';
  else if (tool.action === 'moving-line') text += picked ? `now click where the point should start on ${state.picks[0]}` : 'click a line, then click where the point should start';
  else if (tool.action === 'moving-circle') text += picked ? 'now click where the point should start on the conic' : 'click the conic, then click where the point should start';
  else if (tool.action === 'intersection') text += picked ? 'now click a second line or circle' : 'click two lines or circles';
  else if (tool.pick?.length) text += `click ${tool.pick[picked] || 'the required'}${tool.pick.length > 1 ? ` (${picked}/${tool.pick.length})` : ''}`;
  help.textContent = text;
}

function claimChoices(op) {
  return choices(op === 'collinear' ? 'point' : 'line');
}

function renderClaim(computed) {
  const op = $('claimOp');
  op.value = state.claim.op;
  const target = $('claimArgs');
  target.textContent = '';
  const options = claimChoices(state.claim.op);
  for (let index = 0; index < 3; index++) {
    const select = document.createElement('select');
    select.dataset.claimArg = index;
    for (const object of options) select.add(new Option(object.name, object.name));
    select.value = state.claim.args[index] || options[index]?.name || '';
    target.append(select);
  }
  const claim = computed?.steps.find((step) => step.claim);
  const box = $('claimResult');
  box.className = 'claim-result';
  box.textContent = '';
  if (!claim) { box.textContent = computed ? 'Claim is incomplete.' : ''; return; }
  if (claim.unsupported) { box.textContent = 'Degree unavailable.'; return; }
  const verdict = claim.alwaysTrue ? 'verified' : 'not verified';
  box.textContent = verdict;
  box.classList.add(claim.alwaysTrue ? 'good' : 'bad');
}

function renderAnswers(computed) {
  const table = $('answers');
  table.textContent = '';
  const header = document.createElement('div');
  header.className = 'answer-row answer-header';
  header.innerHTML = '<span>Object</span><span>Engine</span><span>Published</span>';
  table.append(header);
  for (const name of state.focus) {
    const step = engineStep(computed, name);
    if (!step) continue;
    const row = document.createElement('div');
    row.className = 'answer-row';
    row.innerHTML = `<code>${name}</code><span class="engine-degree">d${step.degree ?? '—'}</span>`;
    const input = document.createElement('input');
    input.value = state.answers[name] ?? step.degree ?? '';
    input.inputMode = 'numeric'; input.setAttribute('aria-label', `Published degree for ${name}`);
    input.addEventListener('change', () => {
      const value = input.value.trim();
      if (!/^\d+$/.test(value)) { input.value = state.answers[name] ?? step.degree ?? ''; toast('Use a non-negative integer degree.'); return; }
      checkpoint();
      if (Number(value) === step.degree) delete state.answers[name];
      else state.answers[name] = Number(value);
      refresh();
    });
    row.append(input); table.append(row);
  }
}

function refresh() {
  const computed = result();
  if (!state.degreeDefaults) {
    for (const step of computed.data?.steps || []) if (step.name && step.degree != null && step.degree !== 0) state.showDegrees.add(step.name);
    state.degreeDefaults = true;
  }
  renderVisuals(computed);
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
  renderSteps(computed.data); renderAnswers(computed.data);
  renderClaim(computed.data);
}

function toast(message) {
  const box = $('toast'); box.textContent = message; box.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove('visible'), 2400);
}

function download(name, text, type) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type })); link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function importConstruction(payload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.points) || !Array.isArray(payload.steps)) throw new Error('unsupported construction JSON');
  const names = new Set();
  const points = payload.points.map((point) => {
    if (!/^\w+$/.test(point.name) || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y)) || names.has(point.name)) throw new Error('invalid point data');
    names.add(point.name);
    return { name: point.name, x: shortNumber(Number(point.x)), y: shortNumber(Number(point.y)) };
  });
  const steps = payload.steps.map((step) => {
    if (!/^\w+$/.test(step.name) || !/^\w+$/.test(step.op) || !Array.isArray(step.args) || names.has(step.name)) throw new Error('invalid construction step');
    names.add(step.name);
    return { name: step.name, op: step.op, tool: step.tool, shape: step.shape, args: step.args.map(String), note: step.note };
  });
  checkpoint();
  state.points = points;
  state.steps = steps;
  state.focus = new Set((Array.isArray(payload.focus) ? payload.focus : []).filter((name) => names.has(name)));
  state.claim = {
    op: payload.claim?.op === 'concurrent' ? 'concurrent' : 'collinear',
    args: Array.isArray(payload.claim?.args) ? payload.claim.args.map(String) : [],
  };
  state.answers = Object.assign(Object.create(null), payload.answers || {});
  state.showDegrees = new Set();
  state.degreeDefaults = false;
  state.t = Number.isFinite(Number(payload.t)) ? Number(payload.t) : 2;
  state.previewStep = null;
  state.picks = [];
  setSliderFromT();
  renderPalette(); renderToolHelp(); refresh();
  toast('Construction imported.');
}

function objectFromNode(node) {
  const hit = node?.closest?.('[data-object],[data-locus]');
  if (!hit || !$('canvas').contains(hit)) return null;
  if (hit.dataset.locus) return { name: null, kind: hit.dataset.kind || hit.dataset.locus };
  return objects().find((object) => object.name === hit.dataset.object) || null;
}

function hitObject(event, kind = null) {
  const kinds = kind == null ? null : new Set(Array.isArray(kind) ? kind : [kind]);
  if (!kinds || kinds.has('point')) {
    const point = pointFromEvent(event);
    let best = null;
    let drawn;
    try { drawn = coords(source(), state.t); } catch { drawn = null; }
    if (drawn) for (const object of objects()) {
      if (object.kind !== 'point' || !visibleNames().has(object.name)) continue;
      const xy = pointXY(drawn.env[object.name]);
      if (!xy) continue;
      const distance = Math.hypot(point.x - xy[0], point.y - xy[1]);
      if (!best || distance < best.distance) best = { object, distance };
    }
    if (best && best.distance <= pointPickRadius()) return best.object;
    if (kinds?.has('point')) return null;
  }
  const nodes = document.elementsFromPoint(event.clientX, event.clientY);
  for (const node of nodes) {
    const object = objectFromNode(node);
    if (object && (!kinds || kinds.has(object.kind))) return object;
  }
  const fallback = objectFromNode(event.target);
  return fallback && (!kinds || kinds.has(fallback.kind)) ? fallback : null;
}

function lineParameter(lineName, point) {
  const drawn = coords(source(), state.t);
  const line = drawn.env[lineName];
  const a = line[0], b = line[1], c = line[2];
  const norm = a * a + b * b;
  const error = norm ? (a * point.x + b * point.y + c) / norm : 0;
  const projected = { x: point.x - a * error, y: point.y - b * error };
  const values = Math.abs(b) >= Math.abs(a)
    ? [(projected.x * norm + a * c) / b]
    : [-(projected.y * norm + b * c) / a];
  const parameter = values.find((value) => Number.isFinite(value) && Math.abs(value) < 1e8);
  return parameter ?? 0;
}

function addStep(tool, args, record = true) {
  if (record) checkpoint();
  const kind = OUTPUT_KIND[tool.op] || 'point';
  const name = nextName(kind);
  state.steps.push({ name, op: tool.op, tool: tool.id, shape: tool.shape, args });
  autoShowDegrees([name]);
  state.picks = [];
  refresh(); renderToolHelp();
}

function autoShowDegrees(names) {
  const computed = result().data;
  for (const name of names) {
    const degree = computed?.steps.find((step) => step.name === name)?.degree;
    if (degree != null && degree !== 0) state.showDegrees.add(name);
  }
}

function completeIntersection(tool) {
  const [first, second] = state.picks;
  const kind = new Map(objects().map((object) => [object.name, object.kind]));
  let op = 'meet', args = [first, second], count = 1;
  if (kind.get(first) === 'line' && kind.get(second) === 'conic') { op = 'meetlinecircle'; count = 2; }
  else if (kind.get(first) === 'conic' && kind.get(second) === 'line') { op = 'meetlinecircle'; args = [second, first]; count = 2; }
  else if (kind.get(first) === 'conic' && kind.get(second) === 'conic') { op = 'meetcircles'; count = 2; }
  else if (kind.get(first) !== 'line' || kind.get(second) !== 'line') return toast('Select two lines or circles.');
  checkpoint();
  const names = [];
  for (let branch = 0; branch < count; branch++) {
    const name = nextName('point');
    state.steps.push({ name, op, tool: tool.id, args: count === 1 ? args : [...args, String(branch)] });
    names.push(name);
  }
  autoShowDegrees(names);
  state.picks = [];
  refresh(); renderToolHelp();
}

function createIntersectionPoint(candidate) {
  checkpoint();
  const name = nextName('point');
  state.steps.push({
    name,
    op: candidate.op,
    tool: 'intersection',
    args: candidate.count === 1 ? candidate.args : [...candidate.args, String(candidate.branch)],
  });
  autoShowDegrees([name]);
  return { name, created: true };
}

function completeMovingPoint(tool, point) {
  checkpoint();
  if (tool.action === 'moving-line') {
    const lineName = state.picks[0];
    const placed = lineParameter(lineName, point);
    addStep(tool, withPhase([lineName, '$t'], placed), false);
    return;
  }
  const locusName = state.picks[0];
  const drawn = coords(source(), state.t);
  const locus = state.steps.find((step) => step.name === locusName);
  const placed = nearestCirclePoint(drawn.env[locusName], point)?.point || point;
  if (locus?.op === 'unitcircle') {
    addStep({ ...tool, op: 'circle' }, withPhase(['$t'], circleParameter(placed, drawn.env[locusName])), false);
    return;
  }
  const anchor = circleAnchor(locus);
  if (!anchor) return toast('This circle needs a marked point on it.');
  addStep(tool, withPhase([locusName, anchor, '$t'], circleChordParameter(drawn.env[anchor], placed)), false);
}

function pickOrCreatePoint(event) {
  const picked = hitObject(event, 'point');
  if (picked) return { name: picked.name, created: false };
  const point = pointFromEvent(event);
  const intersection = nearestIntersection(point);
  if (intersection) return createIntersectionPoint(intersection);
  const placed = snapPoint(point);
  checkpoint();
  const name = nextName('point');
  state.points.push({ name, x: shortNumber(placed.x), y: shortNumber(placed.y) });
  return { name, created: true };
}

function handleAuthorClick(event) {
  if (state.suppressClick) { state.suppressClick = false; return; }
  clearStepPreview();
  const tool = TOOL_BY_ID.get(state.selectedTool);
  if (!tool || tool.disabled) return;
  const point = pointFromEvent(event);
  const target = hitObject(event);

  if (tool.action === 'move') return;
  if (tool.action === 'fixed') {
    if (target?.kind === 'point') return toast('Click an empty part of the canvas for a fixed point.');
    const intersection = nearestIntersection(point);
    if (intersection) {
      createIntersectionPoint(intersection);
      refresh();
      return;
    }
    const placed = snapPoint(point);
    checkpoint();
    state.points.push({ name: nextName('point'), x: shortNumber(placed.x), y: shortNumber(placed.y) });
    refresh();
    return;
  }
  if (tool.action === 'conic') return;
  if (tool.action === 'intersection') {
    const curve = hitObject(event, ['line', 'conic']);
    if (!curve || !['line', 'conic'].includes(curve.kind)) return toast('Select a line or circle.');
    if (state.picks.includes(curve.name)) return toast('Select a different line or circle.');
    state.picks.push(curve.name);
    if (state.picks.length === 2) completeIntersection(tool);
    else { renderToolHelp(); refresh(); }
    return;
  }
  if (tool.action === 'moving-line' || tool.action === 'moving-circle') {
    if (!state.picks.length) {
      const expectedKind = tool.action === 'moving-line' ? 'line' : 'conic';
      const locus = hitObject(event, expectedKind);
      if (!locus) return toast(`Select a ${expectedKind} first.`);
      state.picks = [locus.name || '__conic']; renderToolHelp(); refresh();
      return;
    }
    completeMovingPoint(tool, point);
    return;
  }

  const expectedKind = tool.pick[state.picks.length];
  const pointPick = expectedKind === 'point' ? pickOrCreatePoint(event) : null;
  const picked = pointPick || hitObject(event, expectedKind);
  if (!picked) return toast(`Select a ${expectedKind}.`);
  state.picks.push(picked.name);
  if (state.picks.length === tool.pick.length) addStep(tool, [...state.picks], !pointPick?.created);
  else { renderToolHelp(); refresh(); }
}

state = freshState();

$('slider').addEventListener('input', () => {
  const value = Number($('slider').value);
  state.t = Math.tan(value * Math.PI / 2 * .98);
  renderVisuals(result());
});
$('stepSlider').addEventListener('input', () => {
  const value = Number($('stepSlider').value);
  state.previewStep = value >= state.steps.length ? null : value;
  renderVisuals(result());
  renderSteps(result().data);
});
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('reset').addEventListener('click', () => { checkpoint(); state = freshState(); resetView(); document.documentElement.style.removeProperty('--sidebar'); document.querySelector('.workbench').classList.remove('sidebar-closed'); setSliderFromT(); renderPalette(); renderToolHelp(); refresh(); });

$('resizeSidebar').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  const left = $('resizeSidebar').getBoundingClientRect().left;
  sidebarResize = { start: event.clientX, width: left + 3 };
  $('resizeSidebar').setPointerCapture?.(event.pointerId);
});

$('canvas').addEventListener('click', handleAuthorClick);
$('canvas').addEventListener('selectstart', (event) => event.preventDefault());
$('canvas').addEventListener('dragstart', (event) => event.preventDefault());
$('canvas').addEventListener('pointerdown', (event) => {
  if (state.selectedTool === 'move') {
    clearStepPreview();
    const target = hitObject(event, 'point');
    const draggable = target?.name ? draggableObject(target.name) : null;
    if (draggable) {
      state.suppressClick = false;
      state.dragging = { name: target.name, ...draggable, start: pointFromEvent(event), moved: false, historySaved: false };
      return;
    }
  }
  if (state.selectedTool === 'move') {
    const rect = $('canvas').getBoundingClientRect();
    state.panning = { x: event.clientX, y: event.clientY, view: { ...VIEW }, width: rect.width, height: rect.height };
    $('canvas').setPointerCapture?.(event.pointerId);
  }
});
document.addEventListener('pointermove', (event) => {
  if (sidebarResize) {
    const proposed = sidebarResize.width + event.clientX - sidebarResize.start;
    const workbench = document.querySelector('.workbench');
    if (proposed < 180) {
      state.sidebarOpen = false;
      workbench.classList.add('sidebar-closed');
      document.documentElement.style.setProperty('--sidebar', '0px');
    } else {
      state.sidebarOpen = true;
      workbench.classList.remove('sidebar-closed');
      document.documentElement.style.setProperty('--sidebar', `${Math.min(460, Math.max(240, proposed))}px`);
    }
    return;
  }
  if (state.panning) {
    const { x, y, view, width, height } = state.panning;
    VIEW = { ...view, x0: view.x0 - (event.clientX - x) * view.w / width, y0: view.y0 - (event.clientY - y) * view.h / height };
    renderVisuals();
    return;
  }
  const point = pointFromEvent(event);
  if (state.dragging) {
    const start = state.dragging.start;
    if (Math.hypot(point.x - start.x, point.y - start.y) > .025) {
      state.dragging.moved = true;
      if (!state.dragging.historySaved) { checkpoint(); state.dragging.historySaved = true; }
    }
    updateDraggedPoint(state.dragging, point);
    return;
  }
  const rect = $('canvas').getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside && !state.hover) return;
  state.hover = inside ? point : null;
  renderVisuals();
});
document.addEventListener('pointerup', () => {
  if (sidebarResize) {
    sidebarResize = null;
    return;
  }
  if (state.panning) {
    state.suppressClick = true;
    state.panning = null;
    return;
  }
  if (!state.dragging) return;
  const moved = state.dragging.moved;
  state.suppressClick = moved;
  state.dragging = null;
  if (moved) refresh(); else renderVisuals();
});
$('canvas').addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = pointFromEvent(event);
  const svgY = -point.y;
  const factor = Math.exp(Math.max(-.14, Math.min(.14, event.deltaY * .0008)));
  const rect = $('canvas').getBoundingClientRect();
  const aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
  const minWidth = Math.max(2.4, 1.8 * aspect);
  const maxWidth = Math.min(20, 15 * aspect);
  const w = Math.max(minWidth, Math.min(maxWidth, VIEW.w * factor));
  const h = w / aspect;
  VIEW = {
    x0: point.x - (point.x - VIEW.x0) * w / VIEW.w,
    y0: svgY - (svgY - VIEW.y0) * h / VIEW.h,
    w, h,
  };
  renderVisuals();
}, { passive: false });
$('canvas').addEventListener('pointerleave', () => {
  if (!state.dragging && !state.panning) { state.hover = null; renderVisuals(); }
});
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.isComposing) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  } else if (key === 'y') {
    event.preventDefault();
    redo();
  }
});

$('claimOp').addEventListener('change', () => {
  checkpoint();
  state.claim.op = $('claimOp').value;
  state.claim.args = claimChoices(state.claim.op).slice(0, 3).map((object) => object.name);
  refresh();
});
$('claimForm').addEventListener('submit', (event) => {
  event.preventDefault();
  checkpoint();
  state.claim.args = [...event.target.querySelectorAll('[data-claim-arg]')].map((input) => input.value);
  refresh(); toast('Claim updated and checked by the engine.');
});

$('downloadMmp').addEventListener('click', () => download('fokozas-construction.mmp', source() + '\n', 'text/plain'));
$('downloadJSON').addEventListener('click', () => download('fokozas-construction.json', constructionJSON(), 'application/json'));
$('importJSON').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try { importConstruction(JSON.parse(await file.text())); }
  catch (error) { toast(`Import failed: ${error.message}`); }
  event.target.value = '';
});

renderPalette();
renderToolHelp();
refresh();
