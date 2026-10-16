import assert from "node:assert/strict";
import test from "node:test";
import { disabledSkillsStorageKey, installSkillsServer } from "../dist/skills-server.js";

const skill = (id) => ({
  id,
  name: id.toUpperCase(),
  description: `${id} description`,
  path: `/skills/${id}/SKILL.md`,
  content: `# ${id}`,
});

function fakeContext(initialDisabled = []) {
  const stored = new Map([[disabledSkillsStorageKey("project-1"), initialDisabled]]);
  const source = [skill("alpha"), skill("beta")];
  let transform;
  let handlers;
  let transformDisposed = false;
  let rpcDisposed = false;

  const current = async () => {
    const values = new Map(source.map((item) => [item.id, { ...item }]));
    transform?.({
      list: () => [...values.values()],
      remove: (id) => values.delete(String(id)),
    });
    return [...values.values()];
  };

  const context = {
    location: {
      directory: "/workspace",
      project: { id: "project-1", directory: "/workspace", canonical: "/workspace" },
    },
    storage: {
      get: async (key) => stored.get(key),
      set: async (key, value) => stored.set(key, value),
    },
    skill: {
      transform: async (callback) => {
        transform = callback;
        return {
          dispose: async () => {
            transformDisposed = true;
            transform = undefined;
          },
        };
      },
      list: current,
      reload: async () => undefined,
    },
    rpc: {
      register: async (_definition, value) => {
        handlers = value;
        return { dispose: async () => { rpcDisposed = true; } };
      },
    },
    event: {
      subscribe: async function* ({ signal }) {
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      },
    },
  };

  return {
    context,
    stored,
    current,
    handlers: () => handlers,
    disposed: () => ({ transform: transformDisposed, rpc: rpcDisposed }),
  };
}

test("uses a project-scoped storage key for disabled Skills", () => {
  assert.equal(disabledSkillsStorageKey("project-1"), "skills.disabled:project-1");
});

test("persists disabled Skills and removes them from the live catalog", async () => {
  const fake = fakeContext(["beta"]);
  const dispose = await installSkillsServer(fake.context);
  const handlers = fake.handlers();

  const initial = await handlers.list({});
  assert.deepEqual(initial.skills.map((item) => [item.id, item.disabled]), [
    ["alpha", false],
    ["beta", true],
  ]);
  assert.deepEqual((await fake.current()).map((item) => item.id), ["alpha"]);

  const enabled = await handlers.setDisabled({ id: "beta", disabled: false });
  assert.equal(enabled.skills.find((item) => item.id === "beta")?.disabled, false);
  assert.deepEqual((await fake.current()).map((item) => item.id), ["alpha", "beta"]);
  assert.deepEqual(fake.stored.get(disabledSkillsStorageKey("project-1")), []);

  await handlers.setDisabled({ id: "alpha", disabled: true });
  assert.deepEqual((await fake.current()).map((item) => item.id), ["beta"]);
  assert.deepEqual(fake.stored.get(disabledSkillsStorageKey("project-1")), ["alpha"]);

  await dispose();
  assert.deepEqual(fake.disposed(), { transform: true, rpc: true });
});
