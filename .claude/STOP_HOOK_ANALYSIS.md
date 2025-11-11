# Stop Hook Architecture Analysis

## Problem Summary

The `stop-await-mailbox.sh` hook was failing instantly with no error output in the logs.

## Root Cause - RESOLVED ✅

**Actual Issue**: `mailbox-reader.sh` was missing execute permissions.

File had: `-rw-r--r--` (no execute)
Should be: `-rwxr-xr-x` (executable)

This caused the PostToolUse hook to fail with "Permission denied" after every tool execution:
```
PostToolUse:Bash hook error: Failed with non-blocking status code:
/bin/sh: .claude/hooks/mailbox-reader.sh: Permission denied
```

**Fix Applied**: `chmod +x .claude/hooks/mailbox-reader.sh`

---

## Original Analysis (For Reference)

The following was the initial hypothesis about blocking behavior before discovering the permission issue:

### Root Cause (Hypothesis)

### Current Flow

1. Bash wrapper checks if session is registered in `mailboxes.json`
2. If registered, it calls the TypeScript implementation with `SESSION_ID` env var
3. TypeScript uses `FileSystem.watch()` to watch for file changes
4. It waits for an "Update" event, then checks for messages
5. **PROBLEM**: If messages already exist, no "Update" event fires, so the stream never emits and the hook blocks forever

### Code Location

File: `.claude/hooks/stop-await-mailbox.ts:338-361`

```typescript
const awaitMessages = (agentId: string): Effect.Effect<ReadonlyArray<Request>, MailboxOperationError> =>
  Effect.gen(function* () {
    // Watch for changes using Stream + takeUntil pattern
    return yield* pipe(
      fs.watch(config.mailboxFilePath),           // ← Starts watching
      Stream.filter(e => e._tag === "Update"),    // ← Only reacts to updates
      Stream.mapError(
        (error) =>
          new MailboxOperationError({
            reason: "Failed to watch mailbox file",
            cause: error,
          })
      ),
      Stream.mapEffect(() => repo.readMessages(agentId)),  // ← Reads messages after update
      Stream.filter(_ => Array.isNonEmptyReadonlyArray(_)), // ← Waits for non-empty
      Stream.runHead,                             // ← Blocks until first emission
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.never,             // ← Never completes if no emissions
          onSome: (messages) => Effect.succeed(messages)
        })
      )
    )
  })
```

## Evidence from Logs

Looking at `.claude/coordination/hook-debug.log`:

```
[2025-11-11T08:24:21.3NZ] stop-await-mailbox.sh START
...
[RUNNING TYPESCRIPT...]
[COMMAND: bun run /Users/front_depiction/Desktop/Projects/claude-setup/.claude/hooks/stop-await-mailbox.ts]
[SESSION_ID ENV: fdadff56-af5b-4e67-bb1a-c0d6df316c17]
```

**Notice**: No `[EXIT CODE: ...]` entry follows. The script never completes.

Meanwhile, `mailboxes.json` contains:

```json
{
  "fdadff56-af5b-4e67-bb1a-c0d6df316c17": [
    {
      "from": "human-test",
      "message": "Hello from another window!",
      "timestamp": "2025-11-10T17:44:29Z"
    }
  ]
}
```

Messages were already present when the hook started, so no "Update" event occurred.

## Architecture Issues

### 1. Race Condition

**Issue**: Messages might arrive BEFORE the watch is established or AFTER the last check but BEFORE the watch starts.

**Timeline**:
```
T0: Hook reads mailboxes.json (empty)
T1: Another process writes message to mailboxes.json
T2: Hook establishes fs.watch()
T3: Hook blocks forever waiting for next update
```

### 2. Missing Initial Check

**Issue**: The implementation never checks for existing messages before setting up the watch.

**What it should do**:
```typescript
const awaitMessages = (agentId: string) =>
  Effect.gen(function* () {
    // 1. Check for existing messages FIRST
    const existingMessages = yield* repo.readMessages(agentId)
    if (Array.isNonEmptyReadonlyArray(existingMessages)) {
      return existingMessages
    }

    // 2. Only watch if no messages exist yet
    return yield* watchForNewMessages(agentId)
  })
```

### 3. No Timeout Mechanism

**Issue**: The hook can block indefinitely. Claude Code's Stop hook should have a maximum execution time.

**Recommendation**: Add a timeout using `Effect.timeout()`:
```typescript
yield* awaiter.awaitMessages(sessionId).pipe(
  Effect.timeout("30 seconds"),
  Effect.catchTag("TimeoutException", () =>
    Effect.succeed([])  // Return empty array on timeout
  )
)
```

### 4. Error Swallowing

**Issue**: Line 437 catches ALL errors silently:

```typescript
Effect.catchAll(() => Effect.void)
```

This makes debugging impossible when the hook fails.

**Recommendation**: At minimum, log errors before swallowing them:

```typescript
Effect.catchAll((error) =>
  Console.error("Stop hook error:", error).pipe(
    Effect.andThen(Effect.void)
  )
)
```

## Testing Evidence

When manually running the script with an existing message:

```bash
$ SESSION_ID="fdadff56-af5b-4e67-bb1a-c0d6df316c17" bun run .claude/hooks/stop-await-mailbox.ts
🔔 Waiting for messages...
messages are here:  1

🔔 Messages Received:
  - From human-test: "Hello from another window!"
```

This works because we manually triggered it, but the watch-based flow doesn't emit when messages already exist.

## Proposed Solutions

### Solution 1: Check-Then-Watch Pattern (Recommended)

