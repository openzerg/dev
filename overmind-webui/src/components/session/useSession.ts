import { onMount, onCleanup, createSignal, createEffect } from 'solid-js';
import { getRegistry, getAgent } from '~/lib/clients';
import { unwrap } from '~/lib/result';
import { createEventHandler, type EventHandlerDeps } from './sessionEventHandler';
import type { DisplayMessage, TodoItem, ProcessInfo } from './types';

export function useSession(sessionId: string) {
  const registry = getRegistry();
  const agent = getAgent();

  const [session, setSession] = createSignal<any>(null);
  const [messages, setMessages] = createSignal<DisplayMessage[]>([]);
  const [sending, setSending] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [streamingContent, setStreamingContent] = createSignal('');
  const [streamingThinking, setStreamingThinking] = createSignal('');
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
  const [inputText, setInputText] = createSignal('');

  let messagesEndEl: HTMLDivElement | undefined;
  let abortController: AbortController | null = null;

  const scrollToBottom = () => {
    setTimeout(() => messagesEndEl?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const loadSession = async () => {
    try {
      const result = await registry.getSession(sessionId);
      setSession(unwrap(result));
    } catch {}
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await registry.listMessages({ sessionId, limit: 200 });
      const data = unwrap(result);
      const msgs: DisplayMessage[] = ((data as any).messages || data || []).map((m: any) => ({
        messageId: m.id || m.messageId || crypto.randomUUID(),
        role: m.role || 'assistant',
        content: m.content || '',
        sessionId: m.sessionId,
        toolName: m.toolName || m.tool_name || '',
        toolCallId: m.toolCallId || m.tool_call_id || '',
        toolSuccess: m.toolSuccess ?? m.tool_success ?? false,
        toolStatus: m.toolStatus || m.tool_status,
        createdAt: m.createdAt || Date.now(),
        tokenUsage: m.tokenUsage || m.token_usage,
        metadata: m.metadata,
        parentMessageId: m.parentMessageId || m.parent_message_id,
        toolCalls: m.toolCalls || m.tool_calls,
      }));
      setMessages(msgs);
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadProcesses = async () => {
    try {
      const result = await (registry as any).listProcesses?.(sessionId);
      if (result) {
        const data = unwrap(result);
        setProcesses(((data as any).processes || data || []).map((p: any) => ({
          processId: p.processId || p.process_id || p.id || '',
          command: p.command || '',
          status: p.status || '',
        })));
      }
    } catch {}
  };

  const deps: EventHandlerDeps = {
    setStreamingThinking,
    setStreamingContent,
    streamingContent,
    streamingThinking,
    setMessages,
    setSending,
    setError,
    setTodos,
    scrollToBottom,
    loadSession,
    loadProcesses,
    t: () => ({} as any),
  };

  const handleEvent = createEventHandler(deps);

  const startSubscription = async () => {
    abortController?.abort();
    abortController = new AbortController();
    setSending(true);
    setError(null);

    try {
      const stream = agent.subscribeSessionEvents(sessionId);

      if (stream && typeof stream === 'object' && Symbol.asyncIterator in stream) {
        try {
          for await (const event of stream as AsyncIterable<any>) {
            if (abortController?.signal.aborted) break;
            handleEvent(event as { type: string; payload: Record<string, unknown> });
          }
        } catch (err: any) {
          if (!abortController?.signal.aborted) {
            setError(err?.message || 'Stream error');
          }
        }
      }

      setSending(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to subscribe');
      setSending(false);
    }
  };

  const send = async () => {
    const text = inputText().trim();
    if (!text) return;
    setError(null);
    setInputText('');

    const userMsg: DisplayMessage = {
      messageId: `user_${Date.now()}`,
      role: 'user',
      content: text,
      toolName: '',
      toolCallId: '',
      toolSuccess: false,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, { ...userMsg, messageId: STREAMING_ID } as DisplayMessage]);

    try {
      await agent.chat(sessionId, text);
    } catch (e: any) {
      setError(e?.message || 'Failed to send message');
    }
  };

  const interrupt = async () => {
    try {
      await agent.interrupt(sessionId);
    } catch (e: any) {
      setError(e?.message || 'Failed to interrupt');
    }
  };

  const stop = async () => {
    try {
      await registry.stopSession(sessionId);
      abortController?.abort();
      setSending(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to stop session');
    }
  };

  const start = async () => {
    try {
      await registry.startSession(sessionId);
      startSubscription();
    } catch (e: any) {
      setError(e?.message || 'Failed to start session');
    }
  };

  onMount(async () => {
    await Promise.all([loadSession(), loadMessages()]);
    const s = session();
    if (s?.state === 'running') {
      startSubscription();
    }
  });

  onCleanup(() => {
    abortController?.abort();
  });

  return {
    session,
    messages,
    sending,
    loading,
    error,
    streamingContent,
    streamingThinking,
    todos,
    processes,
    inputText,
    setInputText,
    messagesEndRef: (el: HTMLDivElement) => { messagesEndEl = el; },
    send,
    interrupt,
    stop,
    start,
    startSubscription,
    loadSession,
    loadMessages,
  };
}

const STREAMING_ID = '__streaming__';
