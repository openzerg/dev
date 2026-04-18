import type { DisplayMessage, TodoItem } from './types';

const STREAMING_ID = '__streaming__';

export interface EventHandlerDeps {
  setStreamingThinking: (fn: (prev: string) => string) => void;
  setStreamingContent: (fn: (prev: string) => string) => void;
  streamingContent: () => string;
  streamingThinking: () => string;
  setMessages: (fn: (prev: DisplayMessage[]) => DisplayMessage[]) => void;
  setSending: (v: boolean) => void;
  setError: (v: string | null) => void;
  setTodos: (fn: (prev: TodoItem[]) => TodoItem[]) => void;
  scrollToBottom: () => void;
  loadSession: () => Promise<void>;
  loadProcesses: () => Promise<void>;
  t: () => any;
}

export function createEventHandler(deps: EventHandlerDeps) {
  return (event: { type: string; payload: Record<string, unknown> }) => {
    const payload = event.payload;

    switch (event.type) {
      case 'thinking':
        deps.setStreamingThinking((prev) => prev + (payload.content as string || ''));
        deps.scrollToBottom();
        break;

      case 'message_delta':
      case 'response': {
        const content = (payload.content as string) || '';
        const streaming = payload.streaming !== false;
        if (streaming) {
          if (!deps.streamingContent() && deps.streamingThinking()) {
            deps.setStreamingThinking(() => '');
          }
          deps.setStreamingContent((prev) => prev + content);
          deps.scrollToBottom();
        } else {
          deps.setStreamingContent((prev) => prev + content);
          deps.scrollToBottom();
        }
        break;
      }

      case 'tool_call_start':
      case 'tool_call': {
        deps.setStreamingThinking(() => '');
        const toolMsg: DisplayMessage = {
          messageId: (payload.messageId as string) || (payload.id as string) || `tool_${Date.now()}`,
          role: 'tool',
          content: '',
          toolName: (payload.toolName as string) || (payload.name as string) || 'unknown',
          toolCallId: (payload.toolCallId as string) || (payload.tool_call_id as string) || '',
          toolSuccess: false,
          toolStatus: 'running',
          createdAt: Date.now(),
        };
        deps.setMessages((prev) => {
          const idx = prev.findIndex((m) => m.messageId === STREAMING_ID);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              messageId: `assistant_${Date.now()}`,
              content: deps.streamingContent(),
            };
            return [...updated, toolMsg];
          }
          return [...prev, toolMsg];
        });
        deps.setStreamingContent(() => '');
        deps.scrollToBottom();
        break;
      }

      case 'tool_call_end':
      case 'tool_result':
        deps.setMessages((prev) =>
          prev.map((m) => {
            const tcId = (payload.toolCallId as string) || (payload.tool_call_id as string);
            if (tcId && m.toolCallId === tcId) {
              return {
                ...m,
                content: (payload.content as string) || m.content,
                toolSuccess: payload.toolSuccess !== undefined
                  ? !!payload.toolSuccess
                  : payload.success !== undefined
                    ? !!payload.success
                    : m.toolSuccess,
                toolStatus: payload.toolSuccess || payload.success ? 'completed' : 'error',
              };
            }
            return m;
          }),
        );
        break;

      case 'done':
      case 'message_end':
        deps.setSending(false);
        deps.setStreamingContent(() => '');
        deps.setStreamingThinking(() => '');
        deps.loadSession();
        deps.loadProcesses();
        break;

      case 'error':
        deps.setSending(false);
        deps.setStreamingContent(() => '');
        deps.setStreamingThinking(() => '');
        deps.setError((payload.content as string) || (payload.message as string) || deps.t().status.error);
        break;

      case 'interrupted':
      case 'state_change':
        if (event.type === 'interrupted') {
          deps.setSending(false);
          deps.setStreamingContent(() => '');
          deps.setStreamingThinking(() => '');
        }
        deps.loadSession();
        break;

      case 'todo_update':
        try {
          const raw = (payload.content as string) || (payload.todos as string);
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : payload.todos;
          if (Array.isArray(parsed)) {
            deps.setTodos(() => parsed.map((item: any) => ({
              content: item.content || '',
              status: item.status || 'pending',
              priority: item.priority,
            })));
          }
        } catch {}
        break;

      case 'process_notification':
        deps.loadProcesses();
        break;

      case 'compacting':
        deps.setStreamingContent(() => '');
        deps.setStreamingThinking(() => '');
        deps.setError('Compacting history...');
        break;

      case 'compacted':
        deps.setError(null);
        deps.loadSession();
        break;
    }
  };
}
