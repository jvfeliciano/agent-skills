import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface ParsedArgs { positional: string[]; flags: Record<string, string | boolean>; }

const BOOL_FLAGS = new Set(['help', 'no-link', 'copy-env', 'delete-branch', 'force', 'json']);

function fail(msg: string, example?: string): never {
  throw new Error(example ? `${msg}\nExample: ${example}` : msg);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { flags.help = true; continue; }
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eqIdx = a.indexOf('=');
    if (eqIdx !== -1) {
      const key = a.slice(2, eqIdx);
      const val = a.slice(eqIdx + 1);
      flags[key] = BOOL_FLAGS.has(key) ? val !== 'false' : val;
    } else {
      const key = a.slice(2);
      if (BOOL_FLAGS.has(key)) {
        flags[key] = true;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    }
  }
  return { positional, flags };
}

function strFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function git(cwd: string, args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const res = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { ok: res.status === 0, stdout: (res.stdout ?? '').trim(), stderr: (res.stderr ?? '').trim() };
}

export function repoRoot(cwd: string): string {
  const abs = resolve(cwd);
  const bareRes = git(abs, ['rev-parse', '--is-bare-repository']);
  if (bareRes.ok && bareRes.stdout === 'true') {
    fail(`Cannot run agx worktree inside a bare repository: ${cwd}`);
  }
  const res = git(abs, ['rev-parse', '--git-common-dir']);
  if (!res.ok || !res.stdout) fail(`Not inside a git repository: ${cwd}`, 'agx worktree create --name feat-x');
  const commonPath = resolve(abs, res.stdout);
  if (basename(commonPath) !== '.git') {
    const cwRes = git(commonPath, ['config', '--get', 'core.worktree']);
    if (cwRes.ok && cwRes.stdout) return resolve(commonPath, cwRes.stdout);
    const topRes = git(abs, ['rev-parse', '--show-toplevel']);
    if (topRes.ok && topRes.stdout) return topRes.stdout;
  }
  return dirname(commonPath);
}

function assertSafeName(name: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(name) || name === '.' || name === '..') {
    fail(`Invalid worktree name '${name}' (use [a-zA-Z0-9._-])`, 'agx worktree create --name fix-auth');
  }
  return name;
}

export function linkWorktreeModules(root: string, wtPath: string, copyEnv = false): { linkedModules: boolean; copiedEnv: string[] } {
  const absRoot = resolve(root);
  const absWtPath = resolve(wtPath);
  if (!existsSync(absWtPath)) fail(`Worktree path not found: ${absWtPath}`);
  let linkedModules = false;
  const srcMod = join(absRoot, 'node_modules');
  const dstMod = join(absWtPath, 'node_modules');

  if (existsSync(srcMod)) {
    try {
      if (lstatSync(dstMod).isSymbolicLink() && !existsSync(dstMod)) {
        unlinkSync(dstMod);
      }
    } catch {}
    if (!existsSync(dstMod)) {
      try {
        symlinkSync(srcMod, dstMod, 'dir');
        linkedModules = true;
      } catch {}
    }
  }

  const copiedEnv: string[] = [];
  if (copyEnv) {
    for (const envFile of ['.env', '.env.local']) {
      const src = join(absRoot, envFile), dst = join(absWtPath, envFile);
      if (existsSync(src) && !existsSync(dst)) {
        copyFileSync(src, dst);
        copiedEnv.push(envFile);
      }
    }
  }
  return { linkedModules, copiedEnv };
}

export function createWorktree(opts: { cwd?: string; name: string; branch?: string; base?: string; linkModules?: boolean; copyEnv?: boolean }): {
  root: string; path: string; branch: string; linkedModules: boolean; copiedEnv: string[];
} {
  const root = repoRoot(opts.cwd ?? '.');
  const name = assertSafeName(opts.name);
  git(root, ['worktree', 'prune']);
  const wtDir = join(root, '.worktrees');
  const wtPath = join(wtDir, name);
  if (existsSync(wtPath)) fail(`Worktree already exists at ${wtPath}`, `agx worktree teardown --name ${name}`);

  mkdirSync(wtDir, { recursive: true });
  const branch = opts.branch ?? `wt/${name}`;
  const branchExists = git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).ok;
  if (opts.base && branchExists) {
    fail(`Branch '${branch}' already exists; cannot specify --base '${opts.base}' for an existing branch`, `agx worktree create --name ${name} --branch new-branch --base ${opts.base}`);
  }
  const args = branchExists
    ? ['worktree', 'add', wtPath, branch]
    : ['worktree', 'add', '-b', branch, wtPath, opts.base ?? 'HEAD'];
  const res = git(root, args);
  if (!res.ok) fail(`git worktree add failed: ${res.stderr || res.stdout}`);

  const { linkedModules, copiedEnv } = opts.linkModules !== false
    ? linkWorktreeModules(root, wtPath, Boolean(opts.copyEnv))
    : { linkedModules: false, copiedEnv: [] };
  return { root, path: wtPath, branch, linkedModules, copiedEnv };
}

function canonicalPath(p: string): string {
  try { return realpathSync(p); } catch {
    try { return join(realpathSync(dirname(p)), basename(p)); } catch { return resolve(p); }
  }
}

function findWorktreeBranch(root: string, wtPath: string): string | null {
  const res = git(root, ['worktree', 'list', '--porcelain']);
  if (!res.ok) return null;
  let target = canonicalPath(wtPath);
  try { target = canonicalPath(join(realpathSync(root), '.worktrees', basename(wtPath))); } catch {}
  let curPath: string | null = null;
  let curBranch: string | null = null;
  for (const line of res.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      curPath = canonicalPath(line.slice(9).trim());
      curBranch = null;
    } else if (line.startsWith('branch refs/heads/')) {
      curBranch = line.slice(18).trim();
    } else if (line === '' && curPath === target && curBranch) {
      return curBranch;
    }
  }
  return curPath === target && curBranch ? curBranch : null;
}

