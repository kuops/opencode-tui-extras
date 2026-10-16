import assert from "node:assert/strict";
import test from "node:test";
import {
  managedSkills,
  normalizeDisabledSkillIDs,
  normalizeSkillDescription,
  skillCounts,
  skillStatusLabel,
} from "../dist/skills-model.js";

const skill = (id, input = {}) => ({
  id,
  name: input.name ?? id,
  description: input.description,
  autoinvoke: input.autoinvoke,
  path: input.path ?? `/skills/${id}/SKILL.md`,
});

test("normalizes persisted disabled skill IDs", () => {
  assert.deepEqual(normalizeDisabledSkillIDs(undefined), []);
  assert.deepEqual(normalizeDisabledSkillIDs([" z ", "a", "z", 2, ""]), ["a", "z"]);
});

test("normalizes skill descriptions for compact UI", () => {
  assert.equal(normalizeSkillDescription("  Review\n\nchanges  "), "Review changes");
  assert.equal(normalizeSkillDescription(" \n "), undefined);
  assert.equal(normalizeSkillDescription(undefined), undefined);
});

test("builds stable managed skill state without changing autoinvoke semantics", () => {
  const result = managedSkills(
    [
      skill("manual", { name: "Manual", autoinvoke: false }),
      skill("review", { name: "Review", description: "Review\nchanges" }),
    ],
    new Set(["review"]),
  );

  assert.deepEqual(result, [
    {
      id: "manual",
      name: "Manual",
      autoinvoke: false,
      path: "/skills/manual/SKILL.md",
      disabled: false,
    },
    {
      id: "review",
      name: "Review",
      description: "Review changes",
      path: "/skills/review/SKILL.md",
      disabled: true,
    },
  ]);
  assert.equal(skillStatusLabel(result[0]), "Manual");
  assert.equal(skillStatusLabel(result[1]), "Disabled");
  assert.equal(skillStatusLabel({ disabled: false, autoinvoke: true }), "Enabled");
});

test("summarizes sidebar skill rows", () => {
  const list = managedSkills(
    [skill("a"), skill("b"), skill("c")],
    ["b"],
  );
  assert.deepEqual(skillCounts(list), { enabled: 2, disabled: 1, total: 3 });
});
