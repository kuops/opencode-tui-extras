import assert from "node:assert/strict";
import test from "node:test";
import { setupV2 } from "../dist/tui-v2.js";

function context(skills) {
  const claims = [];
  const layers = [];
  const listeners = [];
  const invalidations = [];
  const syncs = [];
  let disposals = 0;
  let listenerDisposals = 0;
  const location = { directory: "/repo" };
  return {
    value: {
      options: { skills },
      ui: {
        router: { current: () => ({ type: "home" }) },
        slot: (claim) => {
          claims.push(claim);
          return () => { disposals += 1; };
        },
      },
      data: {
        on: (type, handler) => {
          listeners.push({ type, handler });
          return () => { listenerDisposals += 1; };
        },
        session: { get: () => undefined },
        location: {
          default: () => location,
          skill: {
            invalidate: (value) => invalidations.push(value),
            sync: async (value) => { syncs.push(value); },
          },
        },
      },
      keymap: {
        layer: (factory) => layers.push(factory()),
      },
    },
    claims,
    layers,
    listeners,
    invalidations,
    syncs,
    disposals: () => disposals,
    listenerDisposals: () => listenerDisposals,
  };
}

test("registers the Skills sidebar, manager, and native cache refresh only when enabled", async () => {
  const disabled = context(false);
  const disposeDisabled = setupV2(disabled.value);
  assert.equal(disabled.claims.length, 1);
  assert.equal(disabled.layers.length, 0);
  disposeDisabled();
  assert.equal(disabled.disposals(), 1);

  const enabled = context(true);
  const disposeEnabled = setupV2(enabled.value);
  assert.equal(enabled.claims.length, 2);
  assert.equal(enabled.claims[1].append, "sidebar.content");
  assert.equal(enabled.layers.length, 1);
  assert.equal(enabled.listeners.length, 1);
  assert.equal(enabled.listeners[0].type, "skill.updated");
  assert.equal(enabled.layers[0].commands[0].id, "opencode-tui-extras.skills.manage");
  assert.equal(enabled.layers[0].commands[0].slash.name, "skills-settings");

  enabled.listeners[0].handler({ type: "skill.updated", data: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(enabled.invalidations, [{ directory: "/repo" }]);
  assert.deepEqual(enabled.syncs, [{ directory: "/repo" }]);

  enabled.listeners[0].handler({
    type: "skill.updated",
    location: { directory: "/other" },
    data: {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(enabled.invalidations.length, 1);

  disposeEnabled();
  assert.equal(enabled.disposals(), 2);
  assert.equal(enabled.listenerDisposals(), 1);
});
