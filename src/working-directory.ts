import open from "open";
import type { MouseEvent, OptimizedBuffer, Renderable } from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/plugin";

export type WorkingDirectoryAction = "copy" | "open" | "vscode" | "workspaces";

interface MouseInternals {
  _mouseListeners?: Partial<Record<"up", (event: MouseEvent) => void>>;
}

interface PatchedLocation {
  native?: (event: MouseEvent) => void;
  enhanced: (event: MouseEvent) => void;
}

interface WorkingDirectoryActions {
  copy(path: string): boolean;
  open(path: string): Promise<unknown>;
  vscode(path: string): Promise<unknown>;
  workspaces(): void;
  success(message: string): void;
}

export function workingDirectoryOptions(directory: string) {
  return [
    { title: "Copy path", value: "copy" as const, description: directory },
    { title: "Open folder", value: "open" as const, description: "in system file manager" },
    { title: "Open in VS Code", value: "vscode" as const, description: "in the current window" },
    { title: "Workspaces", value: "workspaces" as const, description: "to another working directory" },
  ];
}

export async function runWorkingDirectoryAction(
  action: WorkingDirectoryAction,
  directory: string,
  actions: WorkingDirectoryActions,
) {
  if (action === "copy") {
    if (!actions.copy(directory)) throw new Error("Terminal clipboard is unavailable");
    actions.success("Path copied to clipboard");
    return;
  }
  if (action === "open") {
    await actions.open(directory);
    return;
  }
  if (action === "vscode") {
    await actions.vscode(directory);
    return;
  }
  actions.workspaces();
}

function currentDirectory(context: Context) {
  const route = context.ui.router.current();
  if (route.type === "session") {
    const directory = context.data.session.get(route.sessionID)?.location.directory;
    if (directory) return directory;
  }
  return context.location?.directory ?? context.data.location.default().directory;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mouseUp(renderable: Renderable) {
  return (renderable as unknown as MouseInternals)._mouseListeners?.up;
}

export function installWorkingDirectoryMenu(context: Context) {
  const patched = new Map<Renderable, PatchedLocation>();
  const actions: WorkingDirectoryActions = {
    copy: (path) => context.renderer.copyToClipboardOSC52(path),
    open: (path) => open(path),
    vscode: (path) => open(path, { app: { name: "code", arguments: ["--reuse-window"] } }),
    workspaces: () => context.keymap.dispatch("session.move"),
    success: (message) => context.ui.toast.show({ message, variant: "info" }),
  };

  const showMenu = async () => {
    if (context.renderer.getSelection()?.getSelectedText()) return;
    const directory = currentDirectory(context);
    const action = await context.ui.dialog.select<WorkingDirectoryAction>({
      title: "Working directory",
      options: workingDirectoryOptions(directory),
    });
    if (!action) return;
    await runWorkingDirectoryAction(action, directory, actions).catch((error) => {
      context.ui.toast.show({
        title: action === "vscode" ? "Failed to open VS Code" : "Working directory action failed",
        message: errorMessage(error),
        variant: "error",
      });
    });
  };

  const patchLocation = (renderable: Renderable | undefined) => {
    if (!renderable || renderable.isDestroyed) return;
    const current = mouseUp(renderable);
    const previous = patched.get(renderable);
    if (previous?.enhanced === current) return;
    const enhanced = (_event: MouseEvent) => void showMenu();
    patched.set(renderable, { native: current, enhanced });
    renderable.onMouseUp = enhanced;
  };

  const reconcile = (_buffer: OptimizedBuffer) => {
    patchLocation(context.renderer.root.findDescendantById("prompt.footer.location"));
    patchLocation(context.renderer.root.findDescendantById("sidebar.footer.location"));
  };

  context.renderer.addPostProcessFn(reconcile);
  return () => {
    context.renderer.removePostProcessFn(reconcile);
    for (const [renderable, handlers] of patched) {
      if (!renderable.isDestroyed && mouseUp(renderable) === handlers.enhanced) {
        renderable.onMouseUp = handlers.native;
      }
    }
    patched.clear();
  };
}
