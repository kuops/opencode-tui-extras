import type { Plugin } from "@opencode-ai/plugin";
import type { Context } from "@opencode/plugin/promise/plugin";

export const ContextSidebarPlugin: Plugin = async () => ({});

export default {
  id: "opencode-context-sidebar",
  setup(_context: Context) {},
  server: ContextSidebarPlugin,
};
