---
name: arena
description: >-
  Evaluates two or more competing architectural or implementation approaches
  side-by-side against explicit criteria before committing to one. Use when
  facing a high-stakes design choice with non-obvious trade-offs.
---

# Arena (Competing Approaches)

Pit distinct solutions against the same rubric instead of rationalizing the first idea that compiles.

## Protocol
1. **Frame the Contenders**: Define 2-3 genuinely different approaches (e.g., different data models, state boundaries, or libraries—not minor syntax tweaks).
2. **Set Evaluation Criteria**: Pick 3-5 concrete axes (e.g., complexity/LOC, failure modes, migration cost, latency, reversibility).
3. **Evaluate Side-by-Side**:
   - For high-stakes code spikes, optionally spawn parallel read-only/isolated `invoke_subagent` explorers or `workspace: "branch"` prototypes to test feasibility.
   - Probe the hardest edge case of each approach—don't compare only the happy path.
4. **Output Format**:
   - **Comparison Table**: Contenders vs criteria (concise facts, no vague adjectives).
   - **Killer Flaw / Risk**: The strongest objection to each option.
   - **Recommendation**: One clear winner with rationale, plus what would change the decision. Wait for user confirmation before implementing if the choice is irreversible.
