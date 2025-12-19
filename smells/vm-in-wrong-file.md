---
name: vm-in-wrong-file
description: View Model definitions must be in .vm.ts files - detected VM pattern outside of proper location
glob: "**/!(*.vm).{ts,tsx}"
pattern: (interface\s+\w+VM\s*\{|Context\.GenericTag<\w*VM>|Layer\.(effect|scoped)\(\s*\w+VM)
tag: vm-location
severity: error
---

# VM Code in Wrong File

View Models must be defined in dedicated `.vm.ts` files, not in component files or other locations.

**Why it's wrong:**
- Breaks the `Component.tsx` + `Component.vm.ts` convention
- Makes VMs harder to find and maintain
- Mixes rendering logic with state management
- Prevents proper code organization

**File structure convention:**
```
components/
  MyComponent/
    MyComponent.tsx      # Pure renderer - uses useVM, useAtomValue
    MyComponent.vm.ts    # VM definition - interface, tag, layer
    index.ts
```

**What to do:**
1. Create a `ComponentName.vm.ts` file alongside your component
2. Move the VM interface, tag, and layer to the `.vm.ts` file
3. Export as `default { tag, layer }` from the VM file
4. Import in component: `import MyComponentVM from "./MyComponent.vm"`

**VM file template:**
```typescript
// MyComponent.vm.ts
import * as Atom from "@effect-atom/atom/Atom"
import { AtomRegistry } from "@effect-atom/atom/Registry"
import { Context, Layer, Effect, pipe } from "effect"

// 1. Interface
export interface MyComponentVM {
  readonly state$: Atom.Atom<State>
  readonly action: () => void
}

// 2. Tag
export const MyComponentVM = Context.GenericTag<MyComponentVM>("MyComponentVM")

// 3. Layer
const layer = Layer.effect(MyComponentVM, Effect.gen(function* () {
  const registry = yield* AtomRegistry
  // ... implementation
}))

// 4. Default export
export default { tag: MyComponentVM, layer }
```

Invoke the `react-vm` skill for full implementation guidance.
