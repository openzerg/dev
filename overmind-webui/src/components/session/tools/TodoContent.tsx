import { type Component, For, Show } from 'solid-js';
import { Box, Typography, Chip } from '@suid/material';
import CheckCircleOutlined from '@suid/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedOutlined from '@suid/icons-material/RadioButtonUncheckedOutlined';
import PendingOutlined from '@suid/icons-material/PendingOutlined';

interface TodoContentProps {
  content: string;
  maxHeight?: number;
}

interface TodoItem {
  id?: string;
  content: string;
  status?: string;
  priority?: string;
}

const TodoContent: Component<TodoContentProps> = (props) => {
  const todos = (): TodoItem[] => {
    try {
      const data = JSON.parse(props.content);
      const list = data.todos || data.items || data.tasks || [];
      if (Array.isArray(list)) return list;
      return [];
    } catch {
      return props.content.split('\n').filter(Boolean).map(line => ({ content: line }));
    }
  };

  const count = () => todos().length;
  const completed = () => todos().filter(t => t.status === 'completed').length;
  const inProgress = () => todos().filter(t => t.status === 'in_progress').length;
  const pending = () => todos().filter(t => t.status === 'pending').length;

  const getStatusIcon = (status?: string) => {
    if (status === 'completed') return <CheckCircleOutlined sx={{ fontSize: 14, color: '#34d399' }} />;
    if (status === 'in_progress') return <PendingOutlined sx={{ fontSize: 14, color: '#fbbf24' }} />;
    return <RadioButtonUncheckedOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />;
  };

  const getPriorityColor = (priority?: string) => {
    if (priority === 'high') return '#f87171';
    if (priority === 'medium') return '#fbbf24';
    return '#34d399';
  };

  return (
    <Box sx={{ maxHeight: props.maxHeight || 400, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#34d399' }}>
          {completed()} done
        </Typography>
        <Typography variant="caption" sx={{ color: '#fbbf24' }}>
          {inProgress()} in progress
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {pending()} pending
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <For each={todos()}>
          {(todo) => (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              p: 0.5,
              bgcolor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            }}>
              {getStatusIcon(todo.status)}
              <Typography variant="caption" sx={{
                flex: 1,
                fontSize: '0.7rem',
                color: todo.status === 'completed' ? 'text.secondary' : 'text.primary',
                textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
              }}>
                {todo.content}
              </Typography>
              <Show when={todo.priority}>
                <Chip
                  size="small"
                  label={todo.priority}
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    bgcolor: getPriorityColor(todo.priority),
                    color: 'white',
                  }}
                />
              </Show>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
};

export default TodoContent;
