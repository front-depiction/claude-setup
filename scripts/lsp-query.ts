#!/usr/bin/env bun
import * as ts from "typescript"
import { FileSystem, Path } from "@effect/platform"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import * as Console from "effect/Console"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

// Repo root - scripts run from .claude, so go up one level
const REPO_ROOT = ts.sys.resolvePath(`${__dirname}/../..`)

// --- Typed Errors ---

class InvalidArguments extends Data.TaggedError("InvalidArguments")<{
  readonly message: string
}> {}

class FileNotFound extends Data.TaggedError("FileNotFound")<{
  readonly path: string
  readonly resolved: string
}> {}

class TsConfigNotFound extends Data.TaggedError("TsConfigNotFound")<{
  readonly searchedFrom: string
}> {}

class TsConfigError extends Data.TaggedError("TsConfigError")<{
  readonly configPath: string
  readonly message: string
}> {}

class FileNotInProgram extends Data.TaggedError("FileNotInProgram")<{
  readonly path: string
}> {}

class InvalidPosition extends Data.TaggedError("InvalidPosition")<{
  readonly line: number
  readonly col: number
  readonly lineCount: number
}> {}

class NoResultAtPosition extends Data.TaggedError("NoResultAtPosition")<{
  readonly operation: string
  readonly line: number
  readonly col: number
}> {}

class CannotRename extends Data.TaggedError("CannotRename")<{
  readonly reason: string
}> {}

class UnknownOperation extends Data.TaggedError("UnknownOperation")<{
  readonly operation: string
}> {}

type LspError =
  | InvalidArguments
  | FileNotFound
  | TsConfigNotFound
  | TsConfigError
  | FileNotInProgram
  | InvalidPosition
  | NoResultAtPosition
  | CannotRename
  | UnknownOperation

// --- Helpers ---

const shortPath = (fullPath: string): string =>
  fullPath.startsWith(REPO_ROOT) ? fullPath.slice(REPO_ROOT.length + 1) : fullPath

const safeGetPosition = (
  sourceFile: ts.SourceFile,
  line: number,
  col: number
): Option.Option<number> => {
  const lineStarts = sourceFile.getLineStarts()
  const lineIndex = line - 1
  const colIndex = col - 1

  if (lineIndex < 0 || lineIndex >= lineStarts.length) {
    return Option.none()
  }

  const lineStart = lineStarts[lineIndex]
  const lineEnd = lineIndex + 1 < lineStarts.length
    ? lineStarts[lineIndex + 1] - 1
    : sourceFile.text.length
  const lineLength = lineEnd - lineStart

  if (colIndex < 0 || colIndex > lineLength) {
    return Option.none()
  }

  return Option.some(lineStart + colIndex)
}

// --- Core Effects ---

const findTsConfig = (dir: string): Effect.Effect<
  Option.Option<string>,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const configPath = path.join(dir, "tsconfig.json")
    const exists = yield* fs.exists(configPath).pipe(Effect.orElseSucceed(() => false))
    if (exists) {
      return Option.some(configPath)
    }

    const parent = path.dirname(dir)
    if (parent === dir) {
      return Option.none()
    }

    return yield* Effect.suspend(() => findTsConfig(parent))
  })

const readTsConfig = (configPath: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
      return yield* Effect.fail(new TsConfigError({
        configPath,
        message: ts.formatDiagnostic(configFile.error, {
          getCurrentDirectory: () => REPO_ROOT,
          getCanonicalFileName: (f) => f,
          getNewLine: () => "\n"
        })
      }))
    }

    const basePath = path.dirname(configPath)
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, basePath)

    if (parsed.errors.length > 0) {
      return yield* Effect.fail(new TsConfigError({
        configPath,
        message: parsed.errors.map(e =>
          ts.formatDiagnostic(e, {
            getCurrentDirectory: () => REPO_ROOT,
            getCanonicalFileName: (f) => f,
            getNewLine: () => "\n"
          })
        ).join("\n")
      }))
    }

    return { parsed, basePath }
  })

const createLanguageService = (configPath: string) =>
  Effect.gen(function* () {
    const { parsed, basePath } = yield* readTsConfig(configPath)
    const files = new Map<string, string>()

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => parsed.fileNames,
      getScriptVersion: () => "0",
      getScriptSnapshot: (fileName) => {
        if (!ts.sys.fileExists(fileName)) return undefined
        let content = files.get(fileName)
        if (content === undefined) {
          content = ts.sys.readFile(fileName)
          if (content !== undefined) files.set(fileName, content)
        }
        return content !== undefined ? ts.ScriptSnapshot.fromString(content) : undefined
      },
      getCurrentDirectory: () => basePath,
      getCompilationSettings: () => parsed.options,
      getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    }

    const service = ts.createLanguageService(host, ts.createDocumentRegistry())
    const program = service.getProgram()

    if (!program) {
      return yield* Effect.fail(new TsConfigError({
        configPath,
        message: "Failed to create TypeScript program"
      }))
    }

    return { service, program }
  })

