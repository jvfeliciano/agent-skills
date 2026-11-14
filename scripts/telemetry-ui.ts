import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDiagnostics, loadSession, parseTranscript, saveSession, telemetryDir, type SessionSummary } from './telemetry.ts';
import { resolveAgentSkillsVersion } from './telemetry-meta.ts';
import { aggregateSessions, compareBuckets, filterSessions, loadAllSessions, summarizeBucket } from './telemetry-stats.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
let lastScanAt = '';

const STATIC_UI: Record<string, { file: string; mime: string }> = {
  '/': { file: 'ui/index.html', mime: 'text/html; charset=utf-8' },
  '/ui/styles.css': { file: 'ui/styles.css', mime: 'text/css; charset=utf-8' },
  '/ui/app.js': { file: 'ui/app.js', mime: 'application/javascript; charset=utf-8' },
  '/ui/inspector.js': { file: 'ui/inspector.js', mime: 'application/javascript; charset=utf-8' },
  '/ui/compare.js': { file: 'ui/compare.js', mime: 'application/javascript; charset=utf-8' },
};

function findTranscripts(root: string, depth = 0): string[] {
  if (!existsSync(root) || depth > 5) return [];
  const st = statSync(root);
  if (st.isFile()) return root.endsWith('.jsonl') ? [root] : [];
  const out: string[] = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = join(root, ent.name);
    if (ent.isDirectory()) out.push(...findTranscripts(full, depth + 1));
    else if (ent.name === 'transcript.jsonl') out.push(full);
  }
  return out;
}

function conversationIdFromPath(tp: string): string {
  const parts = tp.split(/[\\/]/);
  const idx = parts.lastIndexOf('.system_generated');
  if (idx > 0) return parts[idx - 1];
  return basename(dirname(tp)) || basename(tp, '.jsonl');
}

export function scanTranscripts(extraPath?: string): { scanned: number; imported: number; updated: number; lastScanAt: string } {
  const dir = telemetryDir();
  mkdirSync(join(dir, 'sessions'), { recursive: true });
  const roots = [
    join(homedir(), '.gemini', 'antigravity', 'brain'),
    join(homedir(), '.gemini', 'antigravity-cli', 'brain'),
    join(homedir(), '.gemini', 'antigravity-ide', 'brain'),
  ];
  if (extraPath?.trim()) roots.push(resolve(extraPath.trim()));

  const files = new Set<string>();
  for (const r of roots) findTranscripts(r).forEach((f) => files.add(f));

  let imported = 0, updated = 0;
  for (const tp of files) {
    const mtimeMs = statSync(tp).mtimeMs;
    const convId = conversationIdFromPath(tp);
    const existing = loadSession(dir, convId);
    const prevMs = existing?.updatedAt ? Date.parse(existing.updatedAt) : 0;
    if (existing && prevMs >= mtimeMs && Object.keys(existing.tokensByModel || {}).length > 0 && existing.skillActivations !== undefined) continue;

    const p = parseTranscript(tp);
    const session: SessionSummary = {
      conversationId: convId,
      cwd: existing?.cwd,
      workspacePaths: existing?.workspacePaths || [],
      transcriptPath: tp,
      modelName: existing?.modelName || Object.keys(p.tokensByModel || {})[0],
      agentSkillsVersion: existing?.agentSkillsVersion || resolveAgentSkillsVersion(existing?.cwd),
      startedAt: existing?.startedAt || p.startedAt || new Date(mtimeMs).toISOString(),
      updatedAt: p.updatedAt || new Date(mtimeMs).toISOString(),
      terminationReason: existing?.terminationReason,
      skillsLoaded: [...new Set([...(existing?.skillsLoaded || []), ...(p.skillsLoaded || [])])],
      skillActivations: (p.skillActivations?.length ? p.skillActivations : existing?.skillActivations) || [],
      pathsTouched: [...new Set([...(existing?.pathsTouched || []), ...(p.pathsTouched || [])])],
      cliCalls: (p.cliCalls?.length ? p.cliCalls : existing?.cliCalls) || [],
      subagents: (p.subagents?.length ? p.subagents : existing?.subagents) || [],
      toolCounts: Object.keys(p.toolCounts || {}).length ? p.toolCounts! : (existing?.toolCounts || {}),
      tokensByModel: p.tokensByModel || existing?.tokensByModel || {},
    };
    saveSession(dir, session);
    if (existing) updated += 1; else imported += 1;
  }
  lastScanAt = new Date().toISOString();
  return { scanned: files.size, imported, updated, lastScanAt };
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { res(raw ? JSON.parse(raw) as Record<string, unknown> : {}); } catch { res({}); }
    });
  });
}

