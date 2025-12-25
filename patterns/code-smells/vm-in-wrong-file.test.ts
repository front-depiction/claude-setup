import { describe, it, expect } from "vitest"
import { $ } from "bun"

const patternTag = "vm-location"

const shouldMatch = [
  { code: "interface ComponentVM {", filePath: "Component.ts" },
  { code: "Context.GenericTag<SettingsVM>", filePath: "Settings.tsx" },
  { code: "Layer.effect(ComponentVM", filePath: "component.ts" },
  { code: "Layer.scoped(  PageVM", filePath: "page.tsx" },
  { code: "interface UserVM { name: string }", filePath: "User.tsx" },
]

const shouldNotMatch = [
  { code: "interface ComponentVM {", filePath: "Component.vm.ts" },
  { code: "Context.GenericTag<SettingsVM>", filePath: "Settings.vm.ts" },
  { code: "Layer.effect(PageVM", filePath: "page.vm.ts" },
  { code: "const vm = useVM()", filePath: "Component.tsx" },
  { code: "interface Component {", filePath: "Component.ts" },
  { code: "const UserService = Context.GenericTag<UserService>()", filePath: "User.ts" },
]

describe("vm-in-wrong-file", () => {
  it.each(shouldMatch)("should match: $code in $filePath", async ({ code, filePath }) => {
    const input = JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: filePath, new_string: code }
    })
    const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=. bun run .claude/hooks/pattern-detector/index.ts`.cwd("/Users/front_depiction/Desktop/Phosphor/repos/interviews").text()
    expect(result).toContain(patternTag)
  })

  it.each(shouldNotMatch)("should NOT match: $code in $filePath", async ({ code, filePath }) => {
    const input = JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: { file_path: filePath, new_string: code }
    })
    const result = await $`echo ${input} | CLAUDE_PROJECT_DIR=. bun run .claude/hooks/pattern-detector/index.ts`.cwd("/Users/front_depiction/Desktop/Phosphor/repos/interviews").text()
    expect(result).not.toContain(patternTag)
  })
})
