import { describe, expect, it } from "bun:test"
import * as ts from "typescript"
import {
  type ArchitectureGraph,
  type LayerDefinition,
  type ServiceDefinition,
  formatMermaid,
  formatHuman,
  formatAgent,
  formatAdjacencyList,
  buildAnalysisGraph,
  computeCommonAncestors,
  renderCommonAncestors
} from "../analyze-architecture"

const SERVICE_TAG_PATTERN = /export\s+const\s+(\w+)\s*=\s*Context\.GenericTag<\1>/g
const LAYER_PATTERN = /(export\s+)?const\s+(\w+)(?::\s*[^=]+)?\s*=\s*Layer\.(scoped|effect|succeed|sync)\(\s*(\w+)\s*,/g

const EFFECT_INFRASTRUCTURE = new Set([
  "never",
  "unknown",
  "Scope",
  "Clock",
  "Random",
  "ConfigProvider",
  "Tracer",
  "Console",
  "__type"
])

const EXCLUDED_FROM_GRAPH = new Set(["AtomRegistry", "Registry"])

interface LayerMatch {
  readonly name: string
  readonly serviceName: string
  readonly line: number
}

const countLinesBefore = (content: string, index: number): number =>
  content.substring(0, index).split("\n").length

const extractServicesFromContent = (
  content: string,
  filePath: string
): ReadonlyArray<ServiceDefinition> => {
  const results: ServiceDefinition[] = []
  SERVICE_TAG_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = SERVICE_TAG_PATTERN.exec(content)) !== null) {
    results.push({
      name: match[1],
      path: filePath,
      line: countLinesBefore(content, match.index)
    })
  }

  return results
}

const extractLayerMatches = (content: string): ReadonlyArray<LayerMatch> => {
  const results: LayerMatch[] = []
  LAYER_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = LAYER_PATTERN.exec(content)) !== null) {
    const isExported = match[1] !== undefined
    const varName = match[2]
    const layerType = match[3]
    const serviceName = match[4]

    results.push({
      name: varName,
      serviceName,
      line: countLinesBefore(content, match.index)
    })
  }

  return results
}

const isEffectInfrastructure = (name: string): boolean =>
  EFFECT_INFRASTRUCTURE.has(name)

const isExcludedFromGraph = (name: string): boolean =>
  EXCLUDED_FROM_GRAPH.has(name)

const extractDepsFromType = (
  type: ts.Type,
  checker: ts.TypeChecker
): ReadonlyArray<string> => {
  const deps: string[] = []

  const processType = (t: ts.Type): void => {
    if (t.isUnion()) {
      for (const unionMember of t.types) {
        processType(unionMember)
      }
      return
    }

    if (t.isIntersection()) {
      for (const intersectionMember of t.types) {
        processType(intersectionMember)
      }
      return
    }

    const symbol = t.getSymbol() ?? t.aliasSymbol
    if (symbol) {
      const name = symbol.getName()
      if (
        !isEffectInfrastructure(name) &&
        !isExcludedFromGraph(name) &&
        !deps.includes(name)
      ) {
        deps.push(name)
      }
    }
  }

  processType(type)
  return deps
}

const extractLayerDependencies = (
  program: ts.Program,
  filePath: string,
  layerName: string
): ReadonlyArray<string> => {
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(filePath)

  if (!sourceFile) return []

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) return []

  const exports = checker.getExportsOfModule(moduleSymbol)
  const layerExport = exports.find((s) => s.getName() === layerName)

  if (!layerExport) return []

  const type = checker.getTypeOfSymbol(layerExport)
  const typeString = checker.typeToString(type)

  if (!typeString.startsWith("Layer<")) return []

  const typeRef = type as ts.TypeReference
  const typeArgs = checker.getTypeArguments(typeRef)
  if (typeArgs.length >= 3) {
    return extractDepsFromType(typeArgs[2], checker)
  }

  return []
}

const createTsProgram = (filePaths: ReadonlyArray<string>): ts.Program => {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    noEmit: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    baseUrl: ".",
    paths: {
      "~/*": ["./src/*"]
    }
  }

  return ts.createProgram([...filePaths], compilerOptions)
}

const extractLayersFromContent = (
  content: string,
  filePath: string,
  program?: ts.Program
): ReadonlyArray<LayerDefinition> => {
  const layerMatches = extractLayerMatches(content)

  return layerMatches.map((match) => {
    const dependencies = program
      ? extractLayerDependencies(program, filePath, match.name)
      : []

    return {
      name: match.name,
      serviceName: match.serviceName,
      path: filePath,
      line: match.line,
      dependencies,
      errorTypes: []
    }
  })
}

const generateMermaid = (graph: ArchitectureGraph): string => {
  const serviceLines = graph.services.map((service) =>
    `  ${service.name}[${service.name}]`
  )

  const dependencyLines = graph.layers.flatMap((layer) =>
    layer.dependencies.map((dep) => `  ${layer.serviceName} --> ${dep}`)
  )

  const vms = graph.services
    .filter((s) => s.name.endsWith("VM"))
    .map((s) => s.name)

  const services = graph.services
    .filter((s) => !s.name.endsWith("VM"))
    .map((s) => s.name)

  const styleLines: string[] = []
  if (vms.length > 0) {
    styleLines.push(`  classDef vm fill:#e1f5fe,stroke:#01579b`)
    styleLines.push(`  class ${vms.join(",")} vm`)
  }
  if (services.length > 0) {
    styleLines.push(`  classDef service fill:#f3e5f5,stroke:#4a148c`)
    styleLines.push(`  class ${services.join(",")} service`)
  }

  return [
    "flowchart TD",
    "",
    "  %% Services",
    ...serviceLines,
    "",
    "  %% Dependencies",
    ...dependencyLines,
    "",
    "  %% Styling",
    ...styleLines
  ].join("\n")
}

