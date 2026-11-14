# Architecture & Guiding Principles (`agent-skills`)

Canonical specification for the `agent-skills` repository: directory layout, token-economy mechanics, orchestrator flows, subagent topology, skill catalog, and deterministic `agx` CLI contracts.

## 1. Repository Structure & Progressive Disclosure

```text
agent-skills/
├── plugin.json                 # Plugin manifest (Antigravity / Cursor)
├── hooks.json                  # Antigravity lifecycle hooks (telemetry ingest)
├── package.json                # Node ESM package exposing `agx` binary
├── README.md                   # Quickstart and installation guide
├── ARCHITECTURE.md             # This specification
├── rules/
│   └── AGENTS.md               # Always-on operating rules (<60 lines, no frontmatter)
├── agents/
│   ├── orchestrator.md         # Phase-handoff coordinator (scout -> planner -> implementer -> reviewer)
│   ├── scout.md                # Read-only explorer (agx context, rg, file:line handoffs)
│   ├── planner.md              # Vertical tracer-bullet planner (agx plan init)
│   ├── implementer.md          # TDD slice executor (300-line cap, agx buffer add)
│   ├── reviewer.md             # Adversarial verify gate (agx blast, god-files, unslop)
│   ├── gh.md                   # GitHub specialist (issues, PRs, CI/review checks, releases)
│   └── telemetry-analyst.md    # Low-cost subagent for telemetry digest triage
├── bin/
│   ├── agx                     # POSIX/Bash dispatcher (context, god-files, blast)
│   └── install.sh              # Idempotent multi-harness installer
├── scripts/
│   ├── cli.ts                  # Native Node/TS subcommands (buffer, plan, rubric, unslop, mine)
│   └── telemetry.ts            # Hook ingestion + token/cost/path/subagent/CLI diagnostics
└── skills/
    └── <skill-name>/
        ├── SKILL.md            # On-demand runbook (<100 lines, YAML name + description)
        └── references/         # Heavy lookup tables/checklists (loaded only if needed)
```

### Structural Invariants
- **300-Line Ceiling**: No source or documentation file exceeds 300 lines (`agx god-files --max-lines 300 --strict`). Split by feature or boundary instead of appending to monoliths.
- **Progressive Disclosure**: Only `name` and third-person `description` from each `SKILL.md` sit in the initial prompt. Full skill bodies load on demand; bulky examples live in `references/`.
- **State Isolation**: Runtime state never pollutes `agent-skills/`. Per-project state lives in `<project>/.agents/state/` (`pattern-buffer.md`, `plan.json`, `rubric.json`).

---

## 2. Guiding Principles

### Technical
- **Agent Hands & Eyes (`verify-loop`)**: Agents must exercise live runtime behavior (browser automation / Chrome DevTools or real HTTP/CLI probes), inspect console/network errors, and never rely on static inspection alone.
- **Autonomous Fuzzing & Hill Climbing**: Probe boundary/invalid/multi-tenant inputs and iterate against `agx rubric score` until reaching `score >= target` without human supervision.
- **Determinism vs. Judgment (`agx`)**: Offload mechanical work (repo snapshots, line counts, symbol cross-refs, state JSON, slop scans, log parsing) to `bin/agx` so the model's context window stays reserved for architecture and judgment.
- **Hardening the Environment**: Convert recurring mistakes into strict TypeScript types (discriminated unions, unrepresentable invalid states), lint rules, or `agx` checks instead of adding prose reminders.

### Operational ("Michelin Kitchen")
- **Executive Chef**: Design the menu (specs), sharpen the knives (`agx`, types, tests), and delegate to isolated sous-chefs (subagents) with rich context rather than micromanaging edits.
- **Outer Loop -> Inner Loop**: Feed external payloads (issues, bug batches, requirements) directly into `to-spec` and `plan.json` without manual copy-paste ("meat proxy").
- **Chief of Staff (`orchestrate`)**: Never write application code in the coordinator; cluster overlapping issues by root cause and dispatch disjoint workers.
- **Pattern Buffering (`pattern-buffer`)**: Log out-of-scope footguns via `agx buffer add` and fix root causes in batches via `agx buffer triage`.
- **Transcript Mining (`mine-transcripts`)**: Extract repeated user corrections from `.jsonl` logs (`agx mine`) and codify them into checks or skills.
- **Intent Compression**: Use precise engineering terms (`tautological tests`, `tracer bullet`, `stringly-typed`, `god file`, `blast radius`) to transfer constraints in minimal tokens.

---

## 3. Orchestrator & Subagent Topology

### Chief-of-Staff Execution Flow

