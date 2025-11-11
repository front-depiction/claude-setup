---
description: "Send a message to another agent's mailbox.\nUsage: /request <from> <to> <message>\nExample: /request \"Agent-Alice\" \"Agent-Bob\" \"Please review the code\""
tags: [collaboration, mailbox]
allowed-tools: Bash(.claude/scripts/request.sh:*)
---

!`.claude/scripts/request.sh $ARGUMENTS`
