import type { Plugin } from "@opencode-ai/plugin";
import type { Context } from "@opencode/plugin/promise/plugin";
import { installSkillsServer } from "./skills-server.js";

export const ContextSidebarPlugin: Plugin = async () => ({});

export default {
  id: "opencode-context-sidebar",
  async setup(context: Context) {
    if (context.options.skills !== true) return;
    return installSkillsServer(context);
  },
  server: ContextSidebarPlugin,
};