```typescript
const awaitMessages = (agentId: string) =>
  Effect.gen(function* () {
    // Check for existing messages first
    const existing = yield* repo.readMessages(agentId)
    if (Array.isNonEmptyReadonlyArray(existing)) {
      return existing
    }

    // Watch for new messages
    return yield* pipe(
      fs.watch(config.mailboxFilePath),
      Stream.filter(e => e._tag === "Update"),
      Stream.mapEffect(() => repo.readMessages(agentId)),
      Stream.filter(msgs => Array.isNonEmptyReadonlyArray(msgs)),
      Stream.runHead,
      Effect.map(Option.getOrElse(() => [])),
      Effect.timeout("30 seconds"),
      Effect.catchTag("TimeoutException", () => Effect.succeed([]))
    )
  })
```

### Solution 2: Poll-Based Approach

Instead of watching, poll the file at intervals:

```typescript
const awaitMessages = (agentId: string) =>
  pipe(
    repo.readMessages(agentId),
    Effect.repeat({
      until: (msgs) => Array.isNonEmptyReadonlyArray(msgs),
      schedule: Schedule.spaced("1 second"),
      times: 30  // Poll for up to 30 seconds
    }),
    Effect.catchAll(() => Effect.succeed([]))
  )
```

### Solution 3: Hybrid Approach

Combine initial check with watch, using `Stream.prepend`:

```typescript
const awaitMessages = (agentId: string) =>
  pipe(
    // Create a stream that emits existing messages immediately
    Stream.fromEffect(repo.readMessages(agentId)),

    // Concatenate with watch stream
    Stream.concat(
      fs.watch(config.mailboxFilePath).pipe(
        Stream.filter(e => e._tag === "Update"),
        Stream.mapEffect(() => repo.readMessages(agentId))
      )
    ),

    // Take first non-empty result
    Stream.filter(msgs => Array.isNonEmptyReadonlyArray(msgs)),
    Stream.runHead,
    Effect.map(Option.getOrElse(() => [])),
    Effect.timeout("30 seconds")
  )
```

## Additional Optimizations

### 1. Bash Wrapper Optimization

The bash wrapper already extracts session_id and checks mailboxes.json. It could check for existing messages and skip the TypeScript entirely:

```bash
# Check if messages exist
MESSAGE_COUNT=$(jq --arg sid "$SESSION_ID" '(.[$sid] // []) | length' "$MAILBOXES_FILE")

if [ "$MESSAGE_COUNT" -gt 0 ]; then
  # Display messages directly without TypeScript
  jq --arg sid "$SESSION_ID" '.[$sid] // []' "$MAILBOXES_FILE" | ...
  exit 0
fi

# Otherwise, run TypeScript to watch for new messages
bun run "${HOOKS_DIR}/stop-await-mailbox.ts"
```

### 2. Separate Hooks

Split into two separate hooks:
- `stop-check-mailbox.sh` - Quick check for existing messages (runs first)
- `stop-await-mailbox.sh` - Block waiting for new messages (runs if first returns empty)

Configure in settings.json:
```json
"Stop": [
  {
    "hooks": [
      {
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-check-mailbox.sh",
        "description": "Check for existing mailbox messages"
      },
      {
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-await-mailbox.sh",
        "description": "Await new mailbox messages if enabled"
      }
    ]
  }
]
```

## Performance Considerations

### Current Issues

1. **Hook Execution Time**: Stop hook blocks indefinitely, preventing session cleanup
2. **Resource Usage**: `fs.watch()` keeps file descriptor open unnecessarily
3. **User Experience**: User has to force-quit when hook hangs

### Recommendations

1. **Maximum Timeout**: 30 seconds for Stop hook (configurable)
2. **Fast Path**: Check existing messages first (< 10ms)
3. **Slow Path**: Only watch if no messages exist
4. **Fallback**: Always allow hook to complete, even without messages

## Testing Strategy

### Test Cases

1. **No messages exist**: Hook should wait for new messages (with timeout)
2. **Messages already exist**: Hook should return immediately
3. **Messages arrive during watch**: Hook should detect and return
4. **Timeout occurs**: Hook should gracefully exit
5. **File doesn't exist**: Hook should handle gracefully
6. **File is invalid JSON**: Hook should handle gracefully

### Manual Testing

```bash
# Test 1: With existing messages
echo '{"test-session": [{"from": "test", "message": "hi", "timestamp": "2025-01-01T00:00:00Z"}]}' > .claude/coordination/mailboxes.json
SESSION_ID="test-session" bun run .claude/hooks/stop-await-mailbox.ts

# Test 2: Without messages
echo '{}' > .claude/coordination/mailboxes.json
SESSION_ID="test-session" timeout 5 bun run .claude/hooks/stop-await-mailbox.ts

# Test 3: Race condition
echo '{}' > .claude/coordination/mailboxes.json
SESSION_ID="test-session" bun run .claude/hooks/stop-await-mailbox.ts &
sleep 1
echo '{"test-session": [{"from": "test", "message": "hi", "timestamp": "2025-01-01T00:00:00Z"}]}' > .claude/coordination/mailboxes.json
```

## Related Issues

- File locking system has similar race condition issues
- Agent cleanup timing is dependent on Stop hook completion
- Multiple hooks in Stop array run sequentially, so blocking one blocks all

## Conclusion

The Stop hook architecture needs refactoring to:

1. **Check before watch**: Always check for existing messages first
2. **Add timeouts**: Never block indefinitely
3. **Better error handling**: Log errors even if suppressing them
4. **Optimize for common case**: Fast path for existing messages

**Recommended Immediate Fix**: Implement Solution 1 (Check-Then-Watch Pattern) with 30-second timeout.
