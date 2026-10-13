/** @jsxImportSource @opentui/solid */
import type { RGBA } from "@opentui/core";
import { createMemo, createSignal, Show } from "solid-js";
import { BAR_WIDTH, calculateUsage, type TokenUsage } from "./usage.js";

const INTEGER_FORMAT = new Intl.NumberFormat("en-US");

export interface ThemePalette {
  text: RGBA;
  textMuted: RGBA;
  info: RGBA;
  success: RGBA;
  error: RGBA;
  warning: RGBA;
  secondary: RGBA;
  accent: RGBA;
  border: RGBA;
}

export interface UsageSource {
  tokens: () => TokenUsage | undefined;
  contextLimit: () => unknown;
  cost: () => unknown;
}

function formatInteger(value: number): string {
  return INTEGER_FORMAT.format(Math.max(0, Math.round(value)));
}

export function ContextUsage(props: {
  palette: () => ThemePalette;
  source: UsageSource;
}) {
  const theme = props.palette;
  const [open, setOpen] = createSignal(true);
  const [separatorWidth, setSeparatorWidth] = createSignal(BAR_WIDTH);
  let panel: any;
  const usage = createMemo(() =>
    calculateUsage(props.source.tokens(), props.source.contextLimit(), props.source.cost()),
  );

  const row = (
    label: string,
    value: number,
    color: RGBA,
    indent = false,
    symbol = "■",
  ) => (
    <box flexDirection="row" width="100%" paddingLeft={indent ? 2 : 0}>
      <text fg={theme().textMuted}>
        <span style={{ fg: color }}>{symbol}</span> {label}
      </text>
      <box flexGrow={1} />
      <text fg={theme().textMuted}>{formatInteger(value)}</text>
    </box>
  );
  const separator = () => "─".repeat(separatorWidth());
  const contextColor = () =>
    usage().contextUsage >= 90
      ? theme().error
      : usage().contextUsage >= 80
        ? theme().warning
        : theme().success;

  return (
    <box
      ref={panel}
      gap={0}
      width="100%"
      onSizeChange={() => {
        const width = Math.max(1, panel?.width ?? BAR_WIDTH);
        setSeparatorWidth((current) => (current === width ? current : width));
      }}
    >
      <box
        flexDirection="row"
        width="100%"
        gap={1}
        onMouseDown={() => setOpen((value) => !value)}
      >
        <text flexShrink={0} fg={theme().text}>
          {open() ? "▼" : "▶"}
        </text>
        <text fg={theme().text}>
          <b>Context</b>
          <Show when={!open()}>
            <span style={{ fg: contextColor() }}>
              {` (${usage().contextUsage.toFixed(1)}%)`}
            </span>
          </Show>
        </text>
        <box flexGrow={1} />
        <text fg={theme().textMuted}>Total {formatInteger(usage().total)}</text>
      </box>
      <Show when={open()}>
        {row("Input", usage().input, theme().info, false, "↓")}
        {row("Cache hit", usage().hit, theme().success, true)}
        {row("Cache miss", usage().miss, theme().error, true)}
        {row("Cache write", usage().write, theme().warning, true)}
        <text fg={theme().border}>{separator()}</text>
        {row("Output", usage().output, theme().secondary, false, "↑")}
        {row("Thinking", usage().thinking, theme().accent, true)}
        {row("Response", usage().response, theme().textMuted, true)}
        <text fg={theme().border}>{separator()}</text>
        <box flexDirection="row" width="100%">
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().success }}>↺</span> Cache hit rate
          </text>
          <box flexGrow={1} />
          <text fg={theme().success}>{usage().hitRate.toFixed(1)}%</text>
        </box>
        <text>
          <span style={{ fg: theme().success }}>{"━".repeat(usage().hitWidth)}</span>
          <span style={{ fg: theme().warning }}>{"━".repeat(usage().writeWidth)}</span>
          <span style={{ fg: theme().error }}>{"━".repeat(usage().missWidth)}</span>
          <span style={{ fg: theme().border }}>{"━".repeat(usage().emptyWidth)}</span>
        </text>
        <box flexDirection="row" gap={1}>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().success }}>■</span> Hit
          </text>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().warning }}>■</span> Write
          </text>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().error }}>■</span> Miss
          </text>
        </box>
        <text fg={theme().border}>{separator()}</text>
        <box flexDirection="row" width="100%">
          <text fg={theme().textMuted}>
            <span style={{ fg: contextColor() }}>◉</span> Context usage
          </text>
          <box flexGrow={1} />
          <text fg={contextColor()}>
            {`${usage().contextUsage.toFixed(1)}%`}
          </text>
        </box>
        <text>
          <span style={{ fg: contextColor() }}>{"━".repeat(usage().contextWidth)}</span>
          <span style={{ fg: theme().border }}>
            {"━".repeat(BAR_WIDTH - usage().contextWidth)}
          </span>
        </text>
        <box flexDirection="row" gap={1}>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().success }}>■</span> &lt;80%
          </text>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().warning }}>■</span> 80-89%
          </text>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().error }}>■</span> ≥90%
          </text>
        </box>
        <text fg={theme().border}>{separator()}</text>
        <box flexDirection="row" width="100%">
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().warning }}>$</span> Spent
          </text>
          <box flexGrow={1} />
          <text fg={theme().textMuted}>${usage().cost.toFixed(2)}</text>
        </box>
      </Show>
    </box>
  );
}
