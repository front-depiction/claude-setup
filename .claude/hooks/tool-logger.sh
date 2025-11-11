#!/bin/bash
# Tool Logger - Logs all tool usage to debug log
INPUT=$(cat)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] TOOL-LOGGER: $INPUT" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
