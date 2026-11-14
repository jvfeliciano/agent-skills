---
name: verify-loop
description: >-
  Executes autonomous Agent Hands and Eyes verification, fuzzing probes, and
  rubric-driven Hill Climbing until quality targets pass without manual
  supervision. Use after implementation or before marking a feature/fix ready.
---

# Verify Loop (Hands & Eyes + Hill Climbing)

Agents without runtime verification fly blind. Exercise the real system and climb the rubric until passing.

## Protocol
1. **Define or Load Rubric**:
   - Run `agx rubric score --json` (or `agx rubric init --checks '<json>'` to add project `typecheck`, `test`, `build`, `god-files`, `unslop` checks).
2. **Equip Hands & Eyes (Live Runtime Probes)**:
   - **Web / UI changes**: Launch the dev server and invoke the `browser` subagent (or Playwright/Chrome DevTools) to render pages, click user flows, check console/network errors, and inspect mobile/desktop layout.
   - **API / CLI changes**: Execute real HTTP requests or CLI invocations with representative payloads.
3. **Autonomous Fuzzing Edge Cases**:
   - Probe empty inputs, invalid types, unauthorized/cross-tenant IDs, double-submit races, and boundary dates.
4. **Hill Climb**:
   - Re-run `agx rubric score --json` after each targeted fix.
   - Loop independently until `passed: true` (`score >= target`) and all live probes succeed.
   - Report exact commands run, rubric score progression, and observed UI/API results.
