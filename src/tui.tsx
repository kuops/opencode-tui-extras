import type { TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Context } from "@opencode/plugin/tui/plugin";
import { tuiV1 } from "./tui-v1.js";
import { setupV2 } from "./tui-v2.js";
export { mcpStatusLabel } from "./mcp-sidebar.js";

const plugin: TuiPluginModule & {
  id: string;
  setup: (context: Context) => ReturnType<typeof setupV2>;
} = {
  id: "opencode-context-sidebar-tui",
  tui: tuiV1,
  setup: setupV2,
};

export default plugin;