```text
Outer Loop Payload (specs / bug batch / PR feedback)
   │
   ▼
[1. Align & Slice]  grill-me -> ubiquitous-language -> design-an-interface -> to-spec
   │
   ▼
[2. Plan DAG]       agx plan init --goal "..." --tasks '[...]'  (.agents/state/plan.json)
   │
   ▼
[3. Frontier Loop]  agx plan next --json  (selects unblocked pending tasks)
   │
   ├──► Worker A (disjoint files | workspace: inherit/share) ──► tdd -> implement
   ├──► Worker B (disjoint files | workspace: inherit/share) ──► tdd -> implement
   │       └─► out-of-scope debt? ──► agx buffer add (no scope creep)
   ▼
[4. Verify Gate]    blast-radius (agx blast) + verify-loop (Hands & Eyes + agx rubric score)
   │
   ├── FAIL ──► Worker fixes & climbs rubric
   └── PASS ──► agx plan update --id <id> --status done --handoff "<proof>"
   │
   ▼
[5. Retro & Harden] agx buffer triage --min 3 | agx mine | unslop
```

### Subagent Roles & Workspace Modes
- **`scout` (`agents/scout.md`, Read-Only)**: Fast codebase/doc exploration using `agx context` and `rg` without polluting the coordinator's context window.
- **`planner` (`agents/planner.md`, Read-Only)**: Breaks specs into vertically-sliced tracer bullets in `plan.json` (`agx plan init`).
- **`implementer` (`agents/implementer.md`, Scoped Worker)**: Executes TDD slices within disjoint `files[]` under the 300-line cap (`agx buffer add` for out-of-scope debt).
- **`reviewer` (`agents/reviewer.md`, Adversarial Gate)**: Runs pre-PR verification (`agx blast`, `agx god-files`, `agx unslop-check`, tests/typechecks).
- **`telemetry-analyst` (`agents/telemetry-analyst.md`, `flash`)**: Triages `agx telemetry report --digest` for token, cache, skill, and `agx` adoption issues.
- **`browser` (Hands & Eyes)**: Drives Chrome DevTools to click flows, verify layouts, and inspect runtime console/network state on live UIs.
- **Execution Workers (`invoke_subagent` / `swarm` / `run_workflow`)**:
  - `workspace: "inherit"`: Default when tasks own strictly disjoint files (configured in `plan.json` `files[]`).
  - `workspace: "share"` / `"branch"`: Used when parallel authors edit overlapping modules or run concurrent builds.
  - **Delegation & Coordinator Invariant**: The orchestrator owns `plan.json` transitions, dependency ordering, and final verification gates; it never edits app code directly. Route exploration to `scout`, scoped edits to `implementer`/`worker`, pre-PR checks to `reviewer`, and telemetry triage to `telemetry-analyst` on `flash`.

---

## 4. Complete Skill Catalog (29 Skills)

| Phase | Skill | Core Purpose | Primary `agx` / Tool Seam |
|---|---|---|---|
| **Setup** | `setup` | Onboards repo: detects commands/docs/tracker, initializes `.agents/state/` & `AGENTS.md` | `agx context`, `bin/install.sh` |
| **Align** | `clarify` | Asks 2-3 clarifying questions, then proposes a brief plan before non-trivial edits | `agx context` |
| **Align** | `grill-me` | 3-4 question design-tree rounds with `(Recommended)` defaults before coding | `agx context` |
| **Align** | `ubiquitous-language` | Resolves synonyms/overloaded terms into `UBIQUITOUS_LANGUAGE.md` | `agx buffer add` |
| **Design** | `arena` | Evaluates 2-3 competing approaches side-by-side against explicit criteria | Subagents / `workspace: branch` |
| **Design** | `design-an-interface` | Deep modules: compares 2+ distinct type signatures before implementation | Type contracts |
| **Plan** | `plan` | Creates a concise, file-grounded implementation plan before coding | `agx context`, `agx plan` |
| **Plan** | `to-spec` | Converts aligned design into lean spec + vertically-sliced tracer bullets | `agx plan init` |
| **Build** | `tdd` | Strict Red-Green-Refactor at public seams; bans tautological mock tests | Test runner |
| **Verify** | `blast-radius` | Audits indirect wire/DB/cache/env breakage; requires executable proof | `agx blast` |
| **Verify** | `interrogate` | Adversarial pre-PR diff review against concrete bug classes & smells | `agx blast`, `agx god-files` |
| **Verify** | `verify-loop` | Live UI/API probes + fuzzing + Hill Climbing against weighted checks | `agx rubric score` |
| **Ship** | `pr` | Authors concise, evidence-backed PR descriptions linking specs & checks | `agx blast`, `agx unslop-check` |
| **Ship** | `issue-pr` | Creates duplicate-checked GitHub issues and opens/updates PRs via `gh` | `gh`, `agx blast` |
| **Ship** | `gh` | Delegates full GitHub lifecycle (issues, PRs, CI/reviews, releases) to `gh` agent | `gh`, `invoke_subagent` |
| **Quality** | `unslop` | Strips AI prose tells (`references/slop-patterns.md`) and code bloat | `agx unslop-check` |
| **Learn** | `bro` | Zero-fluff *how* explanation via ASCII flow + `file:line` pointers | `agx context`, `rg` |
| **Learn** | `why` | Traces *why* code exists via `git log`, `git blame`, and commit/PR history | `git log`, `git blame` |
| **Scale** | `orchestrate` | Chief-of-Staff coordinator loop with disjoint worker ownership | `agx plan` |
| **Scale** | `goal` | Autonomous loop executing a goal or plan(s) until binary exit checks pass | `agx plan`, `agx rubric` |
| **Scale** | `handoff` | Compacts session state, locked decisions, and next action for fresh agents | `agx context`, `agx plan` |
| **Scale** | `pattern-buffer` | Logs out-of-scope footguns for batch root-cause remediation | `agx buffer` |
| **Meta** | `which-skill` | Catalog router mapping user intent to the shortest effective skill chain | Skill catalog |
| **Meta** | `cli-for-agent` | Non-interactive, `--help`, `--json`, fail-fast CLI design rules | `bin/agx` |
| **Meta** | `writing-for-agents` | Progressive disclosure and token-compression rules for `SKILL.md` | `agx unslop-check` |
| **Meta** | `mine-transcripts` | Extracts user interventions from `.jsonl` logs into rules/skills | `agx mine` |
| **Meta** | `add-skill` | Scaffolds, registers, and verifies new `agent-skills` entries per `ARCHITECTURE.md` | `agx god-files`, `agx unslop-check` |
| **Meta** | `telemetry-analyst` | Retrieves and triages telemetry digests (cost, cache %, `agx` adoption, skills) | `agx telemetry report --digest` |
| **Meta** | `agx-first` | Audits `sh`-vs-`agx` command logs and enforces deterministic `agx` subcommands | `agx telemetry`, `agx context`, `agx blast` |

