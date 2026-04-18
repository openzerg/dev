import { type Component, Show } from 'solid-js';
import { Box, Typography, Chip, IconButton, Button } from '@suid/material';
import ArrowBack from '@suid/icons-material/ArrowBack';
import StopIcon from '@suid/icons-material/Stop';
import CompressIcon from '@suid/icons-material/Compress';
import { useI18n } from '~/i18n/context';

interface SessionInfo {
  sessionId: string;
  title?: string;
  purpose?: string;
  state: string;
  inputTokens?: number | bigint;
  outputTokens?: number | bigint;
  compactCount?: number;
}

interface SessionHeaderProps {
  session: SessionInfo | null;
  sessionId: string;
  onBack: () => void;
  onInterrupt?: () => void;
  onCompact?: () => void;
  sending?: boolean;
  compactCount?: number;
}

const SessionHeader: Component<SessionHeaderProps> = (props) => {
  const { t } = useI18n();

  const sessionStateColor = () => {
    const s = props.session;
    if (!s) return 'default';
    switch (s.state) {
      case 'running': return 'info';
      case 'compacting': return 'warning';
      case 'idle': return 'success';
      case 'done':
      case 'completed': return 'success';
      case 'error':
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const sessionStateLabel = () => {
    const s = props.session;
    if (!s) return t().status.unknown;
    switch (s.state) {
      case 'idle': return t().status.idle;
      case 'running': return t().status.running;
      case 'compacting': return 'Compacting';
      case 'done':
      case 'completed': return t().status.done;
      case 'error':
      case 'failed': return t().status.error;
      default: return t().status.unknown;
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <IconButton size="small" onClick={props.onBack}>
        <ArrowBack />
      </IconButton>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {props.session?.purpose || props.session?.title || t().sessions.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
            {props.sessionId}
          </Typography>
          <Chip size="small" label={sessionStateLabel()} color={sessionStateColor() as any} />
          <Show when={props.compactCount && props.compactCount > 0}>
            <Chip size="small" label={`${props.compactCount} compacts`} variant="outlined" />
          </Show>
        </Box>
      </Box>
      <Show when={props.session?.state === 'running' || props.sending}>
        <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />} onClick={props.onInterrupt}>
          {t().sessionDetail.stop}
        </Button>
      </Show>
      <Show when={(props.session?.state === 'idle' || props.session?.state === 'done') && props.onCompact}>
        <Button size="small" variant="outlined" startIcon={<CompressIcon />} onClick={props.onCompact}>
          Compact
        </Button>
      </Show>
    </Box>
  );
};

export default SessionHeader;
