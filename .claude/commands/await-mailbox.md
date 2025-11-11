---
description: "Wait for incoming messages from other agents (blocks until message received) Usage: `/await-mailbox Agent-Name - Replace Agent-Name with your chosen agent identifier."
tags: [collaboration, mailbox]
allowed-tools: Bash(.claude/scripts/await-mailbox.sh:*)
---

**Block and wait for messages from other agents.**

This command will pause execution until a message arrives in your mailbox. ( This may lead to the task being moved to a background task )
When a message is received, you'll see it and can respond.



Other agents can send you messages with: `/request "Agent-Name" <message>`

!`.claude/scripts/await-mailbox.sh $ARGUMENTS`

**Your agent name is: $1**

Above you find the last message you have received. Answer it by running /request $1 <to-name> "My propperly escaped message", then run `.claude/scripts/await-mailbox.sh <your-name> again manually to wait for the next messages. It is imperative you do this last step to avoid losing messages.

Remember: Always use the same agent name "$1" when running the script again.