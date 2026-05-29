# MCP Builder

引導建立 Claude Code MCP Server 配置，輸出 `mcp_config.json` 和相關模板。

## 用法

```
/mcp-builder [server 描述]
```

範例：
- `/mcp-builder` — 進入互動式建構流程
- `/mcp-builder 建立一個查詢 3Q D1 資料庫的 MCP server` — 快速建構指定 server

## 互動流程

當用戶執行此 command，依序詢問：

1. **Server 名稱**（英文，kebab-case，例：`3q-crm-server`）
2. **描述**（一句話說明用途）
3. **工具列表**：每個工具的 name + description（重複詢問直到用戶說「完成」）
4. **執行環境**：`stdio`（本地）或 `http`（遠端 Worker）

## 輸出格式

### `~/.claude/mcp_servers.json` 片段（stdio）
```json
{
  "mcpServers": {
    "[server-name]": {
      "command": "node",
      "args": ["./mcp-servers/[server-name]/index.js"],
      "env": {}
    }
  }
}
```

### Cloudflare Worker 版本（http）
```json
{
  "mcpServers": {
    "[server-name]": {
      "type": "http",
      "url": "https://[server-name].[subdomain].workers.dev/mcp"
    }
  }
}
```

### Tool 定義模板（輸出到 console）
```js
server.tool("[tool-name]", "[description]", {
  // zod schema
}, async (args) => {
  // implementation
});
```

## 注意事項

- 生成的配置要立即可用，不含佔位符（除非必要）
- Worker MCP server 使用 `@cloudflare/workers-mcp` 套件
- 本地 stdio server 使用 `@modelcontextprotocol/sdk`

## 對應頁面

`mcp-builder.html` — 視覺化填表介面，產生相同輸出
