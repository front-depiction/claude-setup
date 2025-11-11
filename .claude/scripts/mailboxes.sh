#!/usr/bin/env bash

MAILBOXES_FILE=".claude/coordination/mailboxes.json"

if [ ! -f "$MAILBOXES_FILE" ]; then
  echo "No mailboxes file found."
  exit 0
fi

CONTENT=$(cat "$MAILBOXES_FILE")

# Check if empty or just {}
if [ "$CONTENT" = "{}" ] || [ -z "$CONTENT" ]; then
  echo "No pending mailbox requests."
  exit 0
fi

echo "=== Agent Mailboxes ==="
echo ""
cat "$MAILBOXES_FILE" | jq -r '
  to_entries |
  if length == 0 then
    "No pending mailbox requests."
  else
    "Total agents with pending messages: \(length)\n" +
    (map("
Agent: \(.key)
  Pending requests: \(.value | length)
\(.value | map(
    if type == "object" then
      "    - From: \(.from)\n      Message: \"\(.message)\"\n      Time: \(.timestamp)"
    else
      "    - Message: \"\(. | tostring)\""
    end
  ) | join("\n"))
") | join("\n"))
  end
'
