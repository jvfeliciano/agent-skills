---
name: agx-first
description: >-
  Audits shell-vs-agx tool usage in telemetry logs and enforces replacing raw sh
  chains with deterministic agx subcommands. Use when reviewing session command
  logs, improving agx adoption, or spotting repetitive sh orientation patterns.
---

# `agx-first` (Deterministic CLI Enforcement & Audit)

Replace repetitive `sh` orientation, scanning, and verification chains with `agx` subcommands to cut token waste and output noise.

## 1. Audit Session Logs (`sh` vs `agx`)
1. Pull the latest digest via `agx telemetry report --digest` (or inspect the pasted `agx` / `sh` command table).
2. Classify each `sh` call into one of three buckets:
   - **Direct `agx` replacement**: Covered by an existing `agx` command (see table below, including `agx gh`, `agx god-files`, and `agx worktree`).
   - **Legitimate `sh`**: Build/test runners (`npm test`, `npx prisma`), mutating `git` (`commit`, `rebase`, `cherry-pick`), or one-off `gh` queries not covered by `agx gh`.
   - **Candidate `agx` gap**: Repeated read-only/triage `sh` pattern (3+ times) that belongs in `bin/agx` per `cli-for-agent` (log via `agx buffer add` or implement).

## 2. `sh` -> `agx` Replacement Table
| Raw `sh` Pattern | Use `agx` Instead |
|---|---|
| `git status`, `find`, `ls`, `rg` for repo orientation | `agx context --json` |
| `wc -l` or checking file length | `agx god-files --path <file> --show-lines` |
| `git diff` + `rg` symbol/caller checks | `agx blast --base HEAD` |
| `gh pr checks`, `gh pr merge`, `gh issue create`, `gh pr comment` | `agx gh <checks\|merge\|issue-create\|comment>` |
| `git worktree add/remove` + `ln -s node_modules` | `agx worktree <create\|link-modules\|teardown>` |
| Prose/markdown quality or slop checks | `agx unslop-check --file <f> --strict` |
| Tracking out-of-scope debt in notes/TODOs | `agx buffer add` / `agx buffer triage` |
| Ad-hoc task lists or phase tracking | `agx plan init\|next\|update` |
| Manual pass/fail checklists | `agx rubric init\|score` |
| Grepping `.jsonl` transcripts for corrections | `agx mine --transcript <jsonl>` |

## 3. Session Habits (Enforce Before `sh`)
1. **Start**: Run `agx context` once instead of chaining `git status`, `git branch`, and `find`.
2. **Delegate**: Route multi-file exploration to `scout` rather than running 10+ `cat`/`head`/`rg` calls in the coordinator.
3. **Pre-PR**: Run `agx blast`, `agx god-files --max-lines 300 --strict`, and `agx unslop-check` before opening a PR.

## 4. Report Format (When Auditing a Log)
Output a concise 3-part summary:
1. **Adoption Ratio**: `agx` calls vs replaceable `sh` calls.
2. **Missed `agx` Swaps**: Top `sh` steps (with step IDs) and their exact `agx` replacement.
3. **Gap Candidates**: Any repeated `sh` cluster (3+ occurrences) worth promoting to `bin/agx` or a `cli-for-agent` ticket.
