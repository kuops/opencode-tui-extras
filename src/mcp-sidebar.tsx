/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/plugin";
import { createMemo, For, Show } from "solid-js";

type McpServer = NonNullable<ReturnType<Context["data"]["location"]["mcp"]["server"]["list"]>>[number];
type McpStatus = McpServer["status"]["status"];

export function mcpStatusLabel(status: McpStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "pending":
      return "Connecting";
    case "failed":
      return "Error";
    case "needs_auth":
      return "Sign in";
    default:
      return "Disabled";
  }
}

export function mcpStatusColor(context: Context, status: McpStatus, label = false) {
  if (status === "connected") return context.theme.text.feedback.success.base;
  if (status === "failed") return context.theme.text.feedback.error.base;
  if (status === "needs_auth" && !label) return context.theme.text.feedback.warning.base;
  return context.theme.text.muted;
}

export function mcpSelectionCommands(serverNames: readonly string[], selected: string): string[] {
  const index = [...serverNames].sort().indexOf(selected);
  if (index < 0) return [];
  return ["dialog.select.home", ...Array.from({ length: index }, () => "dialog.select.next")];
}

export function McpSidebar(props: { context: Context; sessionID: string }) {
  const [view, updateView] = props.context.storage.store("mcp-sidebar", { initial: { open: true } });
  const session = createMemo(() => props.context.data.session.get(props.sessionID));
  const location = () => session()?.location ?? props.context.location ?? props.context.data.location.default();
  const list = createMemo(() => props.context.data.location.mcp.server.list(location()) ?? []);
  const connected = createMemo(() => list().filter((server) => server.status.status === "connected").length);
  const errors = createMemo(
    () => list().filter((server) => server.status.status === "failed" || server.status.status === "needs_auth").length,
  );
  const openDialog = (serverName: string) => {
    const commands = mcpSelectionCommands(list().map((server) => server.name), serverName);
    let focused = false;
    const focusServer = () => {
      if (focused || commands.length === 0) return;
      const available = new Set(props.context.keymap.commands().map((command) => command.id));
      if (!commands.every((command) => available.has(command))) return;
      focused = true;
      for (const command of commands) props.context.keymap.dispatch(command);
    };

    props.context.renderer.once("frame", focusServer);
    props.context.keymap.dispatch("mcp.list", serverName);
    queueMicrotask(focusServer);
  };

  return (
    <Show when={list().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            if (list().length <= 2) return;
            void updateView((draft) => {
              draft.open = !draft.open;
            }).catch((error) => console.error("Failed to persist MCP sidebar state", error));
          }}
        >
          <Show when={list().length > 2}>
            <text fg={props.context.theme.text.base}>{view.open ? "▼" : "▶"}</text>
          </Show>
          <text fg={props.context.theme.text.base}>
            <b>MCP</b>
            <Show when={!view.open}>
              <span style={{ fg: props.context.theme.text.muted }}>{` (${connected()} active${errors() ? `, ${errors()} error${errors() > 1 ? "s" : ""}` : ""})`}</span>
            </Show>
          </text>
        </box>
        <Show when={list().length <= 2 || view.open}>
          <For each={list()}>
            {(server) => (
              <box flexDirection="row" gap={1} minWidth={0} onMouseUp={() => openDialog(server.name)}>
                <text flexShrink={0} fg={mcpStatusColor(props.context, server.status.status)}>•</text>
                <text fg={props.context.theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
                  <b>{server.name}</b>
                </text>
                <text fg={mcpStatusColor(props.context, server.status.status, true)} wrapMode="none" flexShrink={0}>
                  {mcpStatusLabel(server.status.status)}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  );
}
