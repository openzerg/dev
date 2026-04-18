import { type Component, Show } from 'solid-js';
import { Box, Typography, IconButton, Paper } from '@suid/material';
import MoreVert from '@suid/icons-material/MoreVert';
import PsychologyIcon from '@suid/icons-material/Psychology';
import { MarkdownContent, StreamingMarkdown } from './MarkdownContent';
import ToolBubble from './ToolBubble';
import type { DisplayMessage, ToolCallInfo } from './types';

const roleLabel = (role: string) => {
  switch (role) {
    case 'user': return 'You';
    case 'assistant': return 'Assistant';
    case 'tool': return 'Tool';
    case 'system': return 'System';
    default: return role;
  }
};

interface MessageBubbleProps {
  msg: DisplayMessage;
  toolCall?: ToolCallInfo;
  onMenuClick?: (el: HTMLElement, msgId: string, content: string) => void;
  dimmed?: boolean;
}

const MessageBubble: Component<MessageBubbleProps> = (props) => {
  const handleMenuClick = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    props.onMenuClick?.(target, props.msg.messageId, props.msg.content);
  };

  const isEmptyAssistant = () => props.msg.role === 'assistant' && !props.msg.content.trim();

  return (
    <Show when={props.msg.role === 'tool'} fallback={
      <Show when={!isEmptyAssistant()}>
        <Box sx={{ display: 'flex', justifyContent: props.msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
          <Box sx={{ maxWidth: '85%', position: 'relative' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 500 }}>
                {roleLabel(props.msg.role)}
              </Typography>
              <Show when={props.msg.role === 'user' && props.onMenuClick}>
                <IconButton size="small" sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }} onClick={handleMenuClick}>
                  <MoreVert sx={{ fontSize: 14 }} />
                </IconButton>
              </Show>
            </Box>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1,
                bgcolor: props.msg.role === 'user' 
                  ? props.dimmed ? 'primary.light' : 'primary.main' 
                  : props.dimmed ? 'action.selected' : 'action.hover',
                color: props.msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                borderRadius: props.msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                opacity: props.dimmed ? 0.6 : 1,
              }}
            >
              <Show when={props.msg.role === 'assistant'} fallback={
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{props.msg.content}</Typography>
              }>
                <Box class="msg-assistant" sx={{ '& p': { my: 0.5 }, '& pre': { my: 0.5 } }}>
                  <MarkdownContent content={props.msg.content} />
                </Box>
              </Show>
            </Paper>
          </Box>
        </Box>
      </Show>
    }>
      <ToolBubble
        toolName={props.msg.toolName}
        content={props.msg.content}
        toolSuccess={props.msg.toolSuccess}
        toolStatus={props.msg.toolStatus}
        toolCall={props.toolCall}
      />
    </Show>
  );
};

interface ThinkingBubbleProps {
  content: string;
}

const ThinkingBubble: Component<ThinkingBubbleProps> = (props) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
    <Box sx={{ maxWidth: '85%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
        <PsychologyIcon sx={{ fontSize: 14, color: '#c084fc' }} />
        <Typography variant="caption" sx={{ color: '#c084fc', fontWeight: 500 }}>Thinking</Typography>
      </Box>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'rgba(192, 132, 252, 0.08)',
          border: '1px solid rgba(192, 132, 252, 0.2)',
          borderRadius: '16px 16px 16px 4px',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#c084fc', opacity: 0.8 }}>
          {props.content}
        </Typography>
      </Paper>
    </Box>
  </Box>
);

interface StreamingBubbleProps {
  content: string;
}

const StreamingBubble: Component<StreamingBubbleProps> = (props) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
    <Box sx={{ maxWidth: '85%' }}>
      <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 500, display: 'block', mb: 0.25 }}>
        Assistant
      </Typography>
      <Paper elevation={0} sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderRadius: '16px 16px 16px 4px' }}>
        <StreamingMarkdown content={props.content} />
      </Paper>
    </Box>
  </Box>
);

export { MessageBubble, ThinkingBubble, StreamingBubble };
