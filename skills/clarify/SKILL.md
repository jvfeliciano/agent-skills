---
name: clarify
description: >-
  Asks 2-3 targeted clarifying questions and proposes a brief plan after
  answers before editing code on non-trivial human requests. Skip for worker
  subagents, typos, explicit 1-line fixes, and read-only questions.
---

# Clarify (Pre-Edit Alignment)

Align on intent, UI/UX details, and scope before touching files on human requests. Default to `clarify` whenever a request changes behavior or UI; never guess unstated design choices.

## Skip When
- **Worker subagent**: Executing a delegated slice or `plan.json` task (requirements are already scoped).
- **Literal micro-edit**: Typo, exact rename, or explicit 1-line fix with zero ambiguity in behavior, placement, or edge cases.
- **Read-only**: Questions, explanations, or audits that do not edit files.
- **Pre-aligned**: User already supplied a concrete spec/plan or explicitly opted out (e.g. "just do it", "sem perguntas").

## Protocol
1. **Silent Orient**: Run `agx context` or targeted `rg` / `read_file` first. Never ask questions the codebase already answers.
2. **Ask First (2-3 Questions)**: Before calling any edit or write tool, ask 2-3 concise questions on unstated scope, UI placement/style, edge cases, or trade-offs, each with a `(Recommended)` default. Use `ask_question` for discrete choices.
3. **Propose Mini-Plan**: After answers (or directly if 0 questions apply to a multi-line or UI change), share a brief plan (target files, change summary, verification command) and wait for user confirmation before editing.
4. **Escalate if Needed**: Hand off to `plan` for multi-step file-grounded plans, or `grill-me` for deep architectural branches.
