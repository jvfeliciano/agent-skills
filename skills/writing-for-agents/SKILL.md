---
name: writing-for-agents
description: >-
  Authors and refactors token-efficient SKILL.md, AGENTS.md, and prompt
  instructions using progressive disclosure, deterministic CLI offloading, and
  high-compression vocabulary. Use when creating or tightening agent rules.
---

# Writing for Agents

Treat context window space as scarce RAM. Every token in always-on rules or `SKILL.md` must earn its rent.

## Core Principles
1. **Separate Determinism from Judgment**:
   - Move mechanical checks, state tracking, file scans, and formatting into `agx` (`bin/agx` or `scripts/cli.ts`).
   - Keep `SKILL.md` strictly for non-deterministic judgment, ordering, and trade-offs.
2. **Progressive Disclosure**:
   - Put accurate third-person trigger conditions in YAML `description` (the router only sees `name` + `description` upfront).
   - Keep `SKILL.md` under 100 lines. Move lookup tables, examples, and long checklists to `references/*.md`.
3. **Compress Intent with Domain Terms**:
   - Prefer precise terms (`tautological tests`, `tracer bullet`, `stringly-typed`, `god file`, `blast radius`) over multi-sentence tutorials.
   - Never instruct the agent on general programming basics it already knows.
4. **Harden Over Nagging**:
   - If an instruction repeats a correction 2+ times, encode it as a lint rule, type constraint, or `agx` check instead of adding another paragraph to `AGENTS.md`.
5. **Verify**: Run `agx unslop-check --strict` and check `wc -l` on any new `SKILL.md`.
