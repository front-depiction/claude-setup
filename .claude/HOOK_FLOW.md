# Claude Code Hook Flow

This document describes the complete hook execution flow in this project.

## Hook Execution Order

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SESSION START                                                 │
│    ↓ SessionStart hook runs                                     │
│    • agent-init.sh                                               │
│      - Generates AGENT_ID                                        │
│      - Exports to environment                                    │
│      - Captures project structure                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. USER SUBMITS PROMPT                                           │
│    ↓ UserPromptSubmit hook runs                                 │
│    • skill-suggester.sh                                          │
│      - Analyzes prompt for keywords                              │
│      - Suggests relevant Effect TS skills                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. CLAUDE USES TOOLS                                             │
│    ↓ PreToolUse hook runs BEFORE each tool                      │
│    • tool-logger.sh (all tools)                                  │
│      - Logs tool name and input to debug log                    │
│    • file-lock-enforcer.sh (Edit|Write only)                    │
│      - Checks if file is locked by another agent                │
│      - Acquires lock if available                                │
│      - DENIES operation if locked by different agent             │
│                                                                   │
│    ↓ TOOL EXECUTES (Write, Edit, Task, Read, etc.)             │
│                                                                   │
│    ↓ PostToolUse hook runs AFTER each tool                      │
│    • tool-logger.sh (all tools)                                  │
│      - Logs tool result to debug log                            │
│    • file-lock-tracker.sh (Edit|Write only)                     │
│      - Updates lastModified timestamp on owned locks             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        │                                             │
   If Task tool                                 If Edit/Write/etc.
        │                                             │
        ↓                                             ↓
┌──────────────────┐                    ┌──────────────────────┐
│ SUBAGENT SPAWNED │                    │ FILE OPERATION       │
│                  │                    │                      │
│ • Inherits       │                    │ • File modified      │
│   AGENT_ID from  │                    │ • Lock held by       │
│   parent         │                    │   current agent      │
│ • Runs in same   │                    └──────────────────────┘
│   session        │
└──────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. SUBAGENT COMPLETES                                            │
│    ↓ SubagentStop hook runs                                     │
│    • agent-cleanup.sh                                            │
│      - Reads file-locks.json                                     │
│      - Releases ALL locks held by this AGENT_ID                  │
│      - Writes updated locks back                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. SESSION ENDS                                                  │
│    ↓ Stop hook runs                                             │
│    • agent-cleanup.sh                                            │
│      - Same as SubagentStop                                      │
│      - Releases all locks held by this agent                     │
└─────────────────────────────────────────────────────────────────┘
```

## Hook Input Schemas

### SessionStart
No input (empty stdin)

### UserPromptSubmit
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "permission_mode": "string",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "string"
}
```

### PreToolUse / PostToolUse
```json
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "permission_mode": "string",
  "hook_event_name": "PreToolUse" | "PostToolUse",
  "tool_name": "string",
  "tool_input": {
    // Varies by tool
    "file_path"?: "string",
    "notebook_path"?: "string",
    // ... other tool-specific fields
  },
  "tool_response"?: {
    // Only in PostToolUse
    // Contains tool output
  }
}
```

### SubagentStop / Stop
No input (empty stdin)

## File Locking Strategy

### Lock Acquisition (PreToolUse)
1. Check if tool is Edit/Write/NotebookEdit
2. Check if file is TypeScript (.ts/.tsx) - **ONLY TS files are locked**
3. Read file-locks.json
4. If file is locked by **different** AGENT_ID → **DENY**
5. If file is locked by **same** AGENT_ID → **ALLOW** (re-entry)
6. If file is not locked → **ACQUIRE** lock and **ALLOW**

### Lock Tracking (PostToolUse)
1. Check if this agent owns the lock
2. If yes, update `lastModified` timestamp
3. Write back to file-locks.json

### Lock Release (SubagentStop/Stop)
1. Read file-locks.json
2. Filter out all locks where `agentId === $AGENT_ID`
3. Write filtered locks back
4. Log number of locks released

## Key Design Decisions

### 1. ⚠️ CRITICAL ISSUE: Subagent AGENT_ID Inheritance
**CURRENT BEHAVIOR (BROKEN):** Subagents spawned with Task tool inherit parent AGENT_ID, allowing them all to edit the same files simultaneously. This **defeats the entire purpose** of the locking system!

**REQUIRED BEHAVIOR:** Each subagent should get a **unique AGENT_ID** to enable proper conflict prevention between parallel subagents.

**STATUS:** See `CRITICAL_ISSUE_AGENT_IDS.md` for detailed analysis and proposed solutions.

### 2. Only TypeScript Files Are Locked
Non-TS files (txt, md, json, etc.) are not locked. This is controlled by `isTypeScriptFile()` function in file-lock-enforcer.ts.

### 3. Hooks Run Sequentially
Multiple hooks in same event run in order:
- PreToolUse: tool-logger.sh → file-lock-enforcer.sh
- PostToolUse: tool-logger.sh → file-lock-tracker.sh

### 4. Agent Cleanup is Idempotent
agent-cleanup.sh can run multiple times safely - it only releases locks owned by current AGENT_ID.

## Files in Hook System

```
.claude/
├── hooks/
│   ├── agent-init.sh              → SessionStart wrapper
│   ├── agent-init.ts              → TS implementation
│   ├── skill-suggester.sh         → UserPromptSubmit wrapper
│   ├── skill-suggester.ts         → TS implementation
│   ├── tool-logger.sh             → Logs all tool usage
│   ├── file-lock-enforcer.sh      → PreToolUse wrapper
│   ├── file-lock-enforcer.ts      → Lock enforcement logic
│   ├── file-lock-tracker.sh       → PostToolUse wrapper
│   ├── file-lock-tracker.ts       → Lock timestamp updates
│   ├── agent-cleanup.sh           → Stop/SubagentStop wrapper
│   ├── agent-cleanup.ts           → Lock release logic
│   └── schemas.ts                 → Shared TypeScript schemas
├── coordination/
│   ├── file-locks.json            → Lock state (agentId, timestamps)
│   └── hook-debug.log             → Debug output from all hooks
└── settings.json                  → Hook configuration

```

## Debugging Hooks

All hooks log to `.claude/coordination/hook-debug.log` with timestamps:

```bash
# View recent hook activity
tail -f .claude/coordination/hook-debug.log

# Search for specific tool
grep "tool_name\":\"Task" .claude/coordination/hook-debug.log

# Check file lock state
cat .claude/coordination/file-locks.json | jq
```

## Common Issues

### Issue: Stop hook error with no stderr
**Cause**: agent-cleanup.sh tries to read stdin but Stop hook doesn't provide any input
**Solution**: Change `INPUT=$(cat)` to `INPUT=$(cat || echo "")` to handle empty stdin gracefully

### Issue: Task tool doesn't trigger PreToolUse hook
**Cause**: Task IS a tool and should trigger the hook
**Expected**: PreToolUse should log Task tool usage
**Check**: Look for `tool_name":"Task` in hook-debug.log

### Issue: Locks not released after subagent completes
**Cause**: SubagentStop hook not running or AGENT_ID mismatch
**Debug**: Check if hook-debug.log shows agent-cleanup.sh running with correct AGENT_ID
