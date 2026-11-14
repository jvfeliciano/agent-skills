import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSession, saveSession, buildDiagnostics, type SessionSummary } from './telemetry.ts';
import { resolveAgentSkillsVersion } from './telemetry-meta.ts';
import { compareBuckets, filterSessions, summarizeBucket, type SessionWithDiag } from './telemetry-stats.ts';

function makeSession(conversationId: string): SessionSummary {
  return {
    conversationId,
    workspacePaths: [],
    startedAt: '2026-11-14T00:00:00Z',
    updatedAt: '2026-11-14T00:01:00Z',
    skillsLoaded: [],
    pathsTouched: [],
    cliCalls: [],
    subagents: [],
    toolCounts: {},
    tokensByModel: {},
  };
}

test('loadSession resolves exact IDs, unique 8-char digest prefixes, and rejects ambiguous prefixes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agx-telemetry-'));
  try {
    saveSession(dir, makeSession('d9351aad-6901-43b0-8051-0e811409ea60'));
    saveSession(dir, makeSession('d9359999-0000-4000-8000-000000000000'));

    assert.equal(loadSession(dir, 'd9351aad-6901-43b0-8051-0e811409ea60')?.conversationId, 'd9351aad-6901-43b0-8051-0e811409ea60');
    assert.equal(loadSession(dir, 'd9351aad')?.conversationId, 'd9351aad-6901-43b0-8051-0e811409ea60');
    assert.equal(loadSession(dir, 'd935'), null);
    assert.equal(loadSession(dir, 'd93'), null);
    assert.equal(loadSession(dir, 'missing-id'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeDiagSession(id: string, updatedAt: string, version?: string, costIn = 1000, cache = 3000, agx = true): SessionWithDiag {
  const s: SessionSummary = {
    ...makeSession(id),
    startedAt: updatedAt,
    updatedAt,
    agentSkillsVersion: version,
    cliCalls: [{ command: agx ? 'agx context' : 'ls', isAgx: agx, agxSub: agx ? 'context' : undefined, ok: true, ts: updatedAt }],
    tokensByModel: { 'gemini-4-hydrogen-medium': { inputTokens: costIn, cacheReadTokens: cache, outputTokens: 500, steps: 4 } },
  };
  return { ...s, diagnostics: buildDiagnostics(s) };
}

test('resolveAgentSkillsVersion reads plugin.json version', () => {
  assert.equal(resolveAgentSkillsVersion(process.cwd()), '1.0.0');
});

test('filterSessions filters by date range, version, and search query', () => {
  const sessions = [
    makeDiagSession('aaa11111', '2026-11-01T12:00:00Z', '0.9.0'),
    makeDiagSession('bbb22222', '2026-11-10T12:00:00Z', '1.0.0'),
    makeDiagSession('ccc33333', '2026-11-14T12:00:00Z', undefined),
  ];
  assert.equal(filterSessions(sessions, { from: '2026-11-05', to: '2026-11-12' }).length, 1);
  assert.equal(filterSessions(sessions, { version: '1.0.0' })[0].conversationId, 'bbb22222');
  assert.equal(filterSessions(sessions, { version: 'unversioned' })[0].conversationId, 'ccc33333');
  assert.equal(filterSessions(sessions, { q: 'bbb2' }).length, 1);
});

test('compareBuckets computes avg deltas between versions', () => {
  const a = summarizeBucket('0.9.0', [makeDiagSession('a1', '2026-11-01T12:00:00Z', '0.9.0', 4000, 1000, false)]);
  const b = summarizeBucket('1.0.0', [makeDiagSession('b1', '2026-11-10T12:00:00Z', '1.0.0', 1000, 4000, true)]);
  const cmp = compareBuckets(a, b);
  assert.equal(cmp.deltas.cacheHitPct, 60);
  assert.equal(cmp.deltas.agxPct, 100);
  assert.ok(cmp.deltas.avgCostUsd < 0);
});
