import "@typespec/protobuf";

using Protobuf;

/**
 * AgentService — Agent 运行时核心
 * LLM 循环 + 工具调度 + SSE 事件流
 */
@package({ name: "agent.v1" })
namespace AgentV1 {

  // ── Chat ──────────────────────────────────────────────────────────────

  @message model ChatRequest {
    @field(1) sessionId: string;
    @field(2) content: string;
  }

  @message model ChatResponse {}

  // ── Interrupt ─────────────────────────────────────────────────────────

  @message model InterruptRequest {
    @field(1) sessionId: string;
  }

  @message model InterruptResponse {
    @field(1) success: boolean;
  }

  // ── Delete Messages ──────────────────────────────────────────────────

  @message model DeleteMessagesFromRequest {
    @field(1) sessionId: string;
    @field(2) messageId: string;
  }

  @message model DeleteMessagesFromResponse {
    @field(1) deleted: int32;
  }

  // ── Events ────────────────────────────────────────────────────────────

  @message model SubscribeEventsRequest {
    @field(1) sessionId: string;
  }

  @message model SessionEvent {
    @field(1) type:      string;
    @field(2) data:      string;
    @field(3) sessionId: string;
  }

  // ── Health ────────────────────────────────────────────────────────────

  @message model HealthRequest {}

  @message model HealthResponse {
    @field(1) status: string;
  }

  // ── Service ───────────────────────────────────────────────────────────

  @Protobuf.service
  interface AgentService {
    chat(...ChatRequest): ChatResponse;
    interrupt(...InterruptRequest): InterruptResponse;
    deleteMessagesFrom(...DeleteMessagesFromRequest): DeleteMessagesFromResponse;

    @stream(StreamMode.Out)
    subscribeSessionEvents(...SubscribeEventsRequest): SessionEvent;

    health(...HealthRequest): HealthResponse;
  }
}
