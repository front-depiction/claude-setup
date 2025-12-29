# Prompt Module Architecture & Best Practices Report

## 1. Type Hierarchy

```
Prompt (container)
├── content: ReadonlyArray<Message>
│
└── Message (union of 4 types)
    ├── SystemMessage
    │   └── content: string
    ├── UserMessage
    │   └── content: ReadonlyArray<UserMessagePart>
    │       ├── TextPart
    │       └── FilePart
    ├── AssistantMessage
    │   └── content: ReadonlyArray<AssistantMessagePart>
    │       ├── TextPart
    │       ├── FilePart
    │       ├── ReasoningPart
    │       ├── ToolCallPart
    │       └── ToolResultPart
    └── ToolMessage
        └── content: ReadonlyArray<ToolResultPart>
```

**Key insight**: `SystemMessage.content` is a **string**, but `UserMessage` and `AssistantMessage` content is **Part[]**.

## 2. Constructor Reference

### Prompt Constructors

| Constructor | Purpose |
|------------|---------|
| `Prompt.empty` | Empty prompt |
| `Prompt.make(input)` | String → user message, array → messages, prompt → passthrough |
| `Prompt.fromMessages([...])` | From pre-built message array |
| `Prompt.fromResponseParts([...])` | Convert LLM response to assistant message |
| `Prompt.merge(a, b)` | Concatenate prompts (dual signature) |

### Message Constructors

| Constructor | Content Type |
|------------|-------------|
| `Prompt.systemMessage({ content })` | `string` |
| `Prompt.userMessage({ content })` | `UserMessagePart[]` |
| `Prompt.assistantMessage({ content })` | `AssistantMessagePart[]` |
| `Prompt.toolMessage({ content })` | `ToolResultPart[]` |

### Part Constructors

| Constructor | Creates |
|------------|---------|
| `Prompt.textPart({ text })` | TextPart |
| `Prompt.filePart({ mediaType, data })` | FilePart |
| `Prompt.reasoningPart({ text })` | ReasoningPart |
| `Prompt.toolCallPart({ id, name, params })` | ToolCallPart |
| `Prompt.toolResultPart({ id, name, result })` | ToolResultPart |

### System Message Manipulation

| Function | Purpose |
|----------|---------|
| `Prompt.setSystem(prompt, content)` | Replace system message |
| `Prompt.prependSystem(prompt, content)` | Prepend to system |
| `Prompt.appendSystem(prompt, content)` | Append to system |

## 3. Merge Semantics

```typescript
// Concatenates messages from both prompts
const combined = Prompt.merge(prompt1, prompt2)
// Result: [...prompt1.content, ...prompt2.content]

// Dual signature - works in pipes
const combined = pipe(
  systemPrompt,
  Prompt.merge(userPrompt),
  Prompt.merge(contextPrompt)
)
```

## 4. Ephemeral vs Persistent

| Type | Persisted in History | Use Case |
|------|---------------------|----------|
| Regular `Prompt` | Yes | User input, assistant responses |
| `EphemeralPrompt` | No | Traits, steering notes, temporary context |

```typescript
// Ephemeral - filtered out before saving to history
const traitPrompt = EphemeralPrompt.make("<trait>...</trait>")

// Filter before saving
const filteredPrompt = EphemeralPrompt.filter(prompt)
```

## 5. Common Patterns

### Pattern 1: Structured System Prompts
```typescript
const prompt = Prompt.make([
  { role: "system", content: universalContract },
  { role: "system", content: roleGuidance },
  { role: "system", content: domainGuidance }
])
```

### Pattern 2: Ephemeral + Persistent Composition
```typescript
const fullPrompt = pipe(
  EphemeralPrompt.make(traits),      // NOT persisted
  Prompt.merge(EphemeralPrompt.make(steering)),  // NOT persisted
  Prompt.merge(Prompt.make(userInput))  // Persisted
)
```

### Pattern 3: generateObjectWith Response Transform
```typescript
const response = yield* chat.generateObjectWith(
  (response) => {
    const systemPrompt = Prompt.fromMessages([
      Prompt.systemMessage({ content: configXml })
    ])

    const assistantPrompt = Prompt.fromMessages([
      Prompt.assistantMessage({
        content: [Prompt.textPart({ text: summary })]
      })
    ])

    return pipe(
      systemPrompt,
      Prompt.merge(assistantPrompt),
      Prompt.merge(Prompt.fromResponseParts(response.content))
    )
  },
  { prompt, schema, objectName }
)
```

## 6. Anti-Patterns

### AVOID: Plain objects for assistant/user messages
```typescript
// WRONG - content should be Part[], not string
Prompt.assistantMessage({ content: "Hello" })

// CORRECT
Prompt.assistantMessage({ content: [Prompt.textPart({ text: "Hello" })] })
```

### AVOID: Raw object literals for parts
```typescript
// WRONG - missing internal TypeId
{ type: "text", text: "Hello" }

// CORRECT - use constructor
Prompt.textPart({ text: "Hello" })
```

### AVOID: Forgetting to filter ephemeral
```typescript
// WRONG - ephemeral messages leak into history
yield* SubscriptionRef.set(history, fullPrompt)

// CORRECT
const filtered = EphemeralPrompt.filter(fullPrompt)
yield* SubscriptionRef.set(history, filtered)
```

## 7. Best Practices Summary

1. **System messages**: `content` is a string, use `Prompt.systemMessage({ content: "..." })`
2. **User/Assistant messages**: `content` is Part[], always use `Prompt.textPart()` etc.
3. **Ephemeral context**: Use `EphemeralPrompt.make()` for traits, steering notes
4. **Composition**: Use `pipe()` with `Prompt.merge()` for clarity
5. **Response handling**: Use `Prompt.fromResponseParts()` to convert LLM responses
6. **History management**: Always filter ephemeral before persisting

## Quick Reference: Message Content Types

| Message Type | `content` Type | Example |
|-------------|----------------|---------|
| `SystemMessage` | `string` | `{ content: "You are helpful" }` |
| `UserMessage` | `UserMessagePart[]` | `{ content: [Prompt.textPart({text: "Hi"})] }` |
| `AssistantMessage` | `AssistantMessagePart[]` | `{ content: [Prompt.textPart({text: "Hello"})] }` |
| `ToolMessage` | `ToolResultPart[]` | `{ content: [Prompt.toolResultPart({...})] }` |
