---
name: clarify
description: >-
  Asks 2-3 targeted clarifying questions and proposes a brief plan after
  answers before editing code on non-trivial human requests. Skip for worker
  subagents, typos, explicit 1-line fixes, and read-only questions.
---

# Clarify (Pre-Edit Alignment)

Align on intent and scope before touching files on non-trivial human requests, without slowing down trivial fixes or delegated workers.

## Skip When
- **Worker subagent**: Executing a delegated slice or `plan.json` task (requirements are already scoped).
- **Trivial change**: Typos, explicit 1-line fixes, or read-only questions.
- **Pre-aligned**: User already provided a concrete spec/plan or explicitly opted out.

## Protocol
1. **Silent Orient**: Run `agx context` or targeted `rg` reads first. Never ask questions the codebase already answers.
2. **Ask First (2-3 Questions)**: Before editing any file, ask 2-3 concise questions on ambiguous scope, behavior, or trade-offs—each with a `(Recommended)` default.
3. **Propose Mini-Plan**: Once answered, share a brief plan (target files, change summary, verification command) and wait for confirmation before implementing.
4. **Escalate if Needed**: Hand off to `plan` for multi-step file-grounded plans, or `grill-me` for deep architectural branches.
