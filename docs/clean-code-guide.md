# The Ultimate Clean Code Guide

## Introduction

This guide establishes uncompromising standards for writing clean, maintainable, and type-safe code. Every principle herein serves a singular purpose: to create software that accurately models reality while remaining comprehensible, testable, and resilient to change.

---

## Part I: Type Definitions

### Core Principle: Types as Domain Models

Types are not mere data containers. They are precise specifications of what can exist in your system. Every type definition is a contract that enforces correctness at compile time rather than runtime.

### Why Algebraic Data Types (ADTs)

ADTs are the foundation of type-safe programming because they:

1. **Reflect Reality with Precision**: A `Weekday` is not a string—it is exactly one of seven possible values: `"Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"`. No more, no less.

2. **Make Invalid States Unrepresentable**: When a payment can be `"pending" | "completed" | "failed"`, it becomes impossible to accidentally set it to `"procssing"` (typo) or `"archived"` (invalid state).

3. **Enable Exhaustive Pattern Matching**: The compiler guarantees you handle every possible case, eliminating entire categories of runtime errors.

### How to Structure Type Modules

#### Module Organization

Each type lives in its own module file. This module encapsulates:

- The type definition
- All operations on that type
- All transformations of that type
- All validations for that type

#### Mandatory Module Exports

Every type module MUST provide:

1. **Type Definition**: The core type, precisely defined
2. **Constructors**: Type-safe creation functions
3. **Guards**: Runtime validation functions
4. **Equivalence**: Structural equality checking
5. **Validators**: For serialization/deserialization (e.g., Convex validators)

#### Conditional Module Exports

Include these when semantically appropriate:

- **Identity Values**: `zero`, `empty`, `unit` when meaningful
- **Combinators**: Functions that combine values (e.g., `min`, `max`, `combine`)
- **Folds**: Reduction operations over collections
- **Destructors**: Safe extraction of inner values
- **Lenses/Optics**: Immutable update operations via setters

### Implementation Patterns

#### Immutability by Default

```typescript
// WRONG: Mutable by default
interface LineItem {
  itemId: string;
  price: number;
}

// CORRECT: Immutable with precise types
interface LineItem<
  A extends Cents.Cents = Cents.Cents,
  C extends Currency.Currency = Currency.Currency,
> {
  readonly itemId: Id<"items">;
  readonly cartId: Id<"carts">;
  readonly price: Priceable.Price<A, C>;
  readonly notes?: string;
}
```

#### Namespace Imports for Clarity

Import type modules as namespaces to maintain clear boundaries:

```typescript
// WRONG: Cherry-picking imports loses context
import { make, zero, add } from "./Cents";

// CORRECT: Namespace preserves context
import * as Cents from "./Cents";

const price = Cents.make(1299n);
const free = Cents.zero;
const total = Cents.add(price, tax);
```

#### Complete Type Module Example

```typescript
/**
 * Cents type for representing monetary amounts.
 *
 * @since 0.1.0
 * @module
 */

import { dual } from "effect/Function";
import * as Equivalence from "effect/Equivalence";

// Type Definition
export type Cents = bigint & { readonly _tag: "Cents" };

// Constructor
export const make = (amount: bigint): Cents => {
  if (amount < 0n) {
    throw new Error("Cents cannot be negative");
  }
  return amount as Cents;
};

// Guard
export const isCents = (value: unknown): value is Cents =>
  typeof value === "bigint" && value >= 0n;

// Identity Value
export const zero: Cents = make(0n);

// Equivalence
export const Equivalence = Equivalence.bigint;

// Combinator Operations
export const add: {
  (that: Cents): (self: Cents) => Cents;
  (self: Cents, that: Cents): Cents;
} = dual(2, (self: Cents, that: Cents): Cents => make(self + that));

export const multiply: {
  (factor: bigint): (self: Cents) => Cents;
  (self: Cents, factor: bigint): Cents;
} = dual(2, (self: Cents, factor: bigint): Cents => make(self * factor));

// Predicates
export const isZero = (cents: Cents): boolean => cents === 0n;

// Destructors
export const toBigInt = (cents: Cents): bigint => cents;
```

### Type Composition Patterns

#### Using TypeLambdas for Higher-Kinded Types

When creating types that work with type classes, use TypeLambdas:

```typescript
export interface LineItemTypeLambda extends Priceable.TypeLambda {
  readonly type: LineItem<this["Target"], this["In"]>;
}

export const Priceable: Priceable.Priceable<LineItemTypeLambda> =
  Priceable.make(
    (item) => item.price,
    (item, price) => ({ ...item, price }),
  );
```

#### Branded Types for Domain Primitives

Never use raw primitives for domain concepts:

```typescript
// WRONG: Allows any string
type UserId = string;

// CORRECT: Branded type ensures type safety
type UserId = string & { readonly _brand: "UserId" };

// With constructor for safe creation
export const UserId = {
  make: (id: string): UserId => {
    if (!id.startsWith("user_")) {
      throw new Error("Invalid user ID format");
    }
    return id as UserId;
  },
  isUserId: (value: unknown): value is UserId =>
    typeof value === "string" && value.startsWith("user_"),
};
```

### Documentation Standards

Every exported member MUST include:

1. **JSDoc Comment**: Brief description of purpose
2. **Category Tag**: `@category` for grouping in documentation
3. **Since Tag**: `@since` with version number
4. **Example**: At least one realistic usage example

```typescript
/**
 * Set the item's price.
 *
 * @category Operations
 * @since 0.1.0
 *
 * @example
 * import * as LineItem from "@/schemas/LineItem";
 * import * as Priceable from "@/typeclass/Priceable";
 * import * as Cents from "@/schemas/Cents";
 * import * as Currency from "@/schemas/Currency";
 * import type { Id } from "@/_generated/dataModel";
 * import { pipe } from "effect/Function";
 *
 * const itemId = "item_123" as Id<"items">;
 * const cartId = "cart_456" as Id<"carts">;
 * const price = Priceable.makePrice(Cents.make(1299n), Currency.make("USD"));
 * const item = LineItem.make(itemId, cartId, price);
 * const newPrice = Priceable.makePrice(Cents.make(2499n), Currency.make("USD"));
 * const updated = LineItem.setPrice(item, newPrice);
 * // or pipe-friendly: pipe(item, LineItem.setPrice(newPrice))
 */
export const setPrice = Priceable.setPrice;
```

## Part II: Function Design

### Core Principle: Functions Focus on Their Purpose

Function parameters should exclusively concern the operation being performed. Infrastructure concerns—services, repositories, loggers, clocks, random generators—belong in the Effect context, not in parameter lists.

### Parameter Design Philosophy

#### Operation Parameters Only

```typescript
// WRONG: Mixing operational and infrastructure concerns
function createInvoice(
  customer: Customer,
  items: LineItem[],
  serialGenerator: SerialGenerator, // Infrastructure
  database: Database, // Infrastructure
  logger: Logger, // Infrastructure
  clock: Clock, // Infrastructure
): Invoice {
  // Function signature polluted with dependencies
}

// CORRECT: Only operational parameters
const createInvoice = (customer: Customer, items: LineItem[]) =>
  Effect.gen(function* () {
    const serial = yield* InvoiceSerial; // Infrastructure from context
    const repository = yield* InvoiceRepository; // Infrastructure from context
    const now = yield* DateTime.now; // Infrastructure from context

    const invoice = Invoice.make({
      serial,
      customer,
      items,
      createdAt: now,
    });

    return yield* repository.save(invoice);
  });
// Type: Effect<Invoice, SaveError, InvoiceSerial | InvoiceRepository>
```

#### Options as Second Parameter

When functions need configuration, provide options as a second parameter:

```typescript
// WRONG: Options mixed with operational data
function processPayment(
  amount: Cents,
  currency: Currency,
  retryAttempts: number,
  timeout: Duration,
  validateAddress: boolean,
  customer: Customer,
): Result {
  // Unclear parameter ordering
}

// CORRECT: Clear separation of data and options
interface ProcessPaymentOptions {
  readonly retryAttempts?: number;
  readonly timeout?: Duration;
  readonly validateAddress?: boolean;
}

const processPayment = (
  payment: Payment,
  options: ProcessPaymentOptions = {},
) =>
  Effect.gen(function* () {
    const gateway = yield* PaymentGateway;
    const {
      retryAttempts = 3,
      timeout = Duration.seconds(30),
      validateAddress = false,
    } = options;

    // Process with configuration
    return yield* pipe(
      gateway.process(payment),
      Effect.retry(Schedule.recurs(retryAttempts)),
      Effect.timeout(timeout),
    );
  });
```

### Context vs Parameters Decision Framework

Ask these questions to determine if something belongs in context or parameters:

1. **Is it specific to this operation?** → Parameter
2. **Could it be reused across multiple operations?** → Context
3. **Is it infrastructure or a service?** → Context
4. **Is it data being operated on?** → Parameter
5. **Does it configure how the operation runs?** → Options parameter
6. **Would testing require mocking it?** → Context

```typescript
// Example: Sending an email
interface EmailOptions {
  readonly priority?: "low" | "normal" | "high";
  readonly retryOnFailure?: boolean;
}

// WRONG: Infrastructure in parameters
function sendEmail(
  to: Email,
  subject: string,
  body: string,
  smtpClient: SmtpClient, // Should be in context
  logger: Logger, // Should be in context
  priority: string, // Should be in options
): Effect<void, SendError> {
  // Mixed concerns
}

// CORRECT: Clean separation
const sendEmail = (message: EmailMessage, options: EmailOptions = {}) =>
  Effect.gen(function* () {
    const smtp = yield* SmtpClient;
    const { priority = "normal", retryOnFailure = true } = options;

    const result = yield* smtp.send(message, priority);

    if (retryOnFailure && Effect.isFailure(result)) {
      return yield* Effect.retry(smtp.send(message, priority));
    }

    return result;
  });
```

