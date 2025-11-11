#!/usr/bin/env bash

MAILBOXES_FILE=".claude/coordination/mailboxes.json"

# Initialize if doesn't exist
if [ ! -f "$MAILBOXES_FILE" ]; then
  echo "{}" > "$MAILBOXES_FILE"
fi

# Add special flag for Stop hook to disable this session
jq '. + {"__disable_next__": true}' "$MAILBOXES_FILE" > "$MAILBOXES_FILE.tmp" && \
  mv "$MAILBOXES_FILE.tmp" "$MAILBOXES_FILE"

echo "❌ Collaboration mode disabled"
echo "📡 On next Stop, this session will be removed from mailboxes"
echo ""
echo "Use /await-mailbox to enable"
