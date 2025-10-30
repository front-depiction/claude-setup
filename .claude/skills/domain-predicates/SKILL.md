---
name: domain-predicates
description: Generate comprehensive predicates and orders for domain types using typeclass patterns
---

# Domain Predicates Skill

Generate complete sets of predicates and Order instances for domain types, derived from typeclass implementations.

## Pattern: Typeclass-Derived Predicates

When a domain type implements a typeclass, re-export all relevant predicates:

```typescript
import * as Schedulable$ from "@/typeclass/Schedulable"
import * as Durable$ from "@/typeclass/Durable"
import * as Order from "effect/Order"

// Create typeclass instances
export const Schedulable = Schedulable$.make<Appointment>(
  (self) => self.date,
  (self, date) => Appointment.make({ ...self, date: DateTime.toUtc(date) })
)

export const Durable = Durable$.make<Appointment>(
  (self) => self.duration,
  (self, duration) => Appointment.make({ ...self, duration: Duration.decode(duration) })
)

// Re-export all Schedulable predicates
export const isScheduledBefore = Schedulable$.isScheduledBefore(Schedulable)
export const isScheduledAfter = Schedulable$.isScheduledAfter(Schedulable)
export const isScheduledBetween = Schedulable$.isScheduledBetween(Schedulable)
export const isScheduledOn = Schedulable$.isScheduledOn(Schedulable)
export const isScheduledToday = Schedulable$.isScheduledToday(Schedulable)
export const isScheduledThisWeek = Schedulable$.isScheduledThisWeek(Schedulable)
export const isScheduledThisMonth = Schedulable$.isScheduledThisMonth(Schedulable)

// Re-export all Durable predicates
export const hasMinimumDuration = Durable$.isMoreThan(Durable)
export const hasMaximumDuration = Durable$.isLessThan(Durable)
export const hasDurationBetween = Durable$.isBetween(Durable)
export const hasExactDuration = Durable$.hasExactDuration(Durable)
```

## Pattern: Comprehensive Order Instances

Provide extensive sorting capabilities:

```typescript
// Schedulable orders (temporal sorting)
export const OrderByScheduledTime = Schedulable$.OrderByScheduledTime(Schedulable)
export const OrderByDayOfWeek = Schedulable$.OrderByDayOfWeek(Schedulable)
export const OrderByTimeOfDay = Schedulable$.OrderByTimeOfDay(Schedulable)
export const OrderByHour = Schedulable$.OrderByHour(Schedulable)
export const OrderByMonth = Schedulable$.OrderByMonth(Schedulable)
export const OrderByYear = Schedulable$.OrderByYear(Schedulable)
export const OrderByYearMonth = Schedulable$.OrderByYearMonth(Schedulable)
export const OrderByDateOnly = Schedulable$.OrderByDateOnly(Schedulable)
export const OrderByDayPeriod = Schedulable$.OrderByDayPeriod(Schedulable)
export const OrderByBusinessHours = Schedulable$.OrderByBusinessHours(Schedulable)
export const OrderByWeekdayFirst = Schedulable$.OrderByWeekdayFirst(Schedulable)

// Durable orders (duration sorting)
export const OrderByDuration = Durable$.OrderByDuration(Durable)
export const OrderByHours = Durable$.OrderByHours(Durable)
export const OrderByMinutes = Durable$.OrderByMinutes(Durable)
export const OrderBySeconds = Durable$.OrderBySeconds(Durable)

// Domain-specific orders
export const OrderByStatus: Order.Order<Appointment> =
  Order.mapInput(String.Order, (appt) => appt.status)

export const OrderByStatusPriority: Order.Order<Appointment> =
  Order.mapInput(Order.number, (appt) => {
    const priorities: Record<AppointmentStatus, number> = {
      scheduled: 0,
      confirmed: 1,
      completed: 2,
      cancelled: 3,
    }
    return priorities[appt.status]
  })
```

## Usage Examples

Document how these predicates enable powerful filtering:

```typescript
/**
 * Filter appointments scheduled before a date.
 *
 * @example
 * import * as Appointment from "@/schemas/Appointment"
 * import * as DateTime from "effect/DateTime"
 * import * as Duration from "effect/Duration"
 * import * as Array from "effect/Array"
 * import { pipe } from "effect/Function"
 *
 * const tomorrow = DateTime.addDuration(
 *   DateTime.unsafeNow(),
 *   Duration.days(1)
 * )
 *
 * const beforeTomorrow = pipe(
 *   appointments,
 *   Array.filter(Appointment.isScheduledBefore(tomorrow))
 * )
 */
```

## Pattern: Complex Filtering

Combine predicates for sophisticated queries:

```typescript
import { pipe } from "effect/Function"
import * as Array from "effect/Array"

// Find long appointments this week
const longThisWeek = pipe(
  appointments,
  Array.filter(Appointment.isScheduledThisWeek),
  Array.filter(Appointment.hasMinimumDuration(Duration.hours(2)))
)

// Sort by multiple criteria
const sorted = pipe(
  appointments,
  Array.filter(Appointment.isScheduledToday),
  Array.sort(
    Order.combine(
      Appointment.OrderByStatusPriority,
      Appointment.OrderByScheduledTime
    )
  )
)
```

## Checklist for Complete Predicate Coverage

For Schedulable types:
- [ ] isScheduledBefore
- [ ] isScheduledAfter
- [ ] isScheduledBetween
- [ ] isScheduledOn
- [ ] isScheduledToday
- [ ] isScheduledThisWeek
- [ ] isScheduledThisMonth
- [ ] All Order instances

For Durable types:
- [ ] hasMinimumDuration (isMoreThan)
- [ ] hasMaximumDuration (isLessThan)
- [ ] hasDurationBetween (isBetween)
- [ ] hasExactDuration
- [ ] All Order instances

For domain-specific fields:
- [ ] Predicate for each variant (isPending, isActive, etc.)
- [ ] Order by field value
- [ ] Order by priority/importance if applicable

## Documentation Requirements

Every predicate and order MUST have:
- JSDoc description
- @category tag
- @since tag
- @example with realistic usage showing imports and pipe

This ensures predicates are discoverable and developers understand how to use them effectively.
