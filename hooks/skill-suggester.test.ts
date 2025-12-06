import { describe, it, expect } from "vitest"
import { Effect, Option, Array, pipe, String, Record, Random } from "effect"
import { BunContext } from "@effect/platform-bun"

// Pure function re-implementations for testing (not exported from source)
const parseFrontmatter = (content: string): Record.ReadonlyRecord<string, string> => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = content.match(frontmatterRegex)
  if (!match) return Record.empty()

  const frontmatter = match[1]
  const lines = String.split(frontmatter, "\n")

  const entries = Array.filterMap(lines, (line) =>
    pipe(
      line,
      String.indexOf(":"),
      Option.flatMap(colonIndex => {
        const key = pipe(line, String.slice(0, colonIndex), String.trim)
        const value = pipe(line, String.slice(colonIndex + 1), String.trim)
        return String.isNonEmpty(key) && String.isNonEmpty(value)
          ? Option.some([key, value] as const)
          : Option.none()
      })
    )
  )

  return Record.fromEntries(entries)
}

const extractKeywords = (text: string): ReadonlyArray<string> => {
  const commonWords = new Set([
    "the", "and", "for", "with", "using", "that", "this", "from",
    "are", "can", "will", "use", "used", "make", "makes", "create"
  ])

  const lowercased = String.toLowerCase(text)
  const words = String.split(lowercased, /[\s,.-]+/)

  return Array.filter(words, word =>
    String.length(word) >= 3 && !commonWords.has(word)
  )
}

const matchesKeyword = (prompt: string, keyword: string): boolean =>
  pipe(String.toLowerCase(prompt), String.includes(String.toLowerCase(keyword)))

interface SkillMetadata {
  readonly name: string
  readonly keywords: ReadonlyArray<string>
}

const findMatchingSkills = (
  prompt: string,
  skills: ReadonlyArray<SkillMetadata>
): ReadonlyArray<string> =>
  Array.filterMap(skills, skill =>
    Array.some(skill.keywords, keyword => matchesKeyword(prompt, keyword))
      ? Option.some(skill.name)
      : Option.none()
  )

