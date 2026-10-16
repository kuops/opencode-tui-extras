import assert from "node:assert/strict";
import test from "node:test";
import { skillDialogOptions, skillDialogStatus } from "../dist/skills-sidebar.js";

const skills = [
  { id: "enabled", name: "Enabled skill", path: "/enabled", disabled: false },
  { id: "manual", name: "Manual skill", path: "/manual", autoinvoke: false, disabled: false },
  { id: "disabled", name: "Disabled skill", path: "/disabled", disabled: true },
];

test("formats Skill states like the native MCP dialog", () => {
  assert.equal(skillDialogStatus(skills[0]), "Enabled ✓");
  assert.equal(skillDialogStatus(skills[1]), "Manual →");
  assert.equal(skillDialogStatus(skills[2]), "Disabled ○");
});

test("keeps Skill dialog rows flat and uncluttered", () => {
  assert.deepEqual(skillDialogOptions(skills), [
    { title: "Enabled skill", value: "enabled", footer: "Enabled ✓" },
    { title: "Manual skill", value: "manual", footer: "Manual →" },
    { title: "Disabled skill", value: "disabled", footer: "Disabled ○" },
  ]);
});
