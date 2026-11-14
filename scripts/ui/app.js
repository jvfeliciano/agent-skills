import { renderInspector } from '/ui/inspector.js';
import { renderCompare } from '/ui/compare.js';

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();
const $ = (id) => document.getElementById(id);

let autoSync = true;
let dataCache = { sessions: [], aggregate: {}, versions: [] };
let filter = { tf: 'all', from: '', to: '', version: 'all', q: '' };
let sort = { key: 'updatedAt', dir: -1 };
let cmpState = { a: 'all', b: 'all', fromA: '', toA: '', fromB: '', toB: '', result: null };

function parseHash() {
  const h = (location.hash || '#overview').slice(1);
  if (h.startsWith('sessions/')) return { view: 'inspector', id: decodeURIComponent(h.slice(9)) };
  if (['overview', 'sessions', 'skills', 'compare'].includes(h)) return { view: h, id: '' };
  return { view: 'overview', id: '' };
}

function setView(view, id = '') {
  location.hash = id ? `#sessions/${encodeURIComponent(id)}` : `#${view}`;
}

function applyTimeframe(tf) {
  filter.tf = tf;
  const now = new Date();
  const isoDay = (d) => d.toISOString().slice(0, 10);
  if (tf === 'all') { filter.from = ''; filter.to = ''; }
  else {
    const days = tf === '24h' ? 1 : tf === '7d' ? 7 : 30;
    filter.from = isoDay(new Date(now.getTime() - days * 86400_000));
    filter.to = isoDay(now);
  }
  $('filterFrom').value = filter.from;
  $('filterTo').value = filter.to;
  document.querySelectorAll('.tf[data-tf]').forEach((b) => b.classList.toggle('active', b.dataset.tf === tf));
  load();
}

async function load() {
  const params = new URLSearchParams();
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.version && filter.version !== 'all') params.set('version', filter.version);
  if (filter.q) params.set('q', filter.q);
  const res = await fetch(`/api/sessions?${params}`);
  dataCache = await res.json();
  syncVersionSelect();
  render();
}

function syncVersionSelect() {
  const vs = dataCache.versions || [];
  const sel = $('filterVersion');
  const cur = filter.version;
  sel.innerHTML = `<option value="all">All versions (${vs.length})</option>` + vs.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = vs.includes(cur) ? cur : 'all';
  $('versionBadge').textContent = vs.filter((v) => v !== 'unversioned')[0] ? `v${vs.filter((v) => v !== 'unversioned')[0]}` : 'telemetry';
}

async function scan(path) {
  $('btnScan').disabled = true;
  $('status').textContent = 'Scanning transcripts...';
  const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: path || '' }) });
  const r = await res.json();
  $('btnScan').disabled = false;
  $('status').textContent = `Scanned ${r.scanned} | Imported ${r.imported}, Updated ${r.updated} | Sync: ${(r.lastScanAt || '').replace('T', ' ').slice(0, 19)}`;
  await load();
}

function sortValue(s, k) {
  const t = s.diagnostics.totals;
  if (k === 'updatedAt') return Date.parse(s.updatedAt || '0');
  if (k === 'cost') return t.estimatedUsd;
  if (k === 'tokens') return t.inputTokens + t.cacheReadTokens + t.outputTokens;
  if (k === 'cache') return (t.inputTokens + t.cacheReadTokens) > 0 ? t.cacheReadTokens / (t.inputTokens + t.cacheReadTokens) : 0;
  if (k === 'agx') return t.totalCmds > 0 ? t.agxCalls / t.totalCmds : 0;
  if (k === 'errors') return t.toolErrs;
  return String(s[k] || '');
}

