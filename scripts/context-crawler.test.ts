import { describe, it, expect } from "vitest"
import { Effect, Option, Array, pipe, String } from "effect"
import { BunContext } from "@effect/platform-bun"
import { Command, CommandExecutor } from "@effect/platform"

// Pure function tests - re-implement for testing since not exported
const parseFrontmatter = (content: string): Option.Option<string> => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)
  return match ? Option.some(match[1]) : Option.none()
}

const extractTomlMessage = (toml: string): Option.Option<string> => {
  const messageRegex = /message\s*=\s*"([^"]*)"/
  const match = toml.match(messageRegex)
  return match ? Option.some(match[1]) : Option.none()
}

const extractFirstParagraph = (content: string): Option.Option<string> => {
  // Remove frontmatter if present
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n?/, "")
  const lines = withoutFrontmatter.split("\n")

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0 && !trimmed.startsWith("#")) {
      return Option.some(trimmed)
    }
  }
  return Option.none()
}

const extractPurposeSection = (content: string): Option.Option<string> => {
  const purposeRegex = /## Purpose\n([^\n]+)/
  const match = content.match(purposeRegex)
  return match ? Option.some(String.trim(match[1])) : Option.none()
}

const extractSummary = (content: string, fallback: string): string => {
  return pipe(
    parseFrontmatter(content),
    Option.flatMap(extractTomlMessage),
    Option.orElse(() => extractPurposeSection(content)),
    Option.orElse(() => extractFirstParagraph(content)),
    Option.getOrElse(() => fallback)
  )
}

const toModulePath = (absolutePath: string, repoRoot: string): string => {
  const relative = absolutePath.replace(repoRoot + "/", "")
  return relative.replace("/ai-context.md", "").replace("ai-context.md", ".")
}

const parseGitmodules = (content: string): ReadonlyArray<string> => {
  const pathRegex = /path\s*=\s*(.+)/g
  const paths: string[] = []
  let match
  while ((match = pathRegex.exec(content)) !== null) {
    paths.push(match[1].trim())
  }
  return paths
}

type ModuleSource = "internal" | "external"

const getModuleSource = (modulePath: string, submodulePaths: ReadonlyArray<string>): ModuleSource => {
  const isSubmodule = submodulePaths.some(subPath =>
    modulePath === subPath || modulePath.startsWith(subPath + "/")
  )
  return isSubmodule ? "external" : "internal"
}

