---
name: blast-radius
description: >-
  Audits indirect breakage risks across wire formats, schemas, state, and
  cross-boundary contracts before shipping changes, proving safety by executing
  checks rather than guessing. Use before opening a PR or modifying shared code.
---

# Blast Radius (Evidence Over Assertions)

Never stop at direct callers found by grep. Prove what a change could break downstream before it ships.

## Protocol
1. **Deterministic Pre-Flight**: Run `agx blast --base HEAD` (or `--base origin/main...HEAD`) to map changed files, high-risk boundaries, modified symbols, and cross-file references.
2. **Trace Indirect Couplings** (what grep misses):
   - **Wire & JSON contracts**: Renamed keys, optionality shifts, date/timezone formats, enum values.
   - **DB & Migrations**: Nullability, default backfills, foreign key cascades, multi-tenant `WHERE` isolation.
   - **Caches & Side Effects**: Stale cache keys, webhook retries, idempotency, background job payloads.
   - **Env & Config**: New required env vars, build flags, or permission scopes.
3. **Prove the Core Safety Assumption**:
   - Isolate the single assumption that would cause production failure if false.
   - Execute real code (integration test, migration dry-run, schema validation, or `verify-loop` probe) to prove it holds.
4. **Report**: List verified boundaries, exact commands run with outcomes, and any unverified gaps. Never claim "safe" on paper alone.
