---
name: setup
description: >-
  Onboards and configures a repository for agent-skills and agx by detecting
  stack, package manager, test/lint/typecheck commands, domain docs, and issue
  tracking, then initializing .agents/state/ and project rules. Use when setting
  up agent-skills in a new or existing repo.
---

# Setup (Repository Onboarding)

Configure a project once so every subsequent skill knows where docs, specs, state, and verification commands live.

## Protocol
1. **Inspect Repo**: Run `agx context --json` and inspect root manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Makefile`, CI workflows).
2. **Detect & Confirm Vocabulary**:
   - **Commands**: build, test, typecheck, lint, dev server.
   - **Knowledge & Tracking**: where domain docs, specs, ADRs, and issues/PRs live (e.g., `docs/`, GitHub Issues, Linear).
   - **Harness**: Antigravity, Cursor, Claude Code, GitHub Copilot, or all.
   - Ask 1 compact question round only for ambiguous choices; skip if clear from the repo.
3. **Initialize State & Wiring**:
   - Ensure `.agents/state/` exists (add `.agents/state/` to `.gitignore` if appropriate, or keep tracked if team-shared—confirm if unclear).
   - If `agent-skills` is not yet linked in the workspace, run or instruct `bin/install.sh --target <harness> --scope workspace --workspace .`.
   - Record detected commands, doc paths, and conventions in project `AGENTS.md` (append/update without clobbering existing user rules).
4. **Verify**: Run `agx context`, `agx god-files --max-lines 300`, and the detected test/typecheck command to confirm a clean baseline.
