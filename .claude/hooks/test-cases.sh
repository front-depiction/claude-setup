#!/bin/bash

echo "Test 1: atom-state"
echo '{"prompt":"I need help with atom state management"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 2: service-implementation"
echo '{"prompt":"How do I create a service?"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 3: layer-design"
echo '{"prompt":"Set up dependency injection with Layer"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 4: domain-predicates"
echo '{"prompt":"Help with predicates and order"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 5: typeclass-design"
echo '{"prompt":"Explain typeclass patterns"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 6: context-witness"
echo '{"prompt":"Using context and witness pattern"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 7: Multiple matches"
echo '{"prompt":"ATOM state with SERVICE capability"}' | npx tsx skill-suggester.ts
echo ""

echo "Test 8: No matches (silent)"
echo '{"prompt":"Hello world"}' | npx tsx skill-suggester.ts
echo "(no output expected)"
echo ""

echo "Test 9: Invalid JSON (silent error)"
echo 'bad json' | npx tsx skill-suggester.ts 2>/dev/null
echo "(no output expected)"
