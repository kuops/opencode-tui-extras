/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/plugin";
import { createMemo } from "solid-js";
import { ContextUsage, type ThemePalette } from "./tui-shared.js";
import { installTransparency } from "./transparency.js";
import { latestV2UsageIndex } from "./usage.js";
import { McpSidebar } from "./mcp-sidebar.js";

function V2ContextUsage(props: { context: Context; sessionID: string }) {
  const messages = createMemo(() => props.context.data.session.message.list(props.sessionID));
  const session = createMemo(() => props.context.data.session.get(props.sessionID));
  const last = createMemo(() => {
    const list = messages();
    const index = latestV2UsageIndex(list, session()?.revert?.messageID);
    const message = list[index];
    return message?.type === "assistant" ? message : undefined;
  });
  const location = () => session()?.location ?? props.context.location ?? props.context.data.location.default();

  const palette = (): ThemePalette => ({
    text: props.context.theme.text.base,
    textMuted: props.context.theme.text.muted,
    info: props.context.theme.text.feedback.info.base,
    success: props.context.theme.text.feedback.success.base,
    error: props.context.theme.text.feedback.error.base,
    warning: props.context.theme.text.feedback.warning.base,
    secondary: props.context.theme.categorical[0][200],
    accent: props.context.theme.hue.accent[200],
    border: props.context.theme.border.base,
  });

  return (
    <ContextUsage
      palette={palette}
      source={{
        tokens: () => last()?.tokens,
        contextLimit: () => {
          const message = last();
          if (!message) return 0;
          return props.context.data.location.model
            .list(location())
            ?.find(
              (model) =>
                model.providerID === message.model.providerID && model.id === message.model.id,
            )?.limit.context;
        },
        cost: () => props.context.data.session.cost(props.sessionID),
      }}
    />
  );
}

export function setupV2(context: Context) {
  const disposeSlot = context.ui.slot({
    prepend: "sidebar.content",
    render: (props) => <V2ContextUsage context={context} sessionID={props.sessionID} />,
  });
  const disposeTransparency = context.options.transparent === true
    ? installTransparency(context)
    : undefined;
  const disposeMcp = context.options.mcp === true
    ? context.ui.slot({
        append: "sidebar.content",
        render: (props) => <McpSidebar context={context} sessionID={props.sessionID} />,
      })
    : undefined;

  return () => {
    disposeTransparency?.();
    disposeSlot();
    disposeMcp?.();
  };
}
