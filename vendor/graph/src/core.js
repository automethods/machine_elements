/** Graph Studio / Technical Chart Adapter. MIT. No engine or UI dependency. */
export const VERSION = '0.3.0';
export const TESTED_PLOTLY_VERSION = '3.3.1';
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o ?? {}, k);
const fnIds = new WeakMap(); let nextFn = 0;
export class AdapterError extends Error {
  constructor(code, message, details = null) { super(message); this.name = 'AdapterError'; this.code = code; this.details = details; }
}
function fail(code, message) { throw new AdapterError(code, message); }
export function createExclusiveRunner() {
  let tail = Promise.resolve();
  return operation => { const next = tail.then(operation); tail = next.catch(() => {}); return next; };
}
export function canonical(value, stack = new WeakSet()) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'undefined') return 'undefined';
  if (t === 'number') return `number:${Object.is(value, -0) ? '-0' : String(value)}`;
  if (t === 'string' || t === 'boolean') return `${t}:${JSON.stringify(value)}`;
  if (t === 'function') { if (!fnIds.has(value)) fnIds.set(value, ++nextFn); return `function:${fnIds.get(value)}`; }
  if (t !== 'object') fail('UNSUPPORTED_VALUE', `Unsupported value: ${t}`);
  if (stack.has(value)) fail('CYCLIC_STATE', 'Cyclic native state cannot be verified. Supply a simpler state boundary.');
  stack.add(value);
  let out;
  if (ArrayBuffer.isView(value)) out = `${value.constructor.name}:[${Array.from(value, x => canonical(x)).join(',')}]`;
  else if (Array.isArray(value)) out = `[${Array.from({length: value.length}, (_, i) => own(value, i) ? canonical(value[i], stack) : 'hole').join(',')}]`;
  else if (value instanceof Date) out = `date:${value.toISOString()}`;
  else out = `{${Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], stack)).join(',')}}`;
  stack.delete(value); return out;
}
export function sha256Portable(text) {
  const bytes=new TextEncoder().encode(text),n=Math.ceil((bytes.length+9)/64)*64,buf=new Uint8Array(n);buf.set(bytes);buf[bytes.length]=128;
  const dv=new DataView(buf.buffer),bits=bytes.length*8;dv.setUint32(n-8,Math.floor(bits/4294967296));dv.setUint32(n-4,bits>>>0);
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],W=new Uint32Array(64),r=(v,n)=>(v>>>n)|(v<<(32-n));
  for(let off=0;off<n;off+=64){for(let j=0;j<16;j++)W[j]=dv.getUint32(off+4*j);for(let j=16;j<64;j++){const x=W[j-15],y=W[j-2];W[j]=(W[j-16]+(r(x,7)^r(x,18)^(x>>>3))+W[j-7]+(r(y,17)^r(y,19)^(y>>>10)))>>>0;}let[a,b,c,d,e,f,g,h]=H;
    for(let j=0;j<64;j++){const t1=(h+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[j]+W[j])>>>0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,h].forEach((x,i)=>H[i]=(H[i]+x)>>>0);
  }return H.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export async function sha256(text) {
  if (!globalThis.crypto?.subtle) return sha256Portable(text);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
function copy(value) {
  if (ArrayBuffer.isView(value)) return new value.constructor(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') { const out = {}; for (const k of Object.keys(value)) { if (BAD_KEYS.has(k)) fail('UNSAFE_KEY', `Unsafe key: ${k}`); out[k] = copy(value[k]); } return out; }
  return value;
}
function freeze(value) { if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function field(object, path) {
  const keys = path.split('.'); let cur = object;
  for (let i = 0; i < keys.length - 1; i++) { if (!cur || !own(cur, keys[i])) return {present: false}; cur = cur[keys[i]]; }
  return cur && own(cur, keys.at(-1)) ? {present: true, value: copy(cur[keys.at(-1)])} : {present: false};
}
function removeField(object, path) {
  const keys = path.split('.'); let cur = object; const parents = [];
  for (const k of keys.slice(0, -1)) { if (!cur || !own(cur, k)) return; parents.push([cur, k]); cur = cur[k]; }
  if (cur) delete cur[keys.at(-1)];
  for (const [p, k] of parents.reverse()) { if (p[k] && typeof p[k] === 'object' && Object.keys(p[k]).length === 0) delete p[k]; }
}
function pruneEmpty(object) {
  if (!object || typeof object !== 'object' || ArrayBuffer.isView(object)) return object;
  if (Array.isArray(object)) return object.map(pruneEmpty);
  const out = {}; for (const [k, v] of Object.entries(object)) { const w = pruneEmpty(v); if (!(w && typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length === 0)) out[k] = w; } return out;
}
export const profiles = freeze({
  technical: {name: 'Technical', fontFamily: 'Arial', fontSize: 13, foreground: '#334155', background: '#ffffff', plotBackground: '#ffffff', gridColor: '#e2e8f0', gridWidth: 1, showGrid: true, lineWidth: 2.6, colors: {primary: '#087f8c', reference: '#8a94a6', secondary: '#bb7040'}},
  monochrome: {name: 'Monochrome', fontFamily: 'Arial', fontSize: 13, foreground: '#202020', background: '#ffffff', plotBackground: '#ffffff', gridColor: '#dcdcdc', gridWidth: 1, showGrid: true, lineWidth: 2.6, colors: {primary: '#202020', reference: '#858585', secondary: '#585858'}},
  midnight: {name: 'Midnight', fontFamily: 'Arial', fontSize: 13, foreground: '#d9e4ef', background: '#142334', plotBackground: '#142334', gridColor: '#314253', gridWidth: 1, showGrid: true, lineWidth: 2.6, colors: {primary: '#66d2c4', reference: '#93a2b6', secondary: '#efb36d'}}
});
export function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('INVALID_PROFILE', 'Profile must be an object.');
  const numeric = {fontSize: [9, 30], lineWidth: [0.5, 8], gridWidth: [0.25, 3]};
  const colors = ['foreground', 'background', 'plotBackground', 'gridColor'];
  const allowed = new Set(['name', 'fontFamily', 'showGrid', 'colors', ...colors, ...Object.keys(numeric)]);
  for (const [k, v] of Object.entries(profile)) {
    if (!allowed.has(k)) fail('INVALID_PROFILE', `Unknown profile property: ${k}`);
    if (numeric[k] && (typeof v !== 'number' || !Number.isFinite(v) || v < numeric[k][0] || v > numeric[k][1])) fail('INVALID_PROFILE', `${k} must be between ${numeric[k][0]} and ${numeric[k][1]}.`);
    if (colors.includes(k) && !/^#[0-9a-f]{6}$/i.test(v)) fail('INVALID_PROFILE', `${k} must be a six-digit hex color.`);
  }
  if (own(profile, 'fontFamily') && !['Arial', 'Georgia', 'Verdana', 'Courier New'].includes(profile.fontFamily)) fail('INVALID_PROFILE', 'Choose Arial, Georgia, Verdana, or Courier New. Fonts are system requirements, not bundled files.');
  if (own(profile, 'showGrid') && typeof profile.showGrid !== 'boolean') fail('INVALID_PROFILE', 'showGrid must be a boolean.');
  if (own(profile, 'name') && (typeof profile.name !== 'string' || profile.name.length > 80)) fail('INVALID_PROFILE', 'Profile name is invalid.');
  if (own(profile, 'colors')) {
    if (!profile.colors || Array.isArray(profile.colors) || typeof profile.colors !== 'object') fail('INVALID_PROFILE', 'colors must be an object.');
    for (const [role, color] of Object.entries(profile.colors)) if (!['primary', 'secondary', 'reference', 'limit', 'construction'].includes(role) || !/^#[0-9a-f]{6}$/i.test(color)) fail('INVALID_PROFILE', 'Invalid role or decorative color.');
  }
  return freeze(copy(profile));
}
function groups(state, operations) {
  const data = copy(state.data), layout = copy(state.layout);
  for (const op of operations) removeField(op.target === 'layout' ? layout : data[op.index], op.path);
  const view = {};
  for (const [k, v] of Object.entries(layout)) {
    if (/^scene\d*$/.test(k)) { view[k] = {}; for (const p of ['camera', 'aspectmode', 'aspectratio', 'domain']) if (own(v, p)) view[k][p] = v[p]; }
    if (/^[xy]axis\d*$/.test(k)) { view[k] = {}; for (const p of ['range', 'autorange', 'type', 'domain', 'fixedrange']) if (own(v, p)) view[k][p] = v[p]; }
  }
  return {data_and_encodings: canonical(pruneEmpty(data)), view: canonical(pruneEmpty(view)), other_native_configuration: canonical(pruneEmpty(layout)), host_state: canonical(state.host)};
}
/**
 * Native scoped adapter. All application writers must share withExclusive.
 * bindings only authorize explicitly decorative line color/width, never encoded channels.
 * Runtime profile/schema here is deliberately smaller than the 0.2 architecture.
 */
export function createPlotlyAdapter(Plotly, graph, options = {}) {
  if (!Plotly?.relayout || !Plotly?.restyle || !graph?.data || !graph?.layout) fail('INVALID_TARGET', 'Attach to an already-rendered Plotly graph.');
  if (Plotly.version !== TESTED_PLOTLY_VERSION && !options.allowUntestedVersion) fail('UNTESTED_ENGINE', `This release pins Plotly.js ${TESTED_PLOTLY_VERSION}; got ${Plotly.version}.`);
  if (typeof options.withExclusive !== 'function') fail('OWNERSHIP_REQUIRED', 'Supply withExclusive shared by every application update.');
  const bindings = options.bindings ?? []; const plans = new WeakMap(); const history = []; let sequence = 0, disposed = false;
  const bindingIndices = new Set();
  for (const b of bindings) {
    if (!Number.isInteger(b.index) || !graph.data[b.index] || bindingIndices.has(b.index)) fail('INVALID_BINDING', 'Bindings must reference unique existing trace indices.');
    bindingIndices.add(b.index);
    for (const [channel, kind] of Object.entries(b.channels ?? {})) if (!['color', 'width'].includes(channel) || !['decorative', 'quantitative', 'categorical', 'unknown'].includes(kind)) fail('INVALID_BINDING', 'Invalid channel classification.');
  }
  const bound = bindings.map(b => ({...copy(b), uid: graph.data[b.index].uid, identity: graph.data[b.index]}));
  function alive() { if (disposed) fail('DISPOSED', 'Adapter has been disposed.'); if (!graph.data || !graph.layout) fail('INVALID_TARGET', 'Native graph was removed.'); }
  async function capture() { alive(); if (options.awaitSettled) await options.awaitSettled(); return {data: copy(graph.data), layout: copy(graph.layout), host: options.readProtectedState ? copy(await options.readProtectedState()) : null, revision: options.readRevision ? String(await options.readRevision()) : null}; }
  async function makePlan(profile, inverse) {
    alive(); const before = await capture(), ops = [], notices = [];
    function add(target, index, path, value, token) {
      if (value === undefined) return;
      const previous = field(target === 'layout' ? before.layout : before.data[index], path);
      if (previous.present && canonical(previous.value) === canonical(value)) return;
      ops.push({target, ...(target === 'trace' ? {index} : {}), path, previous, next: copy(value), token});
    }
    if (inverse) {
      for (const op of inverse) {
        const current = field(op.target === 'layout' ? before.layout : before.data[op.index], op.path);
        if (!current.present || canonical(current.value) !== canonical(op.next)) fail('UNDO_CONFLICT', 'A styled field has since changed. Undo would overwrite another update.');
        ops.push({...op, previous: current, next: op.previous.present ? copy(op.previous.value) : null, restoreAbsence: !op.previous.present});
      }
    } else {
      const p = validateProfile(profile);
      const layoutFont = (prefix, plus = 0) => {
        add('layout', null, `${prefix}.size`, p.fontSize === undefined ? undefined : p.fontSize + plus, 'fontSize');
        add('layout', null, `${prefix}.family`, p.fontFamily, 'fontFamily');
        add('layout', null, `${prefix}.color`, p.foreground, 'foreground');
      };
      layoutFont('font'); layoutFont('legend.font');
      if (before.layout.title?.text) layoutFont('title.font', 4);
      add('layout', null, 'paper_bgcolor', p.background, 'background');
      add('layout', null, 'plot_bgcolor', p.plotBackground, 'plotBackground');
      const axis = path => {
        layoutFont(`${path}.tickfont`); layoutFont(`${path}.title.font`, 1);
        add('layout', null, `${path}.gridcolor`, p.gridColor, 'gridColor');
        add('layout', null, `${path}.gridwidth`, p.gridWidth, 'gridWidth');
        add('layout', null, `${path}.showgrid`, p.showGrid, 'showGrid');
        add('layout', null, `${path}.color`, p.foreground, 'foreground');
      };
      const axes = new Set(Object.keys(before.layout).filter(k => /^[xy]axis\d*$/.test(k)));
      const scenes = new Set(Object.keys(before.layout).filter(k => /^scene\d*$/.test(k)));
      before.data.forEach(t => { if (['surface', 'scatter3d', 'mesh3d'].includes(t.type)) scenes.add(t.scene ?? 'scene'); else if (!t.type || ['scatter', 'scattergl'].includes(t.type)) { axes.add((t.xaxis ?? 'x').replace('x', 'xaxis')); axes.add((t.yaxis ?? 'y').replace('y', 'yaxis')); } });
      axes.forEach(axis); scenes.forEach(s => { ['xaxis', 'yaxis', 'zaxis'].forEach(a => axis(`${s}.${a}`)); add('layout', null, `${s}.bgcolor`, p.plotBackground, 'plotBackground'); });
      for (const b of bound) {
        const t = graph.data[b.index];
        if (!t || (b.uid ? t.uid !== b.uid : t !== b.identity)) fail('STALE_BINDING', 'A bound trace was replaced or reordered. Reattach with current bindings.');
        if (!['scatter', 'scattergl', 'scatter3d'].includes(t.type ?? 'scatter')) { notices.push(`Trace ${b.index}: surface/mesh encodings are protected; only scene style is changed.`); continue; }
        if (!(t.mode ?? 'lines').includes('lines')) { notices.push(`Trace ${b.index}: no visible line styling requested.`); continue; }
        if (b.channels?.width === 'decorative' && p.lineWidth !== undefined) {
          if (Array.isArray(t.line?.width) || ArrayBuffer.isView(t.line?.width)) fail('ENCODING_PROTECTED', 'An array-valued width cannot be replaced by decorative styling.');
          add('trace', b.index, 'line.width', b.role === 'reference' ? Math.max(0.5, p.lineWidth * 0.65) : p.lineWidth, 'lineWidth');
        }
        if (b.channels?.color === 'decorative' && p.colors?.[b.role]) {
          if (Array.isArray(t.line?.color) || ArrayBuffer.isView(t.line?.color)) fail('ENCODING_PROTECTED', 'An array-valued color cannot be replaced by decorative styling.');
          add('trace', b.index, 'line.color', p.colors[b.role], `colors.${b.role}`);
        }
      }
      if (!bindings.length) notices.push('No trace channels are bound: line colors and widths are unchanged.');
    }
    const signature = canonical(before);
    const plan = freeze({id: `plan-${++sequence}`, adapterVersion: VERSION, engineVersion: Plotly.version, baseDigest: await sha256(signature), operations: ops, notices});
    plans.set(plan, {before, signature, inverse: !!inverse}); return plan;
  }
  async function write(ops, reverse = false) {
    const layout = {}, traces = new Map();
    for (const op of ops) {
      const value = reverse ? (op.previous.present ? copy(op.previous.value) : null) : op.next;
      if (op.target === 'layout') layout[op.path] = value;
      else { if (!traces.has(op.index)) traces.set(op.index, {}); traces.get(op.index)[op.path] = value; }
    }
    if (Object.keys(layout).length) await Plotly.relayout(graph, layout);
    for (const [index, patch] of traces) await Plotly.restyle(graph, patch, [index]);
    if (options.awaitSettled) await options.awaitSettled();
  }
  async function applyInternal(plan) {
    alive(); const saved = plans.get(plan); if (!saved) fail('INVALID_PLAN', 'Use a plan created by this live adapter. Imported or consumed plans must be replanned.');
    const now = await capture(); if (canonical(now) !== saved.signature) fail('STALE_PLAN', 'Chart or host state changed after planning. Replan before applying.');
    plans.delete(plan);
    let after, writeError;
    try { await write(plan.operations); after = await capture(); } catch (e) { writeError = e; after = await capture(); }
    const beforeGroups = groups(saved.before, plan.operations), afterGroups = groups(after, plan.operations);
    const checks = Object.keys(beforeGroups).map(property => ({property, status: beforeGroups[property] === afterGroups[property] ? 'verified' : 'failed', method: 'independent_before_after_canonical_comparison'}));
    if (!options.readProtectedState) checks.find(c => c.property === 'host_state').status = 'not_evaluated';
    const applied = plan.operations.every(op => { const actual = field(op.target === 'layout' ? after.layout : after.data[op.index], op.path); return op.restoreAbsence ? !actual.present : actual.present && canonical(actual.value) === canonical(op.next); });
    checks.push({property: 'requested_style', status: applied && !writeError ? 'verified' : 'failed', method: 'native_public_field_readback'});
    const accepted = !writeError && !checks.some(c => c.status === 'failed');
    let recovery = 'not_needed';
    if (!accepted) {
      if (options.readRevision && after.revision !== saved.before.revision) recovery = 'conflict';
      else {
        try { await write(plan.operations, true); const recovered = await capture(); recovery = canonical(recovered) === saved.signature ? 'restored' : 'recovery_required'; }
        catch { recovery = 'recovery_required'; }
      }
    } else if (!saved.inverse && plan.operations.length) history.push(plan.operations);
    const report = freeze({schema: 'graph-adaptation-report/0.3', adapterVersion: VERSION, engine: {name: 'plotlyjs', version: Plotly.version}, planId: plan.id, outcome: accepted ? 'accepted' : 'failed', operationCount: plan.operations.length, recovery, checks, beforeDigest: plan.baseDigest, afterDigest: await sha256(canonical(after)), limitations: ['Screen lengths are CSS pixels, not verified physical millimetres.', 'Behavioral preservation is qualified by browser fixtures; state equality is not proof of arbitrary plugin behavior.', ...(!options.readProtectedState ? ['External callbacks/plugins/host state were not inspected.'] : []), ...(Plotly.version !== TESTED_PLOTLY_VERSION ? ['This engine version has not been qualified.'] : [])], ...(writeError ? {error: String(writeError.message)} : {})});
    if (!accepted) throw new AdapterError('PRESERVATION_FAILED', 'A required state/style check failed. Inspect recovery and evidence.', report);
    return report;
  }
  return {
    plan: profile => options.withExclusive(() => makePlan(profile)),
    apply: plan => options.withExclusive(() => applyInternal(plan)),
    applyProfile: profile => options.withExclusive(async () => { const plan = await makePlan(profile); const report = await applyInternal(plan); return {plan, report}; }),
    undo: () => options.withExclusive(async () => { if (!history.length) fail('NO_UNDO', 'No style changes to undo.'); const ops = history.at(-1); const plan = await makePlan(null, ops); const report = await applyInternal(plan); history.pop(); return {plan, report}; }),
    capture: () => options.withExclusive(capture),
    get canUndo() { return history.length > 0; },
    dispose() { disposed = true; history.length = 0; }
  };
}
export function safeJSON(value) {
  return JSON.stringify(value, (k, v) => { if (BAD_KEYS.has(k)) fail('UNSAFE_KEY', `Unsafe property ${k}`); if (typeof v === 'function' || typeof v === 'undefined' || typeof v === 'bigint') fail('SOURCE_REQUIRED', 'JSON cannot preserve executable or undefined source. Use the original application module.'); if (Object.is(v, -0)) fail('SIGNED_ZERO_EXPORT', 'JSON does not faithfully preserve negative zero. Retain the original source.'); if (typeof v === 'number' && !Number.isFinite(v)) fail('NONFINITE_EXPORT', 'JSON export requires finite numbers or explicit nulls.'); if (ArrayBuffer.isView(v)) fail('SOURCE_REQUIRED', 'Typed array dtype is not retained by plain JSON. Use the original source module or explicitly convert it.'); return v; }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
/** Restricted local JSON import. Not a parser for arbitrary native applications. */
export function validateFigureInput(input) {
  if (!input || !Array.isArray(input.data) || input.data.length === 0 || input.data.length > 30) fail('INVALID_FIGURE', 'Supply data with 1–30 Plotly traces.');
  let entries = 0;
  function inspect(v, depth = 0) {
    if (depth > 20 || ++entries > 250000) fail('RESOURCE_LIMIT', 'Figure exceeds the supported size or nesting limit.');
    if (typeof v === 'function' || typeof v === 'undefined') fail('INVALID_FIGURE', 'Only explicit JSON values are accepted.');
    if (typeof v === 'number' && !Number.isFinite(v)) fail('INVALID_FIGURE', 'Use finite values or null gaps.');
    if (typeof v === 'string' && (v.length > 2000 || /[<>]|(?:https?:|javascript:|data:|blob:|file:)|\/\//i.test(v.replace(/<\/?(?:br|b|i|sup|sub|extra)\s*\/?>/gi, '')))) fail('UNSAFE_CONTENT', 'Only limited Plotly text tags are accepted; active HTML, URLs, and external assets are rejected.');
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (BAD_KEYS.has(k) || /src$/i.test(k)) fail('UNSAFE_KEY', `Unsupported property: ${k}`); inspect(x, depth + 1); }
  }
  inspect(input);
  const allowedTop = new Set(['data', 'layout', 'config', 'metadata']);
  for (const k of Object.keys(input)) if (!allowedTop.has(k)) fail('INVALID_FIGURE', `Unsupported figure property: ${k}`);
  for (const t of input.data) {
    if (!['scatter', 'scatter3d', 'surface', 'mesh3d'].includes(t.type ?? 'scatter')) fail('UNSUPPORTED_TRACE', `Unsupported imported trace: ${t.type}`);
    if (!Array.isArray(t.y) || !t.y.length) fail('INVALID_FIGURE', 'Each trace requires a nonempty y array.');
    if (t.type === 'surface') {
      if (!Array.isArray(t.z) || t.z.length !== t.y.length || !Array.isArray(t.x) || t.z.some(row => !Array.isArray(row) || row.length !== t.x.length)) fail('INVALID_FIGURE', 'Surface z must have one row per y and one column per x.');
      if (t.surfacecolor && (t.surfacecolor.length !== t.z.length || t.surfacecolor.some(r => !Array.isArray(r) || r.length !== t.x.length))) fail('INVALID_FIGURE', 'Surface color must match the geometry shape.');
    } else {
      if (!Array.isArray(t.x) || t.x.length !== t.y.length) fail('INVALID_FIGURE', 'x and y lengths must match.');
      if (['scatter3d', 'mesh3d'].includes(t.type) && (!Array.isArray(t.z) || t.z.length !== t.x.length)) fail('INVALID_FIGURE', 'x, y, and z lengths must match.');
      if (t.type === 'mesh3d') { if (!['i', 'j', 'k'].every(k => Array.isArray(t[k])) || t.i.length !== t.j.length || t.i.length !== t.k.length) fail('INVALID_FIGURE', 'Meshes require explicit i/j/k connectivity.'); for (const k of ['i', 'j', 'k']) if (t[k].some(v => !Number.isInteger(v) || v < 0 || v >= t.x.length)) fail('INVALID_FIGURE', 'A triangle references a nonexistent vertex.'); }
    }
    if (t.transforms) fail('UNSUPPORTED_TRACE', 'Transform pipelines require application integration, not JSON import.');
  }
  const layout = input.layout ?? {};
  if (layout.images || layout.updatemenus || layout.sliders || layout.map || layout.mapbox || layout.geo) fail('UNSUPPORTED_LAYOUT', 'Images, maps, executable controls, and animation are outside this importer.');
  const allowedConfig = new Set(['responsive', 'displaylogo', 'scrollZoom', 'displayModeBar', 'staticPlot', 'editable', 'doubleClick']);
  for (const [k, v] of Object.entries(input.config ?? {})) if (!allowedConfig.has(k) || !['boolean', 'string'].includes(typeof v)) fail('UNSUPPORTED_CONFIG', `Unsupported config field: ${k}`);
  return copy(input);
}
export function makeStandaloneHTML(figure, runtimeSource, metadata = {}) {
  if (typeof runtimeSource !== 'string' || !runtimeSource.includes('plotly.js v')) fail('RUNTIME_REQUIRED', 'Supply the trusted, pinned Plotly runtime source.');
  const payload = safeJSON(figure), meta = safeJSON(metadata);
  const runtime = runtimeSource.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Technical chart — native HTML</title><style>body{margin:0;font:14px Arial;background:#f5f7fa;color:#334155}header{padding:18px 26px;background:white;border-bottom:1px solid #ddd;display:flex;justify-content:space-between;gap:16px}#chart{height:calc(100vh - 70px);min-height:450px}button{cursor:pointer;padding:8px 14px}#status{padding:6px 26px}</style><header><span>Technical chart · native Plotly · offline HTML</span><button id="source">Save native figure JSON</button></header><div id="chart"></div><div id="status" role="status"></div><script>${runtime}</script><script type="application/json" id="figure">${payload}</script><script type="application/json" id="provenance">${meta}</script><script>const figure=JSON.parse(document.getElementById('figure').textContent);Plotly.newPlot('chart',figure.data,figure.layout,figure.config||{}).catch(e=>document.getElementById('status').textContent=e.message);document.getElementById('source').onclick=()=>{const b=new Blob([document.getElementById('figure').textContent],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='native-figure.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};</script></html>`;
}
