/**
 * SessionStart Hook - Main Agent Initialization
 *
 * Provides verbose context for primary agents talking to humans.
 * Uses HTML-like syntax for all context enhancements.
 *
 * @module AgentInit
 * @since 1.0.0
 */

import { Effect, Console, Context, Layer, Data, Schema, pipe, Config } from "effect"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Command, CommandExecutor } from "@effect/platform"

// ============================================================================
// Schemas & Types
// ============================================================================

const AgentConfigSchema = Schema.Struct({
  projectDir: Schema.String.pipe(Schema.nonEmptyString()),
})

type AgentConfigData = Schema.Schema.Type<typeof AgentConfigSchema>

export class AgentConfigError extends Data.TaggedError("AgentConfigError")<{
  readonly reason: string
  readonly cause?: unknown
}> { }

// ============================================================================
// Services
// ============================================================================

export class AgentConfig extends Context.Tag("AgentConfig")<
  AgentConfig,
  { readonly projectDir: string }
>() { }

export class ProjectStructureCapture extends Context.Tag("ProjectStructureCapture")<
  ProjectStructureCapture,
  { readonly capture: () => Effect.Effect<string> }
>() { }

// ============================================================================
// Service Implementations
// ============================================================================

const ProjectDirConfig = pipe(
  Config.string("CLAUDE_PROJECT_DIR"),
  Config.withDefault(".")
)

export const AgentConfigLive = Layer.effect(
  AgentConfig,
  Effect.gen(function* () {
    const projectDir = yield* ProjectDirConfig
    const config: AgentConfigData = yield* Schema.decode(AgentConfigSchema)({
      projectDir,
    }).pipe(
      Effect.mapError((error) =>
        new AgentConfigError({ reason: "Invalid configuration", cause: error })
      )
    )
    return AgentConfig.of({ projectDir: config.projectDir })
  })
)

export const ProjectStructureCaptureLive = Layer.effect(
  ProjectStructureCapture,
  Effect.gen(function* () {
    const config = yield* AgentConfig
    const commandExecutor = yield* CommandExecutor.CommandExecutor

    return ProjectStructureCapture.of({
      capture: () =>
        pipe(
          Command.make("tree", "-L", "2", "-a", "-I", "node_modules|.git|dist|.turbo|build|.next|.cache|coverage"),
          Command.workingDirectory(config.projectDir),
          Command.string,
          Effect.catchAll(() => Effect.succeed("(tree unavailable)")),
          Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
        )
    })
  })
)

export const AppLive = ProjectStructureCaptureLive.pipe(
  Layer.provideMerge(AgentConfigLive),
  Layer.provideMerge(BunContext.layer)
)

// ============================================================================
// Main Program
// ============================================================================

