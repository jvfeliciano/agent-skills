---
name: pr
description: >-
  Authors concise, unslopped pull request titles and descriptions linking specs,
  blast-radius scope, and executed verification evidence. Use when preparing or
  opening a PR after implementation and review.
---

# PR (Evidence-Backed Pull Request)

Write PRs for human reviewers scanning in 60 seconds: what changed, why, what could break, and what actually ran.

## Protocol
1. **Pre-Flight Gate**:
   - Confirm `agx blast --base origin/main...HEAD` and `agx god-files --max-lines 300` are clean (or exceptions justified).
   - Confirm `interrogate` / `verify-loop` checks have been run after the final edit.
2. **Draft PR Structure**:
   - **Title**: Imperative, scoped (`feat(scope): ...` or `fix(scope): ...`), under 72 chars.
   - **Why & What**: 2-4 bullets on the problem and architectural change; link spec/issue if any.
   - **Blast Radius & Risk**: Downstream boundaries touched (DB, API, env, cache) and rollback/migration notes if applicable.
   - **Verification**: Exact commands executed after the final edit and observed outcomes (unit/integration tests, typecheck, live probe/screenshot). Never claim unrun checks.
3. **Unslop Pass**: Run `agx unslop-check` on the PR text (if written to a file) and strip filler, hype, and redundant restatements of the diff.
