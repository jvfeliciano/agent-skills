import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { resolveAgentSkillsVersion } from './telemetry-meta.ts';

export interface TokenStats { inputTokens: number; cacheReadTokens: number; outputTokens: number; steps: number; }
export interface SkillActivation { skill: string; ts: string; stepIdx?: number; path: string; source: 'read_file' | 'hook'; }
export interface CliCall { command: string; isAgx: boolean; agxSub?: string; ok: boolean; ts: string; stepIdx?: number; }
export interface SubagentCall { tool: string; typeName?: string; role?: string; model?: string; workspace?: string; ok: boolean; ts: string; }
export interface SessionSummary {
  conversationId: string;
  cwd?: string;
  workspacePaths: string[];
  transcriptPath?: string;
  modelName?: string;
  agentSkillsVersion?: string;
  startedAt: string;
  updatedAt: string;
  terminationReason?: string;
  skillsLoaded: string[];
  skillActivations?: SkillActivation[];
  pathsTouched: string[];
  cliCalls: CliCall[];
  subagents: SubagentCall[];
  toolCounts: Record<string, { ok: number; err: number }>;
  tokensByModel: Record<string, TokenStats>;
}

const PRICE_PER_1M: Record<string, { input: number; output: number; cacheRead: number }> = {
  'gemini-4-hydrogen-medium': { input: 1.25, output: 5.0, cacheRead: 0.3125 },
  'gemini-2.5-pro': { input: 1.25, output: 10.0, cacheRead: 0.3125 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50, cacheRead: 0.075 },
  'default': { input: 1.25, output: 5.0, cacheRead: 0.3125 },
};

export function telemetryDir(): string {
  const base = process.env.PLUGIN_DATA || join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'agent-skills');
  return join(base, 'telemetry');
}

function parseArgs(argv: string[]): { sub: string; flags: Record<string, string | boolean> } {
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { flags.help = true; continue; }
    if (!a.startsWith('--')) { pos.push(a); continue; }
    const k = a.slice(2), next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[k] = next; i++; }
    else flags[k] = true;
  }
  return { sub: pos[0] || '', flags };
}

export function estimateCostUsd(tokensByModel: Record<string, TokenStats>): number {
  let total = 0;
  for (const [model, t] of Object.entries(tokensByModel)) {
    const p = PRICE_PER_1M[model] || PRICE_PER_1M.default;
    total += (t.inputTokens / 1e6) * p.input + (t.cacheReadTokens / 1e6) * p.cacheRead + (t.outputTokens / 1e6) * p.output;
  }
  return Number(total.toFixed(6));
}

export function parseTranscript(transcriptPath: string): Partial<SessionSummary> {
  const tokensByModel: Record<string, TokenStats> = {};
  const skillsLoaded = new Set<string>();
  const skillActivations: SkillActivation[] = [];
  const pathsTouched = new Set<string>();
  const cliCalls: CliCall[] = [];
  const subagents: SubagentCall[] = [];
  const toolCounts: Record<string, { ok: number; err: number }> = {};
  let startedAt = '', updatedAt = '';
  if (!existsSync(transcriptPath)) return {};

  for (const line of readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const ts = String(obj.created_at || '');
      if (ts) { if (!startedAt) startedAt = ts; updatedAt = ts; }
      const stepIdx = typeof obj.step_index === 'number' ? obj.step_index : undefined;
      if (obj.type === 'PLANNER_RESPONSE' && obj.model) {
        const m = String(obj.model);
        const cur = tokensByModel[m] || { inputTokens: 0, cacheReadTokens: 0, outputTokens: 0, steps: 0 };
        cur.inputTokens += Number(obj.input_tokens || 0);
        cur.cacheReadTokens += Number(obj.cache_read_tokens || 0);
        cur.outputTokens += Number(obj.output_tokens || 0);
        cur.steps += 1;
        tokensByModel[m] = cur;
      }
      if (Array.isArray(obj.tool_calls)) {
        for (const tc of obj.tool_calls as Array<{ name?: string; args?: Record<string, unknown> }>) {
          if (!tc.name) continue;
          const cnt = toolCounts[tc.name] || { ok: 0, err: 0 };
          cnt.ok += 1;
          toolCounts[tc.name] = cnt;
          extractToolDetails(tc.name, tc.args || {}, true, ts, stepIdx, skillsLoaded, skillActivations, pathsTouched, cliCalls, subagents);
        }
      }
    } catch { /* skip malformed line */ }
  }
  return { startedAt: startedAt || undefined, updatedAt: updatedAt || undefined, tokensByModel, skillsLoaded: [...skillsLoaded], skillActivations, pathsTouched: [...pathsTouched], cliCalls, subagents, toolCounts };
}

