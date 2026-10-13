import assert from "node:assert/strict";
import test from "node:test";

test("exposes both OpenCode adapters through the built TUI entry", async () => {
  const plugin = (await import("../dist/tui.js")).default;

  assert.equal(plugin.id, "opencode-context-sidebar-tui");
  assert.equal(typeof plugin.tui, "function");
  assert.equal(typeof plugin.setup, "function");
});
