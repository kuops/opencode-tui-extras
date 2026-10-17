import type { Context } from "@opencode/plugin/tui/plugin";
import { setupV2 } from "./tui-v2.js";
export { mcpStatusLabel } from "./mcp-sidebar.js";
export { skillStatusLabel } from "./skills-model.js";

const plugin: {
  id: string;
  setup: (context: Context) => ReturnType<typeof setupV2>;
} = {
  // Keep the original ID so persisted TUI state survives the package rename.
  id: "opencode-context-sidebar-tui",
  setup: setupV2,
};

export default plugin;