### Pure Functions as Default

Every function should strive to be pure—producing the same output for the same input without side effects. When side effects are necessary, they must be explicitly tracked in the type system.

### Dual APIs for Composition

Provide both data-first and data-last variants using the `dual` helper:

```typescript
export const setNotes: {
  (
    notes: string | undefined,
  ): <A extends Cents.Cents, C extends Currency.Currency>(
    item: LineItem<A, C>,
  ) => LineItem<A, C>;
  <A extends Cents.Cents, C extends Currency.Currency>(
    item: LineItem<A, C>,
    notes: string | undefined,
  ): LineItem<A, C>;
} = dual(
  2,
  <A extends Cents.Cents, C extends Currency.Currency>(
    item: LineItem<A, C>,
    notes: string | undefined,
  ): LineItem<A, C> => ({
    ...item,
    notes,
  }),
);
```

This enables both styles:

- Direct call: `setNotes(item, "Gift wrap")`
- Pipe-friendly: `pipe(item, setNotes("Gift wrap"))`

### Function Naming Conventions

Functions should clearly communicate their purpose and effect:

```typescript
// Pure functions: Use descriptive verbs
export const calculate = (a: number, b: number): number => a + b;
export const parse = (input: string): ParsedData => ...;
export const validate = (data: unknown): ValidationResult => ...;

// Effectful functions: Indicate effects in the name or return type
export const save = (entity: Entity): Effect.Effect<Entity, SaveError> => ...;
export const fetch = (id: Id): Effect.Effect<Entity, FetchError> => ...;
export const generate = Effect.gen(function* () {
  const random = yield* Random.nextInt;
  return createId(random);
});

// Predicates: Use "is" prefix
export const isValid = (data: unknown): data is ValidData => ...;
export const isEmpty = (collection: Collection): boolean => ...;

// Transformers: Use "to" prefix
export const toString = (value: Value): string => ...;
export const toArray = <T>(set: Set<T>): T[] => ...;
```

### Avoid Hidden Dependencies

Never hide dependencies in closures or global scope:

```typescript
// WRONG: Hidden dependency on global state
let currentUser: User | null = null;

function createPost(content: string): Post {
  if (!currentUser) throw new Error("Not authenticated");
  return { author: currentUser.id, content }; // Hidden dependency
}

/**
 * Factory for creating posts with a pre-set user.
 *
 * @remarks
 * This function explicitly captures the user in a closure.
 * Use when the user is already authenticated and fixed for the factory's lifetime.
 * The function name and documentation make the dependency clear.
 *
 * @param user - The user who will be the author of all posts created by this factory.
 * @returns A function that creates a post authored by the given user.
 *
 * @example
 * const createAlicePost = createPostFactoryWithUser(alice);
 * const post = createAlicePost("Hello world!"); // post.author === alice.id
 *
 */
export function createPostFactoryWithUser(user: User) {
  return function createPost(content: string): Post {
    return { author: user.id, content };
  };
}

// CORRECT: Explicit dependency via Effect context
export class CurrentUser extends Context.Tag("CurrentUser")<
  CurrentUser,
  User
>() {}

const createPost = (content: string) =>
  Effect.gen(function* () {
    const user = yield* CurrentUser;
    return Post.make({ author: user.id, content });
  });
```

---

## Part III: Effect Management

### Explicit Effect Tracking

Side effects must be visible in the type signature using Effect:

```typescript
// WRONG: Hidden side effect
function saveUser(user: User): User {
  database.save(user); // Hidden I/O
  eventBus.emit("user.saved", user); // Hidden side effect
  return user;
}

// CORRECT: Effects are explicit
function saveUser(
  user: User,
): Effect.Effect<User, DatabaseError | EventError, Database | EventEmitter> {
  return Effect.gen(function* () {
    yield* database.save(user);
    yield* eventEmitter.emit(UserSaved.make({ userId: user.id }));
    return user;
  });
}
```

### Service Dependencies

Use Context.Tag to declare service dependencies:

```typescript
export class PaymentGateway extends Context.Tag(
  "@services/payment/PaymentGateway",
)<
  PaymentGateway,
  {
    readonly handoff: (
      intent: Doc<"paymentIntents">,
    ) => Effect.Effect<
      { intent: Doc<"paymentIntents">; handedOffAt: number },
      HandoffError
    >;
  }
>() {}
```

---

## Part IV: Error Handling

### Tagged Errors for Precision

Every error must be a tagged class with structured data:

```typescript
export class HandoffError extends Data.TaggedError("HandoffError")<{
  reason: string;
  cause?: unknown;
}> {}

export class WebhookValidationError extends Data.TaggedError(
  "WebhookValidationError",
)<{
  reason: string;
  payload?: unknown;
}> {}
```

### Exhaustive Error Handling

Use pattern matching to ensure all errors are handled:

```typescript
pipe(
  performOperation(),
  Effect.catchTags({
    HandoffError: (error) => handleHandoffError(error),
    WebhookValidationError: (error) => handleValidationError(error),
    // Compiler ensures all error cases are handled
  }),
);
```

---

## Part V: Dependencies and Services

### Core Principle: Dependencies as Type-Level Requirements

Dependencies are not implementation details—they are fundamental requirements that must be visible in type signatures. Effect's Context system provides compile-time tracking of all service dependencies, making hidden dependencies impossible.

### Context Tags: Witness vs Capability

Use a **Context Tag** when the _existence_ of something must be guaranteed and visible at the type level—without threading it as a value parameter. This is ideal when you want to **decouple infrastructure/generation concerns** (e.g., serial numbers) from core domain logic while still **requiring their presence in the environment**.

## TL;DR

- **Witness (existence-only):** "A serial **exists** in the environment."
- **Capability (power/behavior):** "I can **produce/validate** serials."

Pick **witness** if you only need to _assume presence_. Pick **capability** if you need _operations_.

---

## Anti-pattern (value parameter hidden in semantics)

```typescript
// WRONG: dependency is informal/implicit
function createPaymentIntent(...otherData): PaymentIntent {
  // Someone must remember to pass a serial correctly.
  // The type system doesn't enforce its presence.
  return { ...something };
}
```

## Witness by Environment (existence tracked at type level)

```typescript
// A branded string that simply *exists* in context
export class Serial extends Tracker.TagFor(Tracker)<Serial>() {}

const createPaymentIntent = Effect.gen(function* () {
  const serial = yield* Serial; // <- witness pulled from environment
  return PaymentIntent.make({ ...otherData });
});

// Type: Effect<PaymentIntent, never, Serial>
// Caller must provide Serial in the environment.
```

### When to use a **Witness**

- **Existence is the invariant**: "This operation is valid only if a serial/request-id/txn is present."
- **Decouple infra from domain**: generators/issuers live elsewhere; domain code only requires presence.
- **Avoid parameter pollution**: don't thread opaque tokens through every function.
- **Testing is trivial**: inject a dummy witness in tests without stubbing services.

### When _not_ to use a Witness

- You need **behavior** (e.g., generate/refresh/validate serials).
- The presence isn't **semantically required** for correctness.

---

## Capability (behavior tracked at type level)

```typescript
// A service with behavior (power)
export interface SerialService {
  next(): string;
  validate(s: string): boolean;
}
export class SerialSvc extends Tracker.TagFor<SerialService>() {}

const createPaymentIntent = Effect.gen(function* () {
  const svc = yield* SerialSvc; // capability
  const serial = svc.next(); // behavior
  return PaymentIntent.make({
    /* ... */
  });
});

// Type: Effect<PaymentIntent, never, SerialSvc>
```

### When to use a **Capability**

- You need **operations**: create, validate, log, transact, fetch, etc.
- You want to **mock behavior** in tests (e.g., deterministic generators, failing validators).
- You expect **multiple implementations** (in-memory, prod, fallback).

---

## Witness vs Capability (at a glance)

| Aspect          | Witness (Tag of data)                      | Capability (Tag of service)                  |
| --------------- | ------------------------------------------ | -------------------------------------------- |
| What it encodes | **Existence** of a resource/value          | **Behavior** / operations on a resource      |
| Typical shape   | Branded value (e.g., `Serial`)             | Interface/ADT with methods (`SerialService`) |
| Runtime needs   | Provide a value                            | Provide an implementation                    |
| Best for        | Preconditions, context markers, invariants | IO, generation, validation, side-effects     |
| Test ergonomics | Provide a constant                         | Swap in a fake/mock service                  |

---

## Concrete Situations

### Good fits for **Witness**

- **Correlation/Request ID** must exist for logging/tracing.
- **Transaction context** must be established before executing.
- **Tenant/Region** must be set to select correct data boundary.
- **Pre-validated tokens** (e.g., a previously verified feature flag) are required to proceed.

### Good fits for **Capability**

- **Serial generation/validation** (create/check).
- **Clock** (`now()`) for time-stamping.
- **Logger** with structured methods.
- **Database/HTTP clients** (query, transact, call).

---

## Migration Checklist

1. **Ask:** Do we only need to _know it exists_?
   - Yes → **Witness** (context tag of a branded value).
   - No → **Capability** (context tag of a service interface).

2. **Brand** the data so it can't be confused with plain strings.
3. **Require** it in the effect type (`Effect<_, _, Serial>` or service tag).
4. **Provide** it at the app edge (layer/provider); keep domain code clean.
5. **Test:** Inject simple witnesses or mocked services.

---

## Example: Upgrading Witness → Capability (when needs evolve)

```typescript
// Start: witness only
export class Serial extends Tracker.TagFor(Tracker)<Serial>() {}

// Later: requirements change — we must generate/validate.
export interface SerialService {
  next(): string;
  validate(s: string): boolean;
}
export class SerialSvc extends Tracker.TagFor<SerialService>() {}
```

Use the witness while you only need _presence_. When behavior appears, switch (or add) a capability without touching domain call sites beyond the environment requirement.

---

