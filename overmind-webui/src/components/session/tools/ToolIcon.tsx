import { type Component } from 'solid-js';
import CreateNewFolderOutlined from '@suid/icons-material/CreateNewFolderOutlined';
import EditOutlined from '@suid/icons-material/EditOutlined';
import VisibilityOutlined from '@suid/icons-material/VisibilityOutlined';
import SearchOutlined from '@suid/icons-material/SearchOutlined';
import FolderOutlined from '@suid/icons-material/FolderOutlined';
import TerminalOutlined from '@suid/icons-material/TerminalOutlined';
import CheckBoxOutlined from '@suid/icons-material/CheckBoxOutlined';
import RocketLaunchOutlined from '@suid/icons-material/RocketLaunchOutlined';
import DynamicFeedOutlined from '@suid/icons-material/DynamicFeedOutlined';
import SendOutlined from '@suid/icons-material/SendOutlined';
import StorageOutlined from '@suid/icons-material/StorageOutlined';
import BuildIcon from '@suid/icons-material/Build';
import ContentCutOutlined from '@suid/icons-material/ContentCutOutlined';
import ChatOutlined from '@suid/icons-material/ChatOutlined';
import ExtensionOutlined from '@suid/icons-material/ExtensionOutlined';

const toolIconMap: Record<string, any> = {
  write: CreateNewFolderOutlined,
  edit: EditOutlined,
  'multi-edit': EditOutlined,
  'apply-patch': ContentCutOutlined,
  read: VisibilityOutlined,
  grep: SearchOutlined,
  glob: FolderOutlined,
  ls: FolderOutlined,
  'job-run': TerminalOutlined,
  'job-list': TerminalOutlined,
  'job-kill': TerminalOutlined,
  'job-output': TerminalOutlined,
  'todo-write': CheckBoxOutlined,
  'todo-read': CheckBoxOutlined,
  task: RocketLaunchOutlined,
  batch: DynamicFeedOutlined,
  message: SendOutlined,
  'memory-read': StorageOutlined,
  'memory-write': StorageOutlined,
  'memory-list': StorageOutlined,
  'chatroom-info': ChatOutlined,
  'chatroom-message-read': ChatOutlined,
  'chatroom-message-send': SendOutlined,
  'external-tool': ExtensionOutlined,
};

interface ToolIconProps {
  toolName: string;
  sx?: any;
}

const ToolIcon: Component<ToolIconProps> = (props) => {
  const Icon = toolIconMap[props.toolName] || BuildIcon;
  return <Icon sx={props.sx || { fontSize: 14, color: 'text.secondary' }} />;
};

export default ToolIcon;
export { toolIconMap };
