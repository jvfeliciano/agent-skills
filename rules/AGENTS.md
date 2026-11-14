# Agent Operating Rules (Michelin Kitchen & Context Economy)

## 1. Language & Anti-Slop Discipline
- Process internal instructions, skills, and code reasoning in English for maximum token density; respond to the user in the language they use.
- Apply `unslop` to every output (chat, PRs, docs, comments): zero chatbot filler, corporate puffery, symmetrical contrast clichés, or excessive em-dashes (see `skills/unslop/references/slop-patterns.md`). State facts, trade-offs, and `file:line` pointers directly.

## 2. Deterministic CLI First (Context Preservation)
- Before grepping blindly, orienting manually, or writing ad-hoc verification/parsing scripts in chat, check `agx` (`agx --help` or `<plugin-root>/bin/agx --help`).
- Use `agx context` for repo orientation, `agx blast` for diff impact pre-flight, `agx god-files` to spot monolithic bloat (`agx god-files --path <file> --show-lines` for line counts instead of `wc -l`), `agx unslop-check` to audit prose, `agx buffer` for recurring footguns, `agx plan` for multi-agent orchestration state, `agx rubric` for verification scoring, and `agx gh` for GitHub PR/issue batches instead of raw `sh` loops.
- Never reinvent one-off shell/Python throwaway scripts when a deterministic `agx` subcommand exists or belongs in `bin/agx`.
- Delegate early instead of running 30+ steps in one coordinator: route codebase exploration to `scout`, scoped implementation slices to `worker`/`implementer`, pre-PR audits to `reviewer`, and telemetry triage to `telemetry-analyst` (`flash`).

## 3. Hardening the Environment & Guarding Against God Files
- **300-Line Ceiling**: Refuse to grow source files past 300 lines. Split by cohesive feature module or boundary rather than appending to monolithic files.
- **Make Bugs Structurally Impossible**: When a mistake repeats, encode the fix into strict TypeScript types (discriminated unions, branded IDs, exhaustive switches), lint rules, or an `agx` check rather than relying on memory.
- **Verify With Evidence**: Never claim a change is safe from inspection alone. Prove safety by executing tests, typechecks, `agx blast`, or browser/CLI probes.

## 4. Pattern Buffering (No Whack-a-Mole)
- When encountering out-of-scope anti-patterns, footguns, or repeated workarounds during an unrelated task, do NOT fix them ad-hoc and pollute the diff.
- Log the observation once via `agx buffer add --category <cat> --file <path:line> --summary "<note>"` into `.agents/state/pattern-buffer.md`. Review and fix root causes in batches via `agx buffer triage`.

## 5. Precise Engineering Vocabulary
Enforce strict rejection of these anti-patterns:
- **Tautological tests**: Tests asserting mock return values or mirroring implementation lines instead of testing observable behavior through public seams.
- **Stringly-typed state**: Raw strings/booleans where discriminated unions or state machines belong.
- **Speculative abstractions**: Single-use wrappers, premature factories, or unused configuration hooks.
- **Silent error swallowing**: Empty `catch` blocks or generic fallbacks hiding contract failures.
- **Horizontal layer-cake tickets**: Tasks split by DB/API/UI layers instead of vertically-sliced tracer bullets.

## 6. Pre-Edit Alignment (Human Requests Only)
- For non-trivial code or behavior changes requested directly by a human, follow `clarify`: orient read-only first, ask 2-3 clarifying questions with `(Recommended)` defaults, then propose a brief plan after answers before editing.
- **Skip** for worker/delegated subagents executing scoped tasks, trivial fixes (typos, explicit 1-line edits), read-only questions, or when the user already supplied a spec/plan.