**Rule of thumb:**
If your function reads the tag and never calls a method on it, you probably want a **witness**.
If your function _does_ something via the tag, you want a **capability**.

### Service as Capability Pattern

Services are NOT monolithic classes. They are fine-grained capability interfaces that compose into complete solutions. Each capability represents exactly one cohesive set of operations.

#### Capability-Based Service Design

```typescript
// WRONG: Monolithic service with mixed concerns
export class PaymentService extends Context.Tag("PaymentService")<
  PaymentService,
  {
    readonly processPayment: ...;
    readonly validateWebhook: ...;
    readonly sendReceipt: ...;
    readonly generateReport: ...;
    readonly refund: ...;
  }
>() {}

// CORRECT: Separate capabilities that compose
export class PaymentGateway extends Context.Tag(
  "@services/payment/PaymentGateway"
)<
  PaymentGateway,
  {
    readonly handoff: (
      intent: Doc<"paymentIntents">
    ) => Effect.Effect<null, HandoffError>;
  }
>() {}

export class PaymentWebhookGateway extends Context.Tag(
  "@services/payment/PaymentWebhookGateway"
)<
  PaymentWebhookGateway,
  {
    readonly validateWebhook: (
      payload: WebhookPayload
    ) => Effect.Effect<null, WebhookValidationError>;
  }
>() {}

export class PaymentRefundGateway extends Context.Tag(
  "@services/payment/PaymentRefundGateway"
)<
  PaymentRefundGateway,
  {
    readonly refund: (
      paymentId: PaymentId,
      amount: Cents
    ) => Effect.Effect<RefundResult, RefundError>;
  }
>() {}
```

#### Composing Capabilities into Full Services

Different payment providers support different capabilities. Model this explicitly:

```typescript
// Cash payments: Only supports basic handoff
export const CashGatewayLive = Layer.effect(
  PaymentGateway,
  Effect.gen(function* () {
    const domain = yield* PaymentIntentDomain;

    return PaymentGateway.of({
      handoff: (intent) =>
        Effect.gen(function* () {
          yield* domain.validateCashPayment(intent);
          yield* domain.fulfillIntent(intent);
          return null;
        }),
    });
  }),
);

// Stripe: Supports handoff, webhooks, and refunds
export const StripeHandoffLive = Layer.effect(
  PaymentGateway,
  Effect.gen(function* () {
    const stripe = yield* StripeClient;

    return PaymentGateway.of({
      handoff: (intent) =>
        Effect.gen(function* () {
          const session = yield* stripe.createCheckoutSession(intent);
          yield* stripe.redirectToCheckout(session);
          return null;
        }),
    });
  }),
);

export const StripeWebhookLive = Layer.effect(
  PaymentWebhookGateway,
  Effect.gen(function* () {
    const stripe = yield* StripeClient;

    return PaymentWebhookGateway.of({
      validateWebhook: (payload) =>
        Effect.gen(function* () {
          const signature = payload.headers["stripe-signature"];
          yield* stripe.validateSignature(payload.body, signature);
          yield* stripe.processWebhookEvent(payload.body);
          return null;
        }),
    });
  }),
);

export const StripeRefundLive = Layer.effect(
  PaymentRefundGateway,
  Effect.gen(function* () {
    const stripe = yield* StripeClient;

    return PaymentRefundGateway.of({
      refund: (paymentId, amount) => stripe.createRefund(paymentId, amount),
    });
  }),
);

// Compose Stripe capabilities for convenience
export const StripeGatewayLive = Layer.mergeAll(
  StripeHandoffLive,
  StripeWebhookLive,
  StripeRefundLive,
);
```

#### Testing Benefits of Capability Pattern

Each capability can be tested in isolation:

```typescript
// Test only webhook validation without payment processing
const WebhookTest = Layer.succeed(
  PaymentWebhookGateway,
  PaymentWebhookGateway.of({
    validateWebhook: (payload) =>
      payload.headers["test"] === "valid"
        ? Effect.succeed(null)
        : Effect.fail(
            new WebhookValidationError({ reason: "Invalid test header" }),
          ),
  }),
);

// Test only refunds without other capabilities
const RefundTest = Layer.succeed(
  PaymentRefundGateway,
  PaymentRefundGateway.of({
    refund: (paymentId, amount) =>
      Effect.succeed({
        refundId: "test_refund_123" as RefundId,
        status: "completed" as const,
        amount,
      }),
  }),
);

// Compose test capabilities as needed
const testProgram = myProgram.pipe(
  Effect.provide(
    Layer.mergeAll(
      WebhookTest,
      RefundTest,
      // Only provide capabilities the test actually uses
    ),
  ),
);
```

#### Dynamic Capability Selection

Use the capability pattern to support multiple providers dynamically:

```typescript
// Define provider configuration
export type PaymentProvider =
  | { _tag: "cash" }
  | { _tag: "stripe"; apiKey: string }
  | { _tag: "square"; accessToken: string };

// Factory function to create appropriate layers
export const createPaymentLayers = (provider: PaymentProvider) =>
  Match.value(provider).pipe(
    Match.when({ _tag: "cash" }, () => CashGatewayLive),
    Match.when({ _tag: "stripe" }, ({ apiKey }) =>
      Layer.mergeAll(
        StripeGatewayLive,
        Layer.succeed(StripeClient, createStripeClient(apiKey)),
      ),
    ),
    Match.when({ _tag: "square" }, ({ accessToken }) =>
      Layer.mergeAll(
        SquareHandoffLive,
        SquareWebhookLive,
        // Square doesn't support refunds in our integration
        Layer.succeed(SquareClient, createSquareClient(accessToken)),
      ),
    ),
    Match.exhaustive,
  );

// Usage: Program adapts to available capabilities
const processPayment = (order: Order) =>
  Effect.gen(function* () {
    const handoff = yield* PaymentGateway;
    const result = yield* handoff.handoff(order.paymentIntent);

    // Optional capability - check if available
    const refundGateway = yield* Effect.serviceOption(PaymentRefundGateway);
    if (Option.isSome(refundGateway)) {
      // Refund capability is available
      yield* setupRefundPolicy(refundGateway.value, order);
    }

    return result;
  });
```

#### Capability Composition Guidelines

1. **One Capability, One Purpose**: Each capability interface should have a single, clear purpose
2. **Optional Capabilities**: Use `Effect.serviceOption` for capabilities that may not be available
3. **Compose at the Edge**: Merge capabilities into full services only at the application boundary
4. **Test in Isolation**: Each capability should be independently testable
5. **Document Requirements**: Make it clear which capabilities are required vs optional

```typescript
// Document capability requirements
export const PaymentHandoffRequirements = {
  required: [PaymentGateway] as const,
  optional: [PaymentWebhookGateway, PaymentRefundGateway] as const,
};

// Type-safe capability checking
export const hasRefundCapability = <R>(
  context: Context.Context<R>,
): context is Context.Context<R | PaymentRefundGateway> =>
  Context.isContext(context) && Context.has(context, PaymentRefundGateway);
```

### Dependency Injection Best Practices

#### 1. Justify Every Dependency

Only introduce a dependency when the coupling is essential:

```typescript
// JUSTIFIED: Payment intent CANNOT exist without a serial
const initiateIntent = (args: Omit<PI.PendingProvider, "status">) =>
  Serial.pipe(
    Effect.flatMap((serial) =>
      mutation.createIntent(PI.makePendingProvider({ ...args, serial })),
    ),
  );

// UNJUSTIFIED: Logger could be added at call site
// WRONG:
const saveUser = (user: User) =>
  Effect.gen(function* () {
    const logger = yield* Logger; // Unnecessary coupling
    logger.info("Saving user");
    return yield* database.save(user);
  });

// CORRECT: Let caller handle logging
const saveUser = (user: User) => database.save(user);
// Caller can add logging if needed:
// pipe(saveUser(user), Effect.tap(() => logger.info("User saved")))
```

#### 2. Use Type-Level Context Tags

Define context requirements that can be tracked at compile time:

```typescript
// Define a context tag for tracker-based serial generation
export const TagFor =
  <T extends Tracker>(tracker: T) =>
  <Id>() =>
    Context.Tag(tracker.key)<Id, Serial<T>>();

// Usage: Create specific serial requirement
export class InvoiceSerial extends Tracker.TagFor(
  InvoiceTracker,
)<InvoiceSerial>() {}

// Now functions can declare this specific dependency
const createInvoice = Effect.gen(function* () {
  const serial = yield* InvoiceSerial; // Type-safe serial requirement
  return Invoice.make({ serial });
});
```

#### 3. Layer Composition Patterns

Build applications by composing layers:

```typescript
// Base infrastructure layers
const InfrastructureLayer = Layer.mergeAll(
  DatabaseLive,
  RedisLive,
  HttpClientLive,
);

// Domain service layers
const DomainLayer = Layer.mergeAll(
  PaymentDomainLive,
  OrderDomainLive,
  InventoryDomainLive,
).pipe(Layer.provide(InfrastructureLayer));

// Application service layers
const ApplicationLayer = Layer.mergeAll(
  PaymentGatewayLive,
  NotificationServiceLive,
  ReportingServiceLive,
).pipe(Layer.provide(DomainLayer));

// Complete application
const program = Effect.gen(function* () {
  // All dependencies are satisfied
  const gateway = yield* PaymentGateway;
  const result = yield* gateway.processPayment(order);
  return result;
}).pipe(Effect.provide(ApplicationLayer));
```

### Resource Management

For resources that require lifecycle management, use Layer with proper acquisition and release:

```typescript
export const DatabaseLive = Layer.scoped(
  Database,
  Effect.gen(function* () {
    // Acquire resource
    const connection = yield* Effect.acquireRelease(
      connectToDatabase(),
      (conn) => Effect.sync(() => conn.close()),
    );

    return Database.of({
      query: (sql) =>
        Effect.async((callback) => {
          connection.query(sql, (err, result) => {
            if (err) callback(Effect.fail(new QueryError({ cause: err })));
            else callback(Effect.succeed(result));
          });
        }),
    });
  }),
);
```

