import { type Component, Show } from 'solid-js';
import { Box, TextField, Button } from '@suid/material';
import StopIcon from '@suid/icons-material/Stop';
import Send from '@suid/icons-material/Send';
import { useI18n } from '~/i18n/context';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onInterrupt?: () => void;
  sending: boolean;
  disabled?: boolean;
}

const ChatInput: Component<ChatInputProps> = (props) => {
  const { t } = useI18n();

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      props.onSend();
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <TextField
        fullWidth
        size="small"
        placeholder={t().sessionDetail.typePlaceholder}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={props.sending || props.disabled}
        multiline
        maxRows={4}
      />
      <Show when={props.sending && props.onInterrupt}>
        <Button variant="outlined" color="error" onClick={props.onInterrupt} startIcon={<StopIcon />} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t().sessionDetail.stop}
        </Button>
      </Show>
      <Show when={!props.sending}>
        <Button variant="contained" onClick={props.onSend} disabled={!props.value.trim()} startIcon={<Send />} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t().actions.send}
        </Button>
      </Show>
    </Box>
  );
};

export default ChatInput;