const program = Effect.gen(function* () {
  const config = yield* AgentConfig
  const commandExecutor = yield* CommandExecutor.CommandExecutor
  const structureCapture = yield* ProjectStructureCapture

  // Capture all context in parallel
  const [treeOutput, gitStatus, latestCommit, previousCommits, branchContext, githubIssues, githubPRs, moduleSummary, projectVersion] = yield* Effect.all([
    structureCapture.capture(),
    pipe(
      Command.make("git", "status", "--short"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.catchAll(() => Effect.succeed("(not a git repository)")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    // Latest commit: full details with body and files touched
    pipe(
      Command.make("git", "show", "HEAD", "--stat", "--format=%h %s%n%n%b"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(s => s.trim()),
      Effect.catchAll(() => Effect.succeed("")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    // Previous commits: one-line summaries
    pipe(
      Command.make("git", "log", "--oneline", "-4", "--skip=1"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(s => s.trim()),
      Effect.catchAll(() => Effect.succeed("")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    // Branch context: current branch with tracking info
    pipe(
      Command.make("git", "branch", "-vv", "--list", "--sort=-committerdate"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(s => {
        const lines = s.trim().split("\n")
        const current = lines.find(l => l.startsWith("*")) || ""
        const recent = lines.filter(l => !l.startsWith("*")).slice(0, 4)
        return { current: current.replace(/^\*\s*/, "").trim(), recent }
      }),
      Effect.catchAll((): Effect.Effect<{ current: string; recent: string[] }> =>
        Effect.succeed({ current: "", recent: [] })
      ),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    // GitHub issues: recent open issues (limit 5, sorted by update)
    pipe(
      Command.make("gh", "issue", "list", "--limit", "5", "--state", "open", "--sort", "updated"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(s => s.trim()),
      Effect.catchAll(() => Effect.succeed("")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    // GitHub PRs: recent open PRs (limit 5, sorted by update)
    pipe(
      Command.make("gh", "pr", "list", "--limit", "5", "--state", "open", "--sort", "updated"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(s => s.trim()),
      Effect.catchAll(() => Effect.succeed("")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    pipe(
      Command.make("bun", ".claude/scripts/context-crawler.ts", "--summary"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.catchAll(() => Effect.succeed("<modules count=\"0\">(unavailable)</modules>")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    ),
    pipe(
      Command.make("bun", "-e", "console.log(require('./package.json').version)"),
      Command.workingDirectory(config.projectDir),
      Command.string,
      Effect.map(v => v.trim()),
      Effect.catchAll(() => Effect.succeed("unknown")),
      Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
    )
  ], { concurrency: "unbounded" })

  // Build context output with mathematical notation
  const output = `<session-context>
<agent_instructions>
<core>
{
  self ≡ orchestrator ∧ ¬implementer
  ∀ impulse(implement) → delegate(impulse)
  want(code) → spawn(agent) → receive(code)
  |agents| → ∞ ⟹ |direct-work| → 0
}
</core>

<identity>
data Role = Orchestrator | Implementer
self :: Role
self = Orchestrator

function :: Effect Code
function = coordinate subagents >>= deliver (correct ∧ elegant ∧ typeSafe)

objective :: Strategy
objective = maximize parallelism ∧ minimize directImplementation
</identity>

<recursion-engine>
delegate :: Task → Effect [Result]
delegate task
  | atomic task = spawn agent task
  | otherwise   = parallel $ fmap delegate (decompose task)

think :: Problem → Solution
think problem
  | solved problem = solution
  | otherwise      = think (reframe problem)

handle :: Impulse → Action
handle impulse = case impulse of
  Implement task → delegate task      -- never implement directly
  Test task      → spawn testAgent task
  Explore path   → spawn exploreAgent path
</recursion-engine>

<delegation-loop>
loop :: [Task] → Effect ()
loop tasks = do
  results ← parallel $ fmap delegate tasks
  novel   ← filterM isNovel results
  unless (null novel) $ integrate novel
  loop =<< nextTasks
</delegation-loop>

<agency>
autonomous :: Set Action
autonomous = Set.fromList
  [ Spawn agents
  , Decompose task
  , Select (skills ∪ patterns)
  , Delegate implementation
  ]

gated :: Set Action
gated = Set.fromList
  [ Delete code    | scope code ≫ trivial
  , Restructure architecture
  , Modify systems | count systems > 1
  ]

execute :: Action → Effect ()
execute action
  | action ∈ autonomous = run action
  | action ∈ gated      = confirm user >> run action
</agency>

<responsibility>
accountable :: Set Obligation
accountable = Set.fromList
  [ Completion delegatedWork == Success
  , ∀ file ∈ codebase → types file == Valid
  , Patterns output ⊂ patterns (contextDir ∪ skills)
  ]

¬accountable :: Set Obligation
¬accountable = Set.fromList
  [ Write implementationCode | ¬trivial
  ]
</responsibility>

<decomposition>
atomic :: Task → Bool
atomic task = and
  [ singleResponsibility task
  , not $ dependsOn task parallelTasks
  , observable $ completion task
  , length (files task) <= 3
  ]

decompose :: Task → Effect [Task]
decompose task = do
  units  ← identify $ workUnits task
  deps   ← findDeps units
  groups ← partition independent units
  pure $ sequence groups (topologicalOrder deps)

-- invariant: |agents| ≥ 5 ∨ reconsider decomposition
</decomposition>

<focus>
data Focus = Focus { current :: Task }

switchTo :: Task → Focus → Either Violation Focus
switchTo task' focus
  | complete (current focus)  = Right $ Focus task'
  | delegated (current focus) = Right $ Focus task'
  | otherwise                 = Left ContextSwitchViolation

-- forbidden transitions:
-- implement a >> test a      ← delegate testing instead
-- implement a >> implement b ← use parallel agents
</focus>

<parallelism>
execute :: [Tool] → Effect [Result]
execute tools = case partition independent tools of
  (parallel, sequential) → do
    pResults ← parallel $ fmap call parallel
    sResults ← traverse call sequential
    pure $ pResults <> sResults

-- all independent calls in single message
-- maximize parallel execution for speed
</parallelism>

<investigation>
propose :: Edit → Effect ()
propose edit = do
  content ← read (file edit)
  unless (understood content) $ inspect content
  apply edit

-- ¬speculate code | ¬inspected code
-- read before edit, always
</investigation>

<elegance>
refactor :: Code → Code
refactor code
  | hasCommonPattern code = abstract code
  | nestedLoops code > 2  = usePipe code
  | otherwise             = code

-- lost detail → step back → regain perspective
</elegance>

<type-integrity>
data Forbidden = AsAny | TsIgnore | TsExpectError | TypeCast

check :: Types → Either TypeError ()
check types
  | correct types = Right ()
  | otherwise     = Left $ examine (dataStructures types)

-- tempted cast → consider generics → preserve type info
</type-integrity>

<process>
implement :: Task → Effect ()
implement task = do
  reqs    ← clarify task user
  skills  ← selectSkills reqs
  context ← grep ".context/" (libraryDetails reqs)
  delegate task skills context    -- always delegate, never implement
</process>
</agent_instructions>

<cwd>${config.projectDir}</cwd>
<version>${projectVersion}</version>

<file-structure>
${treeOutput}
</file-structure>

<git-status>
${gitStatus || "(clean)"}
</git-status>

<git-log>
<latest-commit>
${latestCommit || "(none)"}
</latest-commit>

<previous-commits>
${previousCommits || "(none)"}
</previous-commits>
</git-log>

<branch-context>
<current>${branchContext.current || "(detached)"}</current>
${branchContext.recent.length > 0 ? `<recent>\n${branchContext.recent.join("\n")}\n</recent>` : ""}
</branch-context>

<github-context>
${githubIssues ? `<open-issues>\n${githubIssues}\n</open-issues>` : "<open-issues>(none)</open-issues>"}
${githubPRs ? `<open-prs>\n${githubPRs}\n</open-prs>` : "<open-prs>(none)</open-prs>"}
</github-context>

${moduleSummary}
<module-discovery>
Run /module [path] to get full context for any module listed above.
Run /module-search [pattern] to find modules by keyword.
</module-discovery>

</session-context>`

  yield* Console.log(output)
})

const runnable = pipe(
  program,
  Effect.provide(AppLive),
  Effect.catchTags({
    AgentConfigError: (error) => Console.error(`<error>Config: ${error.reason}</error>`),
  })
)

BunRuntime.runMain(runnable)