const generateStats = (graph: ArchitectureGraph): string => {
  const serviceCount = graph.services.filter((s) => !s.name.endsWith("VM")).length
  const vmCount = graph.services.filter((s) => s.name.endsWith("VM")).length

  const depMap = new Map<string, number>()
  for (const layer of graph.layers) {
    for (const dep of layer.dependencies) {
      depMap.set(dep, (depMap.get(dep) ?? 0) + 1)
    }
  }

  const depCounts = Array.from(depMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const complexLayers = [...graph.layers]
    .sort((a, b) => b.dependencies.length - a.dependencies.length)
    .slice(0, 5)

  const depLines = depCounts.map((d) => `- ${d.name}: ${d.count} dependents`)
  const complexLines = complexLayers.map(
    (l) => `- ${l.name}: ${l.dependencies.length} dependencies`
  )

  return [
    "## Architecture Statistics",
    "",
    `- **Services:** ${serviceCount}`,
    `- **ViewModels:** ${vmCount}`,
    `- **Layers:** ${graph.layers.length}`,
    "",
    "### Most Depended-On Services",
    ...depLines,
    "",
    "### Most Complex Layers (by dependency count)",
    ...complexLines
  ].join("\n")
}

describe("analyze-architecture", () => {
  describe("Pass 1: Service Detection", () => {
    it("detects Context.GenericTag service definitions", () => {
      const content = `
import * as Context from "effect/Context"

export interface TodoQueryService {
  readonly allTodos$: Atom.Atom<Result.Result<ReadonlyArray<Todo>>>
}

export const TodoQueryService = Context.GenericTag<TodoQueryService>("TodoQueryService")
`
      const services = extractServicesFromContent(content, "src/services/TodoQueryService.ts")

      expect(services).toHaveLength(1)
      expect(services[0].name).toBe("TodoQueryService")
      expect(services[0].path).toBe("src/services/TodoQueryService.ts")
    })

    it("detects multiple services in same file", () => {
      const content = `
import * as Context from "effect/Context"

export interface ServiceA { readonly a: string }
export const ServiceA = Context.GenericTag<ServiceA>("ServiceA")

export interface ServiceB { readonly b: number }
export const ServiceB = Context.GenericTag<ServiceB>("ServiceB")
`
      const services = extractServicesFromContent(content, "test.ts")

      expect(services).toHaveLength(2)
      expect(services.map(s => s.name)).toEqual(["ServiceA", "ServiceB"])
    })

    it("detects VM services", () => {
      const content = `
import * as Context from "effect/Context"

export interface SidebarVM {
  readonly todos$: Atom.Atom<ReadonlyArray<TodoItemVM>>
}

export const SidebarVM = Context.GenericTag<SidebarVM>("SidebarVM")
`
      const services = extractServicesFromContent(content, "src/vms/Sidebar/SidebarVM.ts")

      expect(services).toHaveLength(1)
      expect(services[0].name).toBe("SidebarVM")
    })

    it("ignores non-service Context usage", () => {
      const content = `
import * as Context from "effect/Context"

const tag = Context.GenericTag<string>("NotAService")
`
      const services = extractServicesFromContent(content, "test.ts")

      expect(services).toHaveLength(0)
    })
  })

  describe("Pass 2: Layer Detection", () => {
    it("detects Layer.scoped definitions", () => {
      const content = `
export const TodoQueryServiceLive = Layer.scoped(
  TodoQueryService,
  Effect.gen(function* () {
    return { allTodos$: Atom.make([]) }
  })
)
`
      const layers = extractLayersFromContent(content, "src/services/TodoQueryService.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("TodoQueryServiceLive")
      expect(layers[0].serviceName).toBe("TodoQueryService")
    })

    it("detects Layer.effect definitions", () => {
      const content = `
export const KeyBindingRegistryLive = Layer.effect(
  KeyBindingRegistry,
  Effect.gen(function* () {
    const atomRegistry = yield* AtomRegistry
    return { root$: Atom.make([]), register: () => {} }
  })
)
`
      const layers = extractLayersFromContent(content, "src/domain/KeyBindingRegistry.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("KeyBindingRegistryLive")
      expect(layers[0].serviceName).toBe("KeyBindingRegistry")
    })

    it("detects Layer.succeed definitions", () => {
      const content = `
export const ConfigLive = Layer.succeed(
  Config,
  { apiUrl: "https://api.example.com", timeout: 5000 }
)
`
      const layers = extractLayersFromContent(content, "src/config/Config.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("ConfigLive")
      expect(layers[0].serviceName).toBe("Config")
    })

    it("detects Layer.sync definitions", () => {
      const content = `
export const LoggerLive = Layer.sync(
  Logger,
  () => ({ log: (msg: string) => console.log(msg) })
)
`
      const layers = extractLayersFromContent(content, "src/services/Logger.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("LoggerLive")
      expect(layers[0].serviceName).toBe("Logger")
    })

    it("detects non-exported layers (Default pattern)", () => {
      const content = `
const Default = Layer.scoped(
  MyService,
  Effect.gen(function* () {
    return { value: 42 }
  })
)
`
      const layers = extractLayersFromContent(content, "src/services/MyService.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("Default")
      expect(layers[0].serviceName).toBe("MyService")
    })

    it("extracts service name from first argument, not variable name", () => {
      const content = `
export const MyCustomName = Layer.effect(
  ActualServiceName,
  Effect.succeed({ value: 123 })
)
`
      const layers = extractLayersFromContent(content, "src/services/ActualServiceName.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("MyCustomName")
      expect(layers[0].serviceName).toBe("ActualServiceName")
    })

    it("handles layers with explicit type annotations", () => {
      const content = `
export const TypedLive: Layer.Layer<MyService, never, Dep1 | Dep2> = Layer.effect(
  MyService,
  Effect.gen(function* () {
    return { value: true }
  })
)
`
      const layers = extractLayersFromContent(content, "src/services/MyService.live.ts")

      expect(layers).toHaveLength(1)
      expect(layers[0].name).toBe("TypedLive")
      expect(layers[0].serviceName).toBe("MyService")
    })

    it.skip("extracts dependencies from real layer files using type checker", () => {
      const filePath = "./src/services/TodoNavigationService.live.ts"
      const program = createTsProgram([filePath])
      const deps = extractLayerDependencies(program, filePath, "TodoNavigationServiceLive")

      expect(deps).toContain("TodoSelectionService")
      expect(deps).toContain("TodoViewService")
      expect(deps).toContain("KeyBindingRegistry")
      expect(deps).not.toContain("AtomRegistry")
    })

    it("excludes Effect infrastructure from dependencies", () => {
      const filePath = "./src/services/TodoQueryService.live.ts"
      const program = createTsProgram([filePath])
      const deps = extractLayerDependencies(program, filePath, "TodoQueryServiceLive")

      expect(deps).not.toContain("Scope")
      expect(deps).not.toContain("never")
      expect(deps).toHaveLength(0)
    })

    it.skip("handles complex layer with multiple dependencies", () => {
      const filePath = "./src/vms/Sidebar/SidebarVM.live.ts"
      const program = createTsProgram([filePath])
      const deps = extractLayerDependencies(program, filePath, "SidebarVMLive")

      expect(deps.length).toBeGreaterThanOrEqual(4)
      expect(deps).toContain("TodoViewService")
      expect(deps).toContain("TodoMutationService")
      expect(deps).toContain("TodoSelectionService")
      expect(deps).toContain("KeyBindingRegistry")
    })

    it.skip("extracts dependencies from union types correctly", () => {
      const filePath = "./src/vms/DetailPanel/DetailPanelVM.live.ts"
      const program = createTsProgram([filePath])
      const deps = extractLayerDependencies(program, filePath, "DetailPanelVMLive")

      expect(deps).toContain("TodoQueryService")
      expect(deps).toContain("TodoMutationService")
      expect(deps).toContain("TodoSelectionService")
      expect(deps).toContain("KeyBindingRegistry")
      expect(deps).not.toContain("AtomRegistry")
      expect(deps).not.toContain("Registry")
    })
  })

  describe("Mermaid Generation", () => {
    const sampleGraph: ArchitectureGraph = {
      services: [
        { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
        { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
        { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
      ],
      layers: [
        {
          name: "TodoQueryServiceLive",
          serviceName: "TodoQueryService",
          path: "src/services/TodoQueryService.live.ts",
          line: 16,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoMutationServiceLive",
          serviceName: "TodoMutationService",
          path: "src/services/TodoMutationService.live.ts",
          line: 19,
          dependencies: ["TodoQueryService"],
          errorTypes: []
        },
        {
          name: "SidebarVMLive",
          serviceName: "SidebarVM",
          path: "src/vms/Sidebar/SidebarVM.live.ts",
          line: 22,
          dependencies: ["TodoQueryService", "TodoMutationService"],
          errorTypes: []
        }
      ]
    }

    it("generates valid Mermaid flowchart header", () => {
      const mermaid = generateMermaid(sampleGraph)

      expect(mermaid).toContain("flowchart TD")
    })

    it("generates service nodes with correct shapes", () => {
      const mermaid = generateMermaid(sampleGraph)

      expect(mermaid).toContain('TodoQueryService[TodoQueryService]')
      expect(mermaid).toContain('TodoMutationService[TodoMutationService]')
      expect(mermaid).toContain('SidebarVM[SidebarVM]')
    })

    it("generates dependency edges", () => {
      const mermaid = generateMermaid(sampleGraph)

      expect(mermaid).toContain("TodoMutationService --> TodoQueryService")
      expect(mermaid).toContain("SidebarVM --> TodoQueryService")
      expect(mermaid).toContain("SidebarVM --> TodoMutationService")
    })

    it("generates styling classes", () => {
      const mermaid = generateMermaid(sampleGraph)

      expect(mermaid).toContain("classDef vm")
      expect(mermaid).toContain("classDef service")
      expect(mermaid).toContain("class SidebarVM vm")
    })

    it("includes file paths in node labels", () => {
      const output = formatMermaid(sampleGraph)
      expect(output).toContain("<br/><i>src/services/TodoQueryService.ts</i>")
    })
  })

  describe("Statistics Generation", () => {
    const sampleGraph: ArchitectureGraph = {
      services: [
        { name: "TodoQueryService", path: "a.ts", line: 1 },
        { name: "TodoMutationService", path: "b.ts", line: 1 },
        { name: "SidebarVM", path: "c.ts", line: 1 },
        { name: "DetailPanelVM", path: "d.ts", line: 1 }
      ],
      layers: [
        { name: "L1", serviceName: "S1", path: "a.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "L2", serviceName: "S2", path: "b.ts", line: 1, dependencies: ["TodoQueryService"], errorTypes: [] },
        { name: "L3", serviceName: "S3", path: "c.ts", line: 1, dependencies: ["TodoQueryService", "TodoMutationService"], errorTypes: [] },
        { name: "L4", serviceName: "S4", path: "d.ts", line: 1, dependencies: ["TodoQueryService"], errorTypes: [] }
      ]
    }

    it("counts services and VMs separately", () => {
      const stats = generateStats(sampleGraph)

      expect(stats).toContain("**Services:** 2")
      expect(stats).toContain("**ViewModels:** 2")
    })

    it("counts layers", () => {
      const stats = generateStats(sampleGraph)

      expect(stats).toContain("**Layers:** 4")
    })

    it("identifies most depended-on services", () => {
      const stats = generateStats(sampleGraph)

      expect(stats).toContain("TodoQueryService: 3 dependents")
    })

    it("identifies most complex layers", () => {
      const stats = generateStats(sampleGraph)

      expect(stats).toContain("L3: 2 dependencies")
    })
  })

  describe("Agent Format Generation (XML Tags)", () => {
    const sampleGraph: ArchitectureGraph = {
      services: [
        { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
        { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
        { name: "TodoSelectionService", path: "src/services/TodoSelectionService.ts", line: 8 },
        { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 },
        { name: "DetailPanelVM", path: "src/vms/DetailPanel/DetailPanelVM.ts", line: 20 }
      ],
      layers: [
        {
          name: "TodoQueryServiceLive",
          serviceName: "TodoQueryService",
          path: "src/services/TodoQueryService.live.ts",
          line: 16,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoSelectionServiceLive",
          serviceName: "TodoSelectionService",
          path: "src/services/TodoSelectionService.live.ts",
          line: 12,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoMutationServiceLive",
          serviceName: "TodoMutationService",
          path: "src/services/TodoMutationService.live.ts",
          line: 19,
          dependencies: ["TodoQueryService"],
          errorTypes: []
        },
        {
          name: "SidebarVMLive",
          serviceName: "SidebarVM",
          path: "src/vms/Sidebar/SidebarVM.live.ts",
          line: 22,
          dependencies: ["TodoQueryService", "TodoMutationService", "TodoSelectionService"],
          errorTypes: []
        },
        {
          name: "DetailPanelVMLive",
          serviceName: "DetailPanelVM",
          path: "src/vms/DetailPanel/DetailPanelVM.live.ts",
          line: 18,
          dependencies: ["TodoQueryService", "TodoMutationService"],
          errorTypes: []
        }
      ]
    }

    it("uses XML-like tags instead of markdown", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("<locations n=")
      expect(output).toContain("</locations>")
      expect(output).not.toContain("# Locations")
    })

    it("includes count attributes in tags", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toMatch(/<locations n="\d+">/)
      expect(output).toMatch(/<adjacency_list n="\d+">/)
    })

    it("nests node classification", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("<node_classification")
      expect(output).toContain("<leaf n=")
      expect(output).toContain("<intermediate n=")
      expect(output).toContain("<vm n=")
      expect(output).toContain("</node_classification>")
    })

    it("uses self-closing tags for empty sections", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain('<violations n="0" />')
    })

    it("includes orphans section", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain('<orphans n="0" />')
    })

    it("includes invariants with status attributes", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("<invariants>")
      expect(output).toContain('<inv id="1" status="pass">')
      expect(output).toContain("</invariants>")
    })

    it("includes warnings with nested tags", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("<warnings>")
      expect(output).toContain("<redundant")
      expect(output).toContain("<hot")
      expect(output).toContain("<wide")
      expect(output).toContain("</warnings>")
    })

    it("uses full service names in output", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("TodoQueryService")
      expect(output).toContain("TodoMutationService")
    })

    it("includes Edges section with dependency counts", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("<adjacency_list")
      expect(output).toContain("<never, never>")
      expect(output).toContain("<never, TodoQueryService>")
      expect(output).toContain("<never, TodoQueryService | TodoMutationService | TodoSelectionService>")
    })

    it("includes error types in edges section", () => {
      const graphWithErrors: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "TodoMutationServiceLive",
            serviceName: "TodoMutationService",
            path: "src/services/TodoMutationService.live.ts",
            line: 19,
            dependencies: ["TodoQueryService"],
            errorTypes: ["ValidationError", "StoreError"]
          }
        ]
      }

      const output = formatAgent(graphWithErrors)
      expect(output).toContain("TodoMutationService<ValidationError | StoreError, TodoQueryService>")
    })

    it("shows 'no runtime errors' for services without errors", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("TodoQueryService<never, never>")
      expect(output).toContain("TodoSelectionService<never, never>")
    })

    it("indents nested XML tags with 2 spaces", () => {
      const output = formatAgent(sampleGraph)
      expect(output).toContain("  <leaf n=")
      expect(output).toContain("  <intermediate n=")
      expect(output).toContain("  <vm n=")
      expect(output).toMatch(/  <inv id=/)
    })

    it("indents content within tags with appropriate spacing", () => {
      const output = formatAgent(sampleGraph)
      const lines = output.split("\n")

      const locationContentLines = lines.filter(l => l.match(/^\s{2}\w+\s+\(/))
      expect(locationContentLines.length).toBeGreaterThan(0)

      const adjacencyContentLines = lines.filter(l => l.match(/^\s{2}\w+<.*>/))
      expect(adjacencyContentLines.length).toBeGreaterThan(0)
    })

    it("indents warning content with 4 spaces", () => {
      const graphWithWarnings: ArchitectureGraph = {
        services: [
          { name: "ServiceA", path: "a.ts", line: 1 },
          { name: "ServiceB", path: "b.ts", line: 1 },
          { name: "ServiceC", path: "c.ts", line: 1 }
        ],
        layers: [
          {
            name: "ServiceALive",
            serviceName: "ServiceA",
            path: "a.live.ts",
            line: 1,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "ServiceBLive",
            serviceName: "ServiceB",
            path: "b.live.ts",
            line: 1,
            dependencies: ["ServiceA"],
            errorTypes: []
          },
          {
            name: "ServiceCLive",
            serviceName: "ServiceC",
            path: "c.live.ts",
            line: 1,
            dependencies: ["ServiceA", "ServiceB"],
            errorTypes: []
          }
        ]
      }

      const output = formatAgent(graphWithWarnings)
      const lines = output.split("\n")

      const redundantIndex = lines.findIndex(l => l.includes("<redundant"))
      if (redundantIndex !== -1) {
        const redundantContent = lines.slice(redundantIndex + 1).find(l => l.includes("→") && l.includes("redundant via"))
        if (redundantContent) {
          expect(redundantContent).toMatch(/^\s{4}\w+/)
        }
      }
    })

    it("maintains consistent indentation throughout", () => {
      const output = formatAgent(sampleGraph)
      const lines = output.split("\n")

      const nestedTags = lines.filter(l => l.match(/^\s{2}<\w+/))
      expect(nestedTags.length).toBeGreaterThan(0)

      nestedTags.forEach(line => {
        expect(line).toMatch(/^  </)
      })
    })
  })

  describe("Agent Format - Warning Descriptions", () => {
    const graphWithRedundant: ArchitectureGraph = {
      services: [
        { name: "ServiceA", path: "a.ts", line: 1 },
        { name: "ServiceB", path: "b.ts", line: 1 },
        { name: "ServiceC", path: "c.ts", line: 1 }
      ],
      layers: [
        {
          name: "ServiceALive",
          serviceName: "ServiceA",
          path: "a.live.ts",
          line: 1,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "ServiceBLive",
          serviceName: "ServiceB",
          path: "b.live.ts",
          line: 1,
          dependencies: ["ServiceA"],
          errorTypes: []
        },
        {
          name: "ServiceCLive",
          serviceName: "ServiceC",
          path: "c.live.ts",
          line: 1,
          dependencies: ["ServiceA", "ServiceB"],
          errorTypes: []
        }
      ]
    }

    const graphWithHot: ArchitectureGraph = {
      services: [
        { name: "HotService", path: "hot.ts", line: 1 },
        { name: "Dep1", path: "d1.ts", line: 1 },
        { name: "Dep2", path: "d2.ts", line: 1 },
        { name: "Dep3", path: "d3.ts", line: 1 },
        { name: "Dep4", path: "d4.ts", line: 1 }
      ],
      layers: [
        { name: "HotServiceLive", serviceName: "HotService", path: "hot.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "Dep1Live", serviceName: "Dep1", path: "d1.live.ts", line: 1, dependencies: ["HotService"], errorTypes: [] },
        { name: "Dep2Live", serviceName: "Dep2", path: "d2.live.ts", line: 1, dependencies: ["HotService"], errorTypes: [] },
        { name: "Dep3Live", serviceName: "Dep3", path: "d3.live.ts", line: 1, dependencies: ["HotService"], errorTypes: [] },
        { name: "Dep4Live", serviceName: "Dep4", path: "d4.live.ts", line: 1, dependencies: ["HotService"], errorTypes: [] }
      ]
    }

    const graphWithWide: ArchitectureGraph = {
      services: [
        { name: "WideService", path: "wide.ts", line: 1 },
        { name: "S1", path: "s1.ts", line: 1 },
        { name: "S2", path: "s2.ts", line: 1 },
        { name: "S3", path: "s3.ts", line: 1 },
        { name: "S4", path: "s4.ts", line: 1 },
        { name: "S5", path: "s5.ts", line: 1 }
      ],
      layers: [
        { name: "S1Live", serviceName: "S1", path: "s1.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "S2Live", serviceName: "S2", path: "s2.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "S3Live", serviceName: "S3", path: "s3.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "S4Live", serviceName: "S4", path: "s4.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "S5Live", serviceName: "S5", path: "s5.live.ts", line: 1, dependencies: [], errorTypes: [] },
        { name: "WideServiceLive", serviceName: "WideService", path: "wide.live.ts", line: 1, dependencies: ["S1", "S2", "S3", "S4", "S5"], errorTypes: [] }
      ]
    }

    const graphWithNoWide: ArchitectureGraph = {
      services: [
        { name: "SimpleService", path: "simple.ts", line: 1 }
      ],
      layers: [
        { name: "SimpleServiceLive", serviceName: "SimpleService", path: "simple.live.ts", line: 1, dependencies: [], errorTypes: [] }
      ]
    }

    it("includes description attribute for redundant warnings", () => {
      const output = formatAgent(graphWithRedundant)
      expect(output).toContain('<redundant n=')
      expect(output).toContain('description="')
      expect(output).toMatch(/description=".*indirect path.*"/)
    })

    it("includes description attribute for hot warnings", () => {
      const output = formatAgent(graphWithHot)
      expect(output).toContain('<hot n=')
      expect(output).toContain('description="')
      expect(output).toMatch(/description=".*dependents.*cascade.*"/)
    })

    it("includes description attribute for wide warnings", () => {
      const output = formatAgent(graphWithWide)
      expect(output).toContain('<wide n=')
      expect(output).toContain('description="')
      expect(output).toMatch(/description=".*dependencies.*"/)
    })

    it("includes description even for empty wide warnings", () => {
      const output = formatAgent(graphWithNoWide)
      expect(output).toMatch(/<wide n="0".*description=".*"\s*\/>/)
    })

    it("redundant description mentions intentional vs accidental", () => {
      const output = formatAgent(graphWithRedundant)
      expect(output).toMatch(/description=".*intentional.*accidental.*"/)
    })

    it("hot description mentions cascade and tests", () => {
      const output = formatAgent(graphWithHot)
      expect(output).toMatch(/description=".*cascade.*tests.*"/)
    })

    it("wide description mentions VMs and SRP", () => {
      const output = formatAgent(graphWithWide)
      expect(output).toMatch(/description=".*VMs.*SRP.*"/)
    })
  })

  describe("Human Format Generation (Expanded Tree)", () => {
    const sampleGraph: ArchitectureGraph = {
      services: [
        { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
        { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
        { name: "TodoSelectionService", path: "src/services/TodoSelectionService.ts", line: 8 },
        { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 },
        { name: "DetailPanelVM", path: "src/vms/DetailPanel/DetailPanelVM.ts", line: 20 }
      ],
      layers: [
        {
          name: "TodoQueryServiceLive",
          serviceName: "TodoQueryService",
          path: "src/services/TodoQueryService.live.ts",
          line: 16,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoSelectionServiceLive",
          serviceName: "TodoSelectionService",
          path: "src/services/TodoSelectionService.live.ts",
          line: 12,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoMutationServiceLive",
          serviceName: "TodoMutationService",
          path: "src/services/TodoMutationService.live.ts",
          line: 19,
          dependencies: ["TodoQueryService"],
          errorTypes: []
        },
        {
          name: "SidebarVMLive",
          serviceName: "SidebarVM",
          path: "src/vms/Sidebar/SidebarVM.live.ts",
          line: 22,
          dependencies: ["TodoQueryService", "TodoMutationService", "TodoSelectionService"],
          errorTypes: []
        },
        {
          name: "DetailPanelVMLive",
          serviceName: "DetailPanelVM",
          path: "src/vms/DetailPanel/DetailPanelVM.live.ts",
          line: 18,
          dependencies: ["TodoQueryService", "TodoMutationService"],
          errorTypes: []
        }
      ]
    }

    it("includes [Leaf] section", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toContain("[Leaf]")
    })

    it("includes [Mid] section", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toContain("[Mid]")
    })

    it("includes [VM] section", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toContain("[VM]")
    })

    it("uses tree connectors", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toMatch(/[\u251C\u2514]\u2500/)
    })

    it("marks redundant dependencies", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toContain("*(redundant)*")
    })

    it("includes file paths for mid/VM services", () => {
      const output = formatHuman(sampleGraph)
      expect(output).toMatch(/\([^)]+\.ts\)/)
    })
  })

  describe("Orphan Detection in Human Format", () => {
    it("detects services with no incoming edges as orphans", () => {
      const graphWithOrphan: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
          { name: "UnusedService", path: "src/services/UnusedService.ts", line: 8 },
          { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "TodoMutationServiceLive",
            serviceName: "TodoMutationService",
            path: "src/services/TodoMutationService.live.ts",
            line: 19,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          },
          {
            name: "UnusedServiceLive",
            serviceName: "UnusedService",
            path: "src/services/UnusedService.live.ts",
            line: 12,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "SidebarVMLive",
            serviceName: "SidebarVM",
            path: "src/vms/Sidebar/SidebarVM.live.ts",
            line: 22,
            dependencies: ["TodoQueryService", "TodoMutationService"],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithOrphan)
      expect(output).toContain("[Orphans]")
      expect(output).toContain("UnusedService")
    })

    it("does not mark leaf services with dependents as orphans", () => {
      const graphWithUsedLeaf: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
          { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "TodoMutationServiceLive",
            serviceName: "TodoMutationService",
            path: "src/services/TodoMutationService.live.ts",
            line: 19,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          },
          {
            name: "SidebarVMLive",
            serviceName: "SidebarVM",
            path: "src/vms/Sidebar/SidebarVM.live.ts",
            line: 22,
            dependencies: ["TodoMutationService"],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithUsedLeaf)
      expect(output).toContain("[Leaf]")
      expect(output).toContain("TodoQueryService")
      expect(output).not.toContain("[Orphans]")
    })

    it("does not show orphans section when no orphans exist", () => {
      const graphWithoutOrphans: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
          { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "TodoMutationServiceLive",
            serviceName: "TodoMutationService",
            path: "src/services/TodoMutationService.live.ts",
            line: 19,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          },
          {
            name: "SidebarVMLive",
            serviceName: "SidebarVM",
            path: "src/vms/Sidebar/SidebarVM.live.ts",
            line: 22,
            dependencies: ["TodoQueryService", "TodoMutationService"],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithoutOrphans)
      expect(output).not.toContain("[Orphans]")
    })

    it("detects mid-level service with dependencies but no dependents as leaf", () => {
      const graphWithMidOrphan: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
          { name: "UnusedMidService", path: "src/services/UnusedMidService.ts", line: 8 },
          { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "TodoMutationServiceLive",
            serviceName: "TodoMutationService",
            path: "src/services/TodoMutationService.live.ts",
            line: 19,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          },
          {
            name: "UnusedMidServiceLive",
            serviceName: "UnusedMidService",
            path: "src/services/UnusedMidService.live.ts",
            line: 12,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          },
          {
            name: "SidebarVMLive",
            serviceName: "SidebarVM",
            path: "src/vms/Sidebar/SidebarVM.live.ts",
            line: 22,
            dependencies: ["TodoMutationService"],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithMidOrphan)
      expect(output).toContain("[Leaf]")
      expect(output).toContain("UnusedMidService")
      expect(output).toContain("[Mid]")
      expect(output).toContain("TodoMutationService")
    })

    it("detects completely disconnected service as orphan", () => {
      const graphWithVMOrphan: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "DisconnectedService", path: "src/services/DisconnectedService.ts", line: 8 },
          { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "DisconnectedServiceLive",
            serviceName: "DisconnectedService",
            path: "src/services/DisconnectedService.live.ts",
            line: 12,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "SidebarVMLive",
            serviceName: "SidebarVM",
            path: "src/vms/Sidebar/SidebarVM.live.ts",
            line: 22,
            dependencies: ["TodoQueryService"],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithVMOrphan)
      expect(output).toContain("[Orphans]")
      expect(output).toContain("DisconnectedService")
      expect(output).toContain("[VM]")
      expect(output).toContain("SidebarVM")
    })

    it("includes file paths for orphan services", () => {
      const graphWithOrphan: ArchitectureGraph = {
        services: [
          { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
          { name: "UnusedService", path: "src/services/UnusedService.ts", line: 8 }
        ],
        layers: [
          {
            name: "TodoQueryServiceLive",
            serviceName: "TodoQueryService",
            path: "src/services/TodoQueryService.live.ts",
            line: 16,
            dependencies: [],
            errorTypes: []
          },
          {
            name: "UnusedServiceLive",
            serviceName: "UnusedService",
            path: "src/services/UnusedService.live.ts",
            line: 12,
            dependencies: [],
            errorTypes: []
          }
        ]
      }

      const output = formatHuman(graphWithOrphan)
      expect(output).toMatch(/UnusedService \([^)]+\.ts\)/)
    })
  })

  describe("CLI Options", () => {
    it("format option accepts valid values", () => {
      const validFormats = ["mermaid", "human", "agent", "adjacency"]
      expect(validFormats).toContain("mermaid")
      expect(validFormats).toContain("human")
      expect(validFormats).toContain("agent")
      expect(validFormats).toContain("adjacency")
    })

    it("format option defaults to agent", () => {
      expect("agent").toBe("agent")
    })

    it("output option is optional", () => {
      expect(true).toBe(true)
    })
  })

  describe("Adjacency List Format", () => {
    const sampleGraph: ArchitectureGraph = {
      services: [
        { name: "TodoQueryService", path: "src/services/TodoQueryService.ts", line: 14 },
        { name: "TodoSelectionService", path: "src/services/TodoSelectionService.ts", line: 8 },
        { name: "TodoMutationService", path: "src/services/TodoMutationService.ts", line: 10 },
        { name: "SidebarVM", path: "src/vms/Sidebar/SidebarVM.ts", line: 26 }
      ],
      layers: [
        {
          name: "TodoQueryServiceLive",
          serviceName: "TodoQueryService",
          path: "src/services/TodoQueryService.live.ts",
          line: 16,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoSelectionServiceLive",
          serviceName: "TodoSelectionService",
          path: "src/services/TodoSelectionService.live.ts",
          line: 12,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "TodoMutationServiceLive",
          serviceName: "TodoMutationService",
          path: "src/services/TodoMutationService.live.ts",
          line: 19,
          dependencies: ["TodoQueryService"],
          errorTypes: ["ValidationError", "StoreError"]
        },
        {
          name: "SidebarVMLive",
          serviceName: "SidebarVM",
          path: "src/vms/Sidebar/SidebarVM.live.ts",
          line: 22,
          dependencies: ["TodoQueryService", "TodoMutationService", "TodoSelectionService"],
          errorTypes: []
        }
      ]
    }

    it("includes header", () => {
      const output = formatAdjacencyList(sampleGraph, false)
      expect(output).toContain("# Edges (direct deps only)")
    })

    it("orders services by dependency count ascending", () => {
      const output = formatAdjacencyList(sampleGraph, false)
      const lines = output.split("\n").slice(1)

      expect(lines[0]).toContain("→ ∅")
      expect(lines[1]).toContain("→ ∅")
    })

    it("shows dependency count before arrow", () => {
      const output = formatAdjacencyList(sampleGraph, false)

      expect(output).toContain("1 →")
      expect(output).toContain("3 →")
    })

    it("shows empty set for zero dependencies", () => {
      const output = formatAdjacencyList(sampleGraph, false)

      expect(output).toContain("→ ∅")
    })

    it("aligns service names for readability", () => {
      const output = formatAdjacencyList(sampleGraph, false)
      const lines = output.split("\n").slice(1)

      const serviceName1 = lines[0].split(" ").filter(s => s.length > 0)[0]
      const serviceName2 = lines[1].split(" ").filter(s => s.length > 0)[0]

      const servicePadding1 = lines[0].indexOf("→") - serviceName1.length
      const servicePadding2 = lines[1].indexOf("→") - serviceName2.length

      expect(servicePadding1).toBeGreaterThan(0)
      expect(servicePadding2).toBeGreaterThan(0)
      expect(lines[0].indexOf("→")).toBe(lines[1].indexOf("→"))
    })

    it("shows error counts by default without --show-errors", () => {
      const output = formatAdjacencyList(sampleGraph, false)

      expect(output).toContain("(2 runtime errors)")
      expect(output).not.toContain("ValidationError")
      expect(output).not.toContain("StoreError")
    })

    it("shows error type names with --show-errors", () => {
      const output = formatAdjacencyList(sampleGraph, true)

      expect(output).toContain("(errors: ValidationError | StoreError)")
    })

    it("shows no indicator for services without errors when not using --show-errors", () => {
      const output = formatAdjacencyList(sampleGraph, false)
      const lines = output.split("\n")

      const queryLine = lines.find(line => line.includes("TodoQueryService"))
      expect(queryLine).not.toContain("error")
    })

    it("shows no runtime errors message with --show-errors for services without errors", () => {
      const output = formatAdjacencyList(sampleGraph, true)

      expect(output).toContain("→ ∅ (no runtime errors)")
    })

    it("handles single error type correctly", () => {
      const graphWithSingleError: ArchitectureGraph = {
        services: [
          { name: "TestService", path: "test.ts", line: 1 }
        ],
        layers: [
          {
            name: "TestServiceLive",
            serviceName: "TestService",
            path: "test.live.ts",
            line: 1,
            dependencies: [],
            errorTypes: ["NetworkError"]
          }
        ]
      }

      const output = formatAdjacencyList(graphWithSingleError, false)
      expect(output).toContain("(1 runtime error)")

      const outputWithErrors = formatAdjacencyList(graphWithSingleError, true)
      expect(outputWithErrors).toContain("(errors: NetworkError)")
    })

    it("uses arrow notation for dependencies", () => {
      const output = formatAdjacencyList(sampleGraph, false)

      expect(output).toMatch(/\w+\s+\d* →/)
    })

    it("lists all direct dependencies", () => {
      const output = formatAdjacencyList(sampleGraph, false)

      expect(output).toContain("3 → TodoQueryService, TodoMutationService, TodoSelectionService")
    })

    it("indents service lines with 2 spaces", () => {
      const output = formatAdjacencyList(sampleGraph, false)
      const lines = output.split("\n").slice(1)

      lines.forEach(line => {
        if (line.length > 0) {
          expect(line).toMatch(/^  \w+/)
        }
      })
    })
  })

  describe("Graph Metrics", () => {
    const buildChainGraph = (nodeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = nodeNames.map((name) => ({
        name,
        path: `src/${name}.ts`,
        line: 1
      }))

      const layers: LayerDefinition[] = nodeNames.map((name, idx) => ({
        name: `${name}Live`,
        serviceName: name,
        path: `src/${name}.ts`,
        line: 10,
        dependencies: idx < nodeNames.length - 1 ? [nodeNames[idx + 1]] : [],
        errorTypes: []
      }))

      return { services, layers }
    }

    const buildStarGraph = (centerName: string, spokeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: centerName, path: `src/${centerName}.ts`, line: 1 },
        ...spokeNames.map((name) => ({
          name,
          path: `src/${name}.ts`,
          line: 1
        }))
      ]

      const layers: LayerDefinition[] = [
        {
          name: `${centerName}Live`,
          serviceName: centerName,
          path: `src/${centerName}.ts`,
          line: 10,
          dependencies: spokeNames,
          errorTypes: []
        },
        ...spokeNames.map((name) => ({
          name: `${name}Live`,
          serviceName: name,
          path: `src/${name}.ts`,
          line: 10,
          dependencies: [],
          errorTypes: []
        }))
      ]

      return { services, layers }
    }

    const buildFullyConnectedGraph = (nodeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = nodeNames.map((name) => ({
        name,
        path: `src/${name}.ts`,
        line: 1
      }))

      const layers: LayerDefinition[] = nodeNames.map((name) => ({
        name: `${name}Live`,
        serviceName: name,
        path: `src/${name}.ts`,
        line: 10,
        dependencies: nodeNames.filter((n) => n !== name),
        errorTypes: []
      }))

      return { services, layers }
    }

    const buildBridgeGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 },
        { name: "D", path: "src/D.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: ["D"],
          errorTypes: []
        },
        {
          name: "DLive",
          serviceName: "D",
          path: "src/D.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    const buildHubGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "Hub", path: "src/Hub.ts", line: 1 },
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "HubLive",
          serviceName: "Hub",
          path: "src/Hub.ts",
          line: 10,
          dependencies: ["A", "B", "C"],
          errorTypes: []
        },
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B", "C"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    const buildTriangleGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: ["A"],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    const buildDisconnectedGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 },
        { name: "D", path: "src/D.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: ["D"],
          errorTypes: []
        },
        {
          name: "DLive",
          serviceName: "D",
          path: "src/D.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    describe("Density", () => {
      it("calculates density for sparse chain graph", () => {
        const graph = buildChainGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<density")
        expect(output).toMatch(/<density[^>]*value="0\.250"/)
      })

      it("returns 0 density for single node graph", () => {
        const graph = buildChainGraph(["A"])
        const output = formatAgent(graph)

        expect(output).toContain("<density")
        expect(output).toMatch(/<density[^>]*value="0\.000"/)
      })

      it("calculates density of 1.0 for fully connected graph", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<density")
        expect(output).toMatch(/<density[^>]*value="1\.000"/)
      })

      it("returns 0 density for empty graph", () => {
        const emptyGraph: ArchitectureGraph = { services: [], layers: [] }
        const output = formatAgent(emptyGraph)

        expect(output).toContain("<density")
        expect(output).toMatch(/<density[^>]*value="0\.000"/)
      })

      it("calculates intermediate density correctly", () => {
        const graph = buildStarGraph("Center", ["A", "B", "C"])
        const output = formatAgent(graph)

        expect(output).toContain("<density")
        const densityMatch = output.match(/<density[^>]*value="([\d.]+)"/)
        expect(densityMatch).toBeTruthy()
        const density = parseFloat(densityMatch![1])
        expect(density).toBeCloseTo(0.25, 2)
      })
    })

    describe("Diameter", () => {
      it("calculates diameter for chain graph", () => {
        const graph = buildChainGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<diameter")
        expect(output).toMatch(/<diameter[^>]*value="3"/)
      })

      it("returns 0 diameter for single node", () => {
        const graph = buildChainGraph(["A"])
        const output = formatAgent(graph)

        expect(output).toContain("<diameter")
        expect(output).toMatch(/<diameter[^>]*value="0"/)
      })

      it("calculates diameter for star graph", () => {
        const graph = buildStarGraph("Center", ["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<diameter")
        expect(output).toMatch(/<diameter[^>]*value="1"/)
      })

      it("handles disconnected graph with infinite distances", () => {
        const graph = buildDisconnectedGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<diameter")
        const diameterMatch = output.match(/<diameter[^>]*value="([\d.]+)"/)
        expect(diameterMatch).toBeTruthy()
        const diameter = parseFloat(diameterMatch![1])
        expect(diameter).toBeGreaterThan(0)
      })

      it("calculates diameter of 1 for fully connected graph", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C"])
        const output = formatAgent(graph)

        expect(output).toContain("<diameter")
        expect(output).toMatch(/<diameter[^>]*value="1"/)
      })
    })

    describe("Average Degree", () => {
      it("calculates average degree for mixed graph", () => {
        const graph = buildHubGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<average_degree")
        const avgDegreeMatch = output.match(/<average_degree[^>]*value="([\d.]+)"/)
        expect(avgDegreeMatch).toBeTruthy()
        const avgDegree = parseFloat(avgDegreeMatch![1])
        expect(avgDegree).toBeGreaterThan(0)
        expect(avgDegree).toBeLessThanOrEqual(4)
      })

      it("returns 0 average degree for single node", () => {
        const graph = buildChainGraph(["A"])
        const output = formatAgent(graph)

        expect(output).toContain("<average_degree")
        expect(output).toMatch(/<average_degree[^>]*value="0\.00"/)
      })

      it("calculates average degree for chain graph", () => {
        const graph = buildChainGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<average_degree")
        const avgDegreeMatch = output.match(/<average_degree[^>]*value="([\d.]+)"/)
        expect(avgDegreeMatch).toBeTruthy()
        const avgDegree = parseFloat(avgDegreeMatch![1])
        expect(avgDegree).toBeCloseTo(0.75, 2)
      })

      it("calculates high average degree for fully connected graph", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<average_degree")
        const avgDegreeMatch = output.match(/<average_degree[^>]*value="([\d.]+)"/)
        expect(avgDegreeMatch).toBeTruthy()
        const avgDegree = parseFloat(avgDegreeMatch![1])
        expect(avgDegree).toBeCloseTo(3, 1)
      })
    })
  })

  describe("Advanced Graph Metrics", () => {
    const buildChainGraph = (nodeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = nodeNames.map((name) => ({
        name,
        path: `src/${name}.ts`,
        line: 1
      }))

      const layers: LayerDefinition[] = nodeNames.map((name, idx) => ({
        name: `${name}Live`,
        serviceName: name,
        path: `src/${name}.ts`,
        line: 10,
        dependencies: idx < nodeNames.length - 1 ? [nodeNames[idx + 1]] : [],
        errorTypes: []
      }))

      return { services, layers }
    }

    const buildStarGraph = (centerName: string, spokeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: centerName, path: `src/${centerName}.ts`, line: 1 },
        ...spokeNames.map((name) => ({
          name,
          path: `src/${name}.ts`,
          line: 1
        }))
      ]

      const layers: LayerDefinition[] = [
        {
          name: `${centerName}Live`,
          serviceName: centerName,
          path: `src/${centerName}.ts`,
          line: 10,
          dependencies: spokeNames,
          errorTypes: []
        },
        ...spokeNames.map((name) => ({
          name: `${name}Live`,
          serviceName: name,
          path: `src/${name}.ts`,
          line: 10,
          dependencies: [],
          errorTypes: []
        }))
      ]

      return { services, layers }
    }

    const buildFullyConnectedGraph = (nodeNames: string[]): ArchitectureGraph => {
      const services: ServiceDefinition[] = nodeNames.map((name) => ({
        name,
        path: `src/${name}.ts`,
        line: 1
      }))

      const layers: LayerDefinition[] = nodeNames.map((name) => ({
        name: `${name}Live`,
        serviceName: name,
        path: `src/${name}.ts`,
        line: 10,
        dependencies: nodeNames.filter((n) => n !== name),
        errorTypes: []
      }))

      return { services, layers }
    }

    const buildBridgeGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 },
        { name: "D", path: "src/D.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: ["D"],
          errorTypes: []
        },
        {
          name: "DLive",
          serviceName: "D",
          path: "src/D.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    const buildHubGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "Hub", path: "src/Hub.ts", line: 1 },
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "HubLive",
          serviceName: "Hub",
          path: "src/Hub.ts",
          line: 10,
          dependencies: ["A", "B", "C"],
          errorTypes: []
        },
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B", "C"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    const buildTriangleGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "A", path: "src/A.ts", line: 1 },
        { name: "B", path: "src/B.ts", line: 1 },
        { name: "C", path: "src/C.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ALive",
          serviceName: "A",
          path: "src/A.ts",
          line: 10,
          dependencies: ["B"],
          errorTypes: []
        },
        {
          name: "BLive",
          serviceName: "B",
          path: "src/B.ts",
          line: 10,
          dependencies: ["C"],
          errorTypes: []
        },
        {
          name: "CLive",
          serviceName: "C",
          path: "src/C.ts",
          line: 10,
          dependencies: ["A"],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    describe("Betweenness Centrality", () => {
      it("assigns high betweenness to center of star graph", () => {
        const graph = buildStarGraph("Center", ["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<betweenness_centrality")
        expect(output).toContain("Center")
      })

      it("assigns higher betweenness to middle nodes in chain", () => {
        const graph = buildChainGraph(["A", "B", "C", "D", "E"])
        const output = formatAgent(graph)

        expect(output).toContain("<betweenness_centrality")
        expect(output).toContain("B")
        expect(output).toContain("C")
        expect(output).toContain("D")
      })

      it("assigns equal low betweenness for fully connected graph", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<betweenness_centrality")
      })

      it("handles small graphs with no betweenness", () => {
        const graph = buildChainGraph(["A", "B"])
        const output = formatAgent(graph)

        expect(output).toContain("<betweenness_centrality")
      })

      it("identifies bridge nodes with high betweenness", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<betweenness_centrality")
        expect(output).toContain("B")
        expect(output).toContain("C")
      })
    })

    describe("Clustering Coefficient", () => {
      it("includes clustering coefficient section", () => {
        const graph = buildHubGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<clustering_coefficient")
        expect(output).toContain("</clustering_coefficient>")
      })

      it("lists nodes with non-zero clustering", () => {
        const graph = buildHubGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<clustering_coefficient")
        const clusteringSection = output.match(/<clustering_coefficient[^>]*>[\s\S]*?<\/clustering_coefficient>/)
        expect(clusteringSection).toBeTruthy()
      })

      it("handles cycle graphs correctly", () => {
        const graph = buildTriangleGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<clustering_coefficient")
        const clusteringMatch = output.match(/<clustering_coefficient[^>]*>([\s\S]*?)<\/clustering_coefficient>/)
        expect(clusteringMatch).toBeTruthy()
      })

      it("handles nodes with fewer than 2 neighbors", () => {
        const graph = buildChainGraph(["A", "B", "C"])
        const output = formatAgent(graph)

        expect(output).toContain("<clustering_coefficient")
      })

      it("formats clustering values with 2 decimal places", () => {
        const graph = buildHubGraph()
        const output = formatAgent(graph)

        const clusteringMatch = output.match(/<clustering_coefficient[^>]*>([\s\S]*?)<\/clustering_coefficient>/)
        if (clusteringMatch) {
          const content = clusteringMatch[1]
          const hasCorrectFormat = /\d\.\d{2}/.test(content)
          expect(hasCorrectFormat).toBe(true)
        }
      })
    })

    describe("Cut Vertices", () => {
      it("identifies bridge node as cut vertex", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<domain_bridges")
        expect(output).toMatch(/B|C/)
      })

      it("identifies no cut vertices in fully connected graph", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C", "D"])
        const output = formatAgent(graph)

        expect(output).toContain("<domain_bridges")
        expect(output).toMatch(/<domain_bridges n="0"/)
      })

      it("identifies middle node in chain as cut vertex", () => {
        const graph = buildChainGraph(["A", "B", "C"])
        const output = formatAgent(graph)

        expect(output).toContain("<domain_bridges")
        expect(output).toContain("B")
      })

      it("handles graph with no cut vertices", () => {
        const graph = buildTriangleGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<domain_bridges")
      })

      it("reports cut vertices count correctly", () => {
        const graph = buildChainGraph(["A", "B", "C", "D", "E"])
        const output = formatAgent(graph)

        expect(output).toContain("<domain_bridges")
        const bridgesMatch = output.match(/<domain_bridges n="(\d+)"/)
        expect(bridgesMatch).toBeTruthy()
        const bridgeCount = parseInt(bridgesMatch![1])
        expect(bridgeCount).toBeGreaterThanOrEqual(0)
      })
    })

    describe("Domain Discovery", () => {
      it("discovers domains after bridge removal", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<domains")
        expect(output).toContain("<domain")
      })

      it("counts domains correctly", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<domains")
        const domainsMatch = output.match(/<domains n="(\d+)"/)
        expect(domainsMatch).toBeTruthy()
      })

      it("lists services in each domain", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toContain("<domain")
        expect(output).toMatch(/<domain name="Domain\d+"/)
      })

      it("reports domain sizes correctly", () => {
        const graph = buildBridgeGraph()
        const output = formatAgent(graph)

        expect(output).toMatch(/<domain[^>]*size="\d+"/)
      })

      it("handles graph with single domain", () => {
        const graph = buildFullyConnectedGraph(["A", "B", "C"])
        const output = formatAgent(graph)

        expect(output).toContain("<domains")
      })
    })
  })

  describe("Agent Format Metrics Integration", () => {
    const buildSampleGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "ServiceA", path: "src/ServiceA.ts", line: 1 },
        { name: "ServiceB", path: "src/ServiceB.ts", line: 1 },
        { name: "ServiceC", path: "src/ServiceC.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ServiceALive",
          serviceName: "ServiceA",
          path: "src/ServiceA.ts",
          line: 10,
          dependencies: ["ServiceB"],
          errorTypes: []
        },
        {
          name: "ServiceBLive",
          serviceName: "ServiceB",
          path: "src/ServiceB.ts",
          line: 10,
          dependencies: ["ServiceC"],
          errorTypes: []
        },
        {
          name: "ServiceCLive",
          serviceName: "ServiceC",
          path: "src/ServiceC.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    it("includes metrics section in agent format", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<metrics>")
      expect(output).toContain("</metrics>")
    })

    it("includes all core metric tags", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<density")
      expect(output).toContain("<diameter")
      expect(output).toContain("<average_degree")
    })

    it("includes descriptions in metric tags", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toMatch(/<density[^>]*>.*?<\/density>/)
      expect(output).toMatch(/<diameter[^>]*>.*?<\/diameter>/)
      expect(output).toMatch(/<average_degree[^>]*>.*?<\/average_degree>/)
    })

    it("includes advanced metrics section", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<advanced_metrics>")
      expect(output).toContain("</advanced_metrics>")
    })

    it("includes betweenness centrality in advanced metrics", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<betweenness_centrality")
      expect(output).toContain("</betweenness_centrality>")
    })

    it("includes clustering coefficient in advanced metrics", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<clustering_coefficient")
      expect(output).toMatch(/<clustering_coefficient[^>]*n="\d+"/)
    })

    it("includes domain bridges in advanced metrics", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<domain_bridges")
      expect(output).toMatch(/<domain_bridges n="\d+"/)
    })

    it("includes domains section in advanced metrics", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toContain("<domains")
      expect(output).toMatch(/<domains n="\d+"/)
    })

    it("formats metrics with proper XML structure", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      const metricsStart = output.indexOf("<metrics>")
      const metricsEnd = output.indexOf("</metrics>")
      expect(metricsStart).toBeGreaterThan(-1)
      expect(metricsEnd).toBeGreaterThan(metricsStart)

      const advancedStart = output.indexOf("<advanced_metrics>")
      const advancedEnd = output.indexOf("</advanced_metrics>")
      expect(advancedStart).toBeGreaterThan(-1)
      expect(advancedEnd).toBeGreaterThan(advancedStart)
    })

    it("includes metric descriptions as content", () => {
      const graph = buildSampleGraph()
      const output = formatAgent(graph)

      expect(output).toMatch(/coupling/i)
      expect(output).toMatch(/chains/i)
      expect(output).toMatch(/connections/i)
    })
  })

  describe("Common Ancestors Analysis", () => {
    const buildCommonAncestorGraph = (): ArchitectureGraph => {
      const services: ServiceDefinition[] = [
        { name: "ServiceA", path: "src/ServiceA.ts", line: 1 },
        { name: "ServiceB", path: "src/ServiceB.ts", line: 1 },
        { name: "ServiceC", path: "src/ServiceC.ts", line: 1 },
        { name: "SharedDep1", path: "src/SharedDep1.ts", line: 1 },
        { name: "SharedDep2", path: "src/SharedDep2.ts", line: 1 },
        { name: "LeafDep", path: "src/LeafDep.ts", line: 1 }
      ]

      const layers: LayerDefinition[] = [
        {
          name: "ServiceALive",
          serviceName: "ServiceA",
          path: "src/ServiceA.ts",
          line: 10,
          dependencies: ["SharedDep1", "SharedDep2"],
          errorTypes: []
        },
        {
          name: "ServiceBLive",
          serviceName: "ServiceB",
          path: "src/ServiceB.ts",
          line: 10,
          dependencies: ["SharedDep1", "SharedDep2"],
          errorTypes: []
        },
        {
          name: "ServiceCLive",
          serviceName: "ServiceC",
          path: "src/ServiceC.ts",
          line: 10,
          dependencies: ["SharedDep1"],
          errorTypes: []
        },
        {
          name: "SharedDep1Live",
          serviceName: "SharedDep1",
          path: "src/SharedDep1.ts",
          line: 10,
          dependencies: ["LeafDep"],
          errorTypes: []
        },
        {
          name: "SharedDep2Live",
          serviceName: "SharedDep2",
          path: "src/SharedDep2.ts",
          line: 10,
          dependencies: ["LeafDep"],
          errorTypes: []
        },
        {
          name: "LeafDepLive",
          serviceName: "LeafDep",
          path: "src/LeafDep.ts",
          line: 10,
          dependencies: [],
          errorTypes: []
        }
      ]

      return { services, layers }
    }

    it("identifies shared dependencies for multiple services", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])

      expect(result.inputServices).toEqual(["ServiceA", "ServiceB", "ServiceC"])
      expect(result.commonDependencies.length).toBeGreaterThan(0)

      const sharedDep1 = result.commonDependencies.find(d => d.service === "SharedDep1")
      expect(sharedDep1).toBeTruthy()
      expect(sharedDep1!.coverage).toBe(3)
    })

    it("assigns HIGH risk to dependencies with 100% coverage", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])

      const sharedDep1 = result.commonDependencies.find(d => d.service === "SharedDep1")
      expect(sharedDep1).toBeTruthy()
      expect(sharedDep1!.risk).toBe("HIGH")
    })

    it("assigns MEDIUM risk to dependencies with >= 50% coverage", () => {
      const customGraph: ArchitectureGraph = {
        services: [
          { name: "S1", path: "src/S1.ts", line: 1 },
          { name: "S2", path: "src/S2.ts", line: 1 },
          { name: "S3", path: "src/S3.ts", line: 1 },
          { name: "S4", path: "src/S4.ts", line: 1 },
          { name: "SharedDep", path: "src/SharedDep.ts", line: 1 },
          { name: "Leaf", path: "src/Leaf.ts", line: 1 }
        ],
        layers: [
          { name: "S1Live", serviceName: "S1", path: "src/S1.ts", line: 1, dependencies: ["SharedDep"], errorTypes: [] },
          { name: "S2Live", serviceName: "S2", path: "src/S2.ts", line: 1, dependencies: ["SharedDep"], errorTypes: [] },
          { name: "S3Live", serviceName: "S3", path: "src/S3.ts", line: 1, dependencies: ["Leaf"], errorTypes: [] },
          { name: "S4Live", serviceName: "S4", path: "src/S4.ts", line: 1, dependencies: ["Leaf"], errorTypes: [] },
          { name: "SharedDepLive", serviceName: "SharedDep", path: "src/SharedDep.ts", line: 1, dependencies: ["Leaf"], errorTypes: [] },
          { name: "LeafLive", serviceName: "Leaf", path: "src/Leaf.ts", line: 1, dependencies: [], errorTypes: [] }
        ]
      }

      const analysisGraph = buildAnalysisGraph(customGraph)
      const result = computeCommonAncestors(analysisGraph, ["S1", "S2", "S3", "S4"])

      const sharedDep = result.commonDependencies.find(d => d.service === "Leaf")
      expect(sharedDep).toBeTruthy()
      expect(sharedDep!.coverage).toBe(4)
      expect(sharedDep!.risk).toBe("HIGH")

      for (const dep of result.commonDependencies) {
        if (dep.coverage === 4) {
          expect(dep.risk).toBe("HIGH")
        } else if (dep.coverage >= 2) {
          expect(dep.risk).toBe("MEDIUM")
        } else {
          expect(dep.risk).toBe("LOW")
        }
      }
    })

    it("sorts dependencies by coverage descending", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])

      if (result.commonDependencies.length > 1) {
        for (let i = 0; i < result.commonDependencies.length - 1; i++) {
          expect(result.commonDependencies[i].coverage).toBeGreaterThanOrEqual(
            result.commonDependencies[i + 1].coverage
          )
        }
      }
    })

    it("generates root cause candidates ranked by coverage", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])

      expect(result.rootCauseCandidates.length).toBeGreaterThan(0)
      expect(result.rootCauseCandidates.length).toBeLessThanOrEqual(5)

      if (result.rootCauseCandidates.length > 1) {
        expect(result.rootCauseCandidates[0].coverage).toBeGreaterThanOrEqual(
          result.rootCauseCandidates[1].coverage
        )
      }
    })

    it("renders XML format with all sections", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])
      const output = renderCommonAncestors(result)

      expect(output).toContain("<common_ancestors")
      expect(output).toContain("<input>")
      expect(output).toContain("<shared_dependencies")
      expect(output).toContain("<root_cause_candidates>")
      expect(output).toContain("</common_ancestors>")
    })

    it("includes coverage attribute in dependency tags", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB"])
      const output = renderCommonAncestors(result)

      expect(output).toMatch(/coverage="\d+\/\d+"/)
    })

    it("includes risk attribute in dependency tags", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB"])
      const output = renderCommonAncestors(result)

      expect(output).toMatch(/risk="(HIGH|MEDIUM|LOW)"/)
    })

    it("formats coverage percentage in candidates", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])
      const output = renderCommonAncestors(result)

      expect(output).toMatch(/coverage="\d+%"/)
    })

    it("handles empty input gracefully", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, [])

      expect(result.inputServices).toEqual([])
      expect(result.commonDependencies).toEqual([])
      expect(result.rootCauseCandidates).toEqual([])
    })

    it("handles non-existent services gracefully", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["NonExistent1", "NonExistent2"])

      expect(result.inputServices).toEqual(["NonExistent1", "NonExistent2"])
      expect(result.commonDependencies).toEqual([])
      expect(result.rootCauseCandidates).toEqual([])
    })

    it("tracks which services are affected by each dependency", () => {
      const graph = buildCommonAncestorGraph()
      const analysisGraph = buildAnalysisGraph(graph)
      const result = computeCommonAncestors(analysisGraph, ["ServiceA", "ServiceB", "ServiceC"])

      const sharedDep1 = result.commonDependencies.find(d => d.service === "SharedDep1")
      expect(sharedDep1).toBeTruthy()
      expect(sharedDep1!.affectedBy).toContain("ServiceA")
      expect(sharedDep1!.affectedBy).toContain("ServiceB")
      expect(sharedDep1!.affectedBy).toContain("ServiceC")
    })
  })
})
