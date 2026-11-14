import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanUnslop, type SlopHit } from './unslop.ts';

interface ParsedArgs { positional: string[]; flags: Record<string, string | boolean>; }
interface BufferEntry { date: string; category: string; file: string; summary: string; }
interface PlanTask { id: string; title: string; owner: string; files: string[]; dependsOn: string[]; status: string; handoff?: string; }
interface PlanState { goal: string; createdAt: string; tasks: PlanTask[]; }
interface RubricCheck { id: string; command: string; weight: number; }
interface RubricConfig { target: number; checks: RubricCheck[]; }

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_STATUS = new Set(['pending', 'in_progress', 'done', 'blocked']);

function fail(msg: string, example?: string): never {
  console.error(`ERROR: ${msg}`);
  if (example) console.error(`Example: ${example}`);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { flags.help = true; continue; }
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2), next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
    else flags[key] = true;
  }
  return { positional, flags };
}

function strFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function findRepoRoot(start: string): string {
  let cur = resolve(start);
  while (true) {
    if (existsSync(join(cur, '.git')) || existsSync(join(cur, '.agents'))) return cur;
    const parent = dirname(cur);
    if (parent === cur) return resolve(start);
    cur = parent;
  }
}

function emit(json: boolean | string | undefined, data: unknown, renderText: () => void): void {
  if (json) console.log(JSON.stringify(data, null, 2));
  else renderText();
}

function walkFiles(dir: string, ext: string, skipName?: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist') continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(full, ext, skipName));
    else if (ent.name.endsWith(ext) && ent.name !== skipName) out.push(full);
  }
  return out;
}

function parseBuffer(filePath: string): BufferEntry[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8').split('\n').flatMap((line) => {
    const m = /^- \[([^\]]+)\] \[([^\]]+)\] `([^`]+)` \| (.+)$/.exec(line.trim());
    return m ? [{ date: m[1], category: m[2], file: m[3], summary: m[4] }] : [];
  });
}

function handleBuffer(args: ParsedArgs): void {
  const sub = args.positional[0];
  if (args.flags.help || !sub) {
    console.log('Usage: agx buffer <add|list|triage> [options]\n\nExamples:\n  agx buffer add --category react --file src/App.tsx:42 --summary "Unbounded effect"\n  agx buffer list --category react --json\n  agx buffer triage --min 3');
    return;
  }
  const repo = findRepoRoot(strFlag(args.flags, 'path') ?? '.');
  const statePath = resolve(strFlag(args.flags, 'state') ?? join(repo, '.agents/state/pattern-buffer.md'));
  if (sub === 'add') {
    const cat = strFlag(args.flags, 'category'), file = strFlag(args.flags, 'file'), summary = strFlag(args.flags, 'summary');
    if (!cat || !file || !summary) fail('buffer add requires --category, --file, and --summary', 'agx buffer add --category arch --file src/a.ts:10 --summary "Missing guard"');
    mkdirSync(dirname(statePath), { recursive: true });
    if (!existsSync(statePath)) writeFileSync(statePath, '# Pattern Buffer\n\nLogged out-of-scope footguns for batch architectural triage.\n\n', 'utf8');
    const date = new Date().toISOString().slice(0, 10), clean = summary.replace(/\s+/g, ' ');
    writeFileSync(statePath, `${readFileSync(statePath, 'utf8').trimEnd()}\n- [${date}] [${cat}] \`${file}\` | ${clean}\n`, 'utf8');
    return emit(args.flags.json, { added: { date, category: cat, file, summary: clean }, statePath }, () => console.log(`Logged [${cat}] ${file} -> ${statePath}`));
  }
  const entries = parseBuffer(statePath);
  if (sub === 'list') {
    const filterCat = strFlag(args.flags, 'category');
    const items = filterCat ? entries.filter((e) => e.category === filterCat) : entries;
    return emit(args.flags.json, { count: items.length, entries: items }, () => {
      if (!items.length) console.log('Pattern buffer is empty.');
      else items.forEach((e) => console.log(`[${e.date}] [${e.category}] ${e.file} | ${e.summary}`));
    });
  }
  if (sub === 'triage') {
    const min = Number(strFlag(args.flags, 'min') ?? '3');
    const groups = new Map<string, BufferEntry[]>();
    entries.forEach((e) => groups.set(e.category, [...(groups.get(e.category) ?? []), e]));
    const cats = [...groups.entries()].map(([category, items]) => ({ category, count: items.length, readyForRootFix: items.length >= min, items })).sort((a, b) => b.count - a.count);
    return emit(args.flags.json, { minThreshold: min, categories: cats }, () => {
      if (!cats.length) console.log('No entries to triage.');
      cats.forEach((g) => {
        console.log(`${g.readyForRootFix ? 'ACTION:ROOT_FIX' : 'WATCH'} [${g.category}] (${g.count}/${min})`);
        g.items.forEach((i) => console.log(`  - ${i.file}: ${i.summary}`));
      });
    });
  }
  fail(`Unknown buffer subcommand '${sub}'`, 'agx buffer list');
}

