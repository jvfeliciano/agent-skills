---
name: why
description: >-
  Traces historical rationale behind existing code, architecture, or workarounds
  using git log, git blame, commit messages, and PR/issue references. Use before
  refactoring, deleting unfamiliar code, or questioning why a design exists.
---

# Why (Historical Rationale)

Never delete or rewrite "weird" code until you know what constraint or incident put it there. (`bro` explains *how* it works; `why` explains *why* it exists.)

## Protocol
1. **Locate the Target**: Pinpoint the exact file, symbol, or line range (`rg -n`).
2. **Mine Git History**:
   - `git log -S "<symbol>" --oneline -n 15` or `git log -L <start>,<end>:<file>` to trace evolution.
   - `git blame -L <start>,<end> <file>` to find the introducing commit(s).
   - `git show <sha>` on key commits to read full commit bodies, linked issue/PR numbers, and co-changed tests.
3. **Cross-Reference Docs**: Check `docs/`, ADRs, `UBIQUITOUS_LANGUAGE.md`, or `.agents/state/pattern-buffer.md` for recorded trade-offs.
4. **Output Format**:
   - **Origin**: Introducing commit (`<sha>`, date, author) and linked issue/PR if present.
   - **Problem Solved**: The bug, invariant, or product constraint that forced this shape.
   - **Still Valid?**: Whether that constraint still holds today, and what breaks if you remove it.
   - **Unverified Gaps**: Mark anything inferred (e.g., missing PR body or squashed history) explicitly.
