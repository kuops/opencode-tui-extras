export interface SkillDescriptor {
  id: string;
  name: string;
  description?: string;
  autoinvoke?: boolean;
  path: string;
}

export interface ManagedSkill extends SkillDescriptor {
  disabled: boolean;
}

export function normalizeDisabledSkillIDs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeSkillDescription(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

export function managedSkills(
  skills: readonly SkillDescriptor[],
  disabled: ReadonlySet<string> | readonly string[],
): ManagedSkill[] {
  const disabledIDs = disabled instanceof Set ? disabled : new Set(disabled);
  return skills
    .map((skill) => {
      const description = normalizeSkillDescription(skill.description);
      return {
        id: skill.id,
        name: skill.name,
        path: skill.path,
        disabled: disabledIDs.has(skill.id),
        ...(description === undefined ? {} : { description }),
        ...(skill.autoinvoke === undefined ? {} : { autoinvoke: skill.autoinvoke }),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function skillStatusLabel(skill: Pick<ManagedSkill, "disabled" | "autoinvoke">): string {
  if (skill.disabled) return "Disabled";
  if (skill.autoinvoke === false) return "Manual";
  return "Enabled";
}

export function skillCounts(skills: readonly Pick<ManagedSkill, "disabled">[]) {
  const disabled = skills.filter((skill) => skill.disabled).length;
  return { enabled: skills.length - disabled, disabled, total: skills.length };
}
