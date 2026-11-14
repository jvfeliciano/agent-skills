# `gh` CLI Templates & Commands

## Issue Body (Tracer Bullet)
```markdown
## Goal / Problem
<1-2 lines on what is broken or needed and why.>

## Scope & Boundaries
- Files/modules: `<path>`
- Blocked by: #<n> (if any)

## Acceptance Criteria
- [ ] <Binary, verifiable check: exact test, CLI command, or UI flow>
```

```bash
gh issue create --title "feat(scope): <imperative summary>" --label "<label>" --body-file - <<'EOF'
...
EOF
```

## PR Body (Evidence-Backed)
```markdown
## Why & What
- <2-4 bullets on problem + architectural change>
- Closes #<n>

## Blast Radius & Risk
- Touched boundaries: <DB / API / env / none>
- Rollback/migration: <notes or N/A>

## Verification
- `<exact command>` -> `<observed outcome>`
```

```bash
gh pr create --draft --base main --title "feat(scope): <imperative summary>" --body-file - <<'EOF'
...
EOF
```
