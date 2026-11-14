---
name: unslop
description: >-
  Strips robotic AI writing tells, filler, and defensive code slop from prose,
  documentation, PR descriptions, and diffs. Use before finalizing docs,
  reviewing generated prose, or cleaning over-engineered code.
---

# Unslop (Prose & Code Discipline)

Produce direct, grounded technical prose and minimal, honest code without AI tells.

## Prose Protocol
1. **Deterministic Scan**: Run `agx unslop-check --file <path>` (or `--path <dir>`) before editing or signing off on Markdown.
2. **Consult Pattern Catalog**: Only read [slop-patterns.md](./references/slop-patterns.md) when rewriting prose with dense AI tells.
3. **Cut Ruthlessly**:
   - Remove chatbot throat-clearing, apologies, and sign-off filler.
   - Replace abstract puffery and symmetrical contrast phrasing with concrete numbers, file paths, and observed tool output.
   - Replace em-dash crutches with periods, colons, or parentheses.

## Code Unslop Protocol
1. **Flag Monoliths**: Run `agx god-files --max-lines 300` to catch bloated files.
2. **Strip Code Tells**:
   - Delete comments that narrate *what* the next obvious line does; keep only *why* comments.
   - Remove silent `try/catch` fallbacks that hide contract violations.
   - Inline single-use helper wrappers and delete speculative dead flags.
3. **Re-Verify**: Re-run `agx unslop-check --strict` and affected tests after cleanup.
