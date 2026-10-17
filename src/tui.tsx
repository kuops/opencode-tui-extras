import type { Context } from "@opencode/plugin/tui/plugin";
import { setupV2 } from "./tui-v2.js";
export { mcpStatusLabel } from "./mcp-sidebar.js";
export { skillStatusLabel } from "./skills-model.js";

const plugin: {
  id: string;
  setup: (context: Context) => ReturnType<typeof setupV2>;
} = {
  id: "opencode-tui-extras-tui",
  setup: setupV2,
};

export default plugin;
