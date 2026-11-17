# agent-skills (Michelin Kitchen & Deterministic CLI)

Standalone repository of **skills** and **operating rules** for coding agents (compatible with **Antigravity**, **Cursor**, **Claude Code**, and **GitHub Copilot**), designed for token efficiency, engineering rigor, and deterministic verification.

Inspired by the workflows of **Matt Pocock** (`mattpocock/skills`) and **Lauren Tan / Poteto** (`cursor/plugins/pstack`, `cli-for-agent`, `orchestrate`).

## Architecture: Token Economy and Rigor

1. **Progressive Disclosure**: The agent loads only the `name` and `description` of each skill into the initial context. Each `SKILL.md` body (all under 100 lines) enters memory only when the task requires it, and large reference catalogs live in `references/`.
2. **Determinism vs. Judgment (`agx` CLI)**: Mechanical tasks (repo snapshots, *God File* detection, *blast radius* mapping, state management, and rubric scoring) run in the hybrid `bin/agx` CLI (Bash + native Node/TypeScript) outside the model's context window.
3. **Language Convention**: Internal instructions (`rules/AGENTS.md` and `SKILL.md`) are written in English for maximum semantic compression; the agent responds in the user's language.
4. **Michelin Kitchen (Executive Chef)**: The coordinator designs the menu, maintains deterministic tooling, and delegates to isolated workers (`orchestrate`), avoiding micromanagement and throwaway chat scripts.
5. **Architecture and Principles**: See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Catalog of 31 Skills

### Onboarding & Alignment (before writing code)
- **`setup`**: Configures a repository for `agent-skills` and `agx` (detects stack, build/test/lint commands, docs, and tracker, and initializes `.agents/state/` and `AGENTS.md`).
- **`clarify`**: Asks 2-3 clarifying questions (with recommended defaults) and proposes a brief plan after answers before editing code on non-trivial human requests.
- **`grill-me`**: Interactive decision-tree interview (3 to 4 questions per round with recommended defaults) to resolve architectural ambiguities before implementation.
- **`ubiquitous-language`**: Extracts and normalizes domain vocabulary into `UBIQUITOUS_LANGUAGE.md`, banning synonyms and ambiguous terms across specs, schemas, and UI.
- **`arena`**: Compares 2 to 3 competing architectural approaches side-by-side against explicit criteria before selecting one.
- **`design-an-interface`**: Applies *Design It Twice* (deep modules), comparing at least two distinct signatures/contracts before locking types.
- **`plan`**: Creates a concise, file-grounded implementation plan with vertical steps and binary verification checks before editing code.
- **`to-spec`**: Converts aligned decisions into a lean specification and vertically-sliced tickets (*tracer bullets*), avoiding horizontal layer-cake splitting.

### Quality, Context & Anti-Slop
- **`unslop`**: Strips robotic writing tells from docs/PRs (via `agx unslop-check` + `references/slop-patterns.md`) and superfluous code (redundant comments, speculative abstractions).
- **`bro`**: Fast explanation of *how* code works (architecture and data flow with ASCII diagrams and `file:line` pointers, no preamble).
- **`why`**: Investigates *why* code exists as written via `git log`, `git blame`, and commit/PR history before refactoring.
- **`writing-for-agents`**: Meta-skill for authoring and compressing `SKILL.md` and `AGENTS.md` with progressive disclosure and precise technical vocabulary.
- **`tdd`**: Strict Red-Green-Refactor cycle through public module boundaries, banning tautological tests and mock soup.
- **`impeccable`**: Frontend and native UI design, critique, audit, polish, motion, typography, and design-system capture (`DESIGN.md`, tokens).

### Safety, Verification & Delivery
- **`blast-radius`**: Runs `agx blast` and audits indirect couplings (JSON contracts, migrations, caches, environment variables), requiring executable proof instead of assumptions.
- **`interrogate`**: Adversarial pre-PR diff review against concrete bug classes (race conditions, edge cases, multi-tenant leaks, contract drift).
- **`verify-loop`**: Runs *Agent Hands & Eyes* (browser/CLI probes), boundary-case fuzzing, and iterative *Hill Climbing* on `agx rubric score`.
- **`pr`**: Authors concise, unslopped PR titles and descriptions linking specs, *blast radius*, and executed verification evidence.
- **`issue-pr`**: Files GitHub issues (with duplicate checks and *tracer bullets*) and opens/updates PRs via the `gh` CLI with verification evidence.
- **`gh`**: Delegates GitHub operations (issues, PRs, CI/review checks, and branch/release triage) to the specialized `gh` subagent.
- **`cli-for-agent`**: Patterns for building agent-friendly CLIs: 100% non-interactive, incremental `--help` with copyable examples, `--json` output, and fail-fast actionable errors.

