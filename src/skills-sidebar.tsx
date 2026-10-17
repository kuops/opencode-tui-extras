/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/plugin";
import { createMemo, createResource, For, onCleanup, Show } from "solid-js";
import {
  managedSkills,
  skillCounts,
  skillStatusLabel,
  type ManagedSkill,
  type SkillDescriptor,
} from "./skills-model.js";
import { SkillsRpc } from "./skills-rpc.js";

type Location = ReturnType<Context["data"]["location"]["default"]>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sameLocation(left: Location | undefined, right: Location) {
  if (!left) return true;
  return left.directory === right.directory && left.workspaceID === right.workspaceID;
}

function skillDescriptor(skill: {
  id: unknown;
  name: unknown;
  description?: string;
  autoinvoke?: boolean;
  path: unknown;
}): SkillDescriptor {
  return {
    id: String(skill.id),
    name: String(skill.name),
    description: skill.description,
    autoinvoke: skill.autoinvoke,
    path: String(skill.path),
  };
}

async function rpcSkills(context: Context, location: Location) {
  const rpc = context.client.rpc(SkillsRpc);
  const result = await rpc.list({}, { location }) as { skills: ManagedSkill[] };
  return result.skills;
}

export async function loadManagedSkills(context: Context, location: Location) {
  try {
    return await rpcSkills(context, location);
  } catch {
    let current = context.data.location.skill.list(location);
    if (!current) {
      await context.data.location.skill.sync(location);
      current = context.data.location.skill.list(location) ?? [];
    }
    return managedSkills(current.map(skillDescriptor), []);
  }
}

export function skillDialogStatus(skill: ManagedSkill) {
  if (skill.disabled) return "Disabled ○";
  if (skill.autoinvoke === false) return "Manual →";
  return "Enabled ✓";
}

export function skillDialogOptions(skills: readonly ManagedSkill[]) {
  return skills.map((skill) => ({
    title: skill.name,
    value: skill.id,
    footer: skillDialogStatus(skill),
  }));
}

export async function syncNativeSkillCatalog(context: Context, location: Location) {
  context.data.location.skill.invalidate(location);
  await context.data.location.skill.sync(location);
}

export function installNativeSkillCatalogRefresh(context: Context) {
  return context.data.on("skill.updated", (event) => {
    // OpenCode's native data cache already handles location-scoped events. Skill
    // reloads currently emit a locationless event, which that cache ignores.
    if (event.location) return;
    void syncNativeSkillCatalog(context, currentSkillsLocation(context)).catch((error) => {
      console.warn("[opencode-tui-extras] Failed to refresh native Skill catalog:", error);
    });
  });
}

export async function openSkillsManager(context: Context, location: Location, initial?: string) {
  const rpc = context.client.rpc(SkillsRpc);
  let current = initial;
  while (true) {
    let skills: ManagedSkill[];
    try {
      skills = await rpcSkills(context, location);
    } catch (error) {
      context.ui.toast.show({
        title: "Skills unavailable",
        message: `Load the server plugin to manage Skills: ${errorMessage(error)}`,
        variant: "error",
      });
      return;
    }

    if (skills.length === 0) {
      await context.ui.dialog.alert({ title: "Manage Skills", message: "No Skills were found for this project." });
      return;
    }

    let actionSelected: string | undefined;
    const selected = await context.ui.dialog.select<string>({
      title: "Skills",
      placeholder: "Search skills",
      current,
      options: skillDialogOptions(skills),
      actions: [{
        bind: "space",
        title: "toggle",
        onTrigger(value) {
          actionSelected = value;
          context.ui.dialog.clear();
        },
      }],
    });
    const selectedID = actionSelected ?? selected;
    if (selectedID === undefined) return;

    const skill = skills.find((item) => item.id === selectedID);
    if (!skill) return;
    try {
      await rpc.setDisabled({ id: skill.id, disabled: !skill.disabled }, { location });
    } catch (error) {
      context.ui.toast.show({
        title: "Could not update Skill",
        message: errorMessage(error),
        variant: "error",
      });
      return;
    }
    let catalogRefreshed = true;
    try {
      await syncNativeSkillCatalog(context, location);
    } catch (error) {
      catalogRefreshed = false;
      context.ui.toast.show({
        title: skill.disabled ? "Skill enabled" : "Skill disabled",
        message: `${skill.name} was updated, but /skills and @ completion could not refresh: ${errorMessage(error)}`,
        variant: "warning",
      });
    }
    if (catalogRefreshed) {
      context.ui.toast.show({
        title: skill.disabled ? "Skill enabled" : "Skill disabled",
        message: skill.disabled
          ? skill.name
          : `${skill.name} is unavailable for future loads; existing session context is unchanged.`,
        variant: "success",
      });
    }
    current = skill.id;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

export function currentSkillsLocation(context: Context): Location {
  const route = context.ui.router.current();
  if (route.type === "session") {
    const location = context.data.session.get(route.sessionID)?.location;
    if (location) return location;
  }
  return context.location ?? context.data.location.default();
}

function statusColor(context: Context, skill: ManagedSkill) {
  if (skill.disabled) return context.theme.text.muted;
  if (skill.autoinvoke === false) return context.theme.text.feedback.warning.base;
  return context.theme.text.feedback.success.base;
}

export function SkillsSidebar(props: { context: Context; sessionID: string }) {
  const [view, updateView] = props.context.storage.store("skills-sidebar", { initial: { open: true } });
  const session = createMemo(() => props.context.data.session.get(props.sessionID));
  const location = () => session()?.location ?? props.context.location ?? props.context.data.location.default();
  const [skills, { refetch }] = createResource(location, (value) => loadManagedSkills(props.context, value));
  const list = createMemo(() => skills() ?? []);
  const counts = createMemo(() => skillCounts(list()));

  const stop = props.context.data.on("skill.updated", (event) => {
    if (!sameLocation(event.location, location())) return;
    void refetch();
  });
  onCleanup(stop);

  const openManager = (id?: string) => {
    void openSkillsManager(props.context, location(), id);
  };

  return (
    <Show when={list().length > 0}>
      <box>
        <box
          flexDirection="row"
          gap={1}
          onMouseDown={() => {
            if (list().length <= 2) return;
            void updateView((draft) => {
              draft.open = !draft.open;
            }).catch((error) => console.error("Failed to persist Skills sidebar state", error));
          }}
        >
          <Show when={list().length > 2}>
            <text fg={props.context.theme.text.base}>{view.open ? "▼" : "▶"}</text>
          </Show>
          <text fg={props.context.theme.text.base}>
            <b>Skills</b>
            <Show when={!view.open}>
              <span style={{ fg: props.context.theme.text.muted }}>
                {` (${counts().enabled} on${counts().disabled ? `, ${counts().disabled} off` : ""})`}
              </span>
            </Show>
          </text>
        </box>
        <Show when={list().length <= 2 || view.open}>
          <For each={list()}>
            {(skill) => (
              <box flexDirection="row" gap={1} minWidth={0} onMouseUp={() => openManager(skill.id)}>
                <text flexShrink={0} fg={statusColor(props.context, skill)}>•</text>
                <text fg={props.context.theme.text.base} wrapMode="none" truncate flexGrow={1} flexShrink={1} minWidth={0}>
                  <b>{skill.name}</b>
                </text>
                <text fg={statusColor(props.context, skill)} wrapMode="none" flexShrink={0}>
                  {skillStatusLabel(skill)}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  );
}
