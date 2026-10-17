import type { Context } from "@opencode/plugin/promise/plugin";
import { installSkillsServer } from "./skills-server.js";

export default {
  id: "opencode-tui-extras",
  async setup(context: Context) {
    if (context.options.skills !== true) return;
    return installSkillsServer(context);
  },
};
