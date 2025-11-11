# Hook System Testing Guide

## What We've Built

### 1. Complete Hook System with Effect TypeScript

All hooks are implemented using Effect TypeScript with:
- ✅ **Zero try-catch blocks** - Pure Effect error handling
- ✅ **Schema validation** - All inputs validated with @effect/schema
- ✅ **Record/Array modules** - Functional operations on collections
- ✅ **Tagged errors** - Type-safe error handling
- ✅ **Service layers** - Proper dependency injection
- ✅ **Schema.parseJson** - Combined JSON parsing + validation

### 2. File Locking System

**Prevents concurrent modifications by different agents**

- Locks acquired in `file-lock-enforcer.ts` (PreToolUse hook)
- Locks tracked in `file-lock-tracker.ts` (PostToolUse hook)
- Locks released in `agent-cleanup.ts` (SubagentStop/Stop hooks)
- Only applies to TypeScript files (.ts, .tsx)
- Same agent can edit multiple times (re-entry allowed)
- Different agents are blocked with helpful error message

**Verified working** ✅
```bash
Agent "different-agent-123" → Acquires lock ✅
Agent "blocked-agent-456"   → DENIED ❌
Agent "different-agent-123" → Allowed (same agent) ✅
```

### 3. Comprehensive Logging

- All hooks log their input to `.claude/coordination/hook-debug.log`
- Timestamps on all log entries
- Easy to debug hook execution flow

### 4. Documentation

- `TOOL_REFERENCE.txt` - Complete list of all Claude Code tools with schemas
- `HOOK_FLOW.md` - Visual flow diagram and detailed hook documentation
- `TESTING.md` - This file

## Current State

### ✅ Working
1. File locking for TypeScript files
2. Lock acquisition/release cycle
3. Cross-agent conflict prevention
4. Agent cleanup on SubagentStop
5. All TypeScript code typechecks with zero errors
6. Debug logging from individual hooks

### ⚠️ To Test
1. **tool-logger.sh default hook** - Should log ALL tool usage but currently not triggering
2. **Task tool in hooks** - Task is a tool and should trigger PreToolUse/PostToolUse
3. **Stop hook** - Fixed timeout issue, needs testing

## How to Test

### Test 1: Verify Settings Loaded

After restarting session, check if tool-logger runs:

```bash
# Clear log
echo "=== Test Session $(date) ===" > .claude/coordination/hook-debug.log

# Create or edit any file
# Expected: See "TOOL-LOGGER:" entries in hook-debug.log

grep "TOOL-LOGGER" .claude/coordination/hook-debug.log
```

### Test 2: Verify Task Tool Triggers Hooks

```bash
# Spawn a subagent
# Expected: See tool_name":"Task" in log

grep '"tool_name":"Task"' .claude/coordination/hook-debug.log
```

### Test 3: Verify Cross-Agent Locking

```bash
# In one session, edit a TypeScript file
# In another session, try to edit same file
# Expected: Second session gets DENIED

# Check locks
cat .claude/coordination/file-locks.json | jq
```

### Test 4: Verify SubagentStop Releases Locks

```bash
# Before spawning agent
cat .claude/coordination/file-locks.json

# Spawn agent that edits TypeScript files
# Task spawns with subagent_type: effect-expert

# After agent completes
cat .claude/coordination/file-locks.json
# Expected: Locks released
```

### Test 5: Verify Stop Hook Doesn't Error

```bash
# End session normally
# Expected: No "Stop hook error" message
# Expected: Locks released

cat .claude/coordination/file-locks.json
# Expected: Empty or no locks for this agent
```

## Manual Testing Commands

### Check Current Lock State
```bash
cat .claude/coordination/file-locks.json | jq
```

### View Recent Hook Activity
```bash
tail -20 .claude/coordination/hook-debug.log
```

### Test File Lock Enforcer Manually
```bash
echo '{"session_id":"test","transcript_path":"/test","cwd":"'$(pwd)'","permission_mode":"acceptEdits","hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"'$(pwd)'/test.ts"}}' | \
AGENT_ID="test-agent-123" \
bun run .claude/hooks/file-lock-enforcer.ts
```

### Test Agent Cleanup Manually
```bash
AGENT_ID="test-agent" \
CLAUDE_PROJECT_DIR="$(pwd)" \
.claude/hooks/agent-cleanup.sh
```

### Watch Logs in Real-Time
```bash
tail -f .claude/coordination/hook-debug.log
```

## Known Issues

### Issue 1: tool-logger.sh not triggering
**Status**: Configuration added but not yet tested in live session
**Cause**: Settings.json changes require session restart
**Test**: Restart session and verify TOOL-LOGGER entries appear

### Issue 2: Task tool not logged
**Status**: Unknown if Task triggers PreToolUse hooks
**Expected**: Task should appear in tool_name field
**Test**: Spawn subagent and check for Task in logs

### Issue 3: Stop hook timeout (FIXED)
**Status**: Fixed with timeout command
**Change**: `INPUT=$(timeout 0.1 cat 2>/dev/null || echo "(no input)")`
**Test**: Verify Stop hook completes without error

## Files Modified

### Hook Scripts
- `.claude/hooks/agent-cleanup.ts` - Uses Record.filter, Record.size, Schema.parseJson
- `.claude/hooks/file-lock-enforcer.ts` - Updated schema with session context
- `.claude/hooks/file-lock-tracker.ts` - Updated schema with session context
- `.claude/hooks/skill-suggester.ts` - Updated schema with session context
- `.claude/hooks/agent-init.ts` - Fixed layer composition, simplified error handling
- `.claude/hooks/schemas.ts` - Corrected all schemas to match actual input format
- `.claude/hooks/agent-cleanup.sh` - Added timeout for stdin read
- `.claude/hooks/tool-logger.sh` - NEW: Logs all tool usage

### Configuration
- `.claude/settings.json` - Added default tool-logger hooks to PreToolUse/PostToolUse

### Documentation
- `.claude/TOOL_REFERENCE.txt` - NEW: Complete tool reference
- `.claude/HOOK_FLOW.md` - NEW: Hook execution flow diagram
- `.claude/TESTING.md` - NEW: This file

## Next Steps

1. **Restart Session** - To load new settings.json configuration
2. **Run Test Suite** - Execute all tests listed above
3. **Verify Logs** - Confirm TOOL-LOGGER entries appear for all tools
4. **Test Task Tool** - Spawn subagents and verify hooks trigger
5. **Document Results** - Update this file with test results
