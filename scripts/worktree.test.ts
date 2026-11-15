import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createWorktree, linkWorktreeModules, parseArgs, repoRoot, teardownWorktree } from './worktree.ts';

function initTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'agx-wt-test-'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'hello\n', 'utf8');
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n.env\n.worktrees/\n', 'utf8');
  mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(dir, '.env'), 'FOO=bar\n', 'utf8');
  execFileSync('git', ['add', 'README.md', '.gitignore'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir });
  return dir;
}

test('worktree create links node_modules, copies env, and teardown cleans up branch', () => {
  const repo = initTempRepo();
  try {
    const created = createWorktree({ cwd: repo, name: 'feat-a', copyEnv: true });
    assert.equal(created.branch, 'wt/feat-a');
    assert.equal(created.linkedModules, true);
    assert.deepEqual(created.copiedEnv, ['.env']);
    assert.equal(lstatSync(join(created.path, 'node_modules')).isSymbolicLink(), true);
    assert.equal(readFileSync(join(created.path, '.env'), 'utf8'), 'FOO=bar\n');

    const removed = teardownWorktree({ cwd: repo, name: 'feat-a', deleteBranch: true });
    assert.equal(removed.removed, true);
    assert.equal(removed.deletedBranch, 'wt/feat-a');
    assert.equal(existsSync(created.path), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('linkWorktreeModules links node_modules when create used --no-link', () => {
  const repo = initTempRepo();
  try {
    const created = createWorktree({ cwd: repo, name: 'feat-b', linkModules: false });
    assert.equal(created.linkedModules, false);
    assert.equal(existsSync(join(created.path, 'node_modules')), false);

    const linked = linkWorktreeModules(repo, created.path, false);
    assert.equal(linked.linkedModules, true);
    assert.equal(lstatSync(join(created.path, 'node_modules')).isSymbolicLink(), true);

    teardownWorktree({ cwd: repo, name: 'feat-b', deleteBranch: true });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('repoRoot resolves primary repo root from main repo, worktree, and nested subdirs', () => {
  const repo = initTempRepo();
  try {
    const subDir = join(repo, 'src', 'nested');
    mkdirSync(subDir, { recursive: true });

    const created = createWorktree({ cwd: repo, name: 'wt-root-test' });
    const wtSubDir = join(created.path, 'src', 'nested');
    mkdirSync(wtSubDir, { recursive: true });

    assert.equal(repoRoot(repo), repo);
    assert.equal(repoRoot(subDir), repo);
    assert.equal(repoRoot(created.path), repo);
    assert.equal(repoRoot(wtSubDir), repo);

    teardownWorktree({ cwd: repo, name: 'wt-root-test', deleteBranch: true });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('linkWorktreeModules repairs dangling symlink and handles relative root without ELOOP', () => {
  const repo = initTempRepo();
  try {
    const created = createWorktree({ cwd: repo, name: 'symlink-test', linkModules: false });
    const wtMod = join(created.path, 'node_modules');

    // Create a dangling symlink pointing to nowhere
    symlinkSync('/tmp/non-existent-modules-target', wtMod, 'dir');
    assert.equal(existsSync(wtMod), false);
    assert.equal(lstatSync(wtMod).isSymbolicLink(), true);

    // Call linkWorktreeModules with a relative path for root
    const relRepo = relative(process.cwd(), repo) || '.';
    const res = linkWorktreeModules(relRepo, created.path, false);
    assert.equal(res.linkedModules, true);
    assert.equal(existsSync(wtMod), true);
    assert.equal(lstatSync(wtMod).isSymbolicLink(), true);
    // Ensure target is absolute and does not loop
    const target = readlinkSync(wtMod);
    assert.equal(target, join(repo, 'node_modules'));

    teardownWorktree({ cwd: repo, name: 'symlink-test', deleteBranch: true });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('parseArgs does not greedily consume positional arguments for boolean flags and parses --key=value', () => {
  const parsed1 = parseArgs(['teardown', '--force', 'feat-x']);
  assert.deepEqual(parsed1.positional, ['teardown', 'feat-x']);
  assert.equal(parsed1.flags.force, true);

  const parsed2 = parseArgs(['create', '--name=fix-auth', '--base=main', '--no-link', '--copy-env', 'extra-arg']);
  assert.deepEqual(parsed2.positional, ['create', 'extra-arg']);
  assert.equal(parsed2.flags.name, 'fix-auth');
  assert.equal(parsed2.flags.base, 'main');
  assert.equal(parsed2.flags['no-link'], true);
  assert.equal(parsed2.flags['copy-env'], true);

  const parsed3 = parseArgs(['link-modules', '--json', '--delete-branch', 'slug']);
  assert.deepEqual(parsed3.positional, ['link-modules', 'slug']);
  assert.equal(parsed3.flags.json, true);
  assert.equal(parsed3.flags['delete-branch'], true);
});

test('createWorktree prunes stale metadata and rejects --base when branch exists', () => {
  const repo = initTempRepo();
  try {
    // 1. Stale worktree directory manually deleted
    const wt1 = createWorktree({ cwd: repo, name: 'stale-wt' });
    rmSync(wt1.path, { recursive: true, force: true });
    // Without git worktree prune, git worktree add would fail. createWorktree must prune and succeed.
    const wt1Recreated = createWorktree({ cwd: repo, name: 'stale-wt' });
    assert.equal(existsSync(wt1Recreated.path), true);
    teardownWorktree({ cwd: repo, name: 'stale-wt', deleteBranch: true });

    // 2. Reject --base when branch exists
    createWorktree({ cwd: repo, name: 'base-conflict' });
    teardownWorktree({ cwd: repo, name: 'base-conflict', deleteBranch: false });
    // Branch 'wt/base-conflict' still exists
    assert.throws(
      () => createWorktree({ cwd: repo, name: 'base-conflict', base: 'HEAD' }),
      /Branch '.*' already exists.*--base/i
    );
    // Cleanup remaining branch
    execFileSync('git', ['branch', '-D', 'wt/base-conflict'], { cwd: repo });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('teardownWorktree deletes branch even if dir deleted, and preserves node_modules symlink on failure', () => {
  const repo = initTempRepo();
  try {
    // 1. Delete branch even if worktree directory was already deleted on disk
    const wtDirDeleted = createWorktree({ cwd: repo, name: 'dir-deleted' });
    rmSync(wtDirDeleted.path, { recursive: true, force: true });
    const tear1 = teardownWorktree({ cwd: repo, name: 'dir-deleted', deleteBranch: true });
    assert.equal(tear1.removed, true);
    assert.equal(tear1.deletedBranch, 'wt/dir-deleted');
    const branches = execFileSync('git', ['branch', '--list', 'wt/dir-deleted'], { cwd: repo, encoding: 'utf8' }).trim();
    assert.equal(branches, '');

    // 2. Dirty worktree fails remove without --force and preserves node_modules symlink
    const wtDirty = createWorktree({ cwd: repo, name: 'dirty-wt' });
    const dirtyFile = join(wtDirty.path, 'untracked.txt');
    writeFileSync(dirtyFile, 'dirty content\n', 'utf8');

    assert.throws(
      () => teardownWorktree({ cwd: repo, name: 'dirty-wt', force: false }),
      /git worktree remove failed/i
    );
    // node_modules symlink must still exist!
    const modPath = join(wtDirty.path, 'node_modules');
    assert.equal(lstatSync(modPath).isSymbolicLink(), true);
    assert.equal(existsSync(modPath), true);

    // Now force teardown
    const tearDirty = teardownWorktree({ cwd: repo, name: 'dirty-wt', force: true, deleteBranch: true });
    assert.equal(tearDirty.removed, true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});


test('repoRoot rejects bare repositories and correctly resolves submodules', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'agx-wt-bare-sub-'));
  try {
    // 1. Bare repo rejection
    const bareDir = join(tmp, 'bare.git');
    execFileSync('git', ['init', '--bare', bareDir]);
    assert.throws(
      () => repoRoot(bareDir),
      /Cannot run agx worktree inside a bare repository/
    );

    // 2. Submodule resolution
    const mainRepo = join(tmp, 'main');
    const subRepo = join(tmp, 'sub');
    mkdirSync(mainRepo);
    mkdirSync(subRepo);
    execFileSync('git', ['init'], { cwd: subRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: subRepo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: subRepo });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'sub-init'], { cwd: subRepo });

    execFileSync('git', ['init'], { cwd: mainRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: mainRepo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: mainRepo });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'main-init'], { cwd: mainRepo });
    execFileSync('git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', subRepo, 'mysub'], { cwd: mainRepo });
    execFileSync('git', ['commit', '-m', 'add sub'], { cwd: mainRepo });

    const mysub = join(mainRepo, 'mysub');
    const mysubNested = join(mysub, 'nested', 'deep');
    mkdirSync(mysubNested, { recursive: true });

    assert.equal(repoRoot(mysub), mysub);
    assert.equal(repoRoot(mysubNested), mysub);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('findWorktreeBranch resolves canonical paths when repo root is a symlink and worktree dir is deleted', () => {
  const realRepo = initTempRepo();
  const symRepo = join(tmpdir(), `agx-sym-${Date.now()}`);
  symlinkSync(realRepo, symRepo);
  try {
    const created = createWorktree({ cwd: symRepo, name: 'sym-wt' });
    assert.equal(created.branch, 'wt/sym-wt');
    // Delete the worktree folder
    rmSync(created.path, { recursive: true, force: true });

    // teardownWorktree on symlinked repo should still discover the branch and delete it
    const removed = teardownWorktree({ cwd: symRepo, name: 'sym-wt', deleteBranch: true });
    assert.equal(removed.removed, true);
    assert.equal(removed.deletedBranch, 'wt/sym-wt');
    const branches = execFileSync('git', ['branch', '--list', 'wt/sym-wt'], { cwd: realRepo, encoding: 'utf8' }).trim();
    assert.equal(branches, '');
  } finally {
    rmSync(symRepo, { force: true });
    rmSync(realRepo, { recursive: true, force: true });
  }
});

test('teardownWorktree falls back to wt/${name} and throws when branch cannot be determined', () => {
  const repo = initTempRepo();
  try {
    // 1. Fallback to wt/${name} when worktree is detached (no branch in porcelain) but branch exists
    const wtOrphan = join(repo, '.worktrees', 'orphan');
    execFileSync('git', ['worktree', 'add', '--detach', wtOrphan, 'HEAD'], { cwd: repo });
    execFileSync('git', ['branch', 'wt/orphan'], { cwd: repo });

    const removed = teardownWorktree({ cwd: repo, name: 'orphan', deleteBranch: true });
    assert.equal(removed.deletedBranch, 'wt/orphan');
    const branches = execFileSync('git', ['branch', '--list', 'wt/orphan'], { cwd: repo, encoding: 'utf8' }).trim();
    assert.equal(branches, '');

    // 2. Throws when deleteBranch: true and worktree is detached and no wt/${name} branch exists
    const wtNoBranch = join(repo, '.worktrees', 'no-branch');
    execFileSync('git', ['worktree', 'add', '--detach', wtNoBranch, 'HEAD'], { cwd: repo });

    assert.throws(
      () => teardownWorktree({ cwd: repo, name: 'no-branch', deleteBranch: true }),
      /Worktree removed, but could not determine branch to delete for 'no-branch'/
    );
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
