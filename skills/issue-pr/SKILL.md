---
name: issue-pr
description: >-
  Creates duplicate-checked GitHub issues and evidence-backed pull requests via
  the `gh` CLI. Use when filing tracer-bullet issues from specs/bugs or opening
  and updating PRs after verification.
---

# Issue & PR (`gh` CLI)

Ship tracer-bullet issues and verified PRs non-interactively via `gh`, without unrun claims or duplicate tickets.

## 1. Pre-Flight
1. Verify auth and repo context: `gh auth status` and `git remote -v` / `git status -sb`. If unauthenticated, stop and ask the user to run `gh auth login`.
2. Confirm target repo/base branch (`gh repo view --json nameWithOwner,defaultBranchRef`).

## 2. Creating Issues (Tracer Bullets & Bug Reports)
1. **Slice vertically**: Follow `to-spec` — include Goal/Problem, Scope/Files, Dependencies (`Blocked by #<n>`), and binary Acceptance Criteria (exact command or UI check).
2. **Deduplicate & create via `agx gh`**: Write body to a temp file (see `references/gh-templates.md`) and run `agx gh issue-create --title "<title>" --body-file <path> --search "<keywords>"`.

## 3. Opening / Updating Pull Requests
1. **Run `pr` & `agx` gates first**:
   - `./bin/agx blast --base origin/main...HEAD`
   - Confirm tests/typecheck/live probes ran after the final edit.
2. **Draft & create via `agx gh`**: Follow `pr` structure (Title <72 chars, Why & What, Blast Radius, Verification), link issues (`Closes #<n>`), and run `agx gh pr-create --title "<title>" --body-file <path> [--draft]` (runs `god-files` + `unslop-check` gates and pushes `HEAD`).
3. **Update / batch**: Use `gh pr edit` to update an existing PR, `agx gh checks --prs ...` for batch CI checks, and `agx gh merge` / `agx gh retarget` for stacked PRs.

## 4. External Mutation Gate
Before running `gh issue create` or `gh pr create` on a shared repo, confirm target repo, title, and labels/draft state unless the user already explicitly approved immediate creation.
