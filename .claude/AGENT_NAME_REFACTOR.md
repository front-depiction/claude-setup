# Agent Mailbox System - Refactored to Use Agent Names

## Summary
Refactored the mailbox system from auto-generated PGID-based IDs to explicit agent names.

## Changes Made

### 1. `/await-mailbox` Command (`.claude/commands/await-mailbox.md`)
- **Old:** `/await-mailbox` (no parameters)
- **New:** `/await-mailbox "Agent-Name"` (requires agent name parameter)
- Now directly calls `await-mailbox.sh "$1"` instead of the wrapper
- Instructs agents to reuse the same name: `.claude/scripts/await-mailbox.sh "$1"`

### 2. Await Mailbox Script (`.claude/scripts/await-mailbox.sh`)
- **Old:** Auto-generated ID based on PGID (`agent-pgid-${_pgid}`)
- **New:** Accepts agent name as first parameter
- Validates that agent name is provided
- Exports `AGENT_NAME` environment variable (instead of `SESSION_ID`)
- Directly executes the TypeScript awaiter

### 3. TypeScript Awaiter (`.claude/hooks/stop-await-mailbox.ts`)
- **Old:** Read `SESSION_ID` from environment
- **New:** Read `AGENT_NAME` from environment
- Updated variable names from `sessionId` to `agentName`
- Updated debug messages to reflect agent names

### 4. Request Script (`.claude/scripts/request.sh`)
- **Old:** Sender auto-identified by PGID (`agent-pgid-${_pgid}`)
- **New:** Sender identified by `AGENT_NAME` env variable, defaults to "anonymous"
- Updated parameter names from `TARGET_AGENT_ID` to `TARGET_AGENT_NAME`
- Updated messages to use "agent name" terminology

### 5. Files Not Changed
- `.claude/scripts/mailboxes.sh` - Already works with any key names
- `.claude/scripts/close-mailbox.sh` - Still uses flag-based approach

## Removed Components
- `.claude/scripts/await-mailbox-wrapper.sh` - No longer needed, functionality moved to `await-mailbox.sh`

## Usage Examples

### Agent Registration
```bash
/await-mailbox "Agent-Bob"
```

### Sending Messages
```bash
/request "Agent-Bob" "Please review the authentication code"
```

### Agent Responding to Messages
When Agent-Bob receives a message, they should run:
```bash
.claude/scripts/await-mailbox.sh "Agent-Bob"
```

## Benefits
1. **Human-readable IDs:** "Agent-Bob" instead of "agent-pgid-12345"
2. **Simpler architecture:** No wrapper script needed
3. **Explicit identity:** Agents explicitly choose their name
4. **Better UX:** Easier to understand who sent what message
5. **Persistent identity:** Agent name can be reused across sessions
