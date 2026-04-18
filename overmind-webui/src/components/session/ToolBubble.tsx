import { type Component, Show, createSignal, createMemo, For } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Box, Typography, IconButton, Chip } from '@suid/material';
import ExpandMore from '@suid/icons-material/ExpandMore';
import CheckCircleIcon from '@suid/icons-material/CheckCircle';
import ErrorIcon from '@suid/icons-material/Error';
import HourglassEmptyIcon from '@suid/icons-material/HourglassEmpty';
import ToolIcon from './tools/ToolIcon';
import DiffContent from './tools/DiffContent';
import TerminalContent from './tools/TerminalContent';
import CodeContent from './tools/CodeContent';
import GenericContent from './tools/GenericContent';
import WriteContent from './tools/WriteContent';
import GlobContent from './tools/GlobContent';
import LsContent from './tools/LsContent';
import TodoContent from './tools/TodoContent';
import ChatroomContent from './tools/ChatroomContent';
import MemoryContent from './tools/MemoryContent';
import type { ToolCallInfo } from './types';

interface ToolBubbleProps {
  toolName: string;
  content: string;
  toolSuccess?: boolean;
  toolStatus?: 'running' | 'completed' | 'error';
  toolCall?: ToolCallInfo;
}

const diffTools = ['edit', 'multi-edit', 'apply-patch'];
const terminalTools = ['job-run', 'job-list', 'job-kill', 'job-output'];
const codeTools = ['read', 'grep'];
const fileOpsTools = ['glob', 'ls'];
const todoTools = ['todo-write', 'todo-read'];
const chatroomTools = ['chatroom-info', 'chatroom-message-read', 'chatroom-message-send'];
const memoryTools = ['memory-write', 'memory-read', 'memory-list'];