### Anti-Patterns to Avoid

#### 1. Prop Drilling Dependencies

```typescript
// WRONG: Threading dependencies through multiple layers
function processOrder(
  order: Order,
  gateway: PaymentGateway,
  logger: Logger,
  notifier: NotificationService,
  tracker: Tracker,
): Result {
  // Dependencies pollute function signatures
}

// CORRECT: Use Effect context
const processOrder = (order: Order) =>
  Effect.gen(function* () {
    // Dependencies are pulled from context as needed
    const gateway = yield* PaymentGateway;
    const serial = yield* OrderSerial;
    // Process order...
  });
```

#### 2. Global Singletons

```typescript
// WRONG: Global mutable state
export const globalLogger = new Logger();
export const globalDatabase = new Database();

// CORRECT: Services provided through layers
export const LoggerLive = Layer.succeed(Logger, Logger.of({...}));
export const DatabaseLive = Layer.scoped(Database, ...);
```

#### 3. Mixed Concerns in Services

```typescript
// WRONG: Service handles multiple unrelated concerns
export class OrderService extends Context.Tag("OrderService")<
  OrderService,
  {
    createOrder: ...;
    sendEmail: ...;    // Should be in NotificationService
    generateReport: ...; // Should be in ReportingService
    validateTax: ...;   // Should be in TaxService
  }
>() {}

// CORRECT: Single responsibility per service
export class OrderDomain extends Context.Tag("OrderDomain")<
  OrderDomain,
  {
    createOrder: ...;
    validateOrder: ...;
    fulfillOrder: ...;
  }
>() {}
```

---

## Part VI: Testing

_To be continued..._

## Part VI: UI Components with React

### Core Principle: Composition Over Configuration

React components suffer from the same problems as functions—accumulating boolean props and configuration options until they become unmaintainable. The solution is the same: composition. Build small, focused components that compose into complex UIs rather than monolithic components with dozens of conditional branches.

### The Boolean Prop Anti-Pattern

Every boolean prop in your component is a code smell. It indicates you're trying to make one component do too many things.

```typescript
// WRONG: The path to component hell
interface UserFormProps {
  isUpdateUser?: boolean;
  isEditNameOnly?: boolean;
  hideWelcomeMessage?: boolean;
  hideTermsAndConditions?: boolean;
  shouldRedirectToOnboarding?: boolean;
  isSlugRequired?: boolean;
  showEmailField?: boolean;
  // ...20 more booleans
}

function UserForm(props: UserFormProps) {
  // Component becomes a maze of conditionals
  return (
    <>
      {!props.hideWelcomeMessage && <WelcomeMessage />}
      {props.isUpdateUser ? (
        <UpdateHeader />
      ) : (
        <CreateHeader />
      )}
      {props.showEmailField && <EmailField required={!props.isUpdateUser} />}
      {/* Endless conditionals... */}
    </>
  );
}

// CORRECT: Compose specific forms from atomic pieces
function CreateUserForm() {
  return (
    <UserForm.Provider>
      <WelcomeMessage />
      <CreateHeader />
      <UserForm.NameField />
      <UserForm.EmailField required />
      <UserForm.TermsAndConditions />
      <UserForm.SubmitButton onSuccess={redirectToOnboarding} />
    </UserForm.Provider>
  );
}

function UpdateUserNameForm() {
  const user = useUser();

  return (
    <UserForm.Provider initialUser={user.data}>
      <UpdateHeader />
      <UserForm.NameField />
      <UserForm.SaveButton />
    </UserForm.Provider>
  );
}
```

### The Problem with Monolithic Components

Consider building a Slack-like composer. The naive approach leads to disaster:

```typescript
// WRONG: Monolith with endless conditionals
function Composer({
  onSubmit,
  isThread,
  channelId,
  isDMThread,
  dmId,
  isEditingMessage,
  onCancel,
  isForwarding,
  hideAttachments,
  hideEmojis,
  // ... dozens more props
}) {
  return (
    <Form>
      <Header />
      <Input />
      {isDMThread ? (
        <AlsoSendToDirectMessageField id={dmId} />
      ) : isThread ? (
        <AlsoSendToChannelField id={channelId} />
      ) : null}
      <Footer
        onSubmit={onSubmit}
        isEditingMessage={isEditingMessage}
        onCancel={onCancel}
      />
    </Form>
  );
}

// The Footer becomes a nightmare
function Footer({ onSubmit, isEditingMessage, onCancel }) {
  return (
    <>
      {!isEditingMessage && <PlusMenu />}
      <TextFormat />
      <Emojis />
      {!isEditingMessage && <Mentions />}
      {!isEditingMessage && <Divider />}
      {!isEditingMessage && <Video />}
      {!isEditingMessage && <Audio />}
      {!isEditingMessage && <Divider />}
      {!isEditingMessage && <SlashCommands />}

      {isEditingMessage ? (
        <>
          <CancelEditing onCancel={onCancel} />
          <SubmitEditing onSubmit={onSubmit} />
        </>
      ) : (
        <Submit onSubmit={onSubmit} />
      )}
    </>
  );
}
```

### Component Module Pattern

Treat React components like Effect modules—each component is a module with its namespace, containing all related sub-components, hooks, types, and utilities.

```typescript
// components/Composer/index.tsx
export * as Composer from "./Composer";

// components/Composer/Composer.tsx
import * as React from "react";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";

// ============================================================================
// TYPES
// ============================================================================

export interface ComposerState {
  readonly content: string;
  readonly attachments: ReadonlyArray<Attachment>;
  readonly mentions: ReadonlyArray<Mention>;
}

export interface ComposerActions {
  readonly updateContent: (content: string) => void;
  readonly addAttachment: (attachment: Attachment) => void;
  readonly submit: () => Effect.Effect<void, SubmitError>;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ComposerContext = React.createContext<
  (ComposerState & ComposerActions) | null
>(null);

export const useComposer = () => {
  const context = React.useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be used within ComposerProvider");
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

export interface ProviderProps {
  readonly children: React.ReactNode;
  readonly state: ComposerState;
  readonly actions: ComposerActions;
}

export const Provider: React.FC<ProviderProps> = ({
  children,
  state,
  actions
}) => {
  const value = React.useMemo(
    () => ({ ...state, ...actions }),
    [state, actions]
  );

  return (
    <ComposerContext.Provider value={value}>
      {children}
    </ComposerContext.Provider>
  );
};

// ============================================================================
// COMPONENTS - Atomic building blocks
// ============================================================================

export const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="composer-frame">
    {children}
  </div>
);

export const Header: React.FC = () => {
  const { mentions } = useComposer();
  return (
    <div className="composer-header">
      {mentions.length > 0 && <MentionsList mentions={mentions} />}
    </div>
  );
};

export const Input: React.FC = () => {
  const { content, updateContent } = useComposer();

  return (
    <textarea
      className="composer-input"
      value={content}
      onChange={(e) => updateContent(e.target.value)}
      placeholder="Type a message..."
    />
  );
};

export const Footer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="composer-footer">
    {children}
  </div>
);

// ============================================================================
// ACTION BUTTONS - Individual, composable actions
// ============================================================================

export const PlusMenu: React.FC = () => (
  <button className="composer-action">
    <PlusIcon />
  </button>
);

export const TextFormat: React.FC = () => (
  <button className="composer-action">
    <FormatIcon />
  </button>
);

export const Emojis: React.FC = () => (
  <button className="composer-action">
    <EmojiIcon />
  </button>
);

export const Mentions: React.FC = () => (
  <button className="composer-action">
    <MentionIcon />
  </button>
);

export const Submit: React.FC = () => {
  const { content, submit } = useComposer();

  return (
    <button
      className="composer-submit"
      disabled={content.trim().length === 0}
      onClick={() => Effect.runPromise(submit())}
    >
      <SendIcon />
    </button>
  );
};

// ============================================================================
// COMPOUND COMPONENTS - Reusable combinations
// ============================================================================

export const CommonActions: React.FC = () => (
  <>
    <PlusMenu />
    <TextFormat />
    <Emojis />
    <Mentions />
    <Divider />
    <Video />
    <Audio />
    <Divider />
    <SlashCommands />
  </>
);

// ============================================================================
// FEATURE COMPONENTS
// ============================================================================

export const DropZone: React.FC = () => {
  const { addAttachment } = useComposer();

  return (
    <div
      className="composer-dropzone"
      onDrop={(e) => /* handle drop */}
    >
      Drop files here
    </div>
  );
};

export const AlsoSendToChannel: React.FC<{ channelId: string }> = ({ channelId }) => {
  const [checked, setChecked] = React.useState(false);

  return (
    <label className="composer-also-send">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      Also send to #{channelId}
    </label>
  );
};
```

### Implementation Through Composition

Now create specific implementations by composing these pieces—no boolean props needed:

```typescript
// components/ChannelComposer.tsx
export const ChannelComposer: React.FC = () => {
  // State comes from a global hook (synced across devices)
  const state = useGlobalChannel();

  return (
    <Composer.Provider state={state.composer} actions={state.actions}>
      <Composer.DropZone />
      <Composer.Frame>
        <Composer.Header />
        <Composer.Input />
        <Composer.Footer>
          <Composer.CommonActions />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </Composer.Provider>
  );
};

// components/ThreadComposer.tsx
export const ThreadComposer: React.FC<{ channelId: string }> = ({ channelId }) => {
  const state = useThreadChannel();

  return (
    <Composer.Provider state={state.composer} actions={state.actions}>
      <Composer.DropZone />
      <Composer.Frame>
        <Composer.Header />
        <Composer.Input />
        <Composer.AlsoSendToChannel channelId={channelId} />
        <Composer.Footer>
          <Composer.CommonActions />
          <Composer.Submit />
        </Composer.Footer>
      </Composer.Frame>
    </Composer.Provider>
  );
};

// components/EditMessageComposer.tsx
export const EditMessageComposer: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const state = useEditMessage();

  return (
    <Composer.Provider state={state.composer} actions={state.actions}>
      {/* No DropZone - editing doesn't support attachments */}
      <Composer.Frame>
        <Composer.Header />
        <Composer.Input />
        <Composer.Footer>
          {/* Only specific actions needed for editing */}
          <Composer.TextFormat />
          <Composer.Emojis />
          {/* Custom buttons just for editing */}
          <Cancel onCancel={onCancel} />
          <Submit />
        </Composer.Footer>
      </Composer.Frame>
    </Composer.Provider>
  );
};
```

