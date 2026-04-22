---
name: vm-architecture-primer
description: Primer on the VM (View Model) architecture used in this codebase. VMs bridge Effect services and React UI via Effect-Atom. Use this skill when building, reviewing, or debugging any VM code. Mandatory reading below points to the authoritative package docs; this skill is a 2-minute orientation, not the documentation.
---

## What VMs are (2-minute orientation)

VMs are Effect services owned by a registry that expose reactive state via `@effect-atom/atom` for React consumption. They sit between domain services (capabilities) and the UI (React components). A VM owns its lifecycle, orchestrates service calls, and publishes state as Atoms. React components subscribe to those Atoms via hooks — they never import services directly.

The VM pattern enforces a clean boundary: Effect owns all state transitions; React is a pure rendering function over Atom values.

## Core covenants (non-negotiable)

- VM is a service, not a class — constructed via Effect, accessed via its Tag
- VM publishes state via `Atom.writable` / `Atom.readable` — not via observables or mutable objects
- UI subscribes via Atom hooks — never imports services directly
- Facets compose React UI; facets are pure projections over VM state
- VM ownership is registry-bound; lifetime is scoped to the registry
- `Atom.map(f) ∘ Atom.map(g) ≡ Atom.map(f ∘ g)` — fuse derived atoms; do not chain `.map` where a single composed map suffices

## Mandatory reading

Before writing or reviewing any VM code, read these in order:

1. `/module packages-shared/vm-runtime` — the VM runtime package; ai-context has the authoritative doctrine, patterns, and invariants for VM construction, keying, and registry ownership
2. `.context/effect-atom/` — the external Atom package; reactive primitives (`Atom.writable`, `Atom.readable`, `Atom.map`, `Atom.family`), hooks, and fusion laws
3. `/module packages-shared/location` — concrete VM example integrating the URL substrate with the VM pattern

## When to use this skill

- Building a new VM
- Reviewing VM code in a PR
- Debugging state or reactivity in a React component that subscribes to a VM
- Adding a new capability that an existing VM should expose

If none of these apply, this skill is not for you.

## Not covered here

This skill is deliberately thin. It does not contain:

- Atom API reference — see `.context/effect-atom/`
- Lifecycle patterns and registry keying — see vm-runtime ai-context
- Testing patterns — see `/skills effect-testing`
- Layer wiring — see `/skills platform-abstraction` and the ai-context of your target package