function sendJson(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

export function printDigest(flags: Record<string, string | boolean>): void {
  const limit = Number(typeof flags.limit === 'string' ? flags.limit : '20');
  const sessions = loadAllSessions();
  const a = aggregateSessions(sessions, lastScanAt);
  const totIn = Number(a.totalInputTokens || 0) + Number(a.totalCacheReadTokens || 0);
  const cacheHitPct = totIn > 0 ? Math.round((Number(a.totalCacheReadTokens || 0) / totIn) * 100) : 0;
  const agxPct = Number(a.totalCmds || 0) > 0 ? Math.round((Number(a.agxCalls || 0) / Number(a.totalCmds || 0)) * 100) : 0;
  const rows = sessions.slice(0, limit).map((s) => {
    const t = s.diagnostics.totals;
    const ti = t.inputTokens + t.cacheReadTokens;
    return {
      id: s.conversationId.slice(0, 8),
      updated: (s.updatedAt || '').slice(0, 16),
      costUsd: t.estimatedUsd,
      cachePct: ti > 0 ? Math.round((t.cacheReadTokens / ti) * 100) : 0,
      agx: `${t.agxCalls}/${t.totalCmds}`,
      subagents: t.subagents,
      skills: s.skillsLoaded,
      warnings: s.diagnostics.checks.filter((c) => c.startsWith('WARN')),
    };
  });
  const compactAgg = { totalSessions: a.totalSessions, totalCostUsd: a.totalCostUsd, cacheHitPct, agxCalls: a.agxCalls, totalCmds: a.totalCmds, agxPct, subagents: a.subagents, skillCounts: a.skillCounts, agxSubCounts: a.agxSubCounts };
  if (flags.json) { console.log(JSON.stringify({ aggregate: compactAgg, sessions: rows }, null, 2)); return; }
  console.log(`digest: ${compactAgg.totalSessions} sessions | $${compactAgg.totalCostUsd} | cache=${cacheHitPct}% | agx=${compactAgg.agxCalls}/${compactAgg.totalCmds} (${agxPct}%) | subagents=${compactAgg.subagents}`);
  rows.forEach((r) => console.log(`  ${r.id} | ${r.updated} | $${r.costUsd.toFixed(4)} | cache:${r.cachePct}% | agx:${r.agx} | sub:${r.subagents} | skills:${r.skills.join(',') || '-'}${r.warnings.length ? ` | ${r.warnings.join('; ')}` : ''}`));
}

export function startTelemetryUi(flags: Record<string, string | boolean>): void {
  const port = Number(typeof flags.port === 'string' ? flags.port : '4311');
  const initialExtra = typeof flags['scan-dir'] === 'string' ? flags['scan-dir'] : undefined;
  const initial = scanTranscripts(initialExtra);
  console.log(`Initial background scan: ${initial.scanned} transcript(s) found (${initial.imported} imported, ${initial.updated} updated).`);

  const timer = setInterval(() => { scanTranscripts(initialExtra); }, 30_000);
  timer.unref();

  const server = createServer(async (req, res) => {
    const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    const qp = parsedUrl.searchParams;

    if (req.method === 'GET' && STATIC_UI[pathname]) {
      const asset = STATIC_UI[pathname];
      res.writeHead(200, { 'Content-Type': asset.mime });
      res.end(readFileSync(join(HERE, asset.file), 'utf8'));
      return;
    }
    if (req.method === 'GET' && pathname === '/api/sessions') {
      const all = loadAllSessions();
      const filtered = filterSessions(all, {
        from: qp.get('from') || undefined,
        to: qp.get('to') || undefined,
        version: qp.get('version') || undefined,
        q: qp.get('q') || undefined,
      });
      const allAgg = aggregateSessions(all, lastScanAt);
      return sendJson(res, 200, {
        sessions: filtered,
        aggregate: aggregateSessions(filtered, lastScanAt),
        versions: Object.keys((allAgg.versionCounts as Record<string, number>) || {}),
      });
    }
    if (req.method === 'GET' && pathname.startsWith('/api/sessions/')) {
      const id = decodeURIComponent(pathname.slice('/api/sessions/'.length));
      const s = loadSession(telemetryDir(), id);
      if (!s) return sendJson(res, 404, { error: 'Session not found' });
      return sendJson(res, 200, { ...s, diagnostics: buildDiagnostics(s) });
    }
    if (req.method === 'GET' && pathname === '/api/compare') {
      const all = loadAllSessions();
      const aVer = qp.get('a') || undefined;
      const bVer = qp.get('b') || undefined;
      const aList = filterSessions(all, { version: aVer, from: qp.get('fromA') || undefined, to: qp.get('toA') || undefined });
      const bList = filterSessions(all, { version: bVer, from: qp.get('fromB') || undefined, to: qp.get('toB') || undefined });
      const labelA = aVer || (qp.get('fromA') || qp.get('toA') ? `${qp.get('fromA') || '...'}..${qp.get('toA') || '...'}` : 'All A');
      const labelB = bVer || (qp.get('fromB') || qp.get('toB') ? `${qp.get('fromB') || '...'}..${qp.get('toB') || '...'}` : 'All B');
      return sendJson(res, 200, compareBuckets(summarizeBucket(labelA, aList), summarizeBucket(labelB, bList)));
    }
    if (req.method === 'POST' && pathname === '/api/scan') {
      const body = await readBody(req);
      return sendJson(res, 200, scanTranscripts(typeof body.path === 'string' ? body.path : initialExtra));
    }
    if (req.method === 'POST' && pathname === '/api/reset') {
      rmSync(telemetryDir(), { recursive: true, force: true });
      return sendJson(res, 200, { ok: true });
    }
    sendJson(res, 404, { error: 'Not found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`agx telemetry UI listening at http://127.0.0.1:${port}`);
  });
}