---

## 5. Deterministic CLI Reference (`bin/agx` + `scripts/cli.ts`)

All commands follow `cli-for-agent`: non-interactive flags, incremental `--help`, `--json` output, and exit code `1` with `Example:` on invalid input.

| Command | Runtime | Key Flags | Output / State Target |
|---|---|---|---|
| `agx context` | Bash/`jq` | `--path <dir> --json` | Branch, dirty files, top extensions, `.agents/state` counts |
| `agx god-files` | Bash/`wc` | `--max-lines 300 --path <file|dir> --show-lines --strict --json` | Files exceeding line cap (exits `1` under `--strict`) |
| `agx blast` | Bash/`rg` | `--base HEAD --path <dir> --json` | Changed files, high-risk boundaries, modified symbols, cross-refs |
| `agx buffer` | Node/TS | `add\|list\|triage --category --file --summary --min 3` | `<repo>/.agents/state/pattern-buffer.md` |
| `agx plan` | Node/TS | `init\|status\|update\|next --goal --tasks --id --status` | `<repo>/.agents/state/plan.json` |
| `agx rubric` | Node/TS | `init\|score --target 100 --checks --strict --json` | `<repo>/.agents/state/rubric.json` (weighted 0-100 score) |
| `agx unslop-check` | Node/TS | `--file <f> \| --path <d> --strict --json` | Scans `.md` files (skips `slop-patterns.md` in dir mode) |
| `agx mine` | Node/TS | `--transcript <jsonl> --limit 20 --json` | Extracts `USER_INPUT` turns with correction signals |
| `agx gh` | Node/TS | `checks\|comment\|merge\|retarget\|issue-create\|pr-create` | Deterministic GitHub PR/issue batches & pre-PR gates |
| `agx telemetry` | Node/TS | `ingest\|report\|reset --latest --transcript --json` | `$PLUGIN_DATA/telemetry/` (tokens, cost, paths, subagents, `agx` usage) |

---

## 6. Multi-Harness Installation (`bin/install.sh`)

```bash
# Global Antigravity plugin (~/.gemini/config/plugins/agent-skills) + ~/.local/bin/agx
./bin/install.sh --target antigravity --scope global

# Workspace-local setup across Antigravity, Cursor, Claude Code, and GitHub Copilot
./bin/install.sh --target all --scope workspace --workspace /path/to/repo
```

- **Antigravity**: Links plugin globally or writes `.agents/plugins.json` + `.agents/skills.json`.
- **Cursor**: Links `rules/AGENTS.md` to `.cursor/rules/agent-skills.md` and skills into `.cursor/skills/`.
- **Claude Code**: Links skills into `.claude/skills/` and rules to `.claude/agent-skills-rules.md`.
- **GitHub Copilot**: Links skills into `.github/skills/` (or `~/.copilot/skills/`) and rules to `.github/copilot-instructions.md` (or `~/.copilot/copilot-instructions.md`).
