const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();

function fmtDuration(start, end) {
  const a = Date.parse(start || ''), b = Date.parse(end || '');
  if (!a || !b || b < a) return '-';
  const sec = Math.round((b - a) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function renderInspector(el, s, onBack) {
  if (!s) {
    el.innerHTML = `<div class="card"><button id="btnBack">← Back to Sessions</button><p class="muted" style="margin-top:12px">Session not found.</p></div>`;
    el.querySelector('#btnBack').onclick = onBack;
    return;
  }

  let activeTab = 'breakdown';
  let cliFilter = 'all';
  let pathQuery = '';
  const t = s.diagnostics.totals;
  const dur = fmtDuration(s.startedAt, s.updatedAt);

  function draw() {
    const models = Object.entries(s.tokensByModel || {});
    const tools = Object.entries(s.toolCounts || {}).sort((a, b) => (b[1].ok + b[1].err) - (a[1].ok + a[1].err));
    const acts = s.skillActivations || [];
    const subs = s.subagents || [];
    const calls = (s.cliCalls || []).filter((c) => {
      if (cliFilter === 'agx') return c.isAgx;
      if (cliFilter === 'err') return !c.ok;
      return true;
    });
    const paths = (s.pathsTouched || []).filter((p) => !pathQuery || p.toLowerCase().includes(pathQuery.toLowerCase()));

    let bodyHtml = '';
    if (activeTab === 'breakdown') {
      bodyHtml = `
        <div class="split">
          <div class="card">
            <h3>Models &amp; Token Usage</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Model</th><th>Steps</th><th>Input</th><th>Cache Read</th><th>Output</th></tr></thead>
              <tbody>${models.map(([m, mt]) => `<tr><td class="mono">${esc(m)}</td><td class="num">${mt.steps}</td><td class="num">${fmt(mt.inputTokens)}</td><td class="num">${fmt(mt.cacheReadTokens)}</td><td class="num">${fmt(mt.outputTokens)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No model token data</td></tr>'}</tbody>
            </table></div>
          </div>
          <div class="card">
            <h3>Tool Calls (${tools.length} tools)</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Tool</th><th>OK</th><th>Errors</th></tr></thead>
              <tbody>${tools.map(([name, c]) => `<tr><td class="mono">${esc(name)}</td><td class="num">${c.ok}</td><td class="num" style="color:${c.err ? 'var(--err)' : 'var(--muted)'}">${c.err}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No tool calls recorded</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>`;
    } else if (activeTab === 'cli') {
      bodyHtml = `
        <div class="card">
          <div class="controls" style="margin-bottom:10px;justify-content:space-between">
            <h3>CLI &amp; agx Runs (${calls.length}/${(s.cliCalls || []).length})</h3>
            <div class="tf-group">
              <button class="tf ${cliFilter === 'all' ? 'active' : ''}" data-cf="all">All</button>
              <button class="tf ${cliFilter === 'agx' ? 'active' : ''}" data-cf="agx">agx only</button>
              <button class="tf ${cliFilter === 'err' ? 'active' : ''}" data-cf="err">Errors</button>
            </div>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Time</th><th>Step</th><th>Kind</th><th>Status</th><th>Command</th></tr></thead>
            <tbody>${calls.map((c) => `<tr><td class="mono muted">${esc((c.ts || '').replace('T', ' ').slice(0, 19))}</td><td class="num">s${c.stepIdx ?? '?'}</td><td><span class="pill ${c.isAgx ? 'ok' : 'acc'}">${c.isAgx ? 'agx' : 'sh'}</span></td><td><span class="pill ${c.ok ? 'ok' : 'err'}">${c.ok ? 'OK' : 'ERR'}</span></td><td class="mono wrap">${esc(c.command)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No matching commands</td></tr>'}</tbody>
          </table></div>
        </div>`;
    } else if (activeTab === 'skills') {
      bodyHtml = `
        <div class="split">
          <div class="card">
            <h3>Skill Activations (${acts.length})</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Time</th><th>Step</th><th>Skill</th><th>Source</th><th>Path</th></tr></thead>
              <tbody>${acts.map((a) => `<tr><td class="mono muted">${esc((a.ts || '').replace('T', ' ').slice(0, 19))}</td><td class="num">s${a.stepIdx ?? '?'}</td><td><span class="pill ok">${esc(a.skill)}</span></td><td class="muted">${esc(a.source)}</td><td class="mono wrap">${esc(a.path)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No skill activations</td></tr>'}</tbody>
            </table></div>
          </div>
          <div class="card">
            <h3>Subagents &amp; Swarms (${subs.length})</h3>
            <div class="table-wrap"><table>
              <thead><tr><th>Tool</th><th>Type / Role</th><th>Model</th><th>Workspace</th><th>Status</th></tr></thead>
              <tbody>${subs.map((a) => `<tr><td class="mono">${esc(a.tool)}</td><td>${esc(a.role || a.typeName || '-')}</td><td class="mono">${esc(a.model || 'inherit')}</td><td class="muted">${esc(a.workspace || 'inherit')}</td><td><span class="pill ${a.ok ? 'ok' : 'err'}">${a.ok ? 'OK' : 'ERR'}</span></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No subagents spawned</td></tr>'}</tbody>
            </table></div>
          </div>
        </div>`;
    } else {
      bodyHtml = `
        <div class="card">
          <div class="controls" style="margin-bottom:10px;justify-content:space-between">
            <h3>Paths Touched (${paths.length}/${(s.pathsTouched || []).length})</h3>
            <input id="pathSearch" placeholder="Filter paths..." value="${esc(pathQuery)}" />
          </div>
          <div class="table-wrap"><table>
            <tbody>${paths.map((p) => `<tr><td class="mono wrap">${esc(p)}</td></tr>`).join('') || '<tr><td class="muted">No paths match</td></tr>'}</tbody>
          </table></div>
        </div>`;
    }

    el.innerHTML = `
      <div class="card">
        <div class="controls" style="justify-content:space-between;margin-bottom:10px">
          <div class="controls">
            <button id="btnBack">← Back</button>
            <h2 style="margin:0" class="mono">${esc(s.conversationId)}</h2>
            <span class="pill acc">v${esc(s.agentSkillsVersion || 'unversioned')}</span>
          </div>
          <div class="muted">Duration: <strong style="color:var(--fg)">${dur}</strong> | Steps: <strong style="color:var(--fg)">${t.steps}</strong> | Est. Cost: <strong style="color:var(--fg)">$${t.estimatedUsd.toFixed(4)}</strong></div>
        </div>
        <div class="muted">CWD: <span class="mono">${esc(s.cwd || 'unknown')}</span> | Updated: ${esc((s.updatedAt || '').replace('T', ' ').slice(0, 19))}</div>
        <div style="margin-top:8px">${s.diagnostics.checks.map((c) => `<span class="pill ${c.startsWith('WARN') ? 'warn' : 'ok'}">${esc(c)}</span>`).join('')}</div>
      </div>
      <div class="subtabs">
        <button class="tab ${activeTab === 'breakdown' ? 'active' : ''}" data-st="breakdown">Models &amp; Tools</button>
        <button class="tab ${activeTab === 'cli' ? 'active' : ''}" data-st="cli">CLI &amp; agx (${(s.cliCalls || []).length})</button>
        <button class="tab ${activeTab === 'skills' ? 'active' : ''}" data-st="skills">Skills &amp; Subagents (${acts.length}/${subs.length})</button>
        <button class="tab ${activeTab === 'paths' ? 'active' : ''}" data-st="paths">Paths (${(s.pathsTouched || []).length})</button>
      </div>
      ${bodyHtml}`;

    el.querySelector('#btnBack').onclick = onBack;
    el.querySelectorAll('[data-st]').forEach((b) => { b.onclick = () => { activeTab = b.dataset.st; draw(); }; });
    el.querySelectorAll('[data-cf]').forEach((b) => { b.onclick = () => { cliFilter = b.dataset.cf; draw(); }; });
    const ps = el.querySelector('#pathSearch');
    if (ps) ps.oninput = (e) => { pathQuery = e.target.value; draw(); ps.focus(); };
  }

  draw();
}