const getSourceFileOrFail = (program: ts.Program, filePath: string) =>
  Option.match(Option.fromNullable(program.getSourceFile(filePath)), {
    onNone: () => Effect.fail(new FileNotInProgram({ path: shortPath(filePath) })),
    onSome: Effect.succeed
  })

const getPositionOrFail = (sourceFile: ts.SourceFile, line: number, col: number) =>
  Option.match(safeGetPosition(sourceFile, line, col), {
    onNone: () => Effect.fail(new InvalidPosition({
      line,
      col,
      lineCount: sourceFile.getLineStarts().length
    })),
    onSome: Effect.succeed
  })

// --- LSP Operations ---

const getTypeAtPosition = (
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): Effect.Effect<string, FileNotInProgram | InvalidPosition | NoResultAtPosition> =>
  Effect.gen(function* () {
    const sourceFile = yield* getSourceFileOrFail(program, filePath)
    const position = yield* getPositionOrFail(sourceFile, line, col)
    const quickInfo = service.getQuickInfoAtPosition(filePath, position)

    if (!quickInfo) {
      return yield* Effect.fail(new NoResultAtPosition({ operation: "type", line, col }))
    }

    return ts.displayPartsToString(quickInfo.displayParts || [])
  })

const getReferences = (
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): Effect.Effect<string, FileNotInProgram | InvalidPosition> =>
  Effect.gen(function* () {
    const sourceFile = yield* getSourceFileOrFail(program, filePath)
    const position = yield* getPositionOrFail(sourceFile, line, col)
    const refs = service.getReferencesAtPosition(filePath, position)

    if (!refs || refs.length === 0) {
      return "No references found"
    }

    const lines = refs.flatMap(ref => {
      const refFile = program.getSourceFile(ref.fileName)
      if (!refFile) return []
      const { line: refLine } = ts.getLineAndCharacterOfPosition(refFile, ref.textSpan.start)
      return [`${shortPath(ref.fileName)}:${refLine + 1}`]
    })

    return `${lines.length} refs:\n${lines.join("\n")}`
  })

const getDefinition = (
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): Effect.Effect<string, FileNotInProgram | InvalidPosition> =>
  Effect.gen(function* () {
    const sourceFile = yield* getSourceFileOrFail(program, filePath)
    const position = yield* getPositionOrFail(sourceFile, line, col)
    const defs = service.getDefinitionAtPosition(filePath, position)

    if (!defs || defs.length === 0) {
      return "No definition found"
    }

    const lines = defs.flatMap(def => {
      const defFile = program.getSourceFile(def.fileName)
      if (!defFile) return []
      const { line: defLine } = ts.getLineAndCharacterOfPosition(defFile, def.textSpan.start)
      return [`${shortPath(def.fileName)}:${defLine + 1}`]
    })

    return lines.join("\n")
  })

const getImplementations = (
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number
): Effect.Effect<string, FileNotInProgram | InvalidPosition> =>
  Effect.gen(function* () {
    const sourceFile = yield* getSourceFileOrFail(program, filePath)
    const position = yield* getPositionOrFail(sourceFile, line, col)
    const impls = service.getImplementationAtPosition(filePath, position)

    if (!impls || impls.length === 0) {
      return "No implementations found"
    }

    const lines = impls.flatMap(impl => {
      const implFile = program.getSourceFile(impl.fileName)
      if (!implFile) return []
      const { line: implLine } = ts.getLineAndCharacterOfPosition(implFile, impl.textSpan.start)
      return [`${shortPath(impl.fileName)}:${implLine + 1}`]
    })

    return `${lines.length} impls:\n${lines.join("\n")}`
  })