export function teardownWorktree(opts: { cwd?: string; name: string; deleteBranch?: boolean; force?: boolean }): {
  root: string; path: string; removed: boolean; deletedBranch: string | null;
} {
  const root = repoRoot(opts.cwd ?? '.');
  const name = assertSafeName(opts.name);
  const wtPath = join(root, '.worktrees', name);
  let branch = findWorktreeBranch(root, wtPath);
  let unlinkedTarget: string | null = null;

  if (existsSync(wtPath)) {
    if (!branch) {
      const bRes = git(wtPath, ['branch', '--show-current']);
      if (bRes.ok && bRes.stdout) branch = bRes.stdout;
    }
    const wtMod = join(wtPath, 'node_modules');
    try {
      if (lstatSync(wtMod).isSymbolicLink()) {
        unlinkedTarget = readlinkSync(wtMod);
        unlinkSync(wtMod);
      }
    } catch {}
  }

  const rmArgs = ['worktree', 'remove', ...(opts.force ? ['--force'] : []), wtPath];
  const rmRes = git(root, rmArgs);
  if (!rmRes.ok) {
    if (unlinkedTarget && existsSync(wtPath)) {
      try { symlinkSync(unlinkedTarget, join(wtPath, 'node_modules'), 'dir'); } catch {}
    }
    fail(`git worktree remove failed: ${rmRes.stderr || rmRes.stdout}`, `agx worktree teardown --name ${name} --force`);
  }
  git(root, ['worktree', 'prune']);

  let deletedBranch: string | null = null;
  if (opts.deleteBranch) {
    if (!branch) {
      const fallback = `wt/${name}`;
      if (git(root, ['show-ref', '--verify', '--quiet', `refs/heads/${fallback}`]).ok) {
        branch = fallback;
      } else {
        fail(`Worktree removed, but could not determine branch to delete for '${name}'`);
      }
    }
    const delRes = git(root, ['branch', opts.force ? '-D' : '-d', branch]);
    if (!delRes.ok) fail(`Worktree removed, but branch delete failed: ${delRes.stderr || delRes.stdout}`);
    deletedBranch = branch;
  }
  return { root, path: wtPath, removed: true, deletedBranch };
}

function emit(json: boolean | string | undefined, data: unknown, text: () => void): void {
  if (json) console.log(JSON.stringify(data, null, 2));
  else text();
}

function main(): void {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const sub = positional[0];
  if (flags.help || !sub) {
    console.log([
      'Usage: agx worktree <create|link-modules|teardown> [options]',
      '',
      'Subcommands:',
      '  create        --name <slug> [--branch <br>] [--base <ref>] [--no-link] [--copy-env] [--path <dir>] [--json]',
      '  link-modules  [--name <slug> | --wt <dir>] [--copy-env] [--path <dir>] [--json]',
      '  teardown      --name <slug> [--delete-branch] [--force] [--path <dir>] [--json]',
      '',
      'Examples:',
      '  agx worktree create --name fix-auth --copy-env --json',
      '  agx worktree link-modules --name fix-auth',
      '  agx worktree teardown --name fix-auth --delete-branch',
    ].join('\n'));
    return;
  }

  const cwd = strFlag(flags, 'path') ?? '.';
  if (sub === 'create') {
    const name = strFlag(flags, 'name') ?? positional[1];
    if (!name) fail('create requires --name <slug>', 'agx worktree create --name fix-auth');
    const out = createWorktree({
      cwd,
      name,
      branch: strFlag(flags, 'branch'),
      base: strFlag(flags, 'base'),
      linkModules: !flags['no-link'],
      copyEnv: Boolean(flags['copy-env']),
    });
    return emit(flags.json, out, () => {
      console.log(`worktree: ${out.path} | branch: ${out.branch} | node_modules_linked: ${out.linkedModules}${out.copiedEnv.length ? ` | env: ${out.copiedEnv.join(',')}` : ''}`);
    });
  }

  if (sub === 'link-modules') {
    const root = repoRoot(cwd);
    const name = strFlag(flags, 'name') ?? positional[1];
    const wt = strFlag(flags, 'wt') ?? (name ? join(root, '.worktrees', assertSafeName(name)) : resolve(cwd));
    const out = linkWorktreeModules(root, wt, Boolean(flags['copy-env']));
    return emit(flags.json, { root, path: wt, ...out }, () => {
      console.log(`linked: ${wt} | node_modules_linked: ${out.linkedModules}${out.copiedEnv.length ? ` | env: ${out.copiedEnv.join(',')}` : ''}`);
    });
  }

  if (sub === 'teardown') {
    const name = strFlag(flags, 'name') ?? positional[1];
    if (!name) fail('teardown requires --name <slug>', 'agx worktree teardown --name fix-auth --delete-branch');
    const out = teardownWorktree({ cwd, name, deleteBranch: Boolean(flags['delete-branch']), force: Boolean(flags.force) });
    return emit(flags.json, out, () => {
      console.log(`removed: ${out.path}${out.deletedBranch ? ` | deleted_branch: ${out.deletedBranch}` : ''}`);
    });
  }

  fail(`Unknown worktree subcommand '${sub}'`, 'agx worktree --help');
}

const isEntry = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isEntry) {
  try {
    main();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${msg}`);
    process.exit(1);
  }
}
