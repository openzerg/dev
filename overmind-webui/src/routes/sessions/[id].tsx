import { Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Box, Alert } from '@suid/material';
import { useSession } from '~/components/session/useSession';
import SessionHeader from '~/components/session/SessionHeader';
import MessageList from '~/components/session/MessageList';
import SessionStatusPanel from '~/components/session/SessionStatusPanel';
import ChatInput from '~/components/session/ChatInput';

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
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
    messagesEndRef,
    send,
    interrupt,
    start,
    stop,
  } = useSession(params.id);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', p: 3, pt: 1 }}>
      <SessionHeader
        session={session()}
        sessionId={params.id}
        onBack={() => navigate('/sessions')}
        onInterrupt={interrupt}
        sending={sending()}
      />

      <Show when={error()}>
        <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{error()}</Alert>
      </Show>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', mt: 1, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <MessageList
              messages={messages()}
              loading={loading()}
              sending={sending()}
              streamingContent={streamingContent()}
              streamingThinking={streamingThinking()}
              messagesEndRef={messagesEndRef}
            />
          </Box>
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <ChatInput
              value={inputText()}
              onChange={setInputText}
              onSend={send}
              onInterrupt={interrupt}
              sending={sending()}
            />
          </Box>
        </Box>

        <Show when={session()}>
          <SessionStatusPanel
            session={session()}
            providers={[]}
            todos={todos()}
            processes={processes()}
            messageCount={messages().length}
          />
        </Show>
      </Box>
    </Box>
  );
}
