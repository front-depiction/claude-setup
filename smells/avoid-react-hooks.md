---
name: avoid-react-hooks
description: React hooks (useState, useEffect, useReducer, etc.) should be avoided - use View Models with Effect Atom instead
glob: "**/*.{ts,tsx}"
pattern: \b(useState|useEffect|useReducer|useCallback|useMemo|useRef|useLayoutEffect|useImperativeHandle|useDebugValue|useDeferredValue|useTransition|useId|useSyncExternalStore|useInsertionEffect)\s*[<(]
tag: avoid-react-hooks
severity: error
---

# Avoid React Hooks - Use View Models

React hooks scatter state and logic across components, making code untestable and breaking dependency injection.

**Why it's wrong:**
- State lives in components instead of testable VMs
- No typed errors, no DI, no service mocking
- `useEffect` cleanup is error-prone

**What to do:**
- Invoke the `react-vm` skill for implementation guidance
- Move all state to VM atoms, all effects to VM actions
- Components become pure renderers using only `useAtomValue`, `useAtomSet`, `useVM`

**Common replacements:**
- `useState` → VM atom
- `useEffect` for side effects → VM action
- `useEffect` for event listeners → `Atom.make` with `get.addFinalizer`
- `useSearchParams` → `Atom.searchParam`
- `useRef` for DOM → pass ref from parent, or use VM for scroll triggers
- `useMemo`/`useCallback` → derived atoms in VM

**Note:** VM implementation is highly parallelizable - spawn multiple subagents to implement VMs concurrently.
