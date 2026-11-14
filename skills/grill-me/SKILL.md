---
name: grill-me
description: >-
  Stress-tests a feature idea, architecture, or plan through a targeted
  design-tree interview before writing code. Use when the user proposes a new
  feature, architecture change, or ambiguous requirement and needs alignment.
---

# Grill Me (Design-Tree Alignment)

Eliminate downstream rework by resolving every unresolved design branch before touching implementation files.

## Protocol
1. **Context Preflight**: Run `agx context` (and read only named spec/files). Do not ask questions the codebase already answers.
2. **Map the Design Tree**: Identify open branches across:
   - Domain boundaries & invariants (multi-tenancy, permissions, state transitions)
   - Data model & contract edges (nullability, migrations, backward compatibility)
   - Failure modes & concurrency (races, retries, idempotency, offline/stale state)
   - Scope cuts (what v1 explicitly excludes)
3. **Interview in Rounds**:
   - Ask 3 to 4 high-leverage questions per round, ordered by architectural blast radius.
   - Supply a `(Recommended)` default with a one-line trade-off for every question.
   - Challenge hidden assumptions and conflicting requirements directly.
4. **Gate Execution**: Do NOT write implementation code until every branch converges.
5. **Converge**: Summarize resolved decisions, invariants, and explicit non-goals, then offer to hand off to `to-spec` or `design-an-interface`.