function handlePlan(args: ParsedArgs): void {
  const sub = args.positional[0];
  if (args.flags.help || !sub) {
    console.log('Usage: agx plan <init|status|update|next> [options]\n\nExamples:\n  agx plan init --goal "Ship auth" --tasks \'[{"id":"t1","title":"Schema","owner":"db","files":["prisma/schema.prisma"],"dependsOn":[]}]\'\n  agx plan next --json\n  agx plan update --id t1 --status done --handoff "Verified migration"');
    return;
  }
  const repo = findRepoRoot(strFlag(args.flags, 'path') ?? '.');
  const statePath = resolve(strFlag(args.flags, 'state') ?? join(repo, '.agents/state/plan.json'));
  if (sub === 'init') {
    const goal = strFlag(args.flags, 'goal');
    if (!goal) fail('plan init requires --goal', 'agx plan init --goal "Refactor auth"');
    let raw = strFlag(args.flags, 'tasks');
    if (raw === '-') raw = readFileSync(0, 'utf8');
    let parsed: Array<Partial<PlanTask>> = [];
    if (raw) { try { parsed = JSON.parse(raw); } catch { fail('Invalid JSON in --tasks', 'agx plan init --goal "X" --tasks \'[{"id":"t1","title":"Do X"}]\''); } }
    const tasks: PlanTask[] = parsed.map((t, i) => ({
      id: t.id ?? `t${i + 1}`, title: t.title ?? `Task ${i + 1}`, owner: t.owner ?? 'worker',
      files: Array.isArray(t.files) ? t.files : [], dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
      status: t.status && VALID_STATUS.has(t.status) ? t.status : 'pending',
    }));
    const state: PlanState = { goal, createdAt: new Date().toISOString(), tasks };
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    return emit(args.flags.json, state, () => console.log(`Initialized plan (${tasks.length} tasks) -> ${statePath}`));
  }
  if (!existsSync(statePath)) fail(`Plan file not found: ${statePath}`, 'agx plan init --goal "My goal"');
  const state: PlanState = JSON.parse(readFileSync(statePath, 'utf8'));
  if (sub === 'status') return emit(args.flags.json, state, () => {
    console.log(`Goal: ${state.goal}`);
    state.tasks.forEach((t) => console.log(`  [${t.status}] ${t.id} (${t.owner}): ${t.title}${t.handoff ? ` | ${t.handoff}` : ''}`));
  });
  if (sub === 'update') {
    const id = strFlag(args.flags, 'id'), status = strFlag(args.flags, 'status'), handoff = strFlag(args.flags, 'handoff');
    if (!id || !status || !VALID_STATUS.has(status)) fail('plan update requires --id and --status <pending|in_progress|done|blocked>', 'agx plan update --id t1 --status done');
    const task = state.tasks.find((t) => t.id === id);
    if (!task) fail(`Task '${id}' not found. Available: ${state.tasks.map((t) => t.id).join(', ')}`);
    task.status = status;
    if (handoff) task.handoff = handoff;
    writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    return emit(args.flags.json, task, () => console.log(`Updated ${id} -> ${status}`));
  }
  if (sub === 'next') {
    const done = new Set(state.tasks.filter((t) => t.status === 'done').map((t) => t.id));
    const ready = state.tasks.filter((t) => t.status === 'pending' && t.dependsOn.every((d) => done.has(d)));
    return emit(args.flags.json, { ready }, () => {
      if (!ready.length) console.log('No unblocked pending tasks.');
      ready.forEach((t) => console.log(`${t.id} (${t.owner}): ${t.title} [files: ${t.files.join(', ') || 'any'}]`));
    });
  }
  fail(`Unknown plan subcommand '${sub}'`, 'agx plan status');
}

