#!/usr/bin/env bash

###############################################################################
# Await Mailbox - Block and wait for incoming messages
#
# Usage: await-mailbox.sh <agent-name>
#
# Registers the agent with the given name and blocks until a message arrives.
###############################################################################

set -euo pipefail

# Check for agent name parameter
if [ $# -lt 1 ]; then
  echo "❌ Error: Agent name required"
  echo "Usage: /await-mailbox \"Agent-Name\""
  exit 1
fi

AGENT_NAME="$1"
MAILBOXES_FILE=".claude/coordination/mailboxes.json"
LOG_FILE=".claude/coordination/hook-debug.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] await-mailbox.sh: Agent '$AGENT_NAME' waiting for messages" >> "$LOG_FILE"

# Initialize mailboxes.json if it doesn't exist or is empty
mkdir -p "$(dirname "$MAILBOXES_FILE")"
if [ ! -f "$MAILBOXES_FILE" ] || [ ! -s "$MAILBOXES_FILE" ]; then
  echo "{}" > "$MAILBOXES_FILE"
fi

# Add this agent to mailboxes.json (if not already registered)
jq --arg agent "$AGENT_NAME" \
  'if has($agent) then . else . + {($agent): []} end' \
  "$MAILBOXES_FILE" > "$MAILBOXES_FILE.tmp" && \
  mv "$MAILBOXES_FILE.tmp" "$MAILBOXES_FILE"

echo "✅ Registered as agent: $AGENT_NAME"
echo "🔔 Waiting for messages..."
echo ""

# Export for TypeScript to read via Config.string("AGENT_NAME")
export AGENT_NAME

# Run the TypeScript implementation - blocks until message received
exec bun run .claude/hooks/stop-await-mailbox.ts
