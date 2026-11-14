---
name: design-an-interface
description: >-
  Applies "Design It Twice" and deep-module principles to propose and compare
  radically different module boundaries and type signatures before coding. Use
  when designing a new service, API contract, SDK, or core abstraction.
---

# Design an Interface (Design It Twice)

Maximize module depth: small, hard-to-misuse public surface hiding non-trivial complexity behind clean types.

## Protocol
1. **Locate Constraints**: Check existing callers, domain glossary (`UBIQUITOUS_LANGUAGE.md`), and error boundaries.
2. **Propose 2+ Distinct Signatures**: Draft at least two genuinely different designs (do not tweak parameter order and call it a second option):
   - **Option A (Minimal Stateless / Functional)**: Pure inputs/outputs, explicit dependencies passed at the seam.
   - **Option B (Scoped Handle / Stateful or Command-Driven)**: Encapsulated client/session or discriminated-union command pipeline.
3. **Compare Trade-Offs**: Score both options concisely on:
   - Caller friction (lines and mental model needed at call sites)
   - Invalid-state prevention (can illegal states be made unrepresentable via types?)
   - Testability seam (can behavior be verified without mock soup?)
   - Blast radius when internal storage or transport changes
4. **Lock Contract**: Recommend one option, get user confirmation, write only the type/interface contract first, then hand off to `tdd`.