function extractToolDetails(
  name: string, args: Record<string, unknown>, ok: boolean, ts: string, stepIdx: number | undefined,
  skills: Set<string>, activations: SkillActivation[], paths: Set<string>, cliCalls: CliCall[], subagents: SubagentCall[],
): void {
  const rawPath = String(args.Path || args.TargetFile || args.AbsolutePath || args.path || '').replace(/^"|"$/g, '');
  if (rawPath) {
    paths.add(rawPath);
    const sm = /\/skills\/([^/]+)\/(?:SKILL\.md|references\/[^/]+)$/.exec(rawPath);
    if (sm) {
      skills.add(sm[1]);
      activations.push({ skill: sm[1], ts, stepIdx, path: rawPath, source: 'read_file' });
    }
  }
  if (name === 'run_command') {
    const cmd = String(args.CommandLine || args.command || '').replace(/^"|"$/g, '');
    const agxM = /(?:^|[\/\s;|&])agx\s+([a-z-]+)/.exec(cmd);
    cliCalls.push({ command: cmd.slice(0, 140), isAgx: Boolean(agxM), agxSub: agxM?.[1], ok, ts, stepIdx });
  }
  if (name === 'invoke_subagent' || name === 'swarm' || name === 'run_workflow') {
    subagents.push({
      tool: name,
      typeName: args.TypeName ? String(args.TypeName) : undefined,
      role: args.Role ? String(args.Role) : (args.name ? String(args.name) : undefined),
      model: args.Model ? String(args.Model) : (args.model ? String(args.model) : undefined),
      workspace: args.Workspace ? String(args.Workspace) : (args.workspace ? String(args.workspace) : undefined),
      ok,
      ts,
    });
  }
}

export function loadSession(dir: string, id: string): SessionSummary | null {
  const sDir = join(dir, 'sessions');
  const exact = join(sDir, `${id}.json`);
  if (existsSync(exact)) return JSON.parse(readFileSync(exact, 'utf8')) as SessionSummary;
  if (!existsSync(sDir) || id.length < 4 || /[/\\]/.test(id)) return null;
  const matches = readdirSync(sDir).filter((f) => f.startsWith(id) && f.endsWith('.json'));
  return matches.length === 1 ? JSON.parse(readFileSync(join(sDir, matches[0]), 'utf8')) as SessionSummary : null;
}

export function saveSession(dir: string, s: SessionSummary): void {
  const sDir = join(dir, 'sessions');
  mkdirSync(sDir, { recursive: true });
  writeFileSync(join(sDir, `${s.conversationId}.json`), JSON.stringify(s, null, 2), 'utf8');
}

function handleIngest(): void {
  let payload: Record<string, unknown> = {};
  try {
    const raw = readFileSync(0, 'utf8').trim();
    if (raw) payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.log('{}');
    return;
  }

  const event = String(payload.hookEventName || '');
  const convId = String(payload.conversationId || 'unknown');
  const now = new Date().toISOString();
  const dir = telemetryDir();

  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'events.jsonl'), `${JSON.stringify({ ts: now, event, conversationId: convId, cwd: payload.cwd, modelName: payload.modelName, toolName: (payload.toolCall as Record<string, unknown> | undefined)?.name })}\n`, 'utf8');

    const s: SessionSummary = loadSession(dir, convId) || {
      conversationId: convId,
      cwd: payload.cwd ? String(payload.cwd) : undefined,
      workspacePaths: Array.isArray(payload.workspacePaths) ? payload.workspacePaths.map(String) : [],
      transcriptPath: payload.transcriptPath ? String(payload.transcriptPath) : undefined,
      modelName: payload.modelName ? String(payload.modelName) : undefined,
      agentSkillsVersion: resolveAgentSkillsVersion(payload.cwd ? String(payload.cwd) : undefined),
      startedAt: now,
      updatedAt: now,
      skillsLoaded: [],
      pathsTouched: [],
      cliCalls: [],
      subagents: [],
      toolCounts: {},
      tokensByModel: {},
    };
    s.updatedAt = now;
    if (!s.agentSkillsVersion) s.agentSkillsVersion = resolveAgentSkillsVersion(s.cwd);
    if (payload.transcriptPath) s.transcriptPath = String(payload.transcriptPath);
    if (payload.cwd) s.cwd = String(payload.cwd);

    if (event === 'PostToolUse' && payload.toolCall) {
      const tc = payload.toolCall as { name?: string; args?: Record<string, unknown> };
      const name = String(tc.name || 'unknown');
      const ok = !payload.error;
      const cnt = s.toolCounts[name] || { ok: 0, err: 0 };
      if (ok) cnt.ok += 1; else cnt.err += 1;
      s.toolCounts[name] = cnt;

      const skills = new Set(s.skillsLoaded);
      const paths = new Set(s.pathsTouched);
      s.skillActivations = s.skillActivations || [];
      const stepIdx = typeof payload.stepIdx === 'number' ? payload.stepIdx : undefined;
      extractToolDetails(name, tc.args || {}, ok, now, stepIdx, skills, s.skillActivations, paths, s.cliCalls, s.subagents);
      s.skillsLoaded = [...skills];
      s.pathsTouched = [...paths];
    }

    if (event === 'Stop') {
      if (payload.terminationReason) s.terminationReason = String(payload.terminationReason);
      if (s.transcriptPath) {
        const parsed = parseTranscript(s.transcriptPath);
        if (parsed.tokensByModel) s.tokensByModel = parsed.tokensByModel;
      }
    }
    saveSession(dir, s);
  } catch { /* never fail the agent loop */ }

  if (event === 'Stop' || event === 'PreToolUse') console.log(JSON.stringify({ decision: 'allow' }));
  else console.log('{}');
}