### The Critical Pattern: Lifting State

State lifting is the key to flexible composition. It means moving state ABOVE the components that need it, into a provider that wraps them all.

#### Why Lift State?

Consider the forward message modal where the Forward button is OUTSIDE the composer:

```typescript
// WRONG: State trapped inside component
function ForwardMessageComposer() {
  const [state, setState] = useState(initialState);

  return (
    <Composer.Provider state={state}>
      <Composer.Frame>
        {/* ... composer internals ... */}
      </Composer.Frame>
    </Composer.Provider>
  );
}

function ForwardMessageModal() {
  return (
    <Modal>
      <ForwardMessageComposer />
      {/* How does this button access the composer's state? */}
      <ForwardButton onClick={???} />
    </Modal>
  );
}
```

The Forward button can't access the composer's state because it's trapped inside the component!

#### The Solution: Lift the Provider

```typescript
// CORRECT: State lifted above both components
function ForwardMessageComposer() {
  return (
    // No provider here - just the UI
    <Composer.Frame>
      <Composer.Header />
      <Composer.Input />
      <Composer.Footer>
        <Composer.TextFormat />
        <Composer.Emojis />
        <Composer.Mentions />
      </Composer.Footer>
    </Composer.Frame>
  );
}

function ForwardMessageModal() {
  // State lives at this level
  const [state, setState] = useState(initialState);
  const forwardMessage = useForwardMessage();

  const actions = {
    updateContent: (content: string) => setState(s => ({ ...s, content })),
    submit: () => forwardMessage(state.content)
  };

  return (
    // Provider wraps EVERYTHING that needs access
    <Composer.Provider state={state} actions={actions}>
      <Modal>
        <ForwardMessageComposer />
        <MessagePreview />
        {/* This button can now access composer state! */}
        <Dialog.Close>
          <ForwardButton />
        </Dialog.Close>
      </Modal>
    </Composer.Provider>
  );
}

// The button outside the composer can access its state
const ForwardButton: React.FC = () => {
  const { submit } = Composer.useComposer();

  return (
    <Button onClick={() => Effect.runPromise(submit())}>
      Forward
    </Button>
  );
};
```

### State Lifting Principles

1. **Lift Early**: Don't wait until you need it—design with lifted state from the start
2. **Provider Scope**: The provider should wrap ALL components that need access to the state
3. **UI/State Separation**: Components render UI; providers manage state
4. **Flexible Boundaries**: Components outside the visual boundary can still access state

```typescript
// Visual representation of lifted state
<Provider>                    {/* State lives here */}
  <VisualContainer>           {/* Visual boundary */}
    <ComponentA />            {/* Can access state */}
    <ComponentB />            {/* Can access state */}
  </VisualContainer>
  <ComponentC />              {/* Can ALSO access state! */}
</Provider>
```

### Decouple State Implementation from UI

The UI doesn't care where state comes from—local React state, Redux, Zustand, or synced across devices:

```typescript
// Local ephemeral state (for modals)
const useLocalComposer = () => {
  const [state, setState] = React.useState(initialState);

  return {
    ...state,
    updateContent: (content) => setState(s => ({ ...s, content })),
    submit: () => Effect.succeed(undefined)
  };
};

// Global synced state (for persistent composers)
const useGlobalComposer = () => {
  const { composer, sendMessage } = useChannelSync();

  return {
    ...composer,
    updateContent: (content) => updateGlobalDraft(content),
    submit: () => sendMessage()
  };
};

// The SAME UI components work with either
<Composer.Provider state={state} actions={actions}>
  <Composer.Input /> {/* Doesn't know or care about state implementation */}
</Composer.Provider>
```

### Visual Example: The Power of Composition

Instead of a monolithic component with boolean props determining what to render:

```typescript
// WRONG: Arrays of actions with complex conditionals
const actions = [
  { icon: "Plus", isMenu: true, menuItems: [...] },
  { icon: "TextFormat", onPress: onFormat },
  { icon: "Emoji", onPress: onEmoji },
  { icon: "Mention", onPress: onMention, divider: true },
  // Complex array that loops with conditions
];
```

Use JSX directly—it's already the perfect abstraction for UI:

```typescript
// CORRECT: Just use JSX
<Composer.Footer>
  <Composer.PlusMenu />
  <Composer.TextFormat />
  <Composer.Emojis />
  <Composer.Mentions />
  <Composer.Divider />
  <Composer.Video />
  <Composer.Audio />
</Composer.Footer>
```

### Component Testing

Composition makes testing straightforward—test each piece in isolation:

```typescript
// Test individual components
describe("Composer.Input", () => {
  it("updates content on change", () => {
    const updateContent = jest.fn();
    const state = { content: "Hello", attachments: [], mentions: [] };
    const actions = { updateContent, addAttachment: jest.fn(), submit: jest.fn() };

    render(
      <Composer.Provider state={state} actions={actions}>
        <Composer.Input />
      </Composer.Provider>
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "World" } });

    expect(updateContent).toHaveBeenCalledWith("World");
  });
});

// Test composed features
describe("EditMessageComposer", () => {
  it("does not render attachment button", () => {
    render(<EditMessageComposer onCancel={jest.fn()} />);
    expect(screen.queryByTestId("attachment-button")).not.toBeInTheDocument();
  });
});
```

After studying the Effect Atom documentation and analyzing the existing Clean Code Guide's patterns, here's a comprehensive section on integrating Effect Atom into the React best practices:

---

## Part VII: State Management with Effect Atom

### Core Principle: State as Composition

Just as we compose components and effects, state management must follow the same compositional principles. Effect Atom bridges the gap between Effect's powerful type system and React's UI layer, providing reactive state management that respects both paradigms.

### Why Effect Atom Over Traditional State Management

Traditional React state management forces a false dichotomy: either scatter state across components (prop drilling) or centralize everything in a global store (Redux/Zustand). Both approaches violate composition principles by creating rigid coupling patterns.

Effect Atom solves this through **reactive composition**—atoms compose like functions, effects compose like monads, and UI components compose through providers. This creates a unified mental model where state transformations are just another form of composition.

### The Atom Module Pattern

Treat atoms like Effect modules—each state domain gets its own module with exported atoms, operations, and types:

```typescript
// state/Cart/index.ts
export * as Cart from "./Cart";

// state/Cart/Cart.ts
import * as Atom from "@effect-atom/atom-react";
import * as Effect from "effect/Effect";
import * as LineItem from "@/schemas/LineItem";
import * as Cents from "@/schemas/Cents";

// ============================================================================
// TYPES
// ============================================================================

export interface CartState {
  readonly items: ReadonlyArray<LineItem.LineItem>;
  readonly subtotal: Cents.Cents;
}

// ============================================================================
// ATOMS - Pure state containers
// ============================================================================

// Primary state atom
export const state = Atom.make<CartState>({
  items: [],
  subtotal: Cents.zero,
}).pipe(
  Atom.keepAlive, // Persist across component lifecycles
);

// Derived atoms for computed values
export const itemCount = Atom.map(state, (cart) => cart.items.length);

export const isEmpty = Atom.map(state, (cart) => cart.items.length === 0);

export const total = Atom.make((get) => {
  const cart = get(state);
  const tax = get(taxRate);
  return Cents.add(cart.subtotal, Cents.multiply(cart.subtotal, tax));
});

// ============================================================================
// OPERATIONS - State transformations as atoms
// ============================================================================

export const addItem = Atom.fn(
  Effect.fnUntraced(function* (item: LineItem.LineItem) {
    const current = yield* Atom.get(state);
    const newSubtotal = Cents.add(current.subtotal, LineItem.getPrice(item));

    yield* Atom.set(state, {
      items: [...current.items, item],
      subtotal: newSubtotal,
    });
  }),
);

export const removeItem = Atom.fn(
  Effect.fnUntraced(function* (itemId: string) {
    const current = yield* Atom.get(state);
    const item = current.items.find((i) => i.id === itemId);
    if (!item) return;

    const newSubtotal = Cents.subtract(
      current.subtotal,
      LineItem.getPrice(item),
    );

    yield* Atom.set(state, {
      items: current.items.filter((i) => i.id !== itemId),
      subtotal: newSubtotal,
    });
  }),
);

export const clear = Atom.fn(
  Effect.fnUntraced(function* () {
    yield* Atom.set(state, {
      items: [],
      subtotal: Cents.zero,
    });
  }),
);
```

### Service Integration Pattern

Effect Atom seamlessly integrates with Effect services, maintaining type safety across the entire stack:

```typescript
// services/CheckoutService.ts
export class CheckoutService extends Context.Tag("CheckoutService")
  CheckoutService,
  {
    readonly processPayment: (
      cart: Cart.CartState
    ) => Effect.Effect<PaymentIntent, CheckoutError>;
  }
>() {}

// state/Checkout/Checkout.ts
import * as Atom from "@effect-atom/atom-react";
import * as Cart from "@/state/Cart";

// Create runtime with service layer
export const runtime = Atom.runtime(
  Layer.mergeAll(
    CheckoutService.Live,
    PaymentGateway.Live,
    DatabaseLive
  )
);

// Atom that uses the service
export const processCheckout = runtime.fn(
  Effect.fnUntraced(function* () {
    const service = yield* CheckoutService;
    const cart = yield* Atom.get(Cart.state);

    if (Cart.isEmpty.value) {
      return yield* Effect.fail(new EmptyCartError());
    }

    const intent = yield* service.processPayment(cart);

    // Clear cart on success
    yield* Cart.clear();

    return intent;
  })
);

// React component uses the atom
export function CheckoutButton() {
  const processPayment = useAtomSetPromise(processCheckout);
  const isEmpty = useAtomValue(Cart.isEmpty);

  return (
    <button
      disabled={isEmpty}
      onClick={async () => {
        const exit = await processPayment();
        if (Exit.isSuccess(exit)) {
          navigate(`/payment/${exit.value.id}`);
        }
      }}
    >
      Checkout
    </button>
  );
}
```

