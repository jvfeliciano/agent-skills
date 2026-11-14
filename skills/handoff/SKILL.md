---
name: handoff
description: >-
  Compacts the active session state, decisions made, touched files, verified
  checks, and exact next steps into a concise handoff note for a fresh session
  or another agent. Use when context is full or pausing multi-step work.
---

# Handoff (Session State Transfer)

Transfer exact momentum to the next agent or session with zero narrative fluff.

## Protocol
1. **Capture Ground Truth**:
   - Run `agx context --json` (branch, dirty files, `.agents/state/`).
   - If orchestrating, run `agx plan status --json` so task IDs and states are exact.
2. **Write the Handoff** (output directly or save to `.agents/state/handoff.md` if requested):
   - **Goal & Current Status**: 1-2 lines on what is done vs remaining.
   - **Decisions Locked**: Non-obvious choices and constraints agreed with the user (do not re-litigate).
   - **Files Changed**: Exact paths and what each change does.
   - **Verification State**:
     - *Passing*: Exact commands run after the final edit and their results.
     - *Not Yet Run / Failing*: What still needs verification.
   - **Next Action**: The single concrete first step for the incoming session (command, file, or `agx plan next`).
3. **Keep It Lean**: Target under 40 lines; link `file:line` and `.agents/state/plan.json` rather than pasting code.
