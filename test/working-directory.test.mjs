import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  installWorkingDirectoryMenu,
  runWorkingDirectoryAction,
  workingDirectoryOptions,
} from "../dist/working-directory.js";

test("adds VS Code to the native working-directory action order", () => {
  assert.deepEqual(
    workingDirectoryOptions("/repo").map((option) => [option.title, option.value, option.description]),
    [
      ["Copy path", "copy", "/repo"],
      ["Open folder", "open", "in system file manager"],
      ["Open in VS Code", "vscode", "in the current window"],
      ["Workspaces", "workspaces", "to another working directory"],
    ],
  );
});

test("delegates working-directory selections to their platform actions", async () => {
  const calls = [];
  const actions = {
    copy: (path) => (calls.push(["copy", path]), true),
    open: async (path) => calls.push(["open", path]),
    vscode: async (path) => calls.push(["vscode", path]),
    workspaces: () => calls.push(["workspaces"]),
    success: (message) => calls.push(["success", message]),
  };

  for (const action of ["copy", "open", "vscode", "workspaces"]) {
    await runWorkingDirectoryAction(action, "/repo", actions);
  }
  assert.deepEqual(calls, [
    ["copy", "/repo"],
    ["success", "Path copied to clipboard"],
    ["open", "/repo"],
    ["vscode", "/repo"],
    ["workspaces"],
  ]);
});

test("enhances and restores native location click handlers", async () => {
  const native = () => {};
  const node = {
    isDestroyed: false,
    _mouseListeners: { up: native },
    set onMouseUp(handler) {
      if (handler) this._mouseListeners.up = handler;
      else delete this._mouseListeners.up;
    },
  };
  let postProcess;
  const toasts = [];
  const context = {
    location: { directory: "/repo" },
    renderer: {
      root: {
        findDescendantById: (id) => (id === "sidebar.footer.location" ? node : undefined),
      },
      addPostProcessFn: (callback) => {
        postProcess = callback;
      },
      removePostProcessFn: (callback) => assert.equal(callback, postProcess),
      getSelection: () => undefined,
      copyToClipboardOSC52: (path) => path === "/repo",
    },
    data: {
      session: { get: () => undefined },
      location: { default: () => ({ directory: "/fallback" }) },
    },
    keymap: { dispatch: () => {} },
    ui: {
      router: { current: () => ({ type: "home" }) },
      dialog: { select: async () => "copy" },
      toast: { show: (value) => toasts.push(value) },
    },
  };

  const dispose = installWorkingDirectoryMenu(context);
  postProcess({});
  assert.notEqual(node._mouseListeners.up, native);
  node._mouseListeners.up({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(toasts, [{ message: "Path copied to clipboard", variant: "info" }]);
  dispose();
  assert.equal(node._mouseListeners.up, native);
});

test("registers the enhanced menu only when its v2 option is enabled", async () => {
  const source = await readFile(new URL("../src/tui-v2.tsx", import.meta.url), "utf8");
  assert.match(source, /context\.options\.vscode === true/);
  assert.match(source, /installWorkingDirectoryMenu\(context\)/);
  assert.match(source, /disposeWorkingDirectory\?\.\(\)/);
});
