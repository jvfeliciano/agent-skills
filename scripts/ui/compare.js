const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();

export function renderCompare(el, versions, state, onRunCompare) {
  const opts = (sel) => ['all', ...versions].map((v) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${v === 'all' ? 'All versions' : esc(v)}</option>`).join('');

  const r = state.result;
  let body = '<div class="card muted">Select two versions or timeframes and click Compare.</div>';
  if (r) {
    const { a, b, deltas } = r;
    const deltaPill = (val, unit, lowerIsBetter) => {
      if (val === 0) return '<span class="pill">0' + unit + '</span>';
      const good = lowerIsBetter ? val < 0 : val > 0;
      const sign = val > 0 ? '+' : '';
      return `<span class="pill ${good ? 'ok' : 'err'}">${sign}${val}${unit}</span>`;
    };
    const rows = [
      ['Sessions', a.sessions, b.sessions, ''],
      ['Avg Cost / Run', '$' + a.avgCostUsd.toFixed(4), '$' + b.avgCostUsd.toFixed(4), deltaPill(deltas.avgCostUsd, ' USD', true)],
      ['Avg Tokens / Run', fmt(a.avgTokens), fmt(b.avgTokens), deltaPill(deltas.avgTokens, '', true)],
      ['Cache Hit Rate', a.cacheHitPct + '%', b.cacheHitPct + '%', deltaPill(deltas.cacheHitPct, '%', false)],
      ['agx Adoption', a.agxPct + '%', b.agxPct + '%', deltaPill(deltas.agxPct, '%', false)],
      ['Avg Steps / Run', a.avgSteps, b.avgSteps, deltaPill(deltas.avgSteps, '', true)],
      ['Tool Error Rate', a.toolErrorRate + '%', b.toolErrorRate + '%', deltaPill(deltas.toolErrorRate, '%', true)],
    ];
    body = `
      <div class="card">
        <h3>Comparison: ${esc(a.label)} (${a.sessions} runs) vs ${esc(b.label)} (${b.sessions} runs)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Metric</th><th>${esc(a.label)}</th><th>${esc(b.label)}</th><th>Delta (B - A)</th></tr></thead>
          <tbody>${rows.map(([m, va, vb, d]) => `<tr><td>${m}</td><td class="num">${va}</td><td class="num">${vb}</td><td>${d}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="split">
        <div class="card">
          <h3>Top Skills</h3>
          <div class="split">
            <div><div class="muted">${esc(a.label)}</div>${a.topSkills.map(([k, v]) => `<span class="pill ok">${esc(k)}: ${v}</span>`).join('') || '<div class="muted">None</div>'}</div>
            <div><div class="muted">${esc(b.label)}</div>${b.topSkills.map(([k, v]) => `<span class="pill ok">${esc(k)}: ${v}</span>`).join('') || '<div class="muted">None</div>'}</div>
          </div>
        </div>
        <div class="card">
          <h3>Top agx Subcommands</h3>
          <div class="split">
            <div><div class="muted">${esc(a.label)}</div>${a.topAgxSubs.map(([k, v]) => `<span class="pill acc">agx ${esc(k)}: ${v}</span>`).join('') || '<div class="muted">None</div>'}</div>
            <div><div class="muted">${esc(b.label)}</div>${b.topAgxSubs.map(([k, v]) => `<span class="pill acc">agx ${esc(k)}: ${v}</span>`).join('') || '<div class="muted">None</div>'}</div>
          </div>
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="card">
      <h3>Compare Versions or Timeframes</h3>
      <div class="controls" style="gap:10px">
        <label class="muted">A: <select id="cmpA">${opts(state.a)}</select></label>
        <input type="date" id="cmpFromA" value="${esc(state.fromA)}" title="From A" />
        <input type="date" id="cmpToA" value="${esc(state.toA)}" title="To A" />
        <span class="muted">vs</span>
        <label class="muted">B: <select id="cmpB">${opts(state.b)}</select></label>
        <input type="date" id="cmpFromB" value="${esc(state.fromB)}" title="From B" />
        <input type="date" id="cmpToB" value="${esc(state.toB)}" title="To B" />
        <button class="primary" id="btnCompare">Compare</button>
      </div>
    </div>
    ${body}`;

  el.querySelector('#btnCompare').onclick = () => {
    onRunCompare({
      a: el.querySelector('#cmpA').value,
      b: el.querySelector('#cmpB').value,
      fromA: el.querySelector('#cmpFromA').value,
      toA: el.querySelector('#cmpToA').value,
      fromB: el.querySelector('#cmpFromB').value,
      toB: el.querySelector('#cmpToB').value,
    });
  };
}
