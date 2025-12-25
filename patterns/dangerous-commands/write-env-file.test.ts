import { describe, it, expect } from "vitest"
import { $ } from "bun"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "../../..")

describe("write-env-file", () => {
  const shouldMatch = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    "apps/web/.env",
    "/path/to/.env",
    "config/.env.test",
    ".env.staging",
  ]

  const shouldNotMatch = [
    ".env.example",
    ".env.template",
    "config.ts",
    "environment.ts",
    "src/env/config.ts",
    "README.md",
  ]

  it.each(shouldMatch)("should match: %s", async (filePath) => {
    const input = JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: filePath, content: "API_KEY=secret" }
    })
    const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=${projectRoot} bun run ${projectRoot}/.claude/hooks/pattern-detector/index.ts`.text().catch(() => "")
    expect(result).toContain(`"permissionDecision":"ask"`)
  })

  it.each(shouldNotMatch)("should NOT match: %s", async (filePath) => {
    const input = JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: filePath, content: "export const config = {}" }
    })
    const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=${projectRoot} bun run ${projectRoot}/.claude/hooks/pattern-detector/index.ts`.text().catch(() => "")
    expect(result).not.toContain("permissionDecision")
  })
})
