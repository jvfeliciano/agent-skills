---
name: tdd
description: >-
  Enforces strict Red-Green-Refactor test-driven development through public
  module seams while banning tautological tests and mock soup. Use when
  implementing business logic, bug fixes, or new domain interfaces.
---

# TDD (Red-Green-Refactor Through Seams)

Prove requirements one failing test at a time before writing production code.

## Non-Negotiable Rules
1. **Test Public Seams, Never Internals**: Test observable behavior at module/API boundaries. Never test private helpers directly or assert internal call order unless ordering is the contract.
2. **Ban Tautological Tests**: Never mock the unit under test or assert a mock returns the exact stub you configured. Mock only true external I/O boundaries (clock, network, filesystem, payment gateway).
3. **One Test at a Time**: Never write a suite of 10 tests upfront.

## Loop
1. **Align Seams**: Confirm the input/output contract (pair with `design-an-interface` if unclear).
2. **RED**: Write **one** minimal test for the next unimplemented behavior. Run the test runner and observe the exact failure message (verify it fails for the right reason, not a syntax error).
3. **GREEN**: Write the simplest production code that makes that test pass. No speculative generalization.
4. **REFACTOR**: Remove duplication, tighten types, and enforce the 300-line file cap. Re-run tests to confirm green.
5. **Repeat** until all acceptance edges (happy path, invalid input, boundary, error path) are covered.
