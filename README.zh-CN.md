# opencode-context-sidebar

[English](README.md) | [简体中文](README.zh-CN.md)

面向 OpenCode v2、不依赖特定提供商的上下文用量侧边栏，并提供可选的透明模式和 MCP 状态样式。现有 OpenCode v1 适配器仅作为维护模式兼容层保留。

<p align="center">
  <img src="images/opencode-context-sidebar.png" alt="上下文用量侧边栏预览" width="600">
</p>

## 功能

- 显示最近一次助手调用的 token 总量
- 分别显示输入、缓存命中、缓存未命中和缓存写入用量
- 分别显示输出、思考和响应内容用量
- 显示缓存命中率和彩色分布条
- 使用绿色、黄色和红色阈值显示上下文窗口用量
- 显示会话累计费用，与 OpenCode 内置 Context 面板的行为一致
- Context 明细可折叠，折叠标题显示当前使用百分比
- 分隔线宽度随侧边栏可用宽度动态调整
- 以 OpenCode v2 为主要目标，同时保留维护模式的 OpenCode v1 兼容
- 可选透明模式，自动跟随当前主题及浅色/深色模式
- 可选 MCP Sidebar：`Connected` 显示为绿色，管理弹窗仍使用 OpenCode 原版

只要提供商通过 OpenCode 标准字段报告 token 用量，此插件即可正常工作。

## 安装

### OpenCode v2

OpenCode v2 是主要支持目标。在全局 `~/.config/opencode/cli.json` 中添加插件，并禁用内置 Context 侧边栏：

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    "opencode-context-sidebar"
  ]
}
```

修改配置后重启 OpenCode。

### OpenCode v1 兼容

现有 v1 适配器和安装方式继续保留，但 v1 仅提供维护性兼容，不再开发新功能。使用 OpenCode v1 安装此包后，在 `~/.config/opencode/tui.json` 或 `.opencode/tui.json` 中禁用内置 Context 面板：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-context-sidebar"],
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

修改配置后重启 OpenCode。此包仍同时导出两个适配器，已有 v1 安装可以继续使用。

## OpenCode v2 选项

以下选项默认均为关闭，仅适用于 OpenCode v2；维护模式的 v1 适配器不会加入这些功能。

| 选项 | 默认值 | 行为 |
| --- | --- | --- |
| `transparent` | `false` | 将当前主题背景透明化，并跟随主题及浅色/深色模式切换 |
| `mcp` | `false` | 添加自定义 MCP 状态侧边栏；需要禁用内置 MCP Sidebar 以免重复 |

在 `~/.config/opencode/cli.json` 中使用对象形式启用选项。以下示例同时启用两项：

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    "-opencode.sidebar.mcp",
    {
      "package": "opencode-context-sidebar",
      "options": {
        "transparent": true,
        "mcp": true
      }
    }
  ]
}
```

### Context 交互

点击 `Context` 标题可折叠或展开明细。折叠标题会显示当前上下文窗口使用百分比；没有用量时显示 `0.0%`。百分比颜色与展开面板使用相同阈值：低于 80% 为绿色，80% 至 89% 为黄色，90% 及以上为红色。

在 OpenCode v2 中，插件会选择最近一次已完成压缩之后、包含 Token 用量的最新助手消息，并遵循当前 revert 边界。

### MCP 行为

可选的 MCP Sidebar 只修改侧边栏呈现：`Connected` 文本使用与状态小点相同的主题 success 颜色。服务器超过两个时，点击 `MCP` 标题可折叠或展开列表；折叠标题会汇总 active 和 error 数量。

点击服务器会打开 OpenCode 原生 `mcp.list` 对话框，并定位到被点击的服务器。连接、断开、重连、认证和错误详情——包括 Space 键操作和实时状态更新——均继续由 OpenCode 原版管理。

### 透明模式

透明模式应搭配原始主题使用（例如使用 `one-dark`，而不是透明主题副本）。启用后，插件会将主界面、Sidebar、输入框和工具区域背景透明化，同时保留当前主题的文字和 Accent 标签，并移除输入框的不透明阴影。主题或浅色/深色模式切换后会自动同步。打开菜单或模态弹窗时，界面会暂时恢复主题原本的不透明背景；关闭后自动恢复透明效果。

## 工作原理

插件使用 OpenCode 已经标准化的数据，不会直接调用各模型提供商的 API。

```text
模型提供商响应
  -> OpenCode 标准化 Token 用量
  -> 插件读取最近一条助手消息
  -> 侧边栏计算并显示用量明细
```

| 界面项目 | OpenCode 字段 | 含义 |
| --- | --- | --- |
| Cache miss | `tokens.input` | 未读取缓存、也未写入缓存的普通输入 |
| Cache hit | `tokens.cache.read` | 从缓存复用的输入 |
| Cache write | `tokens.cache.write` | 写入缓存、供后续请求使用的输入 |
| Response | `tokens.output` | 不含思考过程的模型输出 |
| Thinking | `tokens.reasoning` | 模型报告的思考 Token |

界面中的统计值按以下方式计算：

```text
Input         = Cache miss + Cache hit + Cache write
Output        = Response + Thinking
Total         = Input + Output
Context usage = Total / 模型上下文上限 * 100%
```

上下文上限来自当前模型的元数据。费用直接使用 OpenCode 累计的 `session.cost`，不同提供商的 Token 价格仍由 OpenCode 处理。缺失或无效的数据会显示为零，不会出现 `NaN`。由于数据来自当前会话状态，每次产生新的助手消息后，侧边栏都会随之更新。

## 开发

```bash
npm install
npm run build
```

使用 OpenCode v2 本地加载时，先构建项目，再在 `~/.config/opencode/cli.json` 中指向生成的 `dist` 目录。仅在启用 `mcp` 选项时添加 `-opencode.sidebar.mcp`：

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    {
      "package": "file:///absolute/path/to/opencode-context-sidebar/dist",
      "options": {
        "transparent": true,
        "mcp": false
      }
    }
  ]
}
```

如需测试 OpenCode v1 兼容性：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["file:///absolute/path/to/opencode-context-sidebar"],
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

## 许可证

MIT