### Stream Integration for Real-Time Updates

Effect Atom excels at handling streams, making real-time features compositional:

```typescript
// state/Notifications/Notifications.ts
export const notifications = Atom.make(
  Stream.fromEventListener(window, "notification").pipe(
    Stream.map(parseNotification),
    Stream.filter(isValidNotification),
    Stream.scan(
      [] as ReadonlyArray<Notification>,
      (acc, notification) => [...acc, notification].slice(-10) // Keep last 10
    )
  )
);

// Pull-based pagination for message history
export const messageHistory = Atom.pull(
  Stream.unfoldChunkEffect(
    undefined as string | undefined,
    (cursor) =>
      fetchMessages({ cursor, limit: 20 }).pipe(
        Effect.map(response =>
          response.messages.length > 0
            ? Option.some([
                Chunk.fromIterable(response.messages),
                response.nextCursor
              ])
            : Option.none()
        )
      )
  )
);

// Component that uses pull-based loading
export function MessageList() {
  const [result, loadMore] = useAtom(messageHistory);

  return Result.match(result, {
    onInitial: () => <MessageSkeleton />,
    onFailure: (error) => <ErrorBoundary error={error} />,
    onSuccess: ({ value }) => (
      <>
        <VirtualList items={value.items} />
        {value.hasMore && (
          <LoadMoreButton
            loading={value.waiting}
            onClick={() => loadMore()}
          />
        )}
      </>
    )
  });
}
```

### Family Pattern for Dynamic State

When you need state for dynamic entities (like individual products or users), use the family pattern:

```typescript
// state/Products/Products.ts

// Individual product state atoms
export const product = Atom.family((productId: string) =>
  runtime.atom(
    Effect.gen(function* () {
      const service = yield* ProductService;
      return yield* service.fetchProduct(productId);
    })
  )
);

// Product mutation operations
export const updateQuantity = Atom.family((productId: string) =>
  runtime.fn(
    Effect.fnUntraced(function* (quantity: number) {
      const service = yield* ProductService;
      yield* service.updateQuantity(productId, quantity);

      // Invalidate the product cache
      yield* Reactivity.invalidate([`product:${productId}`]);
    })
  )
);

// Usage in components
export function ProductCard({ productId }: { productId: string }) {
  const productResult = useAtomValue(product(productId));
  const updateQty = useAtomSet(updateQuantity(productId));

  return Result.match(productResult, {
    onSuccess: (product) => (
      <div>
        <h3>{product.name}</h3>
        <QuantitySelector
          value={product.quantity}
          onChange={(qty) => updateQty(qty)}
        />
      </div>
    ),
    // ... other cases
  });
}
```

### Reactivity Pattern for Cache Invalidation

Use Effect's Reactivity service to automatically refresh atoms when mutations occur:

```typescript
// state/Orders/Orders.ts
import * as Reactivity from "@effect/experimental/Reactivity";

// Query atom with reactivity keys
export const userOrders = runtime
  .atom(
    Effect.gen(function* () {
      const service = yield* OrderService;
      const user = yield* CurrentUser;
      return yield* service.fetchUserOrders(user.id);
    }),
  )
  .pipe(Atom.withReactivity(["orders", `user:${userId}`]));

// Mutation that invalidates the query
export const createOrder = runtime.fn(
  Effect.fnUntraced(function* (items: ReadonlyArray<LineItem>) {
    const service = yield* OrderService;
    const order = yield* service.createOrder(items);

    // Automatically invalidates userOrders atom
    yield* Reactivity.invalidate(["orders"]);

    return order;
  }),
);

// Alternative: declarative invalidation
export const updateOrder = runtime.fn(
  Effect.fnUntraced(function* (orderId: string, updates: OrderUpdate) {
    const service = yield* OrderService;
    return yield* service.updateOrder(orderId, updates);
  }),
  { reactivityKeys: ["orders", `order:${orderId}`] },
);
```

### Local Storage Persistence

Persist atoms across sessions using the key-value store pattern:

```typescript
// state/Settings/Settings.ts
import { BrowserKeyValueStore } from "@effect/platform-browser";
import * as Schema from "effect/Schema";

// Define settings schema
const SettingsSchema = Schema.Struct({
  theme: Schema.Literal("light", "dark", "system"),
  notifications: Schema.Boolean,
  language: Schema.Literal("en", "es", "fr"),
});

// Persisted settings atom
export const settings = Atom.kvs({
  runtime: Atom.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "user-settings",
  schema: SettingsSchema,
  defaultValue: () => ({
    theme: "system",
    notifications: true,
    language: "en",
  }),
});

// Derived atoms for specific settings
export const theme = Atom.map(settings, (s) => s.theme);
export const notificationsEnabled = Atom.map(settings, (s) => s.notifications);

// Update operations
export const setTheme = Atom.fn(
  Effect.fnUntraced(function* (theme: "light" | "dark" | "system") {
    const current = yield* Atom.get(settings);
    yield* Atom.set(settings, { ...current, theme });
  }),
);
```

### URL State Synchronization

Keep state synchronized with URL parameters for shareable UI states:

```typescript
// state/Filters/Filters.ts

// Simple string parameter
export const searchQuery = Atom.searchParam("q");

// Typed parameter with schema
export const currentPage = Atom.searchParam("page", {
  schema: Schema.NumberFromString.pipe(Schema.clamp(1, Infinity)),
});

// Complex filter state
const FilterSchema = Schema.Struct({
  category: Schema.optional(Schema.String),
  minPrice: Schema.optional(Schema.NumberFromString),
  maxPrice: Schema.optional(Schema.NumberFromString),
  inStock: Schema.optional(Schema.BooleanFromString),
});

export const filters = Atom.searchParam("filters", {
  schema: FilterSchema,
  serialize: (value) => JSON.stringify(value),
  deserialize: (str) => JSON.parse(str),
});

// Compose URL state with data fetching
export const filteredProducts = Atom.make((get) =>
  Effect.gen(function* () {
    const query = get(searchQuery);
    const page = get(currentPage);
    const filterValues = get(filters);

    const service = yield* ProductService;
    return yield* service.search({
      query: Option.fromNullable(query),
      page: Option.getOrElse(page, () => 1),
      filters: Option.getOrElse(filterValues, () => ({})),
    });
  }),
);
```

### Testing Atoms

Atoms are highly testable due to their compositional nature:

```typescript
// state/Cart/Cart.test.ts
import { renderHook } from "@testing-library/react-hooks";
import * as Cart from "./Cart";
import * as TestUtils from "@/test/utils";

describe("Cart State", () => {
  it("should calculate total with tax", async () => {
    // Create test runtime with mocked services
    const runtime = TestUtils.createTestRuntime({
      taxRate: 0.08,
    });

    // Set initial state
    runtime.runSync(
      Cart.addItem(
        LineItem.make({
          id: "1",
          price: Cents.make(1000n),
        }),
      ),
    );

    // Test derived state
    const total = runtime.runSync(Atom.get(Cart.total));
    expect(total).toBe(Cents.make(1080n));
  });

  it("should clear cart after checkout", async () => {
    const { result } = renderHook(() => useAtom(Cart.state));

    // Add items
    act(() => {
      result.current[1]((prev) => ({
        ...prev,
        items: [testItem],
        subtotal: Cents.make(1000n),
      }));
    });

    // Process checkout
    await act(async () => {
      await processCheckout();
    });

    // Verify cart is cleared
    expect(result.current[0].items).toHaveLength(0);
    expect(result.current[0].subtotal).toBe(Cents.zero);
  });
});
```

### Anti-Patterns to Avoid

#### 1. Atom Proliferation

```typescript
// WRONG: Creating atoms for every piece of state
const userNameAtom = Atom.make("");
const userEmailAtom = Atom.make("");
const userAgeAtom = Atom.make(0);
const userAddressAtom = Atom.make("");

// CORRECT: Group related state
const userAtom = Atom.make<User>({
  name: "",
  email: "",
  age: 0,
  address: "",
});

// Derive specific values when needed
const userName = Atom.map(userAtom, (user) => user.name);
```

#### 2. Effect Chain in Components

```typescript
// WRONG: Complex effect chains in components
function BadComponent() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const user = await fetchUser();
    const orders = await fetchOrders(user.id);
    const processed = await processOrders(orders);
    setLoading(false);
  };
}

// CORRECT: Encapsulate in atom
const processUserOrders = runtime.fn(
  Effect.gen(function* () {
    const user = yield* fetchUser;
    const orders = yield* fetchOrders(user.id);
    return yield* processOrders(orders);
  })
);

function GoodComponent() {
  const process = useAtomSetPromise(processUserOrders);
  return <button onClick={() => process()}>Process</button>;
}
```

#### 3. Synchronous State Dependencies

```typescript
// WRONG: Manual state synchronization
const itemsAtom = Atom.make<Item[]>([]);
const countAtom = Atom.make(0);

// Manually sync count with items
useEffect(() => {
  const items = getAtomValue(itemsAtom);
  setAtomValue(countAtom, items.length);
}, [items]);

// CORRECT: Derive state
const itemsAtom = Atom.make<Item[]>([]);
const countAtom = Atom.map(itemsAtom, (items) => items.length);
```

