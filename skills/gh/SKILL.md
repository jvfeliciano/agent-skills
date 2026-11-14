---
name: gh
description: >-
  Delegates GitHub operations (issues, PRs, CI/review checks, branch/release
  triage) to the specialized `gh` subagent. Use on `/gh` or when delegating
  GitHub tasks.
---

# GitHub Delegation (`/gh`)

Offload GitHub CLI workflows to the `gh` subagent so the main context stays focused on engineering.

## Protocol
1. **Gather Context**: Pass the target repo, branch/base, task intent (issue, PR, review/CI triage, or release), and any verification evidence already run.
2. **Delegate**: Call `invoke_subagent` with `TypeName: "gh"` and state explicitly whether external mutations (`gh issue create`, `gh pr create`, `git push`) are pre-approved or should be drafted/confirmed first.
3. **Fallback**: If already running inside a subagent without delegation tools, follow `issue-pr` and `pr` directly.
