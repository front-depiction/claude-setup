#!/bin/bash

echo "=== Testing Skill Suggester Hook ==="
echo ""

echo "Test 1: atom-state keywords"
echo '{"prompt":"I need help with atom state management in React"}' | bun run skill-suggester.ts
echo ""

echo "Test 2: service-implementation keywords"
echo '{"prompt":"How do I implement a service with capability pattern?"}' | bun run skill-suggester.ts
echo ""

echo "Test 3: layer-design keywords (including 'injection')"
echo '{"prompt":"Help me with dependency injection and DI"}' | bun run skill-suggester.ts
echo ""

echo "Test 4: domain-predicates keywords"
echo '{"prompt":"Creating predicates for order and equivalence"}' | bun run skill-suggester.ts
echo ""

echo "Test 5: typeclass-design keywords"
echo '{"prompt":"Need to design a typeclass"}' | bun run skill-suggester.ts
echo ""

echo "Test 6: context-witness keywords"
echo '{"prompt":"Using context and witness patterns"}' | bun run skill-suggester.ts
echo ""

echo "Test 7: Multiple matches"
echo '{"prompt":"I need atom state, service capability, and layer dependency injection"}' | bun run skill-suggester.ts
echo ""

echo "Test 8: No matches (should be silent)"
echo '{"prompt":"Just some random text"}' | bun run skill-suggester.ts
echo "(No output expected above)"
echo ""

echo "Test 9: Case insensitive"
echo '{"prompt":"ATOM STATE REACT"}' | bun run skill-suggester.ts
echo ""

echo "=== All tests complete ==="
