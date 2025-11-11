#!/bin/bash
# Log input to file for debugging
INPUT=$(cat)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] skill-suggester.sh INPUT: $INPUT" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
echo "$INPUT" | bun run skill-suggester.ts
