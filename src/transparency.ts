import { RGBA, type OptimizedBuffer } from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/plugin";

type Color = Pick<RGBA, "toInts">;
type ColorChannels = Uint16Array;
const UPPER_HALF_BLOCK = "▀".codePointAt(0)!;
const SPACE = " ".codePointAt(0)!;
const MIN_PROMPT_SHADOW_WIDTH = 8;

function matches(channels: ColorChannels, offset: number, color: readonly number[]) {
  return (
    channels[offset] === color[0] &&
    channels[offset + 1] === color[1] &&
    channels[offset + 2] === color[2] &&
    channels[offset + 3] === color[3]
  );
}

export function clearThemeBackgrounds(
  buffer: Pick<OptimizedBuffer, "buffers">,
  colors: readonly Color[],
) {
  const { bg } = buffer.buffers;
  const targets = colors.map((color) => color.toInts());
  let cleared = 0;

  for (let offset = 0; offset < bg.length; offset += 4) {
    if (!targets.some((target) => matches(bg, offset, target))) continue;
    bg[offset] = 0;
    bg[offset + 1] = 0;
    bg[offset + 2] = 0;
    bg[offset + 3] = 0;
    cleared += 1;
  }

  return cleared;
}

export function clearPromptShadow(
  buffer: Pick<OptimizedBuffer, "buffers" | "width" | "height">,
  color: Color,
) {
  const { char, fg } = buffer.buffers;
  const target = color.toInts();
  let cleared = 0;

  for (let y = 0; y < buffer.height; y += 1) {
    let start = -1;
    for (let x = 0; x <= buffer.width; x += 1) {
      const cell = y * buffer.width + x;
      const offset = cell * 4;
      const matchesShadow =
        x < buffer.width && char[cell] === UPPER_HALF_BLOCK && matches(fg, offset, target);
      if (matchesShadow && start === -1) {
        start = x;
        continue;
      }
      if (matchesShadow || start === -1) continue;

      if (x - start >= MIN_PROMPT_SHADOW_WIDTH) {
        for (let shadowX = start; shadowX < x; shadowX += 1) {
          const shadowCell = y * buffer.width + shadowX;
          char[shadowCell] = SPACE;
          fg[shadowCell * 4 + 3] = 0;
          cleared += 1;
        }
      }
      start = -1;
    }
  }

  return cleared;
}

export function installTransparency(context: Context) {
  const transparent = RGBA.fromInts(0, 0, 0, 0);
  let activeTheme = context.theme;
  let activeMode = context.themeMode;
  let disposed = false;
  let backgroundSyncQueued = false;

  const syncRendererBackground = () => {
    if (disposed || backgroundSyncQueued) return;
    backgroundSyncQueued = true;
    queueMicrotask(() => {
      backgroundSyncQueued = false;
      if (!disposed) context.renderer.setBackgroundColor(transparent);
    });
  };

  const postProcess = (buffer: OptimizedBuffer) => {
    const theme = context.theme;
    const mode = context.themeMode;
    if (theme !== activeTheme || mode !== activeMode) {
      activeTheme = theme;
      activeMode = mode;
      syncRendererBackground();
    }

    // Dialogs use the same raised color as the sidebar in many themes. Keep
    // modal frames untouched so command palettes retain their intended panel.
    if (context.keymap.mode.current() === "modal") return;
    const promptBackground = theme.decrease(theme.background.raised.base);
    clearPromptShadow(buffer, promptBackground);
    clearThemeBackgrounds(buffer, [
      theme.background.base,
      theme.background.raised.base,
      theme.decrease(theme.background.base),
      promptBackground,
    ]);
  };

  context.renderer.setBackgroundColor(transparent);
  context.renderer.addPostProcessFn(postProcess);

  return () => {
    disposed = true;
    context.renderer.removePostProcessFn(postProcess);
    context.renderer.setBackgroundColor(context.theme.background.base);
  };
}