### Scale, Buffering & Meta-Workflow
- **`orchestrate`**: *Chief of Staff* mode that clusters bugs by root cause, manages `.agents/state/plan.json` via `agx plan`, and coordinates subagents with disjoint file ownership.
- **`goal`**: Autonomous loop (*goal / potato mode*) that executes an objective, a single plan, or multiple plans until all binary exit criteria pass, with a *circuit breaker* for blockers.
- **`handoff`**: Compacts the current session state, closed decisions, and exact next step for another session or agent.
- **`pattern-buffer`**: Avoids fixing out-of-scope technical debt mid-task; logs patterns to `.agents/state/pattern-buffer.md` (`agx buffer add`) for batch triage (`agx buffer triage`).
- **`principle-never-block-on-the-human`**: Keeps execution unblocked on reversible work (*proceed, then present*), logging issues for self-healing and confirming only irreversible actions.
- **`which-skill`**: Catalog router that recommends the shortest skill or sequence for the current goal without executing it prematurely.
- **`mine-transcripts`**: Analyzes past `.jsonl` conversation logs (`agx mine`) to convert repeated user corrections into lint rules, `agx` commands, or new skills.
- **`add-skill`**: Guides authoring, registering, and verifying new skills in `agent-skills` in compliance with `ARCHITECTURE.md`, progressive disclosure, and `agx`.
- **`telemetry-analyst`**: Retrieves and analyzes telemetry digests (costs, cache %, skill activations, and `agx` usage) at low token cost.
- **`agx-first`**: Audits `sh`-vs-`agx` command logs to surface missed `agx` opportunities and enforce deterministic CLI usage over raw shell chains.

## Deterministic CLI (`bin/agx`)

Requires only `bash`, `git`, `rg`, `jq`, and Node.js (>= 22.6 / v26 with native TypeScript).

| Command | Purpose | Example |
|---|---|---|
| `agx context` | Fast snapshot (branch, dirty files, extensions, `.agents` state) | `./agent-skills/bin/agx context --json` |
| `agx god-files` | Lists files above the line limit (default 300 lines) | `./agent-skills/bin/agx god-files --max-lines 300` |
| `agx blast` | Pre-flight scan of current diff (modified symbols, refs, and boundaries) | `./agent-skills/bin/agx blast --base HEAD` |
| `agx buffer` | Logs and groups recurring footguns (`add`, `list`, `triage`) | `./agent-skills/bin/agx buffer triage --min 3` |
| `agx plan` | Manages the orchestration task graph (`init`, `next`, `update`) | `./agent-skills/bin/agx plan next --json` |
| `agx rubric` | Initializes and scores verification rubrics (`init`, `score`) | `./agent-skills/bin/agx rubric score --json` |
| `agx unslop-check` | Detects AI slop patterns in Markdown files | `./agent-skills/bin/agx unslop-check --file README.md` |
| `agx mine` | Extracts user interventions/corrections from `transcript.jsonl` logs | `./agent-skills/bin/agx mine --limit 20 --json` |
| `agx gh` | Deterministic GitHub PR/issue batches (`checks`, `comment`, `merge`, `retarget`) | `./agent-skills/bin/agx gh checks --prs 10,12 --json` |
| `agx telemetry` | Ingests hooks and reports tokens, costs, paths, subagents, and `agx` usage | `./agent-skills/bin/agx telemetry report --latest` |

## Installation and Sharing

The `bin/install.sh` script configures the repository idempotently for **Antigravity**, **Cursor**, **Claude Code**, or **GitHub Copilot**:

```bash
# Link in the current workspace (.agents/plugins.json and .agents/skills.json)
./agent-skills/bin/install.sh --target antigravity --scope workspace --workspace .

# Install as a global Antigravity plugin (~/.gemini/config/plugins/agent-skills) + ~/.local/bin/agx binary
./agent-skills/bin/install.sh --target antigravity --scope global

# Install simultaneously for Antigravity, Cursor, and Claude Code in the workspace
./agent-skills/bin/install.sh --target all --scope workspace --workspace .
```

To publish as a standalone GitHub repository, move or copy the `agent-skills/` directory into a new Git repository (`git init`) keeping `plugin.json`, `package.json`, `bin/`, `scripts/`, `rules/`, and `skills/`.
