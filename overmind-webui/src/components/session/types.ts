export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
}

export interface DisplayMessage {
  messageId: string;
  role: string;
  content: string;
  sessionId?: string;
  toolName: string;
  toolCallId: string;
  toolSuccess: boolean;
  toolStatus?: 'running' | 'completed' | 'error';
  createdAt: bigint | string | number;
  tokenUsage?: number;
  metadata?: Record<string, unknown>;
  parentMessageId?: string;
  toolCalls?: ToolCallInfo[];
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority?: string;
}

export interface ProcessInfo {
  processId: string;
  command: string;
  status: string;
}

export interface ProviderInfo {
  name: string;
  model: string;
  isActive: boolean;
}
