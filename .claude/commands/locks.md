---
description: Show all current file locks
run_without_approval: true
---

```bash
#!/bin/bash

LOCKS_FILE=".claude/coordination/file-locks.json"

if [ ! -f "$LOCKS_FILE" ]; then
  echo "No locks file found."
  exit 0
fi

CONTENT=$(cat "$LOCKS_FILE")

# Check if empty or just {}
if [ "$CONTENT" = "{}" ] || [ -z "$CONTENT" ]; then
  echo "No active file locks."
  exit 0
fi

echo "=== Current File Locks ==="
echo ""
cat "$LOCKS_FILE" | jq -r '
  to_entries |
  if length == 0 then
    "No active file locks."
  else
    "Total locks: \(length)\n" +
    (map("
File: \(.key)
  Agent ID: \(.value.agentId)
  Acquired: \(.value.acquiredAt)
  Modified: \(.value.lastModified)
") | join("\n"))
  end
'
```
