---
name: pattern-buffer
description: >-
  Logs recurring anti-patterns and out-of-scope footguns into a triage buffer
  instead of fixing them ad-hoc mid-task, then synthesizes root-cause fixes or
  lint rules in batches. Use when spotting debt outside current scope.
---

# Pattern Buffer (Stop Playing Whack-a-Mole)

Keep current diffs surgical while capturing recurring failure modes for systemic root-cause elimination.

## During Execution (Log Once)
When you encounter an out-of-scope bug pattern, footgun, or domain drift:
1. Do NOT fix unrelated files inside your active feature/fix diff.
2. Run:
   `agx buffer add --category <slug> --file <path:line> --summary "<concise observation>"`
3. Continue your primary task cleanly.

## Periodic Triage (See the Forest)
When reviewing `.agents/state/pattern-buffer.md` or when prompted for cleanup:
1. Run `agx buffer triage --min 3` to surface categories with `ACTION:ROOT_FIX`.
2. Inspect clustered examples (`agx buffer list --category <slug>`) to find the shared architectural cause rather than patching symptoms one by one.
3. Propose one systemic fix:
   - A strict type invariant or shared boundary helper
   - An ESLint/compiler rule or `agx` deterministic check
   - A one-shot cleanup PR + `agx buffer` archive note