describe("context-crawler", () => {
  describe("parseFrontmatter", () => {
    it("extracts TOML frontmatter between --- markers", () => {
      const content = `---
[[docs]]
message = "test message"
---
# Content here`

      const result = parseFrontmatter(content)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result)).toContain('message = "test message"')
    })

    it("returns None when no frontmatter exists", () => {
      const content = "# Just markdown\nNo frontmatter here"
      const result = parseFrontmatter(content)
      expect(Option.isNone(result)).toBe(true)
    })

    it("handles empty frontmatter", () => {
      const content = `---

---
# Content`
      const result = parseFrontmatter(content)
      expect(Option.isSome(result)).toBe(true)
    })
  })

  describe("extractTomlMessage", () => {
    it("extracts message from TOML", () => {
      const toml = `[[docs]]
files = ["**/*.ts"]
message = "TypeScript patterns"`

      const result = extractTomlMessage(toml)
      expect(Option.isSome(result)).toBe(true)
      expect(Option.getOrThrow(result)).toBe("TypeScript patterns")
    })

    it("handles message with spaces around equals", () => {
      const toml = 'message   =   "spaced out"'
      const result = extractTomlMessage(toml)
      expect(Option.getOrThrow(result)).toBe("spaced out")
    })

    it("returns None when no message field", () => {
      const toml = "files = [\"*.ts\"]"
      const result = extractTomlMessage(toml)
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("extractFirstParagraph", () => {
    it("extracts first non-heading paragraph", () => {
      const content = `# Heading
This is the first paragraph.
More content here.`

      const result = extractFirstParagraph(content)
      expect(Option.getOrThrow(result)).toBe("This is the first paragraph.")
    })

    it("skips multiple headings", () => {
      const content = `# H1
## H2
### H3
Finally some content`

      const result = extractFirstParagraph(content)
      expect(Option.getOrThrow(result)).toBe("Finally some content")
    })

    it("strips frontmatter before extracting", () => {
      const content = `---
key: value
---
# Heading
Actual content`

      const result = extractFirstParagraph(content)
      expect(Option.getOrThrow(result)).toBe("Actual content")
    })

    it("returns None for empty content", () => {
      const content = "# Just a heading"
      const result = extractFirstParagraph(content)
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("extractPurposeSection", () => {
    it("extracts content after ## Purpose", () => {
      const content = `# Title
## Purpose
Type-safe environment management.
## Other section`

      const result = extractPurposeSection(content)
      expect(Option.getOrThrow(result)).toBe("Type-safe environment management.")
    })

    it("returns None when no Purpose section", () => {
      const content = "# Title\n## Overview\nSome content"
      const result = extractPurposeSection(content)
      expect(Option.isNone(result)).toBe(true)
    })
  })

  describe("extractSummary", () => {
    it("prioritizes TOML message over other sources", () => {
      const content = `---
message = "TOML summary"
---
## Purpose
Purpose summary
First paragraph`

      const result = extractSummary(content, "fallback")
      expect(result).toBe("TOML summary")
    })

    it("falls back to Purpose section when no TOML message", () => {
      const content = `---
key: value
---
## Purpose
Purpose description`

      const result = extractSummary(content, "fallback")
      expect(result).toBe("Purpose description")
    })

    it("falls back to first paragraph when no Purpose", () => {
      const content = `# Title
This is the description.`

      const result = extractSummary(content, "fallback")
      expect(result).toBe("This is the description.")
    })

    it("uses fallback when nothing found", () => {
      const content = "# Just headings"
      const result = extractSummary(content, "my-fallback")
      expect(result).toBe("my-fallback")
    })
  })

  describe("toModulePath", () => {
    it("converts absolute path to module path", () => {
      const result = toModulePath("/repo/apps/editor/ai-context.md", "/repo")
      expect(result).toBe("apps/editor")
    })

    it("handles root ai-context.md", () => {
      const result = toModulePath("/repo/ai-context.md", "/repo")
      expect(result).toBe(".")
    })

    it("handles nested paths", () => {
      const result = toModulePath("/repo/apps/editor/src/components/ai-context.md", "/repo")
      expect(result).toBe("apps/editor/src/components")
    })
  })

  describe("parseGitmodules", () => {
    it("extracts all submodule paths", () => {
      const content = `[submodule "docs/repos/effect"]
	path = docs/repos/effect
	url = https://github.com/Effect-TS/effect.git
[submodule ".claude"]
	path = .claude
	url = https://github.com/example/claude-setup.git`

      const result = parseGitmodules(content)
      expect(result).toEqual(["docs/repos/effect", ".claude"])
    })

    it("handles empty content", () => {
      const result = parseGitmodules("")
      expect(result).toEqual([])
    })

    it("handles spaces around path value", () => {
      const content = "path   =   some/path  "
      const result = parseGitmodules(content)
      expect(result).toEqual(["some/path"])
    })
  })

  describe("getModuleSource", () => {
    const submodulePaths = ["docs/repos/effect", ".claude", "external/lib"]

    it("returns external for exact submodule match", () => {
      expect(getModuleSource("docs/repos/effect", submodulePaths)).toBe("external")
    })

    it("returns external for nested path within submodule", () => {
      expect(getModuleSource("docs/repos/effect/packages/core", submodulePaths)).toBe("external")
    })

    it("returns internal for non-submodule paths", () => {
      expect(getModuleSource("apps/editor", submodulePaths)).toBe("internal")
    })

    it("returns internal for partial path matches", () => {
      expect(getModuleSource("docs/repos/effect-other", submodulePaths)).toBe("internal")
    })
  })

  describe("CLI integration", () => {
    // Get the repo root (parent of .claude)
    const repoRoot = process.cwd().replace(/\/.claude$/, "")

    const runCrawler = (args: string[]) =>
      Effect.gen(function* () {
        const commandExecutor = yield* CommandExecutor.CommandExecutor
        return yield* pipe(
          Command.make("bun", ".claude/scripts/context-crawler.ts", ...args),
          Command.workingDirectory(repoRoot),
          Command.string,
          Effect.provideService(CommandExecutor.CommandExecutor, commandExecutor)
        )
      }).pipe(Effect.provide(BunContext.layer))

    it("--list returns module paths", async () => {
      const result = await Effect.runPromise(runCrawler(["--list"]))
      expect(result).toContain(".")
    })

    it("--summary returns grouped modules", async () => {
      const result = await Effect.runPromise(runCrawler(["--summary"]))
      expect(result).toContain('<modules count="')
      expect(result).toContain("</modules>")
    })

    it("--search finds matching modules", async () => {
      const result = await Effect.runPromise(runCrawler(["--search", "editor"]))
      expect(result).toContain('<modules-search pattern="editor"')
      expect(result).toContain("</modules-search>")
    })

    it("--module returns content without frontmatter", async () => {
      const result = await Effect.runPromise(runCrawler(["--module", "."]))
      expect(result).toContain('<module path=".">')
      expect(result).not.toContain("---")
    })
  })
})
