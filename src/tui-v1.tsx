/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui";
import { createMemo } from "solid-js";
import { ContextUsage, type ThemePalette } from "./tui-shared.js";
import { safeNumber, tokenTotal } from "./usage.js";

function V1ContextUsage(props: { api: TuiPluginApi; sessionID: string }) {
  const messages = createMemo(() => props.api.state.session.messages(props.sessionID));
  const last = createMemo(() => {
    const list = messages();
    for (let index = list.length - 1; index >= 0; index--) {
      const message = list[index];
      if (message.role === "assistant" && tokenTotal(message.tokens) > 0) return message;
    }
  });
  const session = createMemo(() => {
    const sessionApi = props.api.state.session as unknown as {
      get?: (sessionID: string) => unknown;
    };
    const value = sessionApi.get?.(props.sessionID);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  });

  const palette = (): ThemePalette => props.api.theme.current;
  return (
    <ContextUsage
      palette={palette}
      source={{
        tokens: () => last()?.tokens,
        contextLimit: () => {
          const message = last();
          if (!message) return 0;
          return props.api.state.provider.find((item) => item.id === message.providerID)?.models[
            message.modelID
          ]?.limit?.context;
        },
        cost: () => safeNumber(session()?.cost),
      }}
    />
  );
}

export const tuiV1: TuiPlugin = async (api, options) => {
  if (options?.enabled === false) return;
  api.slots.register({
    order: 100,
    slots: {
      sidebar_content(_ctx, props) {
        return <V1ContextUsage api={api} sessionID={props.session_id} />;
      },
    },
  });
};
