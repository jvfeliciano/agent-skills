---
name: ubiquitous-language
description: >-
  Extracts, disambiguates, and codifies canonical domain terminology into a
  shared glossary. Use when starting a domain model, noticing synonym drift, or
  aligning specs, database schemas, and UI copy.
---

# Ubiquitous Language

Enforce one canonical term per domain concept across specs, types, DB schemas, API routes, and UI copy.

## Protocol
1. **Scan Sources**: Inspect `UBIQUITOUS_LANGUAGE.md` (if present), core schemas/types, and recent specs via `agx context` and targeted reads.
2. **Hunt Ambiguities**: Flag:
   - **Synonyms**: Two names for one concept (e.g., `Client` vs `Customer` vs `User`).
   - **Overloaded terms**: One word meaning different things across contexts (e.g., `Booking` vs `AppointmentSlot` vs `InvoiceItem`).
   - **Implicit states**: Stringly-typed flags hiding distinct lifecycle nouns.
3. **Resolve With User**: For each conflict, propose one canonical term and explicitly ban aliases.
4. **Persist Glossary**: Create or update `UBIQUITOUS_LANGUAGE.md` at repo root with this compact table:
   - `Term` | `Definition` | `Banned Aliases` | `Bounded Context` | `Code/Schema Symbol`
5. **Harden**: Log existing codebase alias drift to the pattern buffer via `agx buffer add --category domain-drift --file <path:line> --summary "<alias -> canonical>"`.
