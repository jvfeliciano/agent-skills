import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ParsedArgs { positional: string[]; flags: Record<string, string | boolean>; }
type MergeMethod = 'merge' | 'squash' | 'rebase';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGX_BIN = resolve(ROOT_DIR, 'bin/agx');

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

function parsePrList(raw: string | undefined, example: string): string[] {
  if (!raw) fail('Missing --prs <n,n,...>.', example);
  const prs = raw.split(',').map((s) => s.trim().replace(/^#/, '')).filter((s) => /^\d+$/.test(s));
  if (prs.length === 0) fail(`Invalid PR list '${raw}'.`, example);
  return prs;
}

function runCmd(bin: string, args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  const res = spawnSync(bin, args, { input, encoding: 'utf8' });
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function runGh(args: string[], input?: string): string {
  const res = runCmd('gh', args, input);
  if (res.status !== 0) fail(res.stderr.trim() || `gh ${args.join(' ')} failed.`);
  return res.stdout;
}

function ensureGhAuth(): void {
  const res = runCmd('gh', ['auth', 'status']);
  if (res.status !== 0) fail('gh is not authenticated. Run `gh auth login` first.', 'gh auth login');
}

function defaultBranch(): string {
  const raw = runGh(['repo', 'view', '--json', 'defaultBranchRef']);
  const parsed = JSON.parse(raw) as { defaultBranchRef?: { name?: string } };
  return parsed.defaultBranchRef?.name || 'main';
}

function resolveBody(flags: Record<string, string | boolean>, example: string): string {
  const body = strFlag(flags, 'body');
  const file = strFlag(flags, 'body-file');
  if (body && file) fail('Use either --body or --body-file, not both.', example);
  if (file) {
    if (!existsSync(file)) fail(`Body file not found: ${file}`, example);
    return readFileSync(file, 'utf8');
  }
  if (!body) fail('Missing --body or --body-file.', example);
  return body;
}

function emit(json: boolean | string | undefined, data: unknown, renderText: () => void): void {
  if (json) console.log(JSON.stringify(data, null, 2));
  else renderText();
}

function printHelp(sub?: string): void {
  const map: Record<string, string> = {
    checks: 'Usage: agx gh checks --prs <n,n,...> [--json]\nExample: agx gh checks --prs 10,12,13 --json',
    comment: 'Usage: agx gh comment --prs <n,n,...> (--body <text> | --body-file <path>) [--json]\nExample: agx gh comment --prs 10,12 --body "Approved"',
    merge: 'Usage: agx gh merge --pr <n> [--method merge|squash|rebase] [--delete-branch] [--retarget-next <n>] [--json]\nExample: agx gh merge --pr 7 --method merge --delete-branch --retarget-next 8',
    retarget: 'Usage: agx gh retarget --pr <n> --base <branch> [--reopen] [--json]\nExample: agx gh retarget --pr 8 --base main --reopen',
    'issue-create': 'Usage: agx gh issue-create --title <t> (--body <text> | --body-file <p>) [--search <kw>] [--label <l>] [--json]\nExample: agx gh issue-create --title "Fix auth" --body-file /tmp/issue.md --search "auth"',
    'pr-create': 'Usage: agx gh pr-create --title <t> (--body <text> | --body-file <p>) [--base <branch>] [--draft] [--skip-gates] [--json]\nExample: agx gh pr-create --title "feat: add auth" --body-file /tmp/pr.md --draft',
  };
  if (sub && map[sub]) { console.log(map[sub]); return; }
  console.log([
    'Usage: agx gh <subcommand> [options]',
    '',
    'Subcommands:',
    '  checks        Batch-inspect PR state, base branch, mergeability, and CI checks',
    '  comment       Post a comment to one or more PRs without shell-escaping issues',
    '  merge         Merge a PR and optionally retarget/reopen a stacked follow-up PR',
    '  retarget      Update a PR base branch (and optionally reopen if auto-closed)',
    '  issue-create  Duplicate-check open issues, then create non-interactively',
    '  pr-create     Run agx blast/god-files/unslop gates, push HEAD, and open a PR',
    '',
    'Run `agx gh <subcommand> --help` for flags and examples.',
  ].join('\n'));
}

function cmdChecks(flags: Record<string, string | boolean>): void {
  const prs = parsePrList(strFlag(flags, 'prs'), 'agx gh checks --prs 10,12,13 --json');
  ensureGhAuth();
  const results = prs.map((pr) => {
    const view = JSON.parse(runGh(['pr', 'view', pr, '--json', 'number,title,state,baseRefName,headRefName,mergeable,mergeStateStatus'])) as Record<string, unknown>;
    const chk = runCmd('gh', ['pr', 'checks', pr, '--json', 'name,state,bucket']);
    const checks = chk.status === 0 && chk.stdout.trim() ? JSON.parse(chk.stdout) : [];
    return { ...view, checks };
  });
  emit(flags.json, { prs: results }, () => {
    for (const r of results) {
      const checks = Array.isArray(r.checks) ? r.checks as Array<{ name: string; bucket?: string; state?: string }> : [];
      const summary = checks.length === 0 ? 'no-checks' : checks.map((c) => `${c.name}:${c.bucket || c.state}`).join(', ');
      console.log(`#${r.number} [${r.state}] ${r.headRefName} -> ${r.baseRefName} (${r.mergeStateStatus || r.mergeable}) | ${summary}`);
    }
  });
}

function cmdComment(flags: Record<string, string | boolean>): void {
  const ex = 'agx gh comment --prs 10,12 --body "LGTM"';
  const prs = parsePrList(strFlag(flags, 'prs'), ex);
  const body = resolveBody(flags, ex);
  ensureGhAuth();
  const commented = prs.map((pr) => {
    runGh(['pr', 'comment', pr, '--body-file', '-'], body);
    return Number(pr);
  });
  emit(flags.json, { commented }, () => console.log(`Commented on PR(s): ${commented.map((n) => `#${n}`).join(', ')}`));
}

function retargetPr(pr: string, base: string, reopen: boolean): Record<string, unknown> {
  if (reopen) {
    const state = JSON.parse(runGh(['pr', 'view', pr, '--json', 'state'])) as { state?: string };
    if (state.state === 'CLOSED') runGh(['pr', 'reopen', pr]);
  }
  runGh(['pr', 'edit', pr, '--base', base]);
  return JSON.parse(runGh(['pr', 'view', pr, '--json', 'number,state,baseRefName,mergeable,mergeStateStatus'])) as Record<string, unknown>;
}

function cmdMerge(flags: Record<string, string | boolean>): void {
  const ex = 'agx gh merge --pr 7 --method merge --delete-branch --retarget-next 8';
  const pr = strFlag(flags, 'pr')?.replace(/^#/, '');
  if (!pr || !/^\d+$/.test(pr)) fail('Missing or invalid --pr <n>.', ex);
  const method = (strFlag(flags, 'method') || 'merge') as MergeMethod;
  if (!['merge', 'squash', 'rebase'].includes(method)) fail(`Invalid --method '${method}'.`, ex);
  ensureGhAuth();

  const args = ['pr', 'merge', pr, `--${method}`];
  if (flags['delete-branch']) args.push('--delete-branch');
  runGh(args);

  const nextPr = strFlag(flags, 'retarget-next')?.replace(/^#/, '');
  let retargeted: Record<string, unknown> | undefined;
  if (nextPr) {
    if (!/^\d+$/.test(nextPr)) fail(`Invalid --retarget-next '${nextPr}'.`, ex);
    retargeted = retargetPr(nextPr, defaultBranch(), true);
  }
  emit(flags.json, { merged: Number(pr), method, retargeted }, () => {
    console.log(`Merged PR #${pr} (--${method}).`);
    if (retargeted) console.log(`Retargeted PR #${retargeted.number} -> ${retargeted.baseRefName} (${retargeted.state}).`);
  });
}

function cmdRetarget(flags: Record<string, string | boolean>): void {
  const ex = 'agx gh retarget --pr 8 --base main --reopen';
  const pr = strFlag(flags, 'pr')?.replace(/^#/, '');
  const base = strFlag(flags, 'base');
  if (!pr || !/^\d+$/.test(pr) || !base) fail('Missing --pr <n> or --base <branch>.', ex);
  ensureGhAuth();
  const updated = retargetPr(pr, base, Boolean(flags.reopen));
  emit(flags.json, updated, () => console.log(`PR #${updated.number} [${updated.state}] -> ${updated.baseRefName} (${updated.mergeStateStatus})`));
}

function cmdIssueCreate(flags: Record<string, string | boolean>): void {
  const ex = 'agx gh issue-create --title "Fix auth" --body-file /tmp/issue.md --search "auth"';
  const title = strFlag(flags, 'title');
  if (!title) fail('Missing --title <text>.', ex);
  const body = resolveBody(flags, ex);
  ensureGhAuth();

  const search = strFlag(flags, 'search');
  const duplicates = search
    ? JSON.parse(runGh(['issue', 'list', '--search', search, '--state', 'open', '--json', 'number,title'])) as Array<{ number: number; title: string }>
    : [];
  if (duplicates.length > 0 && !flags.force) {
    emit(flags.json, { created: false, duplicates }, () => {
      console.log('Open duplicate candidates found (pass --force to create anyway):');
      for (const d of duplicates) console.log(`  #${d.number}: ${d.title}`);
    });
    process.exit(1);
  }
  const args = ['issue', 'create', '--title', title, '--body-file', '-'];
  const label = strFlag(flags, 'label');
  if (label) args.push('--label', label);
  const url = runGh(args, body).trim();
  emit(flags.json, { created: true, url }, () => console.log(url));
}

function cmdPrCreate(flags: Record<string, string | boolean>): void {
  const ex = 'agx gh pr-create --title "feat: add auth" --body-file /tmp/pr.md --draft';
  const title = strFlag(flags, 'title');
  if (!title) fail('Missing --title <text>.', ex);
  const body = resolveBody(flags, ex);
  ensureGhAuth();

  if (!flags['skip-gates']) {
    const god = runCmd(AGX_BIN, ['god-files', '--max-lines', '300', '--strict']);
    if (god.status !== 0) fail(god.stdout.trim() || god.stderr.trim() || 'agx god-files failed.');
    const bodyFile = strFlag(flags, 'body-file');
    if (bodyFile) {
      const unslop = runCmd(AGX_BIN, ['unslop-check', '--file', bodyFile, '--strict']);
      if (unslop.status !== 0) fail(unslop.stdout.trim() || unslop.stderr.trim() || 'agx unslop-check failed.');
    }
  }
  const push = runCmd('git', ['push', '-u', 'origin', 'HEAD']);
  if (push.status !== 0) fail(push.stderr.trim() || 'git push failed.');

  const args = ['pr', 'create', '--title', title, '--body-file', '-'];
  const base = strFlag(flags, 'base');
  if (base) args.push('--base', base);
  if (flags.draft) args.push('--draft');
  const url = runGh(args, body).trim();
  emit(flags.json, { created: true, url }, () => console.log(url));
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const sub = positional[0];
if (!sub || (flags.help && !sub)) { printHelp(); process.exit(0); }
if (flags.help) { printHelp(sub); process.exit(0); }

switch (sub) {
  case 'checks': cmdChecks(flags); break;
  case 'comment': cmdComment(flags); break;
  case 'merge': cmdMerge(flags); break;
  case 'retarget': cmdRetarget(flags); break;
  case 'issue-create': cmdIssueCreate(flags); break;
  case 'pr-create': cmdPrCreate(flags); break;
  default: fail(`Unknown gh subcommand '${sub}'.`, 'agx gh --help');
}