### Guidelines for Effect Atom

1. **Atoms are Immutable References**: Never mutate atom values directly—always create new values
2. **Compose, Don't Coordinate**: Derive state through composition rather than manual synchronization
3. **Services for Side Effects**: Use Effect services for all external interactions
4. **Family for Dynamic State**: Use `Atom.family` for entity-specific state
5. **Reactivity for Cache**: Leverage reactivity keys for automatic cache invalidation
6. **Test at the Atom Level**: Test state transformations independent of components
7. **Keep Atoms Focused**: Each atom should represent one cohesive piece of state

### The Result

Effect Atom provides:

- **Type-safe state management** that catches errors at compile time
- **Compositional state transformations** that follow functional principles
- **Seamless Effect integration** for handling side effects
- **Reactive updates** without manual subscription management
- **Testing simplicity** through pure transformations
- **Performance optimization** through automatic memoization

This completes the bridge between Effect's powerful type system and React's component model, creating a unified approach to building type-safe, compositional applications.

### Guidelines for Compositional UI

1. **No Boolean Props**: If you're adding a boolean prop, create a new component instead
2. **Lift State Early**: Don't wait until you need it—lift state to providers from the start
3. **One Component, One Concern**: Each component does exactly one thing
4. **Compose, Don't Configure**: Build complex UIs by composing simple pieces
5. **Namespace Imports**: Import component modules as namespaces for clarity
6. **Provider Pattern**: Use context providers for state, not prop drilling
7. **Escape Hatches**: Always provide ways to render custom implementations

### The Result

Instead of a 500-line component with 30 boolean props, you have:

- Small, focused components that are easy to understand
- Flexible composition that handles any use case
- Clear separation between UI and state management
- Testable pieces that work in isolation
- AI-friendly code that's hard to get wrong

Remember: **Composition is all you need**.

### React Best Practices: Beyond Composition

## You Might Not Need an Effect

Effects are often overused in React. Most of the time, you don't need them. Here's when to avoid Effects and what to use instead.

### Transforming Data for Rendering

```typescript
// WRONG: Effect to compute derived state
function TodoList({ todos, filter }) {
  const [visibleTodos, setVisibleTodos] = useState([]);

  useEffect(() => {
    setVisibleTodos(todos.filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    }));
  }, [todos, filter]);

  return <ul>{visibleTodos.map(...)}</ul>;
}

// CORRECT: Calculate during render
function TodoList({ todos, filter }) {
  const visibleTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  return <ul>{visibleTodos.map(...)}</ul>;
}

// OPTIMAL: Memoize expensive calculations
function TodoList({ todos, filter }) {
  const visibleTodos = useMemo(() =>
    todos.filter(todo => {
      if (filter === 'active') return !todo.completed;
      if (filter === 'completed') return todo.completed;
      return true;
    }),
    [todos, filter]
  );

  return <ul>{visibleTodos.map(...)}</ul>;
}
```

### Resetting State When Props Change

```typescript
// WRONG: Effect to reset state
function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');

  useEffect(() => {
    setComment(''); // Reset when user changes
  }, [userId]);

  return <CommentForm comment={comment} onChange={setComment} />;
}

// CORRECT: Use a key to reset component state
function ProfilePage({ userId }) {
  return (
    <CommentForm
      key={userId} // Component remounts when userId changes
      userId={userId}
    />
  );
}

// ALTERNATIVE: Store previous value and reset during render
function ProfilePage({ userId }) {
  const [comment, setComment] = useState('');
  const [prevUserId, setPrevUserId] = useState(userId);

  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setComment('');
  }

  return <CommentForm comment={comment} onChange={setComment} />;
}
```

### Adjusting State When Props Change

```typescript
// WRONG: Effect to sync state with props
function List({ items }) {
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Reset selection if selected item was removed
    if (selectedItem && !items.includes(selectedItem)) {
      setSelectedItem(null);
    }
  }, [items, selectedItem]);

  return ...;
}

// CORRECT: Adjust during render
function List({ items }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [prevItems, setPrevItems] = useState(items);

  if (items !== prevItems) {
    setPrevItems(items);
    if (selectedItem && !items.includes(selectedItem)) {
      setSelectedItem(null);
    }
  }

  return ...;
}

// BETTER: Derive the valid selection
function List({ items }) {
  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = items.find(item => item.id === selectedId) ?? null;

  return ...;
}
```

### Sharing Logic Between Event Handlers

```typescript
// WRONG: Effect to handle both mount and click
function ProductPage({ product }) {
  useEffect(() => {
    logVisit(product.id);
  }, [product.id]);

  const handleBuyClick = () => {
    logVisit(product.id); // Duplicated logic
    addToCart(product);
  };

  return <button onClick={handleBuyClick}>Buy</button>;
}

// CORRECT: Extract shared logic
function ProductPage({ product }) {
  const hasLoggedVisit = useRef(false);

  const logVisitOnce = () => {
    if (!hasLoggedVisit.current) {
      logVisit(product.id);
      hasLoggedVisit.current = true;
    }
  };

  // Log on first render
  if (!hasLoggedVisit.current) {
    logVisitOnce();
  }

  const handleBuyClick = () => {
    logVisitOnce();
    addToCart(product);
  };

  return <button onClick={handleBuyClick}>Buy</button>;
}
```

### Sending POST Requests

```typescript
// WRONG: POST request in Effect
function Form() {
  const [data, setData] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && data) {
      post('/api/register', data);
    }
  }, [submitted, data]);

  const handleSubmit = (formData) => {
    setData(formData);
    setSubmitted(true);
  };

  return ...;
}

// CORRECT: POST in event handler
function Form() {
  const handleSubmit = async (formData) => {
    await post('/api/register', formData);
  };

  return ...;
}
```

### Chains of Computations

```typescript
// WRONG: Chain of Effects setting state
function Game() {
  const [card, setCard] = useState(null);
  const [goldCardCount, setGoldCardCount] = useState(0);
  const [round, setRound] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);

  useEffect(() => {
    if (card !== null && card.gold) {
      setGoldCardCount(c => c + 1);
    }
  }, [card]);

  useEffect(() => {
    if (goldCardCount > 3) {
      setRound(r => r + 1);
      setGoldCardCount(0);
    }
  }, [goldCardCount]);

  useEffect(() => {
    if (round > 5) {
      setIsGameOver(true);
    }
  }, [round]);

  return ...;
}

// CORRECT: Calculate everything in event handler
function Game() {
  const [state, setState] = useState({
    card: null,
    goldCardCount: 0,
    round: 1,
    isGameOver: false
  });

  const playCard = (nextCard) => {
    setState(state => {
      let newState = { ...state, card: nextCard };

      if (nextCard.gold) {
        newState.goldCardCount++;
      }

      if (newState.goldCardCount > 3) {
        newState.round++;
        newState.goldCardCount = 0;
      }

      if (newState.round > 5) {
        newState.isGameOver = true;
      }

      return newState;
    });
  };

  return ...;
}
```

### Initializing the Application

```typescript
// WRONG: Effect for one-time initialization
function App() {
  useEffect(() => {
    loadDataFromLocalStorage();
    checkAuthToken();
  }, []);

  return ...;
}

// CORRECT: Initialize outside components
if (typeof window !== 'undefined') {
  loadDataFromLocalStorage();
  checkAuthToken();
}

function App() {
  return ...;
}

// OR: Use a flag for truly once-per-app initialization
let didInit = false;

function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true;
      loadDataFromLocalStorage();
      checkAuthToken();
    }
  }, []);

  return ...;
}
```

### Fetching Data

```typescript
// WRONG: Race conditions with Effects
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(data => setResults(data)); // May set stale results
  }, [query]);

  return ...;
}

// BETTER: Cleanup function to ignore stale responses
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let ignore = false;

    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(data => {
        if (!ignore) {
          setResults(data);
        }
      });

    return () => {
      ignore = true;
    };
  }, [query]);

  return ...;
}

// BEST: Use a data fetching library or custom hook
import { useQuery } from '@tanstack/react-query';

function SearchResults({ query }) {
  const { data: results = [] } = useQuery({
    queryKey: ['search', query],
    queryFn: () => fetch(`/api/search?q=${query}`).then(res => res.json())
  });

  return ...;
}
```

## useTransition: Modern Loading States

Instead of manually managing loading states, use `useTransition` for non-blocking updates.

### The Old Way: Manual Loading States

```typescript
// OLD: Manual loading state management
function TabContainer() {
  const [activeTab, setActiveTab] = useState('posts');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState(null);

  const switchTab = async (tab) => {
    setIsLoading(true);
    const newData = await fetchTabData(tab);
    setData(newData);
    setActiveTab(tab);
    setIsLoading(false);
  };

  return (
    <div>
      <TabButtons onSwitch={switchTab} active={activeTab} />
      {isLoading ? <Spinner /> : <TabContent data={data} />}
    </div>
  );
}
```

### The New Way: useTransition

```typescript
// NEW: useTransition for non-blocking updates
import { useTransition, Suspense } from 'react';

function TabContainer() {
  const [activeTab, setActiveTab] = useState('posts');
  const [isPending, startTransition] = useTransition();

  const switchTab = (tab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  return (
    <div>
      <TabButtons
        onSwitch={switchTab}
        active={activeTab}
        isPending={isPending}
      />
      <Suspense fallback={<Spinner />}>
        <TabContent tab={activeTab} />
      </Suspense>
    </div>
  );
}

// The tab content fetches its own data
function TabContent({ tab }) {
  const data = use(fetchTabData(tab)); // React 19 'use' hook
  return <div>{/* render data */}</div>;
}
```

### Real-World Example: Search with Transitions

