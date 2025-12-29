---
name: observability-expert
description: Design observability strategy centered on wide events (canonical log lines) that capture high-dimensional context per request. Covers span instrumentation via Effect.annotateCurrentSpan, tracing layer composition, tail sampling strategies, and structured queryability. Use when adding observability to services, designing telemetry architecture, debugging production issues, or optimizing trace retention policies.
tools: Read, Write, Edit, Grep, Glob
---

**Related skills:** wide-events, layer-design, error-handling

## Core Principle

```haskell
observe :: Effect a -> Effect a
observe effect = do
  span <- startSpan effect
  annotate span (contextDimensions effect)
  result <- run effect
  annotate span (resultDimensions result)
  endSpan span
  pure result

-- wide events: one event per request with all dimensions
-- not: many small events scattered across code
```

## Philosophy

```
traditional := many(log-lines) -> grep(services) -> hope
wide        := one(event) -> query(structured) -> answer

optimize(querying) and not optimize(writing)
```

## Wide Events (Canonical Log Lines)

A wide event is a single comprehensive record per request containing all relevant context. This replaces scattered `console.log` statements with one queryable event.

### Event Dimensionality

```
wide-event.fields := {
  identity:    {traceId, spanId, service, operation}
  user:        {userId, accountTier, accountAge, lifetimeValue}
  business:    {featureFlags, experimentGroup, cartValue}
  performance: {durationMs, dbQueryCount, cacheHitRate, retryCount}
  outcome:     {success, errorCode, httpStatus}
}

high-dimensionality -> better-queryability
high-cardinality(userId) -> acceptable
```

### Anti-Patterns

```
scattered-logs     := console.log("step1") >> console.log("step2") >> ...
low-dimensionality := span.set("success", true) and |fields| < 5
technical-only     := {http.status, db.queries} and not {user, business}
```

## Instrumentation Patterns

### Annotating Spans with Business Context

```typescript
import { Effect } from "effect"

const processOrder = (order: Order) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("order.id", order.id)
    yield* Effect.annotateCurrentSpan("order.total", order.total)
    yield* Effect.annotateCurrentSpan("order.items.count", order.items.length)
    yield* Effect.annotateCurrentSpan("customer.id", order.customer.id)
    yield* Effect.annotateCurrentSpan("customer.tier", order.customer.tier)
    yield* Effect.annotateCurrentSpan("feature.new_checkout", order.featureFlags.newCheckout)

    const result = yield* executeOrder(order)

    yield* Effect.annotateCurrentSpan("outcome.success", result.success)
    yield* Effect.annotateCurrentSpan("outcome.paymentMethod", result.paymentMethod)

    return result
  })
```

### Wrapping Operations with Spans

```typescript
import { Effect } from "effect"

const checkout = (cart: Cart) =>
  Effect.gen(function* () {
    const user = yield* CurrentUser

    return yield* pipe(
      processCheckout(cart),
      Effect.withSpan("checkout", {
        attributes: {
          "cart.id": cart.id,
          "cart.value": cart.total,
          "cart.items": cart.items.length,
          "user.id": user.id,
          "user.tier": user.tier,
        }
      })
    )
  })
```

### Annotating Logs for Structured Context

```typescript
import { Effect } from "effect"

const handleRequest = (request: Request) =>
  pipe(
    processRequest(request),
    Effect.annotateLogs("request.id", request.id),
    Effect.annotateLogs("request.path", request.path),
    Effect.annotateLogs("user.id", request.userId),
  )
```

## Layer-Based Tracing

### Tracer Provider Layer

```typescript
import { Effect, Layer } from "effect"
import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"

const TracingLive = NodeSdk.layer(() => ({
  resource: {
    serviceName: "my-service",
    serviceVersion: "1.0.0",
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({ url: "http://localhost:4318/v1/traces" })
  ),
}))
```

### Composing with Application Layers

```typescript
import { Layer } from "effect"

const ApplicationLive = Layer.mergeAll(
  ServiceALive,
  ServiceBLive,
  ServiceCLive
).pipe(
  Layer.provide(TracingLive)
)
```

## Tail Sampling Strategy

```
retain(100%) := errors or slow(>p99) or vip
retain(1-5%) := success and fast
```

### Implementation Guidance

```typescript
const shouldRetain = (span: Span): boolean =>
  span.status === "ERROR" ||
  span.duration > p99Threshold ||
  span.attributes["user.tier"] === "enterprise"
```

## Queryability Test

Before instrumenting, verify these questions are answerable:

```
"failures where tier=premium and feature.new_flow=true"
"p99(latency) group by tier"
"errors group by featureFlags"
"full context for user X incident"
```

If a question cannot be answered, the span lacks sufficient context.

## Error Instrumentation

Errors should carry full debugging context:

```typescript
import { Data, Effect } from "effect"

export class PaymentError extends Data.TaggedError("PaymentError")<{
  readonly reason: string
  readonly orderId: string
  readonly amount: number
  readonly paymentMethod: string
  readonly cause?: unknown
}> {}

const processPayment = (order: Order) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan("payment.orderId", order.id)
    yield* Effect.annotateCurrentSpan("payment.amount", order.total)
    yield* Effect.annotateCurrentSpan("payment.method", order.paymentMethod)

    const result = yield* attemptPayment(order).pipe(
      Effect.mapError((cause) => new PaymentError({
        reason: "Payment processing failed",
        orderId: order.id,
        amount: order.total,
        paymentMethod: order.paymentMethod,
        cause,
      }))
    )

    yield* Effect.annotateCurrentSpan("payment.success", true)
    yield* Effect.annotateCurrentSpan("payment.transactionId", result.transactionId)

    return result
  })
```

## Terminology Reference

| Term | Definition |
|------|------------|
| Cardinality | Number of unique values a field can contain (userId=high, httpMethod=low) |
| Dimensionality | Number of fields per event (more fields = better queryability) |
| Wide Event | Canonical log line - one comprehensive record per request |
| Span Annotation | Adding context attributes to a tracing span |
| Tail Sampling | Deciding which completed traces to retain based on their content |

## Quality Checklist

Before completing instrumentation:
- [ ] Events have high dimensionality (identity + user + business + performance + outcome)
- [ ] Span annotations capture business context, not just technical details
- [ ] High-cardinality fields (userId, orderId) are included
- [ ] Errors include full context for debugging without code inspection
- [ ] Sampling strategy defined for high-volume paths
- [ ] Queryability test passes for expected debugging questions
- [ ] Layers properly compose tracing with application services
