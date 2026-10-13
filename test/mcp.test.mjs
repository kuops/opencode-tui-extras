import test from "node:test";
import assert from "node:assert/strict";
import { mcpStatusLabel } from "../dist/tui.js";
import { mcpSelectionCommands, mcpStatusColor } from "../dist/mcp-sidebar.js";
import { readFile } from "node:fs/promises";

test("uses clear MCP status labels", () => {
  assert.equal(mcpStatusLabel("connected"), "Connected");
  assert.equal(mcpStatusLabel("pending"), "Connecting");
  assert.equal(mcpStatusLabel("failed"), "Error");
  assert.equal(mcpStatusLabel("needs_auth"), "Sign in");
  assert.equal(mcpStatusLabel("disabled"), "Disabled");
});

test("only changes the Connected label color and preserves other status colors", () => {
  const muted = {};
  const success = {};
  const error = {};
  const warning = {};
  const context = {
    theme: {
      text: {
        muted,
        feedback: { success: { base: success }, error: { base: error }, warning: { base: warning } },
      },
    },
  };

  assert.equal(mcpStatusColor(context, "connected", true), success);
  assert.equal(mcpStatusColor(context, "connected"), success);
  assert.equal(mcpStatusColor(context, "failed", true), error);
  for (const status of ["pending", "disabled", "needs_auth"]) {
    assert.equal(mcpStatusColor(context, status, true), muted);
  }
  assert.equal(mcpStatusColor(context, "needs_auth"), warning);
});

test("moves the native MCP dialog to the clicked server", () => {
  assert.deepEqual(mcpSelectionCommands(["zread", "context7", "github"], "context7"), [
    "dialog.select.home",
  ]);
  assert.deepEqual(mcpSelectionCommands(["zread", "context7", "github"], "zread"), [
    "dialog.select.home",
    "dialog.select.next",
    "dialog.select.next",
  ]);
  assert.deepEqual(mcpSelectionCommands(["zread"], "missing"), []);
});

test("delegates MCP dialogs to the native command without custom connection handling", async () => {
  const source = await readFile(new URL("../src/mcp-sidebar.tsx", import.meta.url), "utf8");

  assert.match(source, /props\.context\.keymap\.dispatch\("mcp\.list", serverName\)/);
  assert.match(source, /"dialog\.select\.home"/);
  assert.match(source, /"dialog\.select\.next"/);
  assert.doesNotMatch(source, /McpDialog|ui\.dialog|client\.mcp|keymap\.layer|setTimeout|createSignal/);
});
