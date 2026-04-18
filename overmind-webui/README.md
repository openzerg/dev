# overmind-webui

管理控制台 Web 界面（SolidJS）。提供 Session 管理、消息查看、角色配置、Worker 状态等功能。

## 状态

**骨架包** —— 仅包含 `package.json` + `tsconfig.json` + `vite.config.ts`，无页面实现。

## 规划功能

- Session 列表 + 详情（消息流、token 使用量）
- Role 管理（CRUD、system prompt 编辑）
- Worker 管理（状态、生命周期）
- AI Proxy 配置（ProviderModelConfig + Proxy CRUD）
- 实时 SSE 事件流（Agent 推理、工具调用）

## 技术栈（计划）

| 属性 | 值 |
|------|-----|
| 框架 | SolidJS + Solid Router |
| UI 库 | SUID (Material UI for Solid) |
| 构建 | Vite |
| RPC | ConnectRPC v2（@connectrpc/connect-web） |
| Proto | common-spec（@bufbuild/protobuf v2） |
| 测试 | Vitest + Playwright |

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
