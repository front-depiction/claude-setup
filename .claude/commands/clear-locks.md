---
description: Clear file locks (select which ones)
---

Read `.claude/coordination/file-locks.json` and show all current locks.

Use the AskUserQuestion tool to present a multi-select list of all locked files, where each option shows:
- File path as the label
- Agent ID and acquired time as the description

Allow the user to select multiple locks to clear.

After the user selects:
1. Remove the selected locks from the JSON
2. Write the updated locks back to the file
3. Show which locks were cleared

If no locks exist, show "No active file locks to clear."

⚠️ Note: Normal lock cleanup happens automatically via SubagentStop/Stop hooks.
