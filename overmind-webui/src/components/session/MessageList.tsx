import { type Component, For, Show, createMemo } from 'solid-js';
import { Box, CircularProgress, Typography, Button, Chip } from '@suid/material';
import HistoryIcon from '@suid/icons-material/History';
import ExpandLessIcon from '@suid/icons-material/ExpandLess';
import { MessageBubble, ThinkingBubble, StreamingBubble } from './MessageBubble';
import type { DisplayMessage, ToolCallInfo } from './types';

interface MessageListProps {
  messages: DisplayMessage[];
  loading: boolean;
  sending: boolean;
  streamingContent: string;
  streamingThinking: string;
  compactCount?: number;
  showHistory?: boolean;
  historyMessages?: DisplayMessage[];
  historyLevel?: number;
  onLoadHistory?: (level: number) => void;
  onHideHistory?: () => void;
  onMenuClick?: (el: HTMLElement, msgId: string, content: string) => void;
  messagesEndRef?: (el: HTMLDivElement) => void;
}

const MessageList: Component<MessageListProps> = (props) => {
  const toolCallMap = createMemo(() => {
    const map = new Map<string, ToolCallInfo>();
    for (const msg of props.messages) {
      if (msg.role === 'assistant' && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          map.set(tc.id, tc);
        }
      }
    }
    return map;
  });

  const getToolCall = (toolCallId: string) => toolCallMap().get(toolCallId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Show when={props.loading}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Show>

      <Show when={!props.loading && props.compactCount && props.compactCount > 0}>
        <Show when={!props.showHistory}>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 1, 
              py: 1,
              bgcolor: 'rgba(0,0,0,0.05)',
              borderRadius: 1,
            }}
          >
            <HistoryIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {props.compactCount} previous compactions
            </Typography>
            <Button 
              size="small" 
              variant="text" 
              startIcon={<ExpandLessIcon />}
              onClick={() => props.onLoadHistory?.(0)}
            >
              View History
            </Button>
          </Box>
        </Show>
        <Show when={props.showHistory}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Chip label={`History Level ${props.historyLevel ?? 0}`} size="small" />
              <Show when={(props.historyLevel ?? 0) < (props.compactCount || 1) - 1}>
                <Button size="small" variant="text" onClick={() => props.onLoadHistory?.((props.historyLevel ?? 0) + 1)}>
                  Load Older
                </Button>
              </Show>
              <Button size="small" variant="text" onClick={props.onHideHistory}>
                Hide
              </Button>
            </Box>
            <For each={props.historyMessages}>
              {(msg) => (
                <MessageBubble
                  msg={msg}
                  toolCall={msg.role === 'tool' ? getToolCall(msg.toolCallId) : undefined}
                  onMenuClick={props.onMenuClick}
                  dimmed={true}
                />
              )}
            </For>
            <Box sx={{ borderBottom: '2px dashed', borderColor: 'divider', my: 2 }} />
          </Box>
        </Show>
      </Show>

      <For each={props.messages}>
        {(msg) => (
          <MessageBubble
            msg={msg}
            toolCall={msg.role === 'tool' ? getToolCall(msg.toolCallId) : undefined}
            onMenuClick={props.onMenuClick}
          />
        )}
      </For>

      <Show when={props.streamingThinking}>
        <ThinkingBubble content={props.streamingThinking} />
      </Show>

      <Show when={props.streamingContent}>
        <StreamingBubble content={props.streamingContent} />
      </Show>

      <Show when={props.sending && !props.streamingContent && !props.streamingThinking}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Processing...</Typography>
          </Box>
        </Box>
      </Show>

      <div ref={props.messagesEndRef} />
    </Box>
  );
};

export default MessageList;
