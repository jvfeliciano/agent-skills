---
name: cli-for-agent
description: >-
  Guides the design and implementation of deterministic, non-interactive CLIs
  built for coding agents and scripts. Use when creating new developer scripts,
  extending bin/agx, or replacing ad-hoc chat scripts with reusable commands.
---

# CLI for Agents

Replace throwaway session scripts with deterministic, agent-ergonomic CLIs.

## Design Rules
1. **Non-Interactive First**: Every input must work via flags or `stdin`. Ban interactive prompts, arrow-key menus, TUI spinners, and confirmation dialogs.
2. **Incremental Discoverability**:
   - Top-level `--help` shows a compact command index plus copy-pasteable examples.
   - Subcommand `--help` details only that subcommand's flags and 2+ concrete invocations.
3. **Machine & Token-Lean Output**:
   - Support `--json` for structured consumption without ANSI colors.
   - Default human/agent text output must fit in minimal lines with zero ASCII banners.
4. **Composable Pipelines**: Support `--stdin` or `-` for JSON/text piping where bulk inputs apply.
5. **Fail Fast With Actionable Fixes**: Validate flags upfront; on error, exit `1` to `stderr` with the exact missing flag and a valid copy-pasteable `Example: ...` line.
6. **Verify**: Run `<cli> --help`, `<cli> <subcmd> --help`, one happy-path `--json` call, and one invalid-flag error check.
