# zcp-web

Web 工具 ZCP 服务。提供两种网页搜索引擎（Exa AI + Brave Search）和 URL 内容抓取（HTML→Markdown 转换）。

## 提供的工具

| 工具 | 功能 | 优先级 | 说明 |
|------|------|--------|------|
| `exa-web-search` | Exa AI 网页搜索 | 20 | MCP 端点，无需 API Key，有速率限制 |
| `brave-web-search` | Brave 网页搜索 | 10 | 需要 API Key，结果带 extra_snippets |
| `web-fetch` | 抓取 URL 内容 | 20 | HTML→Markdown/Text 转换 |

## 工具详情

### exa-web-search

通过 Exa AI MCP 端点进行实时网页搜索。无需 API Key 即可使用（公开端点有速率限制），设置 `EXA_API_KEY` 环境变量可获取更高配额。

参数：
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `query` | string | 是 | — | 搜索查询 |
| `numResults` | number | 否 | 8 | 返回结果数量 |
| `livecrawl` | "fallback"/"preferred" | 否 | "fallback" | 实时抓取模式 |
| `type` | "auto"/"fast"/"deep" | 否 | "auto" | 搜索类型 |
| `contextMaxCharacters` | number | 否 | 10000 | LLM 上下文最大字符数 |

### brave-web-search

通过 Brave Search API 搜索，返回格式化的标题、URL、描述和额外片段。需要 `BRAVE_API_KEY`。

参数：
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `query` | string | 是 | — | 搜索查询 |
| `count` | number | 否 | 10 | 返回结果数量（最大 20） |
| `offset` | number | 否 | 0 | 分页偏移 |
| `country` | string | 否 | — | 国家代码（如 'us', 'cn'） |
| `search_lang` | string | 否 | — | 搜索语言（如 'en', 'zh'） |
| `freshness` | "pd"/"pw"/"pm"/"py" | 否 | — | 时效过滤：pd=24h, pw=周, pm=月, py=年 |

### web-fetch

抓取 URL 内容并转换为指定格式。支持 Cloudflare 403 重试和图片 base64 返回。

参数：
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `url` | string | 是 | — | 目标 URL（http/https） |
| `format` | "text"/"markdown"/"html" | 否 | "markdown" | 输出格式 |
| `timeout` | number | 否 | 30 | 超时秒数（最大 120） |

## 技术栈

| 属性 | 值 |
|------|-----|
| 运行时 | Bun |
| RPC | ConnectRPC v2 |
| ZCP SDK | @openzerg/zcp |
| 错误处理 | neverthrow Result monad |
| Schema 验证 | Zod v4 |
| HTML 转换 | turndown（HTML→Markdown） |
| 搜索引擎 | Exa AI MCP + Brave Search API |

## 环境变量

```bash
ZCP_WEB_PORT=15344
PORT=25030                       # 监听端口
REGISTRY_URL=http://localhost:15319  # Registry 注册中心
REGISTRY_TOKEN=<管理员 Token>         # Registry 鉴权
EXA_API_KEY=                     # 可选，Exa API Key
EXA_BASE_URL=https://mcp.exa.ai # 可选，Exa MCP 端点地址
BRAVE_API_KEY=                   # brave-web-search 必需
BRAVE_BASE_URL=https://api.search.brave.com  # 可选，Brave API 地址
```

## 开发

```bash
bun install && bun run typecheck && bun run dev
```
