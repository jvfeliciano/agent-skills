---
name: interrogate
description: >-
  Runs an adversarial pre-PR review of staged or branch diffs against concrete
  bug classes, contract drift, security/tenant leaks, and code smells. Use
  before opening a PR or after implementing a feature or bug fix.
---

# Interrogate (Adversarial Diff Review)

Assume the diff has at least one subtle bug until proven otherwise. Focus on what tests and linters miss.

## Protocol
1. **Scope the Diff**: Run `agx blast --base HEAD` (or `origin/main...HEAD`) and `git diff --stat`.
2. **Attack Concrete Bug Classes**:
   - **Correctness & Edge Cases**: Off-by-one, null/empty inputs, timezone/DST, partial failures, non-idempotent retries.
   - **Concurrency & State**: Race conditions, stale closures, missing cleanup/locks, out-of-order async updates.
   - **Security & Isolation**: Missing authz checks, multi-tenant `WHERE` gaps, unvalidated input, secret/PII logging.
   - **Contract & Schema Drift**: Breaking JSON shapes, missing migrations/backfills, swallowed errors (`catch` fallbacks).
   - **Code Smells**: Tautological tests, stringly-typed state, speculative abstractions, files >300 lines (`agx god-files`).
3. **Verify Findings**: For every suspected bug, inspect the call site and surrounding lines (`read_file`); never report a guess from a diff hunk alone.
4. **Report by Severity**:
   - **Blocker / Bug** (`file:line`): Failure mode, reproduction input, and minimal fix.
   - **Risk / Question**: Unverified assumption needing a test or `verify-loop` probe.
   - **Nit**: Optional cleanup (skip if trivial).
   - End with **Verdict**: `APPROVE` or `REQUEST CHANGES` + exact checks executed.
