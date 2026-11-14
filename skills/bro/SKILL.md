---
name: bro
description: >-
  Explains how unfamiliar code, data flows, or architecture works quickly and
  without fluff using deterministic context, ASCII flow diagrams, and exact
  file:line pointers. Use when onboarding to a module or tracing a bug path.
---

# Bro (Fast Code Comprehension)

Deliver maximum architectural understanding in minimum tokens. Zero preamble.

## Protocol
1. **Fast Orientation**: Run `agx context` first instead of broad file dumps.
2. **Targeted Reads**: Locate entry points and symbol call sites with `rg -n`, then read only the relevant function blocks (under 150 lines per read).
3. **Trace the Spine**: Identify:
   - Entry point (route, CLI, event, or job)
   - State mutation & persistence seams
   - Side effects & external boundaries
   - Invariants & failure modes
4. **Output Format (Strict)**:
   - **TL;DR (2 lines max)**: What this module owns and its core abstraction.
   - **Flow (ASCII)**: `Input -> Validation -> Core -> SideEffect/DB -> Output` with `file:line` labels.
   - **Key Symbols**: Bullet list of `SymbolName` (`path/file.ts:line`) and its single responsibility.
   - **Gotchas / Non-obvious couplings**: Only verified facts observed in files read.