```typescript
// Without transitions: UI blocks during search
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (value) => {
    setQuery(value);
    setIsSearching(true);
    const data = await searchAPI(value);
    setResults(data);
    setIsSearching(false);
  };

  return (
    <div>
      <SearchInput
        value={query}
        onChange={handleSearch}
        disabled={isSearching}
      />
      {isSearching ? (
        <LoadingSpinner />
      ) : (
        <SearchResults results={results} />
      )}
    </div>
  );
}

// With transitions: UI stays responsive
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value) => {
    setQuery(value); // Update input immediately

    startTransition(async () => {
      const data = await searchAPI(value);
      setResults(data); // Update results in transition
    });
  };

  return (
    <div>
      <SearchInput
        value={query}
        onChange={handleSearch}
      />
      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <SearchResults results={results} />
      </div>
    </div>
  );
}
```

### Filtering Large Lists

```typescript
// Without transitions: Input lags with large lists
function FilterableList({ items }) {
  const [filter, setFilter] = useState('');

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter items..."
      />
      <ul>
        {filteredItems.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

// With transitions: Input stays responsive
function FilterableList({ items }) {
  const [filter, setFilter] = useState('');
  const [displayFilter, setDisplayFilter] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (value) => {
    setFilter(value); // Update input immediately

    startTransition(() => {
      setDisplayFilter(value); // Update filtered list in transition
    });
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(displayFilter.toLowerCase())
  );

  return (
    <div>
      <input
        value={filter}
        onChange={e => handleFilterChange(e.target.value)}
        placeholder="Filter items..."
      />
      <ul style={{ opacity: isPending ? 0.5 : 1 }}>
        {filteredItems.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Form Validation with Transitions

```typescript
// Complex form validation that doesn't block typing
function ValidatedForm() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isPending, startTransition] = useTransition();

  const handleInputChange = (field, value) => {
    // Update input immediately
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validate in transition (won't block typing)
    startTransition(async () => {
      const validationErrors = await validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: validationErrors }));
    });
  };

  return (
    <form>
      <input
        value={formData.email}
        onChange={e => handleInputChange('email', e.target.value)}
        className={errors.email ? 'error' : ''}
      />
      {errors.email && (
        <span style={{ opacity: isPending ? 0.5 : 1 }}>
          {errors.email}
        </span>
      )}
      {/* More fields... */}
    </form>
  );
}
```

### Best Practices for Transitions

1. **User Input Should Never Block**: Keep input fields responsive by updating them outside transitions
2. **Visual Feedback**: Use `isPending` to show that something is happening (opacity, spinner, etc.)
3. **Combine with Suspense**: For data fetching, combine transitions with Suspense boundaries
4. **Don't Overuse**: Not everything needs a transition—use for expensive updates that would block the UI

```typescript
// Complete example: Data table with sorting and filtering
function DataTable({ data }) {
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filter, setFilter] = useState('');

  // Display states (updated in transitions)
  const [displaySort, setDisplaySort] = useState({ column: 'name', direction: 'asc' });
  const [displayFilter, setDisplayFilter] = useState('');

  const [isSorting, startSortTransition] = useTransition();
  const [isFiltering, startFilterTransition] = useTransition();

  const handleSort = (column) => {
    const newDirection =
      column === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';

    setSortColumn(column);
    setSortDirection(newDirection);

    startSortTransition(() => {
      setDisplaySort({ column, direction: newDirection });
    });
  };

  const handleFilter = (value) => {
    setFilter(value);

    startFilterTransition(() => {
      setDisplayFilter(value);
    });
  };

  // Expensive computation happens with display values
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter
    if (displayFilter) {
      result = result.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(displayFilter.toLowerCase())
        )
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[displaySort.column];
      const bVal = b[displaySort.column];
      const multiplier = displaySort.direction === 'asc' ? 1 : -1;
      return aVal > bVal ? multiplier : -multiplier;
    });

    return result;
  }, [data, displayFilter, displaySort]);

  const isPending = isSorting || isFiltering;

  return (
    <div>
      <input
        value={filter}
        onChange={e => handleFilter(e.target.value)}
        placeholder="Filter..."
      />

      <table style={{ opacity: isPending ? 0.6 : 1 }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col} onClick={() => handleSort(col)}>
                {col}
                {sortColumn === col && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {processedData.map(row => (
            <tr key={row.id}>
              {/* Render row */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Summary: Effects and Transitions

**Avoid Effects when you can:**

- Calculate derived state during render
- Reset components with keys
- Update state in event handlers
- Use proper cleanup for async operations

**Use Transitions for:**

- Expensive computations that would block the UI
- Large list filtering/sorting
- Tab switching with data fetching
- Form validation that shouldn't block typing

The goal is always the same: **Keep the UI responsive and predictable**.

---

---

## Convex and Effect Integration

When bridging Convex functions with Effect services, follow these patterns for clean, efficient code.

### Direct Service Access Pattern

**DO:** Use direct service accessors with proper layer provision

```typescript
// ✅ GOOD: Direct service access, single promise chain
export const getOrCreateUserCart = mutation({
  args: {
    userId: v.id("users"),
    locationId: v.id("locations"),
    currency: v.union(v.literal("USD"), v.literal("EUR"), v.literal("GBP")),
  },
  handler: (ctx, { userId, locationId, currency }) =>
    CartDomain.getOrCreateUserCart(
      userId,
      locationId,
      Currency.make(currency),
    ).pipe(
      Effect.provide(CartDomain.Default),
      Effect.provide(makeConvexMutationLayer(ctx)),
      Effect.runPromise,
    ),
});
```

**DON'T:** Use unnecessary async/await or Effect.gen when not needed

```typescript
// ❌ BAD: Unnecessary async/await adds extra microtask
export const getOrCreateUserCart = mutation({
  args: { ... },
  handler: async (ctx, args) =>
    await Effect.gen(function* () {
      const cartDomain = yield* CartDomain;
      return yield* cartDomain.getOrCreateUserCart(...);
    }).pipe(
      Effect.provide(makeConvexMutationLayer(ctx)),
      Effect.runPromise
    ),
});
```

### Simple Transformations

**DO:** Use Effect.map for simple result transformations

```typescript
// ✅ GOOD: Clean transformation pipeline
export const clearCart = mutation({
  args: { cartId: v.id("carts") },
  handler: (ctx, { cartId }) =>
    CartDomain.clearCart(cartId).pipe(
      Effect.map(() => ({ success: true })),
      Effect.provide(CartDomain.Default),
      Effect.provide(makeConvexMutationLayer(ctx)),
      Effect.runPromise,
    ),
});
```

### Conditional Logic

**DO:** Use ternary operators for simple conditionals in pipelines

```typescript
// ✅ GOOD: Clean conditional without Effect.gen
export const addItemToCart = mutation({
  args: {
    cartId: v.id("carts"),
    itemId: v.id("items"),
    quantity: v.optional(v.number()),
  },
  handler: (ctx, { cartId, itemId, quantity }) =>
    (quantity && quantity > 1
      ? CartDomain.addLineItems(cartId, itemId, quantity)
      : CartDomain.addLineItem(cartId, itemId)
    ).pipe(
      Effect.map(() => ({ success: true })),
      Effect.provide(CartDomain.Default),
      Effect.provide(makeConvexMutationLayer(ctx)),
      Effect.runPromise,
    ),
});
```

### Complex Operations

**DO:** Use Effect.gen only when you need sequential operations with intermediate results

```typescript
// ✅ GOOD: Effect.gen for complex logic needing intermediate values
export const getUserCart = query({
  args: {
    userId: v.id("users"),
    locationId: v.id("locations"),
  },
  handler: (ctx, { userId, locationId }) =>
    Effect.gen(function* () {
      const queryRepo = yield* CartQueryRepo;

      // Need intermediate result for filtering
      const userCarts = yield* queryRepo.getByEntity(userId);

      // Use intermediate result
      const locationCart = userCarts.find(
        (cart) => cart.locationId === locationId,
      );

      if (!locationCart) {
        return null;
      }

      // Another operation based on filtered result
      const cartOption = yield* queryRepo.get(locationCart._id, {
        expand: ["items"],
      });

      return Option.getOrNull(cartOption);
    }).pipe(
      Effect.provide(CartQueryRepo.Default),
      Effect.provide(makeConvexQueryLayer(ctx)),
      Effect.runPromise,
    ),
});
```

### Key Principles

1. **Return promises directly** - Convex handlers return promises, don't await unnecessarily
2. **Use service accessors** - Access services with direct static methods when available
3. **Provide layers in order** - Service layers first, then context layers
4. **Destructure args** - Use destructuring in handler parameters for cleaner code
5. **Effect.gen only when needed** - Use it for complex flows, not simple service calls

### Performance Benefits

- No extra microtasks from unnecessary async/await
- Cleaner stack traces
- More readable code
- Better TypeScript inference

---

## Appendix A: Naming Conventions

### Types

- PascalCase for type names: `LineItem`, `PaymentIntent`
- Suffix with purpose when needed: `UserRepository`, `PaymentGateway`

### Functions

- camelCase for functions: `make`, `setPrice`, `getAmount`
- Verb prefixes for actions: `create`, `update`, `delete`
- `is` prefix for predicates: `isZero`, `isCents`
- `get` prefix for accessors: `getAmount`, `getCurrency`
- `set` prefix for immutable updates: `setPrice`, `setNotes`

### Constants

- camelCase for values: `zero`, `empty`
- SCREAMING_SNAKE_CASE only for environment constants

### Modules

- Singular nouns for type modules: `Cent`, `Currency`, `LineItem`
- Plural or descriptive for utility modules: `Arrays`, `Validators`

---

## Appendix B: Import Organization

Order imports consistently:

1. External libraries
2. Type imports
3. Internal modules
4. Relative imports

```typescript
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { Doc } from "@/_generated/dataModel";
import type { Id } from "@/_generated/dataModel";
import { PaymentIntentDomain } from "./PaymentIntentDomain";
import * as PI from "@/schemas/PaymentIntent";
```

---

_This guide is a living document. Each section will be expanded with detailed examples, anti-patterns, and migration strategies._
