import { type Component, For, Show } from 'solid-js';
import { Box, Typography, Chip, Divider } from '@suid/material';
import PersonOutlined from '@suid/icons-material/PersonOutlined';
import SmartToyOutlined from '@suid/icons-material/SmartToyOutlined';

interface ChatroomContentProps {
  content: string;
  maxHeight?: number;
}

interface ChatMessage {
  sender?: string;
  content?: string;
  text?: string;
  timestamp?: string;
  type?: string;
}

const ChatroomContent: Component<ChatroomContentProps> = (props) => {
  const parsed = () => {
    try {
      const data = JSON.parse(props.content);
      return {
        info: data.info || data.channel || data.chatroom,
        messages: data.messages || data.items || [],
      };
    } catch {
      return { info: null, messages: [] };
    }
  };

  const messages = (): ChatMessage[] => {
    const msgs = parsed().messages;
    if (Array.isArray(msgs)) return msgs;
    return [];
  };

  const isAgent = (sender?: string) => sender?.includes('agent') || sender?.includes('mutalisk');

  return (
    <Box sx={{ maxHeight: props.maxHeight || 400, overflow: 'auto' }}>
      <Show when={parsed().info}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Channel: {parsed().info?.name || parsed().info?.id || ''}
          </Typography>
          <Show when={parsed().info?.members}>
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
              ({parsed().info?.members?.length || 0} members)
            </Typography>
          </Show>
        </Box>
        <Divider sx={{ mb: 1 }} />
      </Show>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <For each={messages()}>
          {(msg) => (
            <Box sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.5,
              p: 0.5,
              bgcolor: isAgent(msg.sender) ? 'rgba(34,197,94,0.1)' : 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            }}>
              {isAgent(msg.sender) 
                ? <SmartToyOutlined sx={{ fontSize: 14, color: '#34d399' }} />
                : <PersonOutlined sx={{ fontSize: 14, color: '#60a5fa' }} />
              }
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                  {msg.sender || 'unknown'}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                  {msg.content || msg.text || ''}
                </Typography>
              </Box>
              <Show when={msg.timestamp}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                  {msg.timestamp}
                </Typography>
              </Show>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
};

export default ChatroomContent;