const ToolBubble: Component<ToolBubbleProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false);

  const status = () => props.toolStatus || (props.toolSuccess ? 'completed' : 'error');
  const isRunning = () => status() === 'running';
  const isSuccess = () => status() === 'completed';

  const statusIcon = () => {
    if (isRunning()) return <HourglassEmptyIcon sx={{ fontSize: 14, color: 'warning.main', animation: 'spin 1s linear infinite' }} />;
    if (isSuccess()) return <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />;
    return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
  };

  const statusLabel = () => {
    if (isRunning()) return 'Running';
    if (isSuccess()) return 'Success';
    return 'Failed';
  };

  const borderColorRef = () => {
    if (isRunning()) return 'warning.main';
    if (isSuccess()) return 'success.main';
    return 'error.main';
  };

  const filePath = createMemo(() => {
    if (!props.toolCall?.arguments) return undefined;
    try {
      const args = JSON.parse(props.toolCall.arguments);
      return args.file_path as string | undefined;
    } catch {
      return undefined;
    }
  });

  const parsedArgs = createMemo(() => {
    if (!props.toolCall?.arguments) return {};
    try {
      return JSON.parse(props.toolCall.arguments);
    } catch {
      return {};
    }
  });

  const displayArgs = createMemo(() => {
    const args = parsedArgs();
    const tool = props.toolName;
    
    const format: { key: string; value: string; type: 'text' | 'bool' | 'code' }[] = [];
    
    if (tool === 'job-run') {
      if (args.command) format.push({ key: 'command', value: args.command as string, type: 'code' });
      if (args.wait !== undefined) format.push({ key: 'wait', value: args.wait ? 'true' : 'false', type: 'bool' });
      if (args.timeout) format.push({ key: 'timeout', value: `${args.timeout}ms`, type: 'text' });
      if (args.workdir) format.push({ key: 'workdir', value: args.workdir as string, type: 'text' });
    } else if (tool === 'job-output') {
      if (args.job_id) format.push({ key: 'job_id', value: args.job_id as string, type: 'text' });
      if (args.stream) format.push({ key: 'stream', value: args.stream as string, type: 'text' });
      if (args.mode && args.mode !== 'all') format.push({ key: 'mode', value: args.mode as string, type: 'text' });
      if (args.lines) format.push({ key: 'lines', value: `${args.lines}`, type: 'text' });
      if (args.pattern) format.push({ key: 'pattern', value: args.pattern as string, type: 'code' });
    } else if (tool === 'job-kill' || tool === 'job-list') {
      if (args.job_id) format.push({ key: 'job_id', value: args.job_id as string, type: 'text' });
      if (args.all !== undefined) format.push({ key: 'all', value: args.all ? 'true' : 'false', type: 'bool' });
      if (args.running !== undefined) format.push({ key: 'running', value: args.running ? 'true' : 'false', type: 'bool' });
    } else if (tool === 'write') {
      if (args.file_path) format.push({ key: 'file', value: args.file_path as string, type: 'text' });
      const lines = (args.content as string)?.split('\n').length || 0;
      format.push({ key: 'lines', value: `${lines}`, type: 'text' });
    } else if (tool === 'edit' || tool === 'multi-edit') {
      if (args.file_path) format.push({ key: 'file', value: args.file_path as string, type: 'text' });
    } else if (tool === 'read') {
      if (args.file_path) format.push({ key: 'file', value: args.file_path as string, type: 'text' });
      const offset = args.offset || 1;
      const limit = args.limit || 2000;
      format.push({ key: 'range', value: `lines ${offset}-${offset + limit - 1}`, type: 'text' });
    } else if (tool === 'grep') {
      if (args.pattern) format.push({ key: 'pattern', value: args.pattern as string, type: 'code' });
      if (args.path) format.push({ key: 'path', value: args.path as string, type: 'text' });
      if (args.include) format.push({ key: 'include', value: args.include as string, type: 'text' });
    } else if (tool === 'glob') {
      if (args.pattern) format.push({ key: 'pattern', value: args.pattern as string, type: 'code' });
      if (args.path) format.push({ key: 'path', value: args.path as string, type: 'text' });
    } else if (tool === 'ls') {
      if (args.filePath) format.push({ key: 'path', value: args.filePath as string, type: 'text' });
    } else if (tool === 'task') {
      if (args.description) format.push({ key: 'desc', value: args.description as string, type: 'text' });
      if (args.subagent_type) format.push({ key: 'type', value: args.subagent_type as string, type: 'text' });
    } else if (tool === 'webfetch') {
      if (args.url) format.push({ key: 'url', value: args.url as string, type: 'text' });
      if (args.format) format.push({ key: 'format', value: args.format as string, type: 'text' });
    } else if (tool === 'playwright_browser_navigate') {
      if (args.url) format.push({ key: 'url', value: args.url as string, type: 'text' });
    } else if (tool === 'playwright_browser_click' || tool === 'playwright_browser_type') {
      if (args.element) format.push({ key: 'element', value: args.element as string, type: 'text' });
    } else if (tool === 'chatroom-message-send') {
      if (args.chatroom_id) format.push({ key: 'chatroom', value: args.chatroom_id as string, type: 'text' });
    } else if (tool === 'memory-write') {
      if (args.filename) format.push({ key: 'file', value: args.filename as string, type: 'text' });
      if (args.append !== undefined) format.push({ key: 'append', value: args.append ? 'true' : 'false', type: 'bool' });
    } else {
      Object.entries(args).forEach(([k, v]) => {
        if (k === 'content' && typeof v === 'string' && v.length > 50) {
          format.push({ key: k, value: `${v.slice(0, 50)}... (${v.length} chars)`, type: 'text' });
        } else if (typeof v === 'boolean') {
          format.push({ key: k, value: v ? 'true' : 'false', type: 'bool' });
        } else if (typeof v === 'string') {
          format.push({ key: k, value: v, type: 'text' });
        } else {
          format.push({ key: k, value: JSON.stringify(v), type: 'text' });
        }
      });
    }
    
    return format;
  });

  const ContentComponent = createMemo(() => {
    if (props.toolName === 'write') return WriteContent;
    if (diffTools.includes(props.toolName)) return DiffContent;
    if (terminalTools.includes(props.toolName)) return TerminalContent;
    if (codeTools.includes(props.toolName)) return CodeContent;
    if (fileOpsTools.includes(props.toolName)) return props.toolName === 'glob' ? GlobContent : LsContent;
    if (todoTools.includes(props.toolName)) return TodoContent;
    if (chatroomTools.includes(props.toolName)) return ChatroomContent;
    if (memoryTools.includes(props.toolName)) return MemoryContent;
    return GenericContent;
  });

  return (
    <Box
      sx={{
        borderLeftWidth: '3px',
        borderLeftStyle: 'solid',
        borderLeftColor: borderColorRef(),
        bgcolor: 'action.hover',
        borderRadius: '0 8px 8px 0',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ToolIcon toolName={props.toolName} />
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
          {props.toolName}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {statusIcon()}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
          {statusLabel()}
        </Typography>
      </Box>

      <Show when={displayArgs().length > 0}>
        <Box sx={{ px: 1.5, pb: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <For each={displayArgs()}>
            {(arg) => (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="caption" sx={{ 
                  color: 'text.secondary', 
                  minWidth: '60px', 
                  flexShrink: 0,
                  fontWeight: 500,
                }}>
                  {arg.key}
                </Typography>
                <Show when={arg.type === 'bool'}>
                  <Chip 
                    label={arg.value} 
                    size="small" 
                    color={arg.value === 'true' ? 'success' : 'default'}
                    sx={{ height: '20px', fontSize: '0.65rem' }}
                  />
                </Show>
                <Show when={arg.type === 'code'}>
                  <Box sx={{ 
                    flex: 1, 
                    bgcolor: 'action.selected', 
                    borderRadius: '4px', 
                    px: 1, 
                    py: 0.25,
                    overflow: 'hidden',
                  }}>
                    <Typography variant="caption" sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.7rem',
                      color: 'text.primary',
                      wordBreak: 'break-all',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {arg.value}
                    </Typography>
                  </Box>
                </Show>
                <Show when={arg.type === 'text'}>
                  <Typography variant="caption" sx={{ 
                    color: 'text.primary',
                    wordBreak: 'break-all',
                  }}>
                    {arg.value}
                  </Typography>
                </Show>
              </Box>
            )}
          </For>
        </Box>
      </Show>

      <Show when={props.content}>
        <Box 
          sx={{ 
            px: 1.5, 
            py: 0.5, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            cursor: 'pointer',
            bgcolor: 'action.hover',
          }}
          onClick={() => setExpanded(!expanded())}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Output
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small">
            <ExpandMore sx={{
              fontSize: 16,
              transition: 'transform 0.2s',
              transform: expanded() ? 'rotate(180deg)' : 'rotate(0deg)',
            }} />
          </IconButton>
        </Box>
      </Show>

      <Show when={expanded() && props.content}>
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Dynamic 
            component={ContentComponent()} 
            content={props.content} 
            filePath={filePath()}
          />
        </Box>
      </Show>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg) }
        }
      `}</style>
    </Box>
  );
};

export default ToolBubble;
