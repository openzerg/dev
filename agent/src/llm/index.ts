import OpenAI from "openai"

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
}

export interface LLMTool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: unknown
  }
}

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool"
  content: string | null
  tool_calls?: Array<{
    id: string
    type: "function"
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface StreamChunk {
  type: "text" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "usage" | "done"
  content?: string
  toolCallId?: string
  toolName?: string
  toolArgsDelta?: string
  usage?: { inputTokens: number; outputTokens: number }
  finishReason?: string
}

export class LLMClient {
  private client: OpenAI
  private model: string
  private maxTokens: number

  constructor(config: LLMConfig) {
    this.client = new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey })
    this.model = config.model
    this.maxTokens = config.maxTokens ?? 4096
  }

  async complete(messages: LLMMessage[], signal?: AbortSignal): Promise<string> {
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      max_tokens: this.maxTokens,
    }, { signal })
    return resp.choices[0]?.message?.content ?? ""
  }

  async *stream(
    messages: LLMMessage[],
    tools?: LLMTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      tools: tools?.length ? tools as any : undefined,
      max_tokens: this.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }, { signal })

    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0]
      if (!choice) continue

      if (choice.delta?.content) {
        yield { type: "text", content: choice.delta.content }
      }

      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.id) {
            toolCallBuffers.set(tc.index, { id: tc.id, name: tc.function?.name ?? "", args: "" })
            yield {
              type: "tool_call_start",
              toolCallId: tc.id,
              toolName: tc.function?.name ?? "",
            }
          }
          const buf = toolCallBuffers.get(tc.index)
          if (buf && tc.function?.arguments) {
            buf.args += tc.function.arguments
            yield { type: "tool_call_delta", toolCallId: buf.id, toolArgsDelta: tc.function.arguments }
          }
        }
      }

      if (choice.finish_reason) {
        for (const [, buf] of toolCallBuffers) {
          yield { type: "tool_call_end", toolCallId: buf.id, toolName: buf.name, content: buf.args }
        }
        toolCallBuffers.clear()
        yield { type: "done", finishReason: choice.finish_reason }
      }

      if (chunk.usage) {
        yield {
          type: "usage",
          usage: {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          },
        }
      }
    }
  }
}
