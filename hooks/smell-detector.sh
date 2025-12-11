#!/bin/bash
#
# PostToolUse Hook - Code Smell Detector Wrapper
#
# This bash script wraps the Effect TypeScript implementation
# and is called by Claude after using Edit/Write tools to detect code smells.
#

set -e  # Exit on error

# Capture input and change to hooks directory
INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"

# Execute the TypeScript implementation using Bun, passing the captured input
echo "$INPUT" | bun run smell-detector.ts
