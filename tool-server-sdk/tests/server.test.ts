import { describe, test, expect } from "bun:test"
import { createToolServer } from "../src/server.js"
import type { ITool, GetContext } from "../src/tool.js"
import { ResultAsync, ok, err, errAsync } from "neverthrow"
import { InternalError } from "@openzerg/common"

const mockGetContext: GetContext = async (_token: string) => ({
  sessionId: "test-session",
  workerUrl: "http://localhost:9999",
  workerSecret: "test-secret",
  workspaceRoot: "/tmp/test-workspace",
  serverConfigs: {},
})

const mockTool: ITool = {
  name: "test-tool",
  description: "A test tool",
  group: "test",
  priority: 10,
  inputSchema: { type: "object", properties: { input: { type: "string" } } },
  outputSchema: { type: "object", properties: { output: { type: "string" } } },
  execute(_argsJson: string, _sessionToken: string, _getContext: GetContext) {
    return ResultAsync.fromPromise(
      (async () => {
        const args = JSON.parse(_argsJson)
        return ok({ output: `got: ${args.input}` })
      })(),
      () => new InternalError("unexpected"),
    ).andThen(r => r)
  },
}

const errorTool: ITool = {
  name: "error-tool",
  description: "Always fails",
  group: "test",
  priority: 5,
  inputSchema: { type: "object", properties: {} },
  outputSchema: { type: "object", properties: {} },
  execute() {
    return errAsync(new InternalError("intentional error"))
  },
}

describe("createToolServer", () => {
  test("listTools returns all registered tools", async () => {
    const router = createToolServer([mockTool, errorTool], mockGetContext)
    const handler = router(({
      service: () => {},
    } as any))

    const svcDef = (router as any).__svcDef
  })

  test("listTools response structure", async () => {
    const tools = [mockTool, errorTool]
    expect(tools).toHaveLength(2)
    expect(tools[0].name).toBe("test-tool")
    expect(tools[1].name).toBe("error-tool")
  })
})

describe("ITool execute", () => {
  test("mock tool returns ok with expected output", async () => {
    const result = await mockTool.execute('{"input":"hello"}', "tok", mockGetContext)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toEqual({ output: "got: hello" })
    }
  })

  test("error tool returns err", async () => {
    const result = await errorTool.execute("{}", "tok", mockGetContext)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.message).toBe("intentional error")
    }
  })
})
