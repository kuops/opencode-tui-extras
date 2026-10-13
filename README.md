# opencode-context-sidebar

[English](README.md) | [简体中文](README.zh-CN.md)

Provider-agnostic Context Usage sidebar for OpenCode v2, with optional transparency and MCP status styling. The existing OpenCode v1 adapter remains available in maintenance mode.

<p align="center">
  <img src="images/opencode-context-sidebar.png" alt="Context Usage sidebar preview" width="600">
</p>

## Features

- Latest assistant call token totals
- Input, cache hit, cache miss, and cache write breakdown
- Output, thinking, and response breakdown
- Cache hit rate and colored distribution bar
- Context-window usage with green, yellow, and red thresholds
- Session cumulative cost, matching OpenCode's built-in Context behavior
- Collapsible Context details with the current percentage in the collapsed title
- Dynamic separators that follow the available sidebar width
- Built for OpenCode v2, with maintenance-only OpenCode v1 compatibility
- Optional transparent mode that follows the active theme and light/dark mode
- Optional MCP sidebar with a green `Connected` label and native MCP management dialogs

The plugin works with any provider that reports standard OpenCode token usage fields.

## Install

### OpenCode v2

OpenCode v2 is the primary target. Add the plugin to the global `~/.config/opencode/cli.json` and disable the built-in Context sidebar:

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    "opencode-context-sidebar"
  ]
}
```

Restart OpenCode after changing the configuration.

### OpenCode v1 compatibility

The existing v1 adapter and installation path remain available for compatibility, but v1 support is maintenance-only and will not receive new features. Install the package with OpenCode v1, then disable the built-in Context panel in `~/.config/opencode/tui.json` or `.opencode/tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-context-sidebar"],
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

Restart OpenCode after changing the configuration. The package exposes both adapters so existing v1 installations can continue using the same package.

## OpenCode v2 options

Both options are disabled by default. They are available only on OpenCode v2 and will not be added to the maintenance-only v1 adapter.

| Option | Default | Behavior |
| --- | --- | --- |
| `transparent` | `false` | Makes the active theme transparent while following theme and light/dark mode changes |
| `mcp` | `false` | Adds the custom MCP status sidebar; disable the built-in MCP sidebar to avoid duplicates |

Enable either option with the object form in `~/.config/opencode/cli.json`. This example enables both:

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

### Context interaction

Click the `Context` title to collapse or expand its details. The collapsed title shows the current context-window percentage, including `0.0%` when no usage is available. The usage color follows the same thresholds as the expanded panel: green below 80%, yellow from 80% through 89%, and red at 90% or above.

On OpenCode v2, the plugin selects the latest token-bearing assistant message after the most recent completed compaction and respects the active revert boundary.

### MCP behavior

The optional MCP sidebar changes only sidebar presentation. The `Connected` label uses the same theme success color as its status dot. When there are more than two servers, clicking the `MCP` title collapses or expands the server list; the collapsed title summarizes active servers and errors.

Clicking a server opens OpenCode's native `mcp.list` dialog and focuses the clicked server. Connect, disconnect, reconnect, authentication, and error details—including Space-key behavior and live status updates—remain fully managed by OpenCode.

### Transparent mode

Use transparent mode with the original theme (for example, `one-dark` rather than a transparent theme copy). It makes the main, sidebar, prompt, and tool backgrounds transparent while preserving the active theme's text and accent labels. It also removes the prompt's opaque shadow and follows theme and light/dark mode changes automatically. While a menu or modal dialog is open, the interface temporarily returns to the theme's original opaque backgrounds; transparency resumes automatically after it closes.

## How It Works

The plugin uses data already normalized by OpenCode; it does not call provider APIs directly.

```text
Provider response
  -> OpenCode normalizes token usage
  -> Plugin reads the latest assistant message
  -> Sidebar calculates and renders the breakdown
```

| Display | OpenCode field | Meaning |
| --- | --- | --- |
| Cache miss | `tokens.input` | Regular input not read from or written to cache |
| Cache hit | `tokens.cache.read` | Input reused from cache |
| Cache write | `tokens.cache.write` | Input written to cache for later requests |
| Response | `tokens.output` | Generated output excluding reasoning |
| Thinking | `tokens.reasoning` | Reasoning tokens reported by the model |

The displayed totals are calculated as follows:

```text
Input         = Cache miss + Cache hit + Cache write
Output        = Response + Thinking
Total         = Input + Output
Context usage = Total / model context limit * 100%
```

The context limit comes from the active model metadata. The displayed cost is OpenCode's cumulative `session.cost`, so provider-specific token pricing remains OpenCode's responsibility. Missing or invalid values are displayed as zero instead of `NaN`. Because the values are derived from the current session state, the sidebar updates as new assistant messages arrive.

## Development

```bash
npm install
npm run build
```

For local loading with OpenCode v2, build the project first, then point `~/.config/opencode/cli.json` to the generated `dist` directory. Add `-opencode.sidebar.mcp` only when the `mcp` option is enabled:

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

For compatibility testing with OpenCode v1:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["file:///absolute/path/to/opencode-context-sidebar"],
  "plugin_enabled": {
    "internal:sidebar-context": false
  }
}
```

## License

MIT
