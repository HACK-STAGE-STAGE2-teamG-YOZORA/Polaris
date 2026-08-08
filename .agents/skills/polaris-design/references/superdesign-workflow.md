# Superdesign workflow adapted for Polaris

This repository adopts the useful parts of superdesigndev/superdesign-skill: investigate the existing UI first, create a faithful baseline for existing targets, keep design-system context on every canvas call, and use branch mode for deliberate alternatives. The Polaris-specific rules in SKILL.md take precedence over generic visual experimentation.

## Existing target

1. Confirm the route exists and read the actual render branch.
2. Trace all local UI imports and include the target, shared shell, primitives, tokens, and design system as context.
3. Create a faithful current-state draft; do not put new feature ideas into the baseline.
4. Iterate only after the baseline is available. Each prompt is one direction and must state what stays unchanged.
5. Get user approval before changing production code.

## New target in this codebase

1. Choose the closest existing Polaris screen as the style anchor.
2. Reuse its visual primitives and interaction states.
3. Create the new draft directly; never pretend a non-existent page is current.
4. If a confirmed related draft exists, extend it as a flow rather than starting a competing project.

## Context discipline

- Pass the real logo/brand mark and icon source when fidelity matters.
- Omit data fetching and event-handler code from canvas context when the design tool does not need it, but keep JSX, styles, conditional visual states, and responsive branches.
- Keep context lean. For very large files, pass the render and token sections that were actually read; do not omit visual code merely to make a request fit.
- Always include .superdesign/design-system.md and the relevant token source on design calls.
