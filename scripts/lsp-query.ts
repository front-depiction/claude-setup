#!/usr/bin/env bun
import * as ts from "typescript"
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Console, Effect, pipe } from "effect"
import { BadArgument, PlatformError } from "@effect/platform/Error"

interface QueryResult {
  success: boolean
  data?: unknown
  error?: string
}

const findTsConfig = (dir: string): Effect.Effect<string | null, BadArgument | PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const configPath = path.join(dir, "tsconfig.json")
    if (yield* fs.exists(configPath)) return configPath

    const parent = path.dirname(dir)
    if (parent === dir) return null

    return yield* Effect.suspend(() => findTsConfig(parent))
  })

const createLanguageService = (configPath: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
      throw new Error(`Failed to read tsconfig.json: ${ts.formatDiagnostic(configFile.error, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: (fileName) => fileName,
        getNewLine: () => "\n"
      })}`)
    }

    const basePath = path.dirname(configPath)
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      basePath
    )

    if (parsedConfig.errors.length > 0) {
      const errorMsg = parsedConfig.errors.map(err =>
        ts.formatDiagnostic(err, {
          getCurrentDirectory: () => process.cwd(),
          getCanonicalFileName: (fileName) => fileName,
          getNewLine: () => "\n"
        })
      ).join("\n")
      throw new Error(`Failed to parse tsconfig.json: ${errorMsg}`)
    }

    const fs = yield* FileSystem.FileSystem
    const files = new Map<string, string>()

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => parsedConfig.fileNames,
      getScriptVersion: () => "0",
      getScriptSnapshot: (fileName) => {
        // Use sync version since TypeScript API is synchronous
        if (!ts.sys.fileExists(fileName)) {
          return undefined
        }
        let content = files.get(fileName)
        if (content === undefined) {
          content = ts.sys.readFile(fileName)
          if (content !== undefined) {
            files.set(fileName, content)
          }
        }
        return content !== undefined ? ts.ScriptSnapshot.fromString(content) : undefined
      },
      getCurrentDirectory: () => basePath,
      getCompilationSettings: () => parsedConfig.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    }

    const service = ts.createLanguageService(servicesHost, ts.createDocumentRegistry())
    const program = service.getProgram()!

    return { service, program }
  })

