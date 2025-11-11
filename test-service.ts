import { Context, Effect, Layer } from "effect"

/**
 * A simple greeter service that provides greeting functionality.
 *
 * @category Services
 * @since 1.0.0
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { GreeterService, GreeterServiceLive } from "./test-service"
 *
 * const program = Effect.gen(function* () {
 *   const greeter = yield* GreeterService
 *   yield* greeter.greet()
 * })
 *
 * // Run the program with the live implementation
 * Effect.runPromise(
 *   program.pipe(Effect.provide(GreeterServiceLive))
 * )
 * ```
 */
export class GreeterService extends Context.Tag("GreeterService")<
  GreeterService,
  {
    readonly greet: () => Effect.Effect<void, never, never>
  }
>() {}

/**
 * Live implementation of the GreeterService.
 *
 * @category Layers
 * @since 1.0.0
 */
export const GreeterServiceLive = Layer.succeed(
  GreeterService,
  GreeterService.of({
    greet: () =>
      Effect.sync(() => {
        console.log("Hello World")
      })
  })
)
