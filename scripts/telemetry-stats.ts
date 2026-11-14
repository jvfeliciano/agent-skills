import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDiagnostics, telemetryDir, type SessionSummary } from './telemetry.ts';

export type SessionWithDiag = SessionSummary & { diagnostics: ReturnType<typeof buildDiagnostics> };

export interface SessionFilter {
  from?: string;
  to?: string;
  version?: string;
  q?: string;
}

export interface BucketSummary {
  label: string;
  sessions: number;
  totalCostUsd: number;
  avgCostUsd: number;
  avgTokens: number;
  cacheHitPct: number;
  agxPct: number;
  avgSteps: number;
  toolErrorRate: number;
  topSkills: Array<[string, number]>;
  topAgxSubs: Array<[string, number]>;
}

function parseBoundary(raw: string | undefined, endOfDay: boolean): number | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? `${s}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : s;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function loadAllSessions(dir = telemetryDir()): SessionWithDiag[] {
  const sDir = join(dir, 'sessions');
  if (!existsSync(sDir)) return [];
  return readdirSync(sDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const s = JSON.parse(readFileSync(join(sDir, f), 'utf8')) as SessionSummary;
      return { ...s, diagnostics: buildDiagnostics(s) };
    })
    .sort((a, b) => Date.parse(b.updatedAt || b.startedAt || '0') - Date.parse(a.updatedAt || a.startedAt || '0'));
}

export function filterSessions(sessions: SessionWithDiag[], filter: SessionFilter): SessionWithDiag[] {
  const fromMs = parseBoundary(filter.from, false);
  const toMs = parseBoundary(filter.to, true);
  const ver = filter.version?.trim();
  const q = filter.q?.trim().toLowerCase();

  return sessions.filter((s) => {
    const ts = Date.parse(s.updatedAt || s.startedAt || '0');
    if (fromMs !== null && ts < fromMs) return false;
    if (toMs !== null && ts > toMs) return false;
    if (ver && ver !== 'all' && (s.agentSkillsVersion || 'unversioned') !== ver) return false;
    if (q) {
      const hay = [
        s.conversationId,
        s.cwd || '',
        s.modelName || '',
        s.agentSkillsVersion || 'unversioned',
        Object.keys(s.tokensByModel || {}).join(' '),
        (s.skillsLoaded || []).join(' '),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function aggregateSessions(sessions: SessionWithDiag[], lastScanAt = ''): Record<string, unknown> {
  let totalCostUsd = 0, totalInputTokens = 0, totalCacheReadTokens = 0, totalOutputTokens = 0;
  let agxCalls = 0, totalCmds = 0, subagents = 0;
  const skillCounts: Record<string, number> = {};
  const agxSubCounts: Record<string, number> = {};
  const versionCounts: Record<string, number> = {};
  const modelTokens: Record<string, { input: number; cache: number; output: number; steps: number }> = {};
  const recentSkillActivations: Array<{ conversationId: string; skill: string; ts: string; stepIdx?: number; path: string; source: string }> = [];
  const recentCliCalls: Array<{ conversationId: string; command: string; isAgx: boolean; agxSub?: string; ok: boolean; ts: string; stepIdx?: number }> = [];

  for (const s of sessions) {
    const t = s.diagnostics.totals;
    totalCostUsd += t.estimatedUsd;
    totalInputTokens += t.inputTokens;
    totalCacheReadTokens += t.cacheReadTokens;
    totalOutputTokens += t.outputTokens;
    agxCalls += t.agxCalls;
    totalCmds += t.totalCmds;
    subagents += t.subagents;
    const ver = s.agentSkillsVersion || 'unversioned';
    versionCounts[ver] = (versionCounts[ver] || 0) + 1;

    for (const sk of s.skillsLoaded || []) skillCounts[sk] = (skillCounts[sk] || 0) + 1;
    for (const act of s.skillActivations || []) recentSkillActivations.push({ conversationId: s.conversationId, ...act });
    for (const c of s.cliCalls || []) {
      recentCliCalls.push({ conversationId: s.conversationId, ...c });
      if (c.isAgx && c.agxSub) agxSubCounts[c.agxSub] = (agxSubCounts[c.agxSub] || 0) + 1;
    }
    for (const [m, mt] of Object.entries(s.tokensByModel || {})) {
      const cur = modelTokens[m] || { input: 0, cache: 0, output: 0, steps: 0 };
      cur.input += mt.inputTokens;
      cur.cache += mt.cacheReadTokens;
      cur.output += mt.outputTokens;
      cur.steps += mt.steps;
      modelTokens[m] = cur;
    }
  }
  recentSkillActivations.sort((a, b) => Date.parse(b.ts || '0') - Date.parse(a.ts || '0'));
  recentCliCalls.sort((a, b) => Date.parse(b.ts || '0') - Date.parse(a.ts || '0'));

  return {
    totalSessions: sessions.length,
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    totalInputTokens,
    totalCacheReadTokens,
    totalOutputTokens,
    agxCalls,
    totalCmds,
    subagents,
    skillCounts,
    agxSubCounts,
    versionCounts,
    modelTokens,
    recentSkillActivations: recentSkillActivations.slice(0, 60),
    recentCliCalls: recentCliCalls.slice(0, 60),
    lastScanAt,
  };
}

export function summarizeBucket(label: string, sessions: SessionWithDiag[]): BucketSummary {
  const n = sessions.length;
  let cost = 0, inTok = 0, cacheTok = 0, outTok = 0, agx = 0, cmds = 0, steps = 0, toolOk = 0, toolErr = 0;
  const skills: Record<string, number> = {};
  const agxSubs: Record<string, number> = {};

  for (const s of sessions) {
    const t = s.diagnostics.totals;
    cost += t.estimatedUsd;
    inTok += t.inputTokens;
    cacheTok += t.cacheReadTokens;
    outTok += t.outputTokens;
    agx += t.agxCalls;
    cmds += t.totalCmds;
    steps += t.steps;
    for (const c of Object.values(s.toolCounts || {})) {
      toolOk += c.ok;
      toolErr += c.err;
    }
    for (const sk of s.skillsLoaded || []) skills[sk] = (skills[sk] || 0) + 1;
    for (const c of s.cliCalls || []) {
      if (c.isAgx && c.agxSub) agxSubs[c.agxSub] = (agxSubs[c.agxSub] || 0) + 1;
    }
  }

  const totTok = inTok + cacheTok + outTok;
  const cacheDenom = inTok + cacheTok;
  const toolTotal = toolOk + toolErr;
  const round = (v: number, d = 2) => Number(v.toFixed(d));

  return {
    label,
    sessions: n,
    totalCostUsd: round(cost, 6),
    avgCostUsd: n ? round(cost / n, 4) : 0,
    avgTokens: n ? Math.round(totTok / n) : 0,
    cacheHitPct: cacheDenom ? Math.round((cacheTok / cacheDenom) * 100) : 0,
    agxPct: cmds ? Math.round((agx / cmds) * 100) : 0,
    avgSteps: n ? round(steps / n, 1) : 0,
    toolErrorRate: toolTotal ? round((toolErr / toolTotal) * 100, 1) : 0,
    topSkills: Object.entries(skills).sort((a, b) => b[1] - a[1]).slice(0, 8),
    topAgxSubs: Object.entries(agxSubs).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

export function compareBuckets(a: BucketSummary, b: BucketSummary): { a: BucketSummary; b: BucketSummary; deltas: Record<string, number> } {
  const diff = (x: number, y: number, d = 2) => Number((y - x).toFixed(d));
  return {
    a,
    b,
    deltas: {
      avgCostUsd: diff(a.avgCostUsd, b.avgCostUsd, 4),
      avgTokens: diff(a.avgTokens, b.avgTokens, 0),
      cacheHitPct: diff(a.cacheHitPct, b.cacheHitPct, 0),
      agxPct: diff(a.agxPct, b.agxPct, 0),
      avgSteps: diff(a.avgSteps, b.avgSteps, 1),
      toolErrorRate: diff(a.toolErrorRate, b.toolErrorRate, 1),
    },
  };
}
