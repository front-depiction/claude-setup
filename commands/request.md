---
description: "Send a message to another agent's mailbox.\nUsage: /request <from> <to> <message>\nExample: /request \"Agent-Alice\" \"Agent-Bob\" \"Please review the code\""
allowed-tools: Bash(.claude/scripts/request.sh:*)
argument-hint: [from] [to] [escaped-message]
---

!`.claude/scripts/request.sh $ARGUMENTS`