const getRenameEdits = (
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number,
  _newName: string
): Effect.Effect<string, FileNotInProgram | InvalidPosition | CannotRename> =>
  Effect.gen(function* () {
    const sourceFile = yield* getSourceFileOrFail(program, filePath)
    const position = yield* getPositionOrFail(sourceFile, line, col)
    const renameInfo = service.getRenameInfo(filePath, position)

    if (!renameInfo.canRename) {
      return yield* Effect.fail(new CannotRename({
        reason: renameInfo.localizedErrorMessage || "Unknown reason"
      }))
    }

    const locations = service.findRenameLocations(filePath, position, false, false)

    if (!locations || locations.length === 0) {
      return "No locations to rename"
    }

    const editsByFile = new Map<string, number[]>()
    for (const loc of locations) {
      const locFile = program.getSourceFile(loc.fileName)
      if (!locFile) continue
      const { line: locLine } = ts.getLineAndCharacterOfPosition(locFile, loc.textSpan.start)
      const key = shortPath(loc.fileName)
      const existing = editsByFile.get(key) ?? []
      existing.push(locLine + 1)
      editsByFile.set(key, existing)
    }

    const lines = Array.from(editsByFile.entries()).map(([file, lineNums]) =>
      `${file}: L${lineNums.join(",")}`
    )

    return `${locations.length} edits:\n${lines.join("\n")}`
  })

// --- Main Program ---

const parseArgs = Effect.gen(function* () {
  const args = process.argv.slice(2)

  if (args.length < 4) {
    return yield* Effect.fail(new InvalidArguments({
      message: "Usage: lsp-query.ts <op> <file> <line> <col> [newName]\nOps: type, references, definition, implementations, rename"
    }))
  }

  const [operation, filePath, lineStr, colStr, newName] = args
  const line = parseInt(lineStr, 10)
  const col = parseInt(colStr, 10)

  if (isNaN(line) || isNaN(col)) {
    return yield* Effect.fail(new InvalidArguments({
      message: "line and col must be numbers"
    }))
  }

  return { operation, filePath, line, col, newName }
})

const resolveFilePath = (filePath: string): Effect.Effect<
  string,
  FileNotFound,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(REPO_ROOT, filePath)

    const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(() => false))
    if (!exists) {
      return yield* Effect.fail(new FileNotFound({
        path: filePath,
        resolved: absolutePath
      }))
    }

    return absolutePath
  })

const runOperation = (
  operation: string,
  service: ts.LanguageService,
  program: ts.Program,
  filePath: string,
  line: number,
  col: number,
  newName: string | undefined
): Effect.Effect<string, LspError> => {
  switch (operation) {
    case "type":
      return getTypeAtPosition(service, program, filePath, line, col)
    case "references":
      return getReferences(service, program, filePath, line, col)
    case "definition":
      return getDefinition(service, program, filePath, line, col)
    case "implementations":
      return getImplementations(service, program, filePath, line, col)
    case "rename":
      if (!newName) {
        return Effect.fail(new InvalidArguments({ message: "newName is required for rename" }))
      }
      return getRenameEdits(service, program, filePath, line, col, newName)
    default:
      return Effect.fail(new UnknownOperation({ operation }))
  }
}

const formatError = (error: LspError): string => {
  switch (error._tag) {
    case "InvalidArguments":
      return error.message
    case "FileNotFound":
      return `File not found: ${error.path} (resolved to ${error.resolved})`
    case "TsConfigNotFound":
      return `tsconfig.json not found (searched from ${error.searchedFrom})`
    case "TsConfigError":
      return `tsconfig error in ${error.configPath}: ${error.message}`
    case "FileNotInProgram":
      return `File not in TypeScript program: ${error.path}`
    case "InvalidPosition":
      return `Invalid position ${error.line}:${error.col} (file has ${error.lineCount} lines)`
    case "NoResultAtPosition":
      return `No ${error.operation} at ${error.line}:${error.col}`
    case "CannotRename":
      return `Cannot rename: ${error.reason}`
    case "UnknownOperation":
      return `Unknown operation: ${error.operation}. Valid: type, references, definition, implementations, rename`
  }
}

const main = Effect.gen(function* () {
  const path = yield* Path.Path
  const { operation, filePath, line, col, newName } = yield* parseArgs
  const absolutePath = yield* resolveFilePath(filePath)

  const configPathOpt = yield* findTsConfig(path.dirname(absolutePath))
  const configPath = yield* Option.match(configPathOpt, {
    onNone: () => Effect.fail(new TsConfigNotFound({ searchedFrom: path.dirname(absolutePath) })),
    onSome: Effect.succeed
  })

  const { service, program } = yield* createLanguageService(configPath)
  const result = yield* runOperation(operation, service, program, absolutePath, line, col, newName)

  yield* Console.log(result)
})

main.pipe(
  Effect.catchAll((error: LspError) =>
    Console.error(`Error: ${formatError(error)}`).pipe(
      Effect.andThen(Effect.fail(error))
    )
  ),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
)
