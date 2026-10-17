import type { Context } from "@opencode/plugin/promise/plugin";
import { installSkillsServer } from "./skills-server.js";

export default {
  // Keep the original ID so persisted plugin storage survives the package rename.
  id: "opencode-context-sidebar",
  async setup(context: Context) {
    if (context.options.skills !== true) return;
    return installSkillsServer(context);
  },
};
