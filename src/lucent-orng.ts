import { RGBA, type OptimizedBuffer, type Renderable } from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/plugin";

type Theme = Context["theme"];
type BackgroundRenderable = Renderable & { backgroundColor: RGBA };
type PatchedPanel = { original: RGBA; applied: RGBA };

const LUCENT_ORNG_BORDER = [236, 91, 43, 255] as const;
const LUCENT_ORNG_DIALOG = {
  dark: RGBA.fromInts(42, 26, 21, 255),
  light: RGBA.fromInts(255, 245, 240, 255),
} as const;

function channelsEqual(first: readonly number[], second: readonly number[]) {
  return first.length === second.length && first.every((channel, index) => channel === second[index]);
}

function channelsMatchAt(channels: Uint16Array, offset: number, target: readonly number[]) {
  return channels[offset] === target[0] &&
    channels[offset + 1] === target[1] &&
    channels[offset + 2] === target[2] &&
    channels[offset + 3] === target[3];
}

function luminance(channels: readonly number[]) {
  const [red, green, blue] = channels.slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: readonly number[], second: readonly number[]) {
  const left = luminance(first);
  const right = luminance(second);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function supportsBackground(renderable: Renderable): renderable is BackgroundRenderable {
  return "backgroundColor" in renderable;
}

function isScrollBox(renderable: Renderable) {
  return "verticalScrollBar" in renderable && "content" in renderable;
}

export function findLucentOrngAutocompleteSurface(root: Renderable) {
  const queue = [...root.getChildren()];
  while (queue.length > 0) {
    const renderable = queue.shift()!;
    if (!renderable.visible || renderable.isDestroyed) continue;
    if (renderable.zIndex === 100) {
      const surface = renderable.getChildren().find((child) =>
        child.visible &&
        !child.isDestroyed &&
        child.width > 0 &&
        child.height > 0 &&
        supportsBackground(child) &&
        isScrollBox(child)
      );
      if (surface && supportsBackground(surface)) return surface;
    }
    queue.push(...renderable.getChildren());
  }
  return undefined;
}

export function isLucentOrngTheme(theme: Theme) {
  return theme.background.base.toInts()[3] === 0 &&
    theme.background.raised.base.toInts()[3] === 0 &&
    channelsEqual(theme.border.base.toInts(), LUCENT_ORNG_BORDER);
}

export function fixLucentOrngBadgeContrast(
  buffer: Pick<OptimizedBuffer, "buffers">,
  theme: Theme,
  mode: "dark" | "light",
) {
  const badge = theme.hue.accent[mode === "light" ? 300 : 200].toInts();
  if (badge[3] === 0) return 0;
  const black = [0, 0, 0, 255] as const;
  const white = [255, 255, 255, 255] as const;
  const readable = contrast(badge, black) >= contrast(badge, white) ? black : white;
  const { fg, bg } = buffer.buffers;
  let fixed = 0;
  for (let offset = 0; offset < bg.length; offset += 4) {
    if (!channelsMatchAt(bg, offset, badge)) continue;
    const foreground = [...fg.slice(offset, offset + 4)];
    if (contrast(foreground, badge) >= 4.5) continue;
    fg[offset] = readable[0];
    fg[offset + 1] = readable[1];
    fg[offset + 2] = readable[2];
    fg[offset + 3] = readable[3];
    fixed += 1;
  }
  return fixed;
}

export function clearLucentOrngAutocompleteBackground(
  buffer: Pick<OptimizedBuffer, "buffers" | "width" | "height">,
  surface: Renderable,
  opaque: RGBA,
) {
  const target = opaque.toInts();
  const { bg } = buffer.buffers;
  const left = Math.max(0, Math.floor(surface.screenX));
  const top = Math.max(0, Math.floor(surface.screenY));
  const right = Math.min(buffer.width, Math.ceil(surface.screenX + surface.width));
  const bottom = Math.min(buffer.height, Math.ceil(surface.screenY + surface.height));
  let cleared = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * buffer.width + x) * 4;
      if (!channelsMatchAt(bg, offset, target)) continue;
      bg[offset] = 0;
      bg[offset + 1] = 0;
      bg[offset + 2] = 0;
      bg[offset + 3] = 0;
      cleared += 1;
    }
  }
  return cleared;
}

export function installLucentOrngTransparencyFix(context: Context) {
  const patchedPanels = new Map<BackgroundRenderable, PatchedPanel>();

  const restorePanels = (active = new Set<BackgroundRenderable>()) => {
    for (const [panel, patch] of patchedPanels) {
      if (active.has(panel)) continue;
      if (!panel.isDestroyed && panel.backgroundColor.equals(patch.applied)) {
        panel.backgroundColor = patch.original;
      }
      patchedPanels.delete(panel);
    }
  };

  const makeOpaque = (surface: BackgroundRenderable, opaque: RGBA) => {
    const existing = patchedPanels.get(surface);
    if (existing) existing.applied = opaque;
    else patchedPanels.set(surface, { original: surface.backgroundColor, applied: opaque });
    if (!surface.backgroundColor.equals(opaque)) surface.backgroundColor = opaque;
  };

  const process = (buffer: OptimizedBuffer, panel?: Renderable) => {
    if (!isLucentOrngTheme(context.theme)) {
      restorePanels();
      return;
    }

    fixLucentOrngBadgeContrast(buffer, context.theme, context.themeMode);
    const backgroundPanel = panel && supportsBackground(panel) ? panel : undefined;
    const opaque = LUCENT_ORNG_DIALOG[context.themeMode];
    const autocomplete = context.keymap.mode.current() === "autocomplete"
      ? findLucentOrngAutocompleteSurface(context.renderer.root)
      : undefined;
    const active = new Set([backgroundPanel, autocomplete].filter((value) => value !== undefined));
    restorePanels(active);
    if (backgroundPanel) makeOpaque(backgroundPanel, opaque);
    if (autocomplete) {
      makeOpaque(autocomplete, opaque);
      clearLucentOrngAutocompleteBackground(buffer, autocomplete, opaque);
    }
  };

  return {
    process,
    dispose: () => restorePanels(),
  };
}
