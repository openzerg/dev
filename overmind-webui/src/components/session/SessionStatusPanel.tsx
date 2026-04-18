import { type Component, For, Show, createMemo } from 'solid-js';
import { Box, Typography, LinearProgress, Chip } from '@suid/material';
import MemoryIcon from '@suid/icons-material/Memory';
import CheckCircleIcon from '@suid/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@suid/icons-material/RadioButtonUnchecked';
import FiberManualRecordIcon from '@suid/icons-material/FiberManualRecord';
import TerminalIcon from '@suid/icons-material/Terminal';
import type { TodoItem, ProcessInfo } from './types';

interface SessionStatusPanelProps {
  session: any | null;
  providers: { name: string; model: string; isActive: boolean }[];
  todos: TodoItem[];
  processes: ProcessInfo[];
  messageCount: number;
  onSwitchProvider?: (name: string) => void;
}

const SessionStatusPanel: Component<SessionStatusPanelProps> = (props) => {
  const tokenUsagePercent = createMemo(() => {
    const s = props.session;
    if (!s) return 0;
    const input = Number(s.inputTokens ?? s.input_tokens ?? 0);
    const output = Number(s.outputTokens ?? s.output_tokens ?? 0);
    const total = input + output;
    if (total === 0) return 0;
    return Math.min(100, (total / 100000) * 100);
  });

  const tokenBarColor = createMemo(() => {
    const pct = tokenUsagePercent();
    if (pct > 80) return '#f87171';
    if (pct > 50) return '#fbbf24';
    return '#34d399';
  });

  return (
    <Box sx={{
      width: 280,
      minWidth: 280,
      borderLeft: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      bgcolor: 'rgba(0,0,0,0.1)',
    }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Provider
        </Typography>
        <For each={props.providers}>
          {(p) => (
            <Box
              sx={{
                mt: 0.5,
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: p.isActive ? 'primaryContainer' : 'transparent',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => props.onSwitchProvider?.(p.name)}
            >
              <Typography variant="body2" sx={{ fontWeight: p.isActive ? 600 : 400 }}>
                {p.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {p.model}
              </Typography>
            </Box>
          )}
        </For>
        <Show when={props.providers.length === 0}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            No providers
          </Typography>
        </Show>
      </Box>

      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Token Usage
        </Typography>
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={tokenUsagePercent()}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: tokenBarColor(),
                borderRadius: 3,
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              In: {Number(props.session?.inputTokens ?? props.session?.input_tokens ?? 0).toLocaleString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Out: {Number(props.session?.outputTokens ?? props.session?.output_tokens ?? 0).toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Todos
        </Typography>
        <Show when={props.todos.length === 0}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            No tasks
          </Typography>
        </Show>
        <For each={props.todos}>
          {(todo) => (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
              <Show when={todo.status === 'completed'} fallback={
                <Show when={todo.status === 'in_progress'} fallback={
                  <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25 }} />
                }>
                  <FiberManualRecordIcon sx={{ fontSize: 14, color: '#fbbf24', mt: 0.25 }} />
                </Show>
              }>
                <CheckCircleIcon sx={{ fontSize: 14, color: '#34d399', mt: 0.25 }} />
              </Show>
              <Typography variant="caption" sx={{
                color: todo.status === 'completed' ? 'text.secondary' : 'text.primary',
                textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                lineHeight: 1.4,
              }}>
                {todo.content}
              </Typography>
              <Show when={todo.priority === 'high'}>
                <Chip label="!" size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#f8717133', color: '#f87171' }} />
              </Show>
            </Box>
          )}
        </For>
      </Box>

      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TerminalIcon sx={{ fontSize: 14 }} />
          Processes
        </Typography>
        <Show when={props.processes.length === 0}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
            No running processes
          </Typography>
        </Show>
        <For each={props.processes}>
          {(proc) => (
            <Box sx={{ mt: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>
                {proc.command}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                {proc.processId.slice(0, 8)}
              </Typography>
            </Box>
          )}
        </For>
      </Box>

      <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MemoryIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {props.messageCount} messages
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default SessionStatusPanel;
