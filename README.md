# opencode-tui-extras

[English](README.md) | [简体中文](README.zh-CN.md)

OpenCode v2 TUI enhancements: Context, Skills, and MCP sidebars, a transparent interface, Powerline-style prompt and sidebar status bars, and an Open in VS Code workflow action.

<p align="center">
  <img src="images/opencode-tui-extras.png" alt="OpenCode TUI Extras sidebar preview" width="600">
</p>

## Features

- Context, Skills, and MCP sidebars integrated with the OpenCode v2 TUI
- Optional transparent interface that follows the active theme and light/dark mode
- Optional theme-aware Powerline-style status bars for the prompt and sidebar
- Optional `Open in VS Code` action in the working-directory menu
- Most recent assistant message with a positive normalized token total, respecting compaction and revert boundaries
- Input, cache hit, cache miss, and cache write breakdown
- Output, thinking, and response breakdown
- Cache hit rate and colored distribution bar
- Context-window usage with green, yellow, and red thresholds
- Session cumulative cost, matching OpenCode's built-in Context behavior
- Collapsible Context details with the current percentage in the collapsed title
- Dynamic separators that follow the available sidebar width
- Green `Connected` MCP status with native MCP management dialogs
- Searchable Skills manager with persistent per-project enable/disable state

The plugin works with any provider that reports standard OpenCode token usage fields.

## Install

OpenCode v2.0.26 or newer is required.

### CLI/TUI (`cli.json`)

Add the TUI plugin to the global CLI config at `$XDG_CONFIG_HOME/opencode/cli.json` when `XDG_CONFIG_HOME` is set, or `~/.config/opencode/cli.json` otherwise:

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    "-opencode.sidebar.mcp",
    {
      "package": "opencode-tui-extras",
      "options": {
        "context": true,
        "sidebarScrollbar": false,
        "transparent": true,
        "mcp": true,
        "skills": true,
        "powerline": true,
        "vscode": true
      }
    }
  ]
}
```

The two entries prefixed with `-` disable OpenCode's built-in Context and MCP sidebars because this example enables their replacements. Omit `-opencode.sidebar.context` when `context` is `false`, and omit `-opencode.sidebar.mcp` when `mcp` is `false`.

`context` and `sidebarScrollbar` are independent CLI/TUI options. Setting both to `false` omits the custom Context section and still hides the right Sidebar scrollbar.

### Skills server (`opencode.json(c)`)

When `skills` is enabled in `cli.json`, also load the server plugin with `skills: true`. Add it to the global `~/.config/opencode/opencode.json(c)` or a project-level `opencode.json(c)`:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-tui-extras",
      "options": {
        "skills": true
      }
    }
  ]
}
```

The Server filters the Skill catalog, exposes the management RPC, and stores disabled Skill IDs per project. The CLI/TUI renders the Sidebar and Dialog. When connecting to a remote Server, configure this Server plugin remotely and keep the CLI/TUI plugin in the local `cli.json`.

Restart OpenCode after changing either configuration file.

## Options

The Context section and Sidebar scrollbar are shown by default. Optional enhancements are disabled by default.

| Option | Default | Behavior |
| --- | --- | --- |
| `context` | `true` | Shows the Context usage section; set to `false` to omit it |
| `sidebarScrollbar` | `true` | Shows the right Sidebar's vertical scrollbar; set to `false` to hide it while preserving mouse, trackpad, and keyboard scrolling |
| `transparent` | `false` | Clears selected active-theme backgrounds, keeps modal surroundings transparently dimmed, and follows theme and light/dark mode changes |
| `mcp` | `false` | Adds the custom MCP status sidebar; disable the built-in MCP sidebar to avoid duplicates |
| `skills` | `false` | Adds a compact Skills sidebar and `/skills-settings` manager; the server plugin stores per-project disabled IDs |
| `powerline` | `false` | Applies theme-aware Powerline colors and separators to the prompt and sidebar status bars |
| `vscode` | `false` | Adds `Open in VS Code` to the menu shown when the prompt or sidebar path is clicked |

### Context interaction

Click the `Context` title to collapse or expand its details. The collapsed title shows the computed context-window percentage. It displays `0.0%` when no eligible token usage exists or when the selected message has no valid positive context limit. Colors are green below 80%, yellow from 80% to below 90%, and red at 90% or above.

The plugin selects the latest token-bearing assistant message after the most recent completed compaction and respects the active revert boundary.

### MCP behavior

The optional MCP sidebar changes only sidebar presentation. The `Connected` label uses the same theme success color as its status dot. When there are more than two servers, clicking the `MCP` title collapses or expands the server list; the collapsed title summarizes connected servers and issues. The issue count combines failed servers and servers that require authentication.