function getTypeAtPosition(
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): QueryResult {
  try {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1)
    const quickInfo = service.getQuickInfoAtPosition(filePath, position)

    if (!quickInfo) {
      return { success: false, error: `No type at ${line}:${col}` }
    }

    const displayString = ts.displayPartsToString(quickInfo.displayParts || [])
    return { success: true, data: displayString }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function shortPath(fullPath: string): string {
  const cwd = process.cwd()
  return fullPath.startsWith(cwd) ? fullPath.slice(cwd.length + 1) : fullPath
}

function getReferences(
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): QueryResult {
  try {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1)
    const references = service.getReferencesAtPosition(filePath, position)

    if (!references || references.length === 0) {
      return { success: true, data: "No references found" }
    }

    const lines = references.map(ref => {
      const refSourceFile = program.getSourceFile(ref.fileName)!
      const { line: refLine } = ts.getLineAndCharacterOfPosition(refSourceFile, ref.textSpan.start)
      return `${shortPath(ref.fileName)}:${refLine + 1}`
    })

    return { success: true, data: `${lines.length} refs:\n${lines.join("\n")}` }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function getDefinition(
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): QueryResult {
  try {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1)
    const definitions = service.getDefinitionAtPosition(filePath, position)

    if (!definitions || definitions.length === 0) {
      return { success: true, data: "No definition found" }
    }

    const lines = definitions.map(def => {
      const defSourceFile = program.getSourceFile(def.fileName)!
      const { line: defLine } = ts.getLineAndCharacterOfPosition(defSourceFile, def.textSpan.start)
      return `${shortPath(def.fileName)}:${defLine + 1}`
    })

    return { success: true, data: lines.join("\n") }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function getImplementations(
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): QueryResult {
  try {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1)
    const implementations = service.getImplementationAtPosition(filePath, position)

    if (!implementations || implementations.length === 0) {
      return { success: true, data: "No implementations found" }
    }

    const lines = implementations.map(impl => {
      const implSourceFile = program.getSourceFile(impl.fileName)!
      const { line: implLine } = ts.getLineAndCharacterOfPosition(implSourceFile, impl.textSpan.start)
      return `${shortPath(impl.fileName)}:${implLine + 1}`
    })

    return { success: true, data: `${lines.length} impls:\n${lines.join("\n")}` }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

function getRenameEdits(
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number,
  newName: string
): QueryResult {
  try {
    const sourceFile = program.getSourceFile(filePath)
    if (!sourceFile) {
      return { success: false, error: `File not found: ${filePath}` }
    }

    const position = ts.getPositionOfLineAndCharacter(sourceFile, line - 1, col - 1)
    const renameInfo = service.getRenameInfo(filePath, position)

    if (!renameInfo.canRename) {
      return { success: false, error: `Cannot rename: ${renameInfo.localizedErrorMessage || "Unknown"}` }
    }

    const renameLocations = service.findRenameLocations(filePath, position, false, false)

    if (!renameLocations || renameLocations.length === 0) {
      return { success: true, data: "No locations to rename" }
    }

    const editsByFile = new Map<string, number[]>()
    for (const loc of renameLocations) {
      const locSourceFile = program.getSourceFile(loc.fileName)!
      const { line: locLine } = ts.getLineAndCharacterOfPosition(locSourceFile, loc.textSpan.start)
      const key = shortPath(loc.fileName)
      if (!editsByFile.has(key)) editsByFile.set(key, [])
      editsByFile.get(key)!.push(locLine + 1)
    }

    const lines = Array.from(editsByFile.entries()).map(([file, lineNums]) =>
      `${file}: L${lineNums.join(",")}`
    )

    return { success: true, data: `${renameLocations.length} edits:\n${lines.join("\n")}` }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const args = process.argv.slice(2)

  if (args.length < 4) {
    yield* Console.error("Usage: lsp-query.ts <op> <file> <line> <col> [newName]\nOps: type, references, definition, implementations, rename")
    return yield* Effect.fail(new Error("Invalid arguments"))
  }

  const [operation, filePath, lineStr, colStr, newName] = args
  const line = parseInt(lineStr, 10)
  const col = parseInt(colStr, 10)

  if (isNaN(line) || isNaN(col)) {
    yield* Console.error("Error: line and col must be numbers")
    return yield* Effect.fail(new Error("Invalid line or col"))
  }

  const absolutePath = path.resolve(process.cwd(), filePath)
  const exists = yield* fs.exists(absolutePath)

  if (!exists) {
    yield* Console.error(`Error: File not found: ${filePath}`)
    return yield* Effect.fail(new Error("File not found"))
  }

  const configPath = yield* findTsConfig(path.dirname(absolutePath))
  if (!configPath) {
    yield* Console.error("Error: tsconfig.json not found")
    return yield* Effect.fail(new Error("tsconfig.json not found"))
  }

  const { service, program: tsProgram } = yield* createLanguageService(configPath)

  let result: QueryResult

  switch (operation) {
    case "type":
      result = getTypeAtPosition(service, tsProgram, absolutePath, line, col)
      break
    case "references":
      result = getReferences(service, tsProgram, absolutePath, line, col)
      break
    case "definition":
      result = getDefinition(service, tsProgram, absolutePath, line, col)
      break
    case "implementations":
      result = getImplementations(service, tsProgram, absolutePath, line, col)
      break
    case "rename":
      if (!newName) {
        result = { success: false, error: "newName is required for rename operation" }
      } else {
        result = getRenameEdits(service, tsProgram, absolutePath, line, col, newName)
      }
      break
    default:
      result = {
        success: false,
        error: `Unknown operation: ${operation}. Valid operations: type, references, definition, implementations, rename`
      }
  }

  if (result.success) {
    yield* Console.log(result.data)
  } else {
    yield* Console.error(`Error: ${result.error}`)
    return yield* Effect.fail(new Error(result.error ?? "Unknown error"))
  }
}).pipe(
  Effect.catchAll((error) =>
    Console.error(`Error: ${error}`).pipe(
      Effect.flatMap(() => Effect.fail(error))
    )
  )
)

pipe(
  program,
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
