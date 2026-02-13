# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for significant architectural choices made in the Headlamp Polaris Plugin.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. AD Rs provide historical context for future developers and serve as documentation for why certain approaches were chosen.

## When to Create an ADR

Create an ADR when:

- Making a significant architectural choice (e.g., state management approach)
- Selecting between multiple technology options (e.g., React Context vs. Redux)
- Establishing a pattern that impacts multiple components
- Making a trade-off decision with non-trivial consequences
- Introducing a new dependency or external integration
- Defining security or performance constraints

## ADR Format

Each ADR follows this template (based on Michael Nygard's format):

```markdown
# ADR-NNN: Title

**Status**: [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Date**: YYYY-MM-DD
**Deciders**: [List key decision makers]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- ...

### Negative

- ...

### Neutral

- ...

## Alternatives Considered

### Option 1: Name

**Pros**: ...
**Cons**: ...
**Decision**: Not chosen because...

## References

- [Link to related issues, docs, discussions]
```

## ADR Index

| ADR                                   | Title                                  | Status   | Date       |
| ------------------------------------- | -------------------------------------- | -------- | ---------- |
| [001](001-react-context-for-state.md) | Use React Context for State Management | Accepted | 2026-02-12 |

**Note:** Additional ADRs documenting other significant decisions (service proxy approach, drawer navigation, MUI import restrictions) can be created following the template above.

## Creating a New ADR

1. **Determine the next ADR number** (e.g., if last ADR is 004, new ADR is 005)
2. **Create a new file**: `NNN-short-title.md` (e.g., `005-exemption-management.md`)
3. **Use the template above** and fill in all sections
4. **Add entry to this README** in the ADR Index table
5. **Submit for review** via pull request

## ADR Lifecycle

- **Proposed**: ADR is drafted and under discussion
- **Accepted**: Decision has been made and is currently in effect
- **Deprecated**: Decision is no longer recommended but not yet superseded
- **Superseded by ADR-XXX**: Decision has been replaced by a newer ADR

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record/blob/main/templates/decision-record-template-by-michael-nygard/index.md)
- [ADR Tools](https://github.com/npryce/adr-tools)
