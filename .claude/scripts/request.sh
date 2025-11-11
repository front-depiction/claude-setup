#!/usr/bin/env bash

###############################################################################
# Send Request to Agent Mailbox
#
# Usage: request.sh <from-agent> <to-agent> <message>
#
# Appends a request to the target agent's mailbox.
###############################################################################

set -euo pipefail

# Check arguments
if [ $# -lt 3 ]; then
  echo "Error: Missing required arguments"
  echo "Usage: /request <from> <to> <message>"
  exit 1
fi

FROM_AGENT="$1"
TARGET_AGENT_NAME="$2"
shift 2
MESSAGE="$*"

MAILBOX_FILE=".claude/coordination/mailboxes.json"

# Initialize mailboxes.json if it doesn't exist
if [ ! -f "$MAILBOX_FILE" ]; then
  mkdir -p "$(dirname "$MAILBOX_FILE")"
  echo "{}" > "$MAILBOX_FILE"
fi

# Create request object with sender agent name
REQUEST=$(jq -n \
  --arg from "$FROM_AGENT" \
  --arg msg "$MESSAGE" \
  --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '{from: $from, message: $msg, timestamp: $ts}')

# Append to target agent's mailbox
jq --arg agent "$TARGET_AGENT_NAME" --argjson req "$REQUEST" \
  '.[$agent] = (.[$agent] // []) + [$req]' \
  "$MAILBOX_FILE" > "$MAILBOX_FILE.tmp" && mv "$MAILBOX_FILE.tmp" "$MAILBOX_FILE"

echo ""
echo "✉️  Request sent to agent: $TARGET_AGENT_NAME"
echo "   From: $FROM_AGENT"
echo "   Message: \"$MESSAGE\""
echo ""
echo "The agent will see this message when they run /await-mailbox."