function renderOverview(el, sessions, a) {
  const totIn = (a.totalInputTokens || 0) + (a.totalCacheReadTokens || 0);
  const cachePct = totIn > 0 ? Math.round((a.totalCacheReadTokens / totIn) * 100) : 0;
  const agxPct = a.totalCmds > 0 ? Math.round((a.agxCalls / a.totalCmds) * 100) : 0;
  const kpis = [
    ['Est. Total Cost', '$' + Number(a.totalCostUsd || 0).toFixed(4), `${a.totalSessions || 0} session(s)`],
    ['Total Tokens', fmt((a.totalInputTokens || 0) + (a.totalCacheReadTokens || 0) + (a.totalOutputTokens || 0)), `In ${fmt(a.totalInputTokens)} | Out ${fmt(a.totalOutputTokens)}`],
    ['Cache Hit Rate', cachePct + '%', `${fmt(a.totalCacheReadTokens)} cached`],
    ['agx Adoption', `${a.agxCalls || 0}/${a.totalCmds || 0}`, `${agxPct}% of shell calls`],
    ['Subagents', fmt(a.subagents || 0), 'invoke_subagent / swarm'],
  ];

  const chrono = [...sessions].reverse();
  const maxTok = Math.max(1, ...sessions.map((s) => { const t = s.diagnostics.totals; return t.inputTokens + t.cacheReadTokens + t.outputTokens; }));
  let chart = '<div class="muted">No sessions in current filter.</div>';
  if (chrono.length) {
    const W = 900, H = 150, P = 30, n = chrono.length;
    const xAt = (i) => n === 1 ? W / 2 : P + (i * (W - P * 2)) / (n - 1);
    const yAt = (pct) => H - P - (pct / 100) * (H - P * 2);
    const pts = chrono.map((s, i) => {
      const t = s.diagnostics.totals;
      const cp = (t.inputTokens + t.cacheReadTokens) > 0 ? Math.round((t.cacheReadTokens / (t.inputTokens + t.cacheReadTokens)) * 100) : 0;
      const ap = t.totalCmds > 0 ? Math.round((t.agxCalls / t.totalCmds) * 100) : 0;
      return { x: xAt(i), cy: yAt(cp), ay: yAt(ap), cp, ap, s, t };
    });
    const line = (k) => pts.map((p) => `${p.x.toFixed(1)},${p[k].toFixed(1)}`).join(' ');
    chart = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-height:170px;display:block">
      ${[0, 50, 100].map((v) => `<line x1="${P}" y1="${yAt(v)}" x2="${W - P}" y2="${yAt(v)}" stroke="#2a3441" stroke-dasharray="3 3"/><text x="4" y="${yAt(v) + 4}" fill="#8b949e" font-size="10">${v}%</text>`).join('')}
      ${n > 1 ? `<polyline fill="none" stroke="#3fb950" stroke-width="2" points="${line('cy')}"/><polyline fill="none" stroke="#58a6ff" stroke-width="2" points="${line('ay')}"/>` : ''}
      ${pts.map((p, idx) => `<circle class="pt" data-idx="${idx}" cx="${p.x}" cy="${p.cy}" r="4.5" fill="#3fb950" style="cursor:pointer"/><circle class="pt" data-idx="${idx}" cx="${p.x}" cy="${p.ay}" r="4.5" fill="#58a6ff" style="cursor:pointer"/>`).join('')}
    </svg>`;
  }

  const versions = Object.entries(a.versionCounts || {}).sort((x, y) => y[1] - x[1]);
  const models = Object.entries(a.modelTokens || {});
  el.innerHTML = `
    <div class="grid">${kpis.map(([t, v, s]) => `<div class="card" style="margin:0"><div class="muted">${t}</div><div class="kpi">${v}</div><div class="muted">${s}</div></div>`).join('')}</div>
    <div class="card">
      <h3>Trends Over Time (oldest → newest)</h3>
      ${chart}
      <div class="muted" style="margin-top:6px"><span style="color:var(--ok)">● Cache Hit %</span> &nbsp; <span style="color:var(--acc)">● agx Command %</span> &nbsp; (hover or click a point to inspect)</div>
    </div>
    <div class="split">
      <div class="card">
        <h3>Top Sessions by Tokens &amp; Cost</h3>
        ${sessions.slice(0, 8).map((s) => {
          const t = s.diagnostics.totals;
          const w = (n) => ((n / maxTok) * 100).toFixed(1) + '%';
          return `<div class="chart-row" style="cursor:pointer" data-sid="${esc(s.conversationId)}"><span class="chart-label mono">${esc(s.conversationId.slice(0, 12))}</span><div class="chart-track"><div class="seg-in" style="width:${w(t.inputTokens)}"></div><div class="seg-cache" style="width:${w(t.cacheReadTokens)}"></div><div class="seg-out" style="width:${w(t.outputTokens)}"></div></div><span class="num">$${t.estimatedUsd.toFixed(4)}</span></div>`;
        }).join('') || '<div class="muted">No sessions</div>'}
        <div class="muted" style="margin-top:8px">Orange: uncached input | Green: cache read | Blue: output</div>
      </div>
      <div class="card">
        <h3>Models &amp; Versions</h3>
        <div style="margin-bottom:10px">${versions.map(([v, c]) => `<span class="pill acc">${esc(v)}: ${c}</span>`).join('') || '<span class="muted">None</span>'}</div>
        ${models.map(([m, t]) => `<div class="muted" style="margin:4px 0"><strong style="color:var(--fg)" class="mono">${esc(m)}</strong>: ${t.steps} steps | in=${fmt(t.input)} cache=${fmt(t.cache)} out=${fmt(t.output)}</div>`).join('') || '<div class="muted">No model tokens</div>'}
      </div>
    </div>`;

  const tip = $('tooltip');
  el.querySelectorAll('.pt').forEach((c) => {
    const item = chrono[Number(c.dataset.idx)];
    c.onmouseenter = (e) => {
      const t = item.diagnostics.totals;
      const cp = (t.inputTokens + t.cacheReadTokens) > 0 ? Math.round((t.cacheReadTokens / (t.inputTokens + t.cacheReadTokens)) * 100) : 0;
      const ap = t.totalCmds > 0 ? Math.round((t.agxCalls / t.totalCmds) * 100) : 0;
      tip.innerHTML = `<div class="mono">${esc(item.conversationId.slice(0, 12))} (v${esc(item.agentSkillsVersion || 'unversioned')})</div><div class="muted">${esc((item.updatedAt || '').replace('T', ' ').slice(0, 19))}</div><div>Cache: ${cp}% | agx: ${ap}% | $${t.estimatedUsd.toFixed(4)}</div>`;
      tip.style.left = `${e.clientX + 12}px`; tip.style.top = `${e.clientY + 12}px`; tip.hidden = false;
    };
    c.onmouseleave = () => { tip.hidden = true; };
    c.onclick = () => { tip.hidden = true; setView('sessions', item.conversationId); };
  });
  el.querySelectorAll('[data-sid]').forEach((r) => { r.onclick = () => setView('sessions', r.dataset.sid); });
}

function renderSessions(el, sessions) {
  const sorted = [...sessions].sort((a, b) => {
    const va = sortValue(a, sort.key), vb = sortValue(b, sort.key);
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });
  const th = (k, label) => `<th data-sort="${k}">${label}${sort.key === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
  el.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr>${th('updatedAt', 'Updated')}${th('conversationId', 'Session')}${th('agentSkillsVersion', 'Version')}${th('modelName', 'Model')}${th('cost', 'Cost')}${th('tokens', 'Tokens (In / Cache / Out)')}${th('cache', 'Cache %')}${th('agx', 'agx')}${th('errors', 'Errs')}</tr></thead>
    <tbody>${sorted.map((s) => {
      const t = s.diagnostics.totals;
      const cp = (t.inputTokens + t.cacheReadTokens) > 0 ? Math.round((t.cacheReadTokens / (t.inputTokens + t.cacheReadTokens)) * 100) : 0;
      const model = Object.keys(s.tokensByModel || {})[0] || s.modelName || 'unknown';
      return `<tr data-id="${esc(s.conversationId)}"><td class="mono muted">${esc((s.updatedAt || '').replace('T', ' ').slice(0, 16))}</td><td class="mono">${esc(s.conversationId.slice(0, 12))}</td><td><span class="pill acc">${esc(s.agentSkillsVersion || 'unversioned')}</span></td><td class="mono">${esc(model)}</td><td class="num">$${t.estimatedUsd.toFixed(4)}</td><td class="num">${fmt(t.inputTokens)} / ${fmt(t.cacheReadTokens)} / ${fmt(t.outputTokens)}</td><td class="num">${cp}%</td><td class="num">${t.agxCalls}/${t.totalCmds}</td><td class="num" style="color:${t.toolErrs ? 'var(--err)' : 'var(--muted)'}">${t.toolErrs}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="muted">No sessions match the current filter.</td></tr>'}</tbody>
  </table></div></div>`;
  el.querySelectorAll('th[data-sort]').forEach((h) => {
    h.onclick = () => { const k = h.dataset.sort; sort.dir = sort.key === k ? -sort.dir : -1; sort.key = k; renderSessions(el, sessions); };
  });
  el.querySelectorAll('tbody tr[data-id]').forEach((r) => { r.onclick = () => setView('sessions', r.dataset.id); });
}

function renderSkills(el, a) {
  const skills = Object.entries(a.skillCounts || {}).sort((x, y) => y[1] - x[1]);
  const subs = Object.entries(a.agxSubCounts || {}).sort((x, y) => y[1] - x[1]);
  const acts = a.recentSkillActivations || [];
  const cmds = a.recentCliCalls || [];
  el.innerHTML = `
    <div class="split">
      <div class="card"><h3>Skills Loaded</h3>${skills.map(([k, v]) => `<span class="pill ok">${esc(k)}: ${v}</span>`).join('') || '<span class="muted">None</span>'}</div>
      <div class="card"><h3>agx Subcommands</h3>${subs.map(([k, v]) => `<span class="pill acc">agx ${esc(k)}: ${v}</span>`).join('') || '<span class="muted">None</span>'}</div>
    </div>
    <div class="split">
      <div class="card"><h3>Recent Skill Activations</h3><div class="table-wrap"><table>
        <thead><tr><th>Time</th><th>Session</th><th>Step</th><th>Skill</th></tr></thead>
        <tbody>${acts.slice(0, 25).map((x) => `<tr data-id="${esc(x.conversationId)}"><td class="mono muted">${esc((x.ts || '').replace('T', ' ').slice(0, 19))}</td><td class="mono">${esc(x.conversationId.slice(0, 8))}</td><td class="num">s${x.stepIdx ?? '?'}</td><td><span class="pill ok">${esc(x.skill)}</span></td></tr>`).join('') || '<tr><td colspan="4" class="muted">None</td></tr>'}</tbody>
      </table></div></div>
      <div class="card"><h3>Recent CLI &amp; agx Runs</h3><div class="table-wrap"><table>
        <thead><tr><th>Time</th><th>Session</th><th>Kind</th><th>Command</th></tr></thead>
        <tbody>${cmds.slice(0, 25).map((c) => `<tr data-id="${esc(c.conversationId)}"><td class="mono muted">${esc((c.ts || '').replace('T', ' ').slice(0, 19))}</td><td class="mono">${esc(c.conversationId.slice(0, 8))}</td><td><span class="pill ${c.isAgx ? 'ok' : 'acc'}">${c.isAgx ? 'agx' : 'sh'}</span></td><td class="mono wrap">${esc(c.command.slice(0, 75))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">None</td></tr>'}</tbody>
      </table></div></div>
    </div>`;
  el.querySelectorAll('tbody tr[data-id]').forEach((r) => { r.onclick = () => setView('sessions', r.dataset.id); });
}

async function runCompare(next) {
  cmpState = { ...cmpState, ...next };
  const p = new URLSearchParams();
  if (cmpState.a && cmpState.a !== 'all') p.set('a', cmpState.a);
  if (cmpState.b && cmpState.b !== 'all') p.set('b', cmpState.b);
  if (cmpState.fromA) p.set('fromA', cmpState.fromA);
  if (cmpState.toA) p.set('toA', cmpState.toA);
  if (cmpState.fromB) p.set('fromB', cmpState.fromB);
  if (cmpState.toB) p.set('toB', cmpState.toB);
  const res = await fetch(`/api/compare?${p}`);
  cmpState.result = await res.json();
  render();
}

function render() {
  const { view, id } = parseHash();
  const sessions = dataCache.sessions || [];
  const a = dataCache.aggregate || {};
  $('tabSessionCount').textContent = sessions.length;
  document.querySelectorAll('#navTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === (view === 'inspector' ? 'sessions' : view)));
  ['overview', 'sessions', 'skills', 'compare', 'inspector'].forEach((v) => { $(`view-${v}`).hidden = v !== view; });

  if (view === 'overview') renderOverview($('view-overview'), sessions, a);
  else if (view === 'sessions') renderSessions($('view-sessions'), sessions);
  else if (view === 'skills') renderSkills($('view-skills'), a);
  else if (view === 'compare') renderCompare($('view-compare'), dataCache.versions || [], cmpState, runCompare);
  else if (view === 'inspector') {
    const s = sessions.find((x) => x.conversationId === id || x.conversationId.startsWith(id));
    renderInspector($('view-inspector'), s, () => setView('sessions'));
  }
}

document.querySelectorAll('#navTabs .tab').forEach((b) => { b.onclick = () => setView(b.dataset.view); });
document.querySelectorAll('.tf[data-tf]').forEach((b) => { b.onclick = () => applyTimeframe(b.dataset.tf); });
$('filterFrom').onchange = (e) => { filter.from = e.target.value; filter.tf = ''; document.querySelectorAll('.tf[data-tf]').forEach((b) => b.classList.remove('active')); load(); };
$('filterTo').onchange = (e) => { filter.to = e.target.value; filter.tf = ''; document.querySelectorAll('.tf[data-tf]').forEach((b) => b.classList.remove('active')); load(); };
$('filterVersion').onchange = (e) => { filter.version = e.target.value; load(); };
let qTimer = null;
$('filterQuery').oninput = (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { filter.q = e.target.value; load(); }, 180); };

$('btnScan').onclick = () => scan();
$('btnImport').onclick = () => scan($('customPath').value);
$('btnRefresh').onclick = () => load();
$('btnReset').onclick = async () => { await fetch('/api/reset', { method: 'POST' }); load(); };
$('btnAuto').onclick = (e) => { autoSync = !autoSync; e.target.textContent = `Auto-Sync: ${autoSync ? 'ON' : 'OFF'}`; };
window.onhashchange = render;
setInterval(() => { if (autoSync) scan(); }, 30_000);
load();
