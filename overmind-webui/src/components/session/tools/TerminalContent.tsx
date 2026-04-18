import { type Component, Show } from 'solid-js';
import { Box, Typography } from '@suid/material';

interface TerminalContentProps {
  content: string;
  maxHeight?: number;
}

const TerminalContent: Component<TerminalContentProps> = (props) => {
  const parseOutput = () => {
    try {
      const parsed = JSON.parse(props.content);
      return {
        jobId: parsed.job_id || parsed.processId || '',
        exitCode: parsed.exit_code ?? parsed.exitCode,
        stdout: parsed.stdout || '',
        stderr: parsed.stderr || '',
        duration: parsed.duration_ms || parsed.duration,
        status: parsed.status || '',
      };
    } catch {
      return { stdout: props.content };
    }
  };

  const output = () => parseOutput();

  return (
    <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
      <Show when={output().jobId}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Job: {output().jobId}
        </Typography>
      </Show>
      <Show when={output().duration}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Duration: {output().duration}ms
        </Typography>
      </Show>
      <Show when={output().exitCode !== undefined}>
        <Typography variant="caption" sx={{ color: output().exitCode === 0 ? '#34d399' : '#f87171', mb: 0.5, display: 'block' }}>
          Exit code: {output().exitCode}
        </Typography>
      </Show>
      
      <Box sx={{ bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '4px', p: 1 }}>
        <Show when={output().stdout}>
          <pre style={{
            margin: 0,
            color: '#e5e5e5',
            'font-size': '0.7rem',
            'font-family': 'monospace',
            'white-space': 'pre-wrap',
            'word-break': 'break-word',
          }}>
            {output().stdout}
          </pre>
        </Show>
        <Show when={output().stderr}>
          <pre style={{
            margin: `${output().stdout ? '8px' : '0'} 0 0 0`,
            color: '#f87171',
            'font-size': '0.7rem',
            'font-family': 'monospace',
            'white-space': 'pre-wrap',
            'word-break': 'break-word',
          }}>
            {output().stderr}
          </pre>
        </Show>
        <Show when={!output().stdout && !output().stderr && output().status}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Status: {output().status}
          </Typography>
        </Show>
      </Box>
    </Box>
  );
};

export default TerminalContent;