Clicking a server dispatches OpenCode's native `mcp.list` command. When the native selection commands are available, the plugin moves the dialog selection to the clicked server; otherwise the dialog keeps its native default selection. Connect, disconnect, retry, authentication, error details, the native Space-key action, and live status updates remain managed by OpenCode.

### Skills management

The optional Skills sidebar follows the native MCP sidebar behavior: it shows every Skill while expanded and a status summary while collapsed. Click a row or run `/skills-settings` to open the searchable manager; selecting an entry toggles it between enabled and disabled. `Manual` means the Skill has `autoinvoke: false`: it remains available for explicit use but is not advertised to the model automatically.

Disabled Skill IDs are stored by the server plugin per OpenCode project and survive Server and TUI restarts. The plugin filters them from OpenCode's Skill registry without modifying or moving the original `SKILL.md`, so enabling an entry restores the underlying Skill. The TUI refreshes OpenCode's native Skill cache after a change, so `/skills` and `@skill` completion update immediately in running clients.

OpenCode exposes Skills in two stages. Before activation, the model sees only the `id`, `name`, and `description` of enabled automatically invokable Skills; enabled `Manual` Skills remain available through `/skills` and `@skill`. Enabling a Skill during a session makes it available on the next model request but does not inject its instructions by itself. When the model invokes the Skill tool or the user explicitly attaches a Skill, OpenCode expands the Markdown body of `SKILL.md` into a `<skill_content>` block and stores that text in the session. Files elsewhere in the Skill directory are not uploaded automatically; OpenCode includes a sampled file-path list for later reads.

The switch controls future loads, not history that has already been materialized:

| Situation | Behavior |
| --- | --- |
| Disable before the Skill is loaded in the current session | Takes effect immediately; later requests cannot automatically or explicitly load it |
| Disable after the Skill is loaded | Blocks future loads, but the previously injected text remains in that session's history |
| Disconnect and reopen the same session | Restores the same persisted history, including previously injected Skill text |
| Start a new session while the Skill is disabled | Starts without that Skill and cannot load it |
| Enable during an existing session | Makes it discoverable on the next request; the full body is injected only if the Skill is subsequently invoked |

Changing the setting cannot alter a model request that is already in flight. Context compaction is also not a guaranteed unload mechanism: Skill text may remain verbatim in the recent window or be carried into the generated summary. The current OpenCode API has no session-level Skill unload operation, so starting a new session is the reliable way to guarantee that previously loaded Skill text is absent.

### Transparent mode

Use transparent mode with the original theme (for example, `one-dark` rather than a transparent theme copy). The plugin clears selected base and raised background colors, which typically makes the main view, sidebar, prompt, and tool surfaces transparent. Foreground colors are preserved when they remain readable against the terminal's detected background; low-contrast text is adjusted toward the terminal's foreground color. It also removes long runs matching the prompt-shadow color and follows theme and light/dark mode changes automatically. While a modal dialog is open, only the dialog panel keeps its opaque theme surface; the surrounding interface remains transparent and is dimmed in the same render pass. Underlying images and safely identifiable native borders or prompt shadows are temporarily hidden, while tagged OpenTUI graphemes such as CJK text and emoji are always preserved.

### Powerline mode

Powerline mode keeps OpenCode's existing status-bar content, layout, responsive behavior, and click actions. It only applies theme-derived foreground and background colors plus Powerline separators to the prompt and sidebar status bars. Path, activity, context, cost, and command segments update with theme or light/dark mode changes. Context keeps the same green, yellow, and red thresholds as the Context panel.

If `` or `` renders incorrectly, configure the terminal to use a Powerline-compatible font or a Nerd Font. Powerline styling pauses while a modal dialog is open so dialogs remain visually isolated.

### VS Code action

When `vscode` is enabled, clicking the working-directory path opens an enhanced version of the native menu with an additional `Open in VS Code` entry. It launches `code --reuse-window <directory>`. The `code` command must be available in the environment where the OpenCode TUI runs. Copy path, system file manager, and Workspaces actions remain available.

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

For local TUI-only loading, build the project first, then point `~/.config/opencode/cli.json` to the generated `dist` directory. Add `-opencode.sidebar.mcp` only when the `mcp` option is enabled:

```json
{
  "plugins": [
    "-opencode.sidebar.context",
    {
      "package": "file:///absolute/path/to/opencode-tui-extras/dist",
      "options": {
        "context": true,
        "sidebarScrollbar": false,
        "transparent": true,
        "mcp": false,
        "powerline": true,
        "vscode": true
      }
    }
  ]
}
```

To test Skills management from a source checkout, keep the generated `dist` directory in `cli.json` as shown above and also load it as a server plugin:

```jsonc
{
  "plugins": [
    {
      "package": "file:///absolute/path/to/opencode-tui-extras/dist",
      "options": { "skills": true }
    }
  ]
}
```

## License

MIT