describe("skill-suggester", () => {
  describe("parseFrontmatter", () => {
    it("parses YAML-style frontmatter", () => {
      const content = `---
name: test-skill
description: A test skill for testing
---
# Content`

      const result = parseFrontmatter(content)
      expect(result.name).toBe("test-skill")
      expect(result.description).toBe("A test skill for testing")
    })

    it("returns empty record when no frontmatter", () => {
      const content = "# Just markdown"
      const result = parseFrontmatter(content)
      expect(Record.size(result)).toBe(0)
    })

    it("handles multiple colons in value", () => {
      const content = `---
url: https://example.com
---`

      const result = parseFrontmatter(content)
      expect(result.url).toBe("https://example.com")
    })

    it("trims whitespace from keys and values", () => {
      const content = `---
  name  :   spaced value
---`

      const result = parseFrontmatter(content)
      expect(result.name).toBe("spaced value")
    })

    it("skips lines without colons", () => {
      const content = `---
name: valid
invalid line
another: also valid
---`

      const result = parseFrontmatter(content)
      expect(Record.size(result)).toBe(2)
      expect(result.name).toBe("valid")
      expect(result.another).toBe("also valid")
    })
  })

  describe("extractKeywords", () => {
    it("extracts words 3+ characters", () => {
      const result = extractKeywords("a ab abc abcd")
      expect(result).toEqual(["abc", "abcd"])
    })

    it("filters common words", () => {
      const result = extractKeywords("the and for with using")
      expect(result).toEqual([])
    })

    it("lowercases all words", () => {
      const result = extractKeywords("Effect Schema Layer")
      expect(result).toEqual(["effect", "schema", "layer"])
    })

    it("splits on multiple delimiters", () => {
      const result = extractKeywords("effect-schema,domain.modeling test")
      expect(result).toEqual(["effect", "schema", "domain", "modeling", "test"])
    })

    it("handles empty input", () => {
      const result = extractKeywords("")
      expect(result).toEqual([])
    })
  })

  describe("matchesKeyword", () => {
    it("matches case-insensitively", () => {
      expect(matchesKeyword("Help with EFFECT", "effect")).toBe(true)
      expect(matchesKeyword("help with effect", "EFFECT")).toBe(true)
    })

    it("matches partial words", () => {
      expect(matchesKeyword("testing something", "test")).toBe(true)
    })

    it("returns false for no match", () => {
      expect(matchesKeyword("hello world", "goodbye")).toBe(false)
    })
  })

  describe("findMatchingSkills", () => {
    const skills: ReadonlyArray<SkillMetadata> = [
      { name: "effect-testing", keywords: ["test", "testing", "vitest"] },
      { name: "domain-modeling", keywords: ["domain", "model", "schema"] },
      { name: "layer-design", keywords: ["layer", "service", "dependency"] },
    ]

    it("finds skills matching prompt keywords", () => {
      const result = findMatchingSkills("help me write tests", skills)
      expect(result).toContain("effect-testing")
    })

    it("returns multiple matching skills", () => {
      const result = findMatchingSkills("design a domain model with layers", skills)
      expect(result).toContain("domain-modeling")
      expect(result).toContain("layer-design")
    })

    it("returns empty array for no matches", () => {
      const result = findMatchingSkills("hello world", skills)
      expect(result).toEqual([])
    })

    it("matches case-insensitively", () => {
      const result = findMatchingSkills("TESTING with VITEST", skills)
      expect(result).toContain("effect-testing")
    })
  })

  describe("probabilistic tips", () => {
    it("generates tips based on random values below threshold", () => {
      const buildTips = (showConcurrency: number, showModules: number, showLsp: number) => {
        const parts: string[] = []
        if (showConcurrency < 50) {
          parts.push(`<tip>Use parallel tool calls when operations are independent</tip>`)
        }
        if (showModules < 50) {
          parts.push(`<tip>Use /modules to discover available context, /module [path] to read</tip>`)
        }
        if (showLsp < 50) {
          parts.push(`<tip>Use /definition, /references, /type-at for code navigation</tip>`)
        }
        return parts
      }

      // All below threshold
      expect(buildTips(0, 0, 0).length).toBe(3)

      // All above threshold
      expect(buildTips(50, 50, 50).length).toBe(0)

      // Mixed
      expect(buildTips(25, 75, 25).length).toBe(2)
    })

    it("uses Effect Random service for random generation", async () => {
      const program = Effect.gen(function* () {
        const values = yield* Effect.all([
          Random.nextIntBetween(0, 100),
          Random.nextIntBetween(0, 100),
          Random.nextIntBetween(0, 100)
        ])
        return values
      })

      const result = await Effect.runPromise(program)

      // Results should be valid random numbers in range
      expect(result.length).toBe(3)
      result.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(100)
      })
    })
  })

  describe("output formatting", () => {
    it("wraps context in system-hints tags", () => {
      const parts = ["<tip>Test tip</tip>"]
      const context = `<system-hints>\n${parts.join("\n")}\n</system-hints>`
      expect(context).toBe("<system-hints>\n<tip>Test tip</tip>\n</system-hints>")
    })

    it("includes skills when matched", () => {
      const matchingSkills = ["effect-testing", "domain-modeling"]
      const skillsTag = `<skills>${matchingSkills.join(", ")}</skills>`
      expect(skillsTag).toBe("<skills>effect-testing, domain-modeling</skills>")
    })

    it("includes relevant modules when found", () => {
      const searchResult = `<modules-search pattern="test" count="2">
[internal] apps/test: Test utilities
[internal] packages/test-utils: Testing helpers
</modules-search>`
      const modulesTag = `<relevant-modules>\n${searchResult}\n</relevant-modules>`
      expect(modulesTag).toContain("<relevant-modules>")
      expect(modulesTag).toContain("</relevant-modules>")
    })
  })

  describe("word extraction for module search", () => {
    const extractSearchWords = (prompt: string): ReadonlyArray<string> => {
      return pipe(
        prompt,
        String.toLowerCase,
        String.split(/\s+/),
        Array.filter(w => String.length(w) >= 4)
      )
    }

    it("extracts words 4+ characters for search", () => {
      const result = extractSearchWords("help me with editor")
      expect(result).toEqual(["help", "with", "editor"])
    })

    it("filters short words", () => {
      const result = extractSearchWords("a an the for")
      expect(result).toEqual([])
    })

    it("uses first significant word as pattern", () => {
      const words = extractSearchWords("alchemy infrastructure patterns")
      const pattern = Array.isNonEmptyReadonlyArray(words) ? words[0] : ""
      expect(pattern).toBe("alchemy")
    })
  })
})
