# opencode-context-sidebar

[English](README.md) | [简体中文](README.zh-CN.md)

Provider-agnostic Context Usage sidebar for OpenCode v2, with optional transparency and MCP status styling. The existing OpenCode v1 adapter remains available in maintenance mode.

<p align="center">
  <img src="images/opencode-context-sidebar.png" alt="Context Usage sidebar preview" width="600">
</p>

## Features

- Most recent assistant message with a positive normalized token total, respecting OpenCode v2 compaction and revert boundaries
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

Supported baselines are OpenCode v2.0.16 or newer, and OpenCode v1.18.0 or newer in maintenance mode.

### OpenCode v2

OpenCode v2 is the primary target. Add the plugin to the global CLI config—`$XDG_CONFIG_HOME/opencode/cli.json` when `XDG_CONFIG_HOME` is set, otherwise `~/.config/opencode/cli.json`—and disable the built-in Context sidebar:

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

The existing v1 adapter and installation path remain available for compatibility, but v1 support is maintenance-only and will not receive new features. Install the package with OpenCode v1, then disable the built-in Context panel in `$XDG_CONFIG_HOME/opencode/tui.json` when `XDG_CONFIG_HOME` is set, `~/.config/opencode/tui.json` otherwise, or the project-local `.opencode/tui.json`:

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
| `transparent` | `false` | Clears selected active-theme background colors outside modal dialogs and follows theme and light/dark mode changes |
| `mcp` | `false` | Adds the custom MCP status sidebar; disable the built-in MCP sidebar to avoid duplicates |

Enable either option with the object form in the same global CLI config. This example enables both:

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

Click the `Context` title to collapse or expand its details. The collapsed title shows the computed context-window percentage. It displays `0.0%` when no eligible token usage exists or when the selected message has no valid positive context limit. Colors are green below 80%, yellow from 80% to below 90%, and red at 90% or above.

On OpenCode v2, the plugin selects the latest token-bearing assistant message after the most recent completed compaction and respects the active revert boundary.

### MCP behavior

The optional MCP sidebar changes only sidebar presentation. The `Connected` label uses the same theme success color as its status dot. When there are more than two servers, clicking the `MCP` title collapses or expands the server list; the collapsed title summarizes connected servers and issues. The issue count combines failed servers and servers that require authentication.

Clicking a server dispatches OpenCode's native `mcp.list` command. When the native selection commands are available, the plugin moves the dialog selection to the clicked server; otherwise the dialog keeps its native default selection. Connect, disconnect, retry, authentication, error details, the native Space-key action, and live status updates remain managed by OpenCode.

### Transparent mode

Use transparent mode with the original theme (for example, `one-dark` rather than a transparent theme copy). Outside modal dialogs, the plugin clears cells matching selected base and raised background colors, which typically makes the main view, sidebar, prompt, and tool surfaces transparent while leaving foreground colors unchanged. It also removes long runs matching the prompt-shadow color and follows theme and light/dark mode changes automatically. While a modal dialog is open, the interface temporarily uses the theme's original opaque backgrounds; transparency resumes automatically after it closes.

## How It Works

The plugin uses data already normalized by OpenCode; it does not call provider APIs directly.

```text
Provider response
  -> OpenCode normalizes token usage
  -> Plugin selects the most recent eligible assistant message
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
Cache hit rate = Cache hit / Input * 100% (or 0% when Input is zero)
Context usage = Total / model context limit * 100%
```

The cache distribution bar partitions `Input` into cache-hit, cache-write, and cache-miss proportions. The context limit is looked up from the provider and model recorded on the selected assistant message, not from the model currently selected in the prompt. The displayed cost is OpenCode's cumulative `session.cost`, so provider-specific token pricing remains OpenCode's responsibility. Missing or invalid values are displayed as zero instead of `NaN`. Because the values are derived from the current session state, the sidebar updates as new assistant messages arrive.

## Development from a source checkout

Clone the repository, then install dependencies and build. The published npm package contains generated `dist` files, not the source tree or build scripts.

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

For compatibility testing with OpenCode v1, build the project first, then point `tui.json` to the repository root:

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