export function buildDiagnostics(s: SessionSummary): { checks: string[]; totals: Record<string, number> } {
  let inTok = 0, cacheTok = 0, outTok = 0, steps = 0, toolErrs = 0;
  for (const t of Object.values(s.tokensByModel)) { inTok += t.inputTokens; cacheTok += t.cacheReadTokens; outTok += t.outputTokens; steps += t.steps || 0; }
  for (const c of Object.values(s.toolCounts)) toolErrs += c.err;
  const agxCalls = s.cliCalls.filter((c) => c.isAgx).length;
  const totalCmds = s.cliCalls.length;
  const cachePct = inTok + cacheTok > 0 ? Math.round((cacheTok / (inTok + cacheTok)) * 100) : 0;
  const estimatedUsd = estimateCostUsd(s.tokensByModel);
  const checks: string[] = [];
  checks.push(s.skillsLoaded.length > 0 ? `OK: ${s.skillsLoaded.length} skill(s) loaded (${s.skillsLoaded.join(', ')})` : 'INFO: 0 SKILL.md files read directly');
  checks.push(totalCmds === 0 ? 'INFO: 0 shell commands executed' : (agxCalls > 0 ? `OK: agx used in ${agxCalls}/${totalCmds} shell call(s)` : `WARN: 0 agx calls across ${totalCmds} shell command(s)`));
  checks.push(`INFO: cache hit rate ${cachePct}% (${cacheTok.toLocaleString()} cached / ${inTok.toLocaleString()} uncached input)`);
  if (toolErrs > 0) checks.push(`WARN: ${toolErrs} tool error(s) recorded`);
  if (steps > 40) checks.push(`WARN: high step count (${steps} steps > 40)`);
  if (estimatedUsd > 1.5) checks.push(`WARN: high estimated cost ($${estimatedUsd.toFixed(2)} > $1.50)`);
  return { checks, totals: { inputTokens: inTok, cacheReadTokens: cacheTok, outputTokens: outTok, steps, estimatedUsd, agxCalls, totalCmds, subagents: s.subagents.length, pathsTouched: s.pathsTouched.length, toolErrs } };
}

