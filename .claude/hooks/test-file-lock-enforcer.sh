#!/usr/bin/env bash

###############################################################################
# Test Script for File Lock Enforcer
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_FILE="/tmp/test-lock-$(date +%s).ts"

echo "Testing File Lock Enforcer..."
echo "=============================="
echo ""

# Test 1: First agent acquires lock
echo "Test 1: Agent A acquires lock on new file"
export AGENT_ID="agent-A"
echo '{"tool":"Write","file_path":"'${TEST_FILE}'"}' | "${SCRIPT_DIR}/file-lock-enforcer.sh"
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "✓ PASS: Agent A acquired lock (exit code: $RESULT)"
else
    echo "✗ FAIL: Expected exit code 0, got $RESULT"
fi
echo ""

# Test 2: Same agent tries again (should succeed)
echo "Test 2: Agent A tries to write again (same agent)"
export AGENT_ID="agent-A"
echo '{"tool":"Write","file_path":"'${TEST_FILE}'"}' | "${SCRIPT_DIR}/file-lock-enforcer.sh"
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "✓ PASS: Agent A allowed (exit code: $RESULT)"
else
    echo "✗ FAIL: Expected exit code 0, got $RESULT"
fi
echo ""

# Test 3: Different agent tries to write (should fail)
echo "Test 3: Agent B tries to write (different agent)"
export AGENT_ID="agent-B"
OUTPUT=$(echo '{"tool":"Write","file_path":"'${TEST_FILE}'"}' | "${SCRIPT_DIR}/file-lock-enforcer.sh" 2>&1) || RESULT=$?
if [ $RESULT -eq 2 ]; then
    echo "✓ PASS: Agent B denied (exit code: $RESULT)"
    echo "  Response: $OUTPUT"
else
    echo "✗ FAIL: Expected exit code 2, got $RESULT"
fi
echo ""

# Test 4: Read operation (should always succeed)
echo "Test 4: Agent B tries to read (should be allowed)"
export AGENT_ID="agent-B"
echo '{"tool":"Read","file_path":"'${TEST_FILE}'"}' | "${SCRIPT_DIR}/file-lock-enforcer.sh"
RESULT=$?
if [ $RESULT -eq 0 ]; then
    echo "✓ PASS: Read operation allowed (exit code: $RESULT)"
else
    echo "✗ FAIL: Expected exit code 0 for read operation, got $RESULT"
fi
echo ""

# Cleanup
echo "Cleaning up test file..."
rm -f "${TEST_FILE}"

echo "=============================="
echo "Tests complete!"
