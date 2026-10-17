import type { Context } from "@opencode/plugin/promise/plugin";
import { managedSkills, normalizeDisabledSkillIDs, type SkillDescriptor } from "./skills-model.js";
import { SkillsRpc } from "./skills-rpc.js";

const DISABLED_SKILLS_KEY_PREFIX = "skills.disabled";

export function disabledSkillsStorageKey(projectID: string) {
  return `${DISABLED_SKILLS_KEY_PREFIX}:${projectID}`;
}

function sameLocation(
  left: { directory: string; workspaceID?: string } | undefined,
  right: { directory: string; workspaceID?: string },
) {
  if (!left) return true;
  return left.directory === right.directory && left.workspaceID === right.workspaceID;
}

export async function installSkillsServer(context: Context) {
  const storageKey = disabledSkillsStorageKey(context.location.project.id);
  const disabled = new Set(normalizeDisabledSkillIDs(await context.storage.get(storageKey)));
  let catalog: SkillDescriptor[] = [];
  let filter: Awaited<ReturnType<Context["skill"]["transform"]>> | undefined;
  let installing: Promise<void> | undefined;

  const ensureFilter = async () => {
    if (filter) return;
    if (installing) return installing;
    installing = (async () => {
      const registration = await context.skill.transform((editor) => {
        catalog = editor.list().map((skill) => ({
          id: String(skill.id),
          name: String(skill.name),
          description: skill.description,
          autoinvoke: skill.autoinvoke,
          path: String(skill.path),
        }));
        for (const id of disabled) editor.remove(id);
      });
      filter = registration;
      await context.skill.list();
    })();
    try {
      await installing;
    } finally {
      installing = undefined;
    }
  };

  const list = async () => {
    await ensureFilter();
    await context.skill.list();
    return { skills: managedSkills(catalog, disabled) };
  };

  const rpc = await context.rpc.register(SkillsRpc, {
    list: async () => list(),
    setDisabled: async (input) => {
      const value = input as { id: string; disabled: boolean };
      if (value.disabled) disabled.add(value.id);
      else disabled.delete(value.id);
      await context.storage.set(storageKey, [...disabled].sort((left, right) => left.localeCompare(right)));
      await ensureFilter();
      await context.skill.reload();
      return list();
    },
  });

  // External package plugins activate before OpenCode's compatibility and native
  // skill sources. Their coalesced skill.updated notification arrives after those
  // sources, so installing here appends our filter after the complete catalog.
  const events = new AbortController();
  const listener = (async () => {
    try {
      for await (const event of context.event.subscribe({ signal: events.signal })) {
        if (event.type !== "skill.updated") continue;
        if (!sameLocation(event.location, context.location)) continue;
        await ensureFilter();
      }
    } catch (error) {
      if (!events.signal.aborted) console.warn("[opencode-tui-extras] Skills listener stopped:", error);
    }
  })();

  return async () => {
    events.abort();
    await listener;
    await installing;
    await filter?.dispose();
    await rpc.dispose();
  };
}
