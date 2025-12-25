import { $ } from "bun"
import { describe, it, expect } from "vitest"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "../..")

export interface PatternTestConfig {
  name: string
  tag: string | string[]
  glob?: string
  shouldMatch: string[]
  shouldNotMatch: string[]
}

const inferFilePathFromGlob = (glob?: string): string => {
  if (!glob) return "test.ts"

  if (glob.includes("{test,spec}") || glob.includes(".test.") || glob.includes(".spec.")) {
    return "test.test.ts"
  }

  if (glob.endsWith(".tsx") || glob.includes(".tsx")) return "test.tsx"
  if (glob.endsWith(".ts") || glob.includes(".ts")) return "test.ts"

  return "test.ts"
}

export const testPattern = (config: PatternTestConfig) => {
  const tags = Array.isArray(config.tag) ? config.tag : [config.tag]
  const filePath = inferFilePathFromGlob(config.glob)

  describe(config.name, () => {
    it.each(config.shouldMatch)("should match: %s", async (code) => {
      const input = JSON.stringify({
        hook_event_name: "PostToolUse",
        tool_name: "Edit",
        tool_input: { file_path: filePath, new_string: code }
      })
      const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=${projectRoot} bun run ${projectRoot}/.claude/hooks/pattern-detector/index.ts`.text().catch(() => "")
      const matched = tags.some(tag => result.includes(tag))
      expect(matched).toBe(true)
    })

    if (config.shouldNotMatch.length > 0) {
      it.each(config.shouldNotMatch)("should NOT match: %s", async (code) => {
        const input = JSON.stringify({
          hook_event_name: "PostToolUse",
          tool_name: "Edit",
          tool_input: { file_path: filePath, new_string: code }
        })
        const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=${projectRoot} bun run ${projectRoot}/.claude/hooks/pattern-detector/index.ts`.text().catch(() => "")
        const matched = tags.some(tag => result.includes(tag))
        expect(matched).toBe(false)
      })
    }
  })
}
