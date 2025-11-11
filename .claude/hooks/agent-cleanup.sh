#!/bin/bash
#
# Agent Cleanup Stop Hook - Bash Wrapper
#
# This script wraps the TypeScript implementation and ensures
# the environment is properly set up before running the cleanup.
#

set -euo pipefail

# Ensure CLAUDE_PROJECT_DIR is set
if [ -z "${CLAUDE_PROJECT_DIR:-}" ]; then
  echo "Error: CLAUDE_PROJECT_DIR environment variable is not set"
  exit 1
fi

# Read stdin (Stop hook provides session_id in JSON)
INPUT=$(cat 2>/dev/null || echo "{}")

# Log input to file for debugging
echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-cleanup.sh INPUT: $INPUT" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"

# Extract session_id from input (for hooks)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# If AGENT_ID not already set, try multiple sources
if [ -z "${AGENT_ID:-}" ]; then
  # Try LaunchInstanceID first (stable per terminal session)
  if [ -n "${LaunchInstanceID:-}" ]; then
    export AGENT_ID="$LaunchInstanceID"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-cleanup.sh: Using LaunchInstanceID as AGENT_ID: $AGENT_ID" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
  elif [ -n "$SESSION_ID" ]; then
    export AGENT_ID="$SESSION_ID"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-cleanup.sh: Using session_id as AGENT_ID: $AGENT_ID" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
  else
    # No ID available, skip cleanup (likely no locks to release)
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")] agent-cleanup.sh: No AGENT_ID available, skipping cleanup" >> "$CLAUDE_PROJECT_DIR/.claude/coordination/hook-debug.log"
    exit 0
  fi
fi

# Change to hooks directory
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"

# Run the TypeScript implementation using bun
# Using bun directly instead of npx tsx for better performance
exec bun run agent-cleanup.ts