function handleUnslop(args: ParsedArgs): void {
  if (args.flags.help) { console.log('Usage: agx unslop-check [--file <path> | --path <dir>] [--strict] [--json]\nExamples:\n  agx unslop-check --file README.md\n  agx unslop-check --path docs --strict --json'); return; }
  const file = strFlag(args.flags, 'file'), dir = strFlag(args.flags, 'path') ?? '.';
  if (file && !existsSync(file)) fail(`File not found: ${file}`, 'agx unslop-check --file README.md');
  const files = file ? [resolve(file)] : walkFiles(resolve(dir), '.md', 'slop-patterns.md');
  const hits: SlopHit[] = [];
  for (const f of files) {
    if (!existsSync(f) || statSync(f).isDirectory()) continue;
    hits.push(...scanUnslop(readFileSync(f, 'utf8'), f));
  }
  emit(args.flags.json, { scanned: files.length, violationsCount: hits.length, hits }, () => {
    if (!hits.length) console.log(`OK: 0 slop hits across ${files.length} file(s).`);
    else hits.forEach((h) => console.log(`${h.file}:${h.line} [${h.rule}] "${h.match}"`));
  });
  if (args.flags.strict && hits.length > 0) process.exit(1);
}

function defaultRubric(targetDir: string, target = 100): RubricConfig {
  const agx = join(ROOT_DIR, 'bin/agx');
  return {
    target,
    checks: [
      { id: 'god-files', command: `"${agx}" god-files --max-lines 300 --strict --path "${targetDir}"`, weight: 35 },
      { id: 'unslop-docs', command: `"${agx}" unslop-check --path "${targetDir}" --strict`, weight: 35 },
      { id: 'no-conflict-markers', command: `! rg -n --glob '!.git' "^<{7} " "${targetDir}"`, weight: 30 },
    ],
  };
}

