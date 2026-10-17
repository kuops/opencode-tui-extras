import assert from "node:assert/strict";
import test from "node:test";

test("exposes the OpenCode v2 adapter through the built TUI entry", async () => {
  const plugin = (await import("../dist/tui.js")).default;

  assert.equal(plugin.id, "opencode-context-sidebar-tui");
  assert.equal("tui" in plugin, false);
  assert.equal(typeof plugin.setup, "function");
});

test("exposes only the OpenCode v2 server adapter", async () => {
  const plugin = (await import("../dist/server.js")).default;

  assert.equal(plugin.id, "opencode-context-sidebar");
  assert.equal("server" in plugin, false);
  assert.equal(typeof plugin.setup, "function");
});