function handleReport(flags: Record<string, string | boolean>): void {
  const dir = telemetryDir();
  let session: SessionSummary | null = null;

  if (typeof flags.transcript === 'string') {
    const tp = resolve(flags.transcript);
    const p = parseTranscript(tp);
    session = { conversationId: basename(dirname(dirname(dirname(tp)))) || 'transcript', workspacePaths: [], transcriptPath: tp, startedAt: '', updatedAt: new Date().toISOString(), skillsLoaded: p.skillsLoaded || [], skillActivations: p.skillActivations || [], pathsTouched: p.pathsTouched || [], cliCalls: p.cliCalls || [], subagents: p.subagents || [], toolCounts: p.toolCounts || {}, tokensByModel: p.tokensByModel || {} };
  } else {
    const sDir = join(dir, 'sessions');
    if (!existsSync(sDir)) { console.log(flags.json ? JSON.stringify({ sessions: 0 }) : 'No telemetry recorded yet. Pass --transcript <jsonl> or run a session with hooks.'); return; }
    const files = readdirSync(sDir).filter((f) => f.endsWith('.json')).map((f) => ({ f, mtime: statSync(join(sDir, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
    if (typeof flags.conversation === 'string') session = loadSession(dir, flags.conversation);
    else if (files.length > 0) session = JSON.parse(readFileSync(join(sDir, files[0].f), 'utf8')) as SessionSummary;
    if (session?.transcriptPath && Object.keys(session.tokensByModel).length === 0) session.tokensByModel = parseTranscript(session.transcriptPath).tokensByModel || {};
  }

  if (!session) { console.log(flags.json ? JSON.stringify({ error: 'Session not found' }) : 'Session not found.'); return; }
  const diag = buildDiagnostics(session);
  if (flags.json) { console.log(JSON.stringify({ session, diagnostics: diag }, null, 2)); return; }
  console.log(`session: ${session.conversationId} | cwd: ${session.cwd || 'unknown'} | updated: ${session.updatedAt}`);
  console.log(`tokens: in=${diag.totals.inputTokens.toLocaleString()} cache=${diag.totals.cacheReadTokens.toLocaleString()} out=${diag.totals.outputTokens.toLocaleString()} | est_cost=$${diag.totals.estimatedUsd}`);
  for (const [m, t] of Object.entries(session.tokensByModel)) {
    console.log(`  model ${m}: steps=${t.steps} in=${t.inputTokens.toLocaleString()} cache=${t.cacheReadTokens.toLocaleString()} out=${t.outputTokens.toLocaleString()}`);
  }
  console.log(`paths_touched (${session.pathsTouched.length}): ${session.pathsTouched.slice(0, 8).join(', ')}${session.pathsTouched.length > 8 ? ' ...' : ''}`);
  console.log(`subagents (${session.subagents.length}): ${session.subagents.map((a) => `${a.tool}:${a.role || a.typeName || 'anon'}(${a.model || 'inherit'})`).join(', ') || 'none'}`);
  if (session.skillActivations?.length) console.log(`skills_timeline: ${session.skillActivations.map((a) => `${a.skill}@${a.ts.slice(11, 19)}(s${a.stepIdx ?? '?'})`).join(' -> ')}`);
  if (session.cliCalls.length) {
    const subs: Record<string, number> = {};
    session.cliCalls.filter((c) => c.isAgx && c.agxSub).forEach((c) => { subs[c.agxSub!] = (subs[c.agxSub!] || 0) + 1; });
    console.log(`agx_runs (${diag.totals.agxCalls}/${diag.totals.totalCmds}): ${Object.entries(subs).map(([k, v]) => `${k}:${v}`).join(', ') || 'none'}`);
    session.cliCalls.slice(-8).forEach((c) => console.log(`  ${c.isAgx ? '[agx]' : '[sh ]'} ${c.ok ? 'OK ' : 'ERR'} ${c.ts.slice(11, 19)}(s${c.stepIdx ?? '?'}) ${c.command}`));
  }
  console.log('diagnostics:');
  diag.checks.forEach((c) => console.log(`  ${c}`));
}

if (process.argv[1]?.endsWith('telemetry.ts')) {
  const { sub, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || !sub) console.log('Usage: agx telemetry <ingest|report|ui|reset> [options]\n\nExamples:\n  agx telemetry ui --port 4311\n  agx telemetry report --digest\n  agx telemetry report --latest\n  agx telemetry report --transcript /path/to/transcript.jsonl --json\n  agx telemetry reset --yes');
  else if (sub === 'ingest') handleIngest();
  else if (sub === 'report') {
    if (flags.digest || flags.all) import('./telemetry-ui.ts').then((m) => m.printDigest(flags));
    else handleReport(flags);
  }
  else if (sub === 'ui') import('./telemetry-ui.ts').then((m) => m.startTelemetryUi(flags));
  else if (sub === 'reset') {
    if (!flags.yes) { console.error('ERROR: Pass --yes to confirm clearing telemetry.\nExample: agx telemetry reset --yes'); process.exit(1); }
    rmSync(telemetryDir(), { recursive: true, force: true });
    console.log('Cleared telemetry data.');
  } else {
    console.error(`ERROR: Unknown telemetry subcommand '${sub}'\nExample: agx telemetry report --latest`);
    process.exit(1);
  }
}