function handleRubric(args: ParsedArgs): void {
  const sub = args.positional[0];
  if (args.flags.help || !sub) { console.log('Usage: agx rubric <init|score> [--target 100] [--path <dir>] [--strict] [--json]\nExamples:\n  agx rubric init --target 100\n  agx rubric score --json'); return; }
  const rawPath = strFlag(args.flags, 'path');
  const repo = findRepoRoot(rawPath ?? '.');
  const targetDir = rawPath ? resolve(rawPath) : repo;
  const statePath = resolve(strFlag(args.flags, 'state') ?? join(repo, '.agents/state/rubric.json'));
  if (sub === 'init') {
    if (existsSync(statePath) && !args.flags.force) fail(`Rubric exists at ${statePath} (pass --force to overwrite)`);
    const target = Number(strFlag(args.flags, 'target') ?? '100'), raw = strFlag(args.flags, 'checks');
    const cfg = raw ? { target, checks: JSON.parse(raw) as RubricCheck[] } : defaultRubric(targetDir, target);
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    return emit(args.flags.json, cfg, () => console.log(`Initialized rubric (target: ${target}) -> ${statePath}`));
  }
  if (sub === 'score') {
    const cfg: RubricConfig = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : defaultRubric(targetDir);
    const total = cfg.checks.reduce((s, c) => s + c.weight, 0) || 100;
    let earned = 0;
    const results = cfg.checks.map((c) => {
      const r = spawnSync('sh', ['-c', c.command], { cwd: repo, encoding: 'utf8' });
      const passed = r.status === 0;
      if (passed) earned += c.weight;
      return { id: c.id, weight: c.weight, passed, exitCode: r.status ?? 1, output: (r.stdout || r.stderr || '').trim().slice(0, 300) };
    });
    const score = Math.round((earned / total) * 100), passed = score >= cfg.target;
    emit(args.flags.json, { score, target: cfg.target, passed, results }, () => {
      console.log(`Rubric Score: ${score}/100 (target: ${cfg.target}) -> ${passed ? 'PASS' : 'FAIL'}`);
      results.forEach((r) => console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.id} (${r.weight}w)`));
    });
    if (args.flags.strict && !passed) process.exit(1);
    return;
  }
  fail(`Unknown rubric subcommand '${sub}'`, 'agx rubric score --json');
}

function handleMine(args: ParsedArgs): void {
  if (args.flags.help) { console.log('Usage: agx mine [--transcript <path.jsonl>] [--limit <n>] [--json]\nExamples:\n  agx mine --limit 15 --json\n  agx mine --transcript ~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl'); return; }
  let transcript = strFlag(args.flags, 'transcript');
  if (!transcript && existsSync(join(homedir(), '.gemini/antigravity/brain'))) {
    const logs = execSync(`find "${join(homedir(), '.gemini/antigravity/brain')}" -name transcript.jsonl 2>/dev/null || true`, { encoding: 'utf8' })
      .split('\n').filter(Boolean).map((p) => ({ p, m: statSync(p).mtimeMs })).sort((a, b) => b.m - a.m);
    transcript = logs[0]?.p;
  }
  if (!transcript || !existsSync(transcript)) fail('No transcript.jsonl found; pass --transcript <path>', 'agx mine --transcript /path/to/transcript.jsonl');
  const limit = Number(strFlag(args.flags, 'limit') ?? '20');
  const corrRx = /\b(no|don't|do not|never|instead|stop|wrong|avoid|always|fix|why did you|não|para|errado|sempre|evita)\b/i;
  const inputs: Array<{ step: number; isLikelyCorrection: boolean; snippet: string }> = [];
  for (const line of readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'USER_INPUT' || obj.source === 'USER_EXPLICIT') {
        const text = String(obj.content ?? '').replace(/\s+/g, ' ').trim();
        if (text) inputs.push({ step: Number(obj.step_index ?? 0), isLikelyCorrection: corrRx.test(text), snippet: text.slice(0, 220) });
      }
    } catch { /* skip malformed line */ }
  }
  const candidates = inputs.slice(-limit).filter((i) => i.isLikelyCorrection);
  emit(args.flags.json, { transcript: relative(process.cwd(), transcript) || transcript, totalUserTurns: inputs.length, correctionsCount: candidates.length, corrections: candidates }, () => {
    console.log(`Mined ${transcript} | user_turns: ${inputs.length} | correction_candidates: ${candidates.length}`);
    candidates.forEach((c) => console.log(`  [step ${c.step}] ${c.snippet}`));
  });
}

const [cmd, ...rest] = process.argv.slice(2);
const parsed = parseArgs(rest);
switch (cmd) {
  case 'buffer': handleBuffer(parsed); break;
  case 'plan': handlePlan(parsed); break;
  case 'rubric': handleRubric(parsed); break;
  case 'unslop-check': handleUnslop(parsed); break;
  case 'mine': handleMine(parsed); break;
  default: fail(`Unknown CLI command '${cmd ?? ''}'`, 'agx --help');
}
