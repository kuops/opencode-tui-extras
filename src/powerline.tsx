/** @jsxImportSource @opentui/solid */
import {
  RGBA,
  type OptimizedBuffer,
  type Renderable,
} from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/plugin";

type Color = Pick<RGBA, "toInts">;
type CellBuffer = Pick<OptimizedBuffer, "buffers" | "width" | "height">;
type ResolvedCells = readonly (readonly string[])[];

export interface PowerlineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PowerlinePalette {
  foreground: (background: Color) => Color;
  transparent: Color;
  location: Color;
  branch: Color;
  activity: Color;
  context: (percentage: number) => Color;
  cost: Color;
  command: Color;
  neutral: Color;
}

interface Boundary {
  start: number;
  end: number;
  separator: number;
  connected: boolean;
}

interface Segment {
  start: number;
  end: number;
  before?: Boundary;
}

type SegmentKind = "location" | "activity" | "context" | "cost" | "command" | "neutral";

interface StyledSegment extends Segment {
  background: Color;
  kind: SegmentKind;
}

const SPACE = " ".codePointAt(0)!;
const MIDDLE_DOT = "·".codePointAt(0)!;
const RIGHT_SEPARATOR = "".codePointAt(0)!;
const LEFT_SEPARATOR = "".codePointAt(0)!;
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const BLACK = RGBA.fromInts(0, 0, 0);
const WHITE = RGBA.fromInts(255, 255, 255);

function luminance(color: Color) {
  const [red, green, blue] = color.toInts().slice(0, 3).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: Color, second: Color) {
  const left = luminance(first);
  const right = luminance(second);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

export function readablePowerlineForeground(background: Color, preferred: Color, alternate: Color): Color {
  for (const candidate of [preferred, alternate]) {
    if (candidate.toInts()[3] === 255 && contrast(background, candidate) >= 4.5) return candidate;
  }
  return contrast(background, BLACK) >= contrast(background, WHITE) ? BLACK : WHITE;
}

function blank(codepoint: number) {
  return codepoint === 0 || codepoint === SPACE;
}

function codepointAt(buffer: CellBuffer, x: number, y: number) {
  return buffer.buffers.char[y * buffer.width + x] ?? SPACE;
}

function setCodepoint(buffer: CellBuffer, x: number, y: number, codepoint: number) {
  buffer.buffers.char[y * buffer.width + x] = codepoint;
}

function displayAt(buffer: CellBuffer, x: number, y: number, resolved?: ResolvedCells) {
  const value = resolved?.[y]?.[x];
  if (value !== undefined) return value;
  const codepoint = codepointAt(buffer, x, y);
  if (blank(codepoint)) return " ";
  return codepoint > 0x10ffff ? "\0" : String.fromCodePoint(codepoint);
}

function blankAt(buffer: CellBuffer, x: number, y: number, resolved?: ResolvedCells) {
  return displayAt(buffer, x, y, resolved) === " ";
}

function contains(rect: PowerlineRect | undefined, x: number, y: number) {
  return Boolean(
    rect &&
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height,
  );
}

function setColor(channels: Uint16Array, cell: number, color: Color) {
  const value = color.toInts();
  const offset = cell * 4;
  channels[offset] = value[0];
  channels[offset + 1] = value[1];
  channels[offset + 2] = value[2];
  channels[offset + 3] = value[3];
}

function paintCell(buffer: CellBuffer, x: number, y: number, foreground: Color, background: Color) {
  if (x < 0 || x >= buffer.width || y < 0 || y >= buffer.height) return;
  const cell = y * buffer.width + x;
  setColor(buffer.buffers.fg, cell, foreground);
  setColor(buffer.buffers.bg, cell, background);
}

function clampRect(buffer: CellBuffer, rect: PowerlineRect): PowerlineRect | undefined {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const right = Math.min(buffer.width, Math.ceil(rect.x + rect.width));
  const bottom = Math.min(buffer.height, Math.ceil(rect.y + rect.height));
  if (right <= x || bottom <= y) return undefined;
  return { x, y, width: right - x, height: bottom - y };
}

function trimEnd(buffer: CellBuffer, y: number, start: number, end: number, resolved?: ResolvedCells) {
  let value = end;
  while (value > start && blankAt(buffer, value - 1, y, resolved)) value -= 1;
  return value;
}

function rowSegments(
  buffer: CellBuffer,
  y: number,
  start: number,
  end: number,
  resolved?: ResolvedCells,
  location?: PowerlineRect,
): Segment[] {
  const segments: Segment[] = [];
  let before: Boundary | undefined;
  let cursor = start;

  while (cursor < end) {
    while (cursor < end && blankAt(buffer, cursor, y, resolved)) cursor += 1;
    if (cursor >= end) break;

    const segmentStart = cursor;
    let completed = false;
    while (cursor < end) {
      const character = displayAt(buffer, cursor, y, resolved);
      if (character === String.fromCodePoint(MIDDLE_DOT)) {
        if (contains(location, cursor, y)) {
          cursor += 1;
          continue;
        }
        const segmentEnd = trimEnd(buffer, y, segmentStart, cursor, resolved);
        if (segmentEnd > segmentStart) segments.push({ start: segmentStart, end: segmentEnd, before });
        const separator = cursor;
        cursor += 1;
        while (cursor < end && blankAt(buffer, cursor, y, resolved)) cursor += 1;
        before = { start: segmentEnd, end: cursor, separator, connected: true };
        completed = true;
        break;
      }

      if (character === " ") {
        const gapStart = cursor;
        while (cursor < end && blankAt(buffer, cursor, y, resolved)) cursor += 1;
        const gapLength = cursor - gapStart;
        const remainsInLocation = contains(location, segmentStart, y) && contains(location, cursor, y);
        if (remainsInLocation) continue;
        const leavesLocation =
          cursor < end &&
          location !== undefined &&
          y >= location.y &&
          y < location.y + location.height &&
          segmentStart >= location.x &&
          segmentStart < location.x + location.width &&
          cursor >= location.x + location.width;
        if (cursor < end && (gapLength >= 2 || leavesLocation)) {
          const segmentEnd = trimEnd(buffer, y, segmentStart, gapStart, resolved);
          if (segmentEnd > segmentStart) segments.push({ start: segmentStart, end: segmentEnd, before });
          before = {
            start: segmentEnd,
            end: cursor,
            separator: gapLength <= 3 ? gapStart + Math.ceil((gapLength - 1) / 2) : cursor - 2,
            connected: gapLength <= 3,
          };
          completed = true;
          break;
        }
        continue;
      }

      cursor += 1;
    }

    if (!completed) {
      const segmentEnd = trimEnd(buffer, y, segmentStart, end, resolved);
      if (segmentEnd > segmentStart) segments.push({ start: segmentStart, end: segmentEnd, before });
      break;
    }
  }

  return segments;
}

function segmentText(buffer: CellBuffer, y: number, segment: Segment, resolved?: ResolvedCells) {
  let value = "";
  for (let x = segment.start; x < segment.end; x += 1) {
    const character = displayAt(buffer, x, y, resolved);
    value += character === "\0" ? " " : character;
  }
  return value;
}

function overlaps(segment: Segment, rect: PowerlineRect | undefined, y: number) {
  if (!rect || y < rect.y || y >= rect.y + rect.height) return false;
  return segment.start < rect.x + rect.width && segment.end > rect.x;
}

function contextPercentage(text: string) {
  const parenthesized = text.match(/\((\d+(?:\.\d+)?)%\)/);
  if (parenthesized) return Number(parenthesized[1]);
  const plain = text.match(/(?:^|\s)(\d+(?:\.\d+)?)%(?:\s|$)/);
  return plain ? Number(plain[1]) : undefined;
}

function addLeadingPadding(
  buffer: CellBuffer,
  y: number,
  segment: Segment,
  resolved?: ResolvedCells,
): Segment {
  const boundary = segment.before;
  if (
    !boundary?.connected ||
    boundary.end - boundary.start !== 2 ||
    segment.end + 1 >= buffer.width ||
    !blankAt(buffer, segment.end, y, resolved) ||
    !blankAt(buffer, segment.end + 1, y, resolved)
  ) {
    return segment;
  }
  for (let x = segment.end - 1; x >= segment.start; x -= 1) {
    setCodepoint(buffer, x + 1, y, codepointAt(buffer, x, y));
  }
  setCodepoint(buffer, segment.start, y, SPACE);
  return { ...segment, end: segment.end + 2 };
}

function styleLocationSegment(
  buffer: CellBuffer,
  y: number,
  segment: Segment,
  location: PowerlineRect,
  palette: PowerlinePalette,
  resolved?: ResolvedCells,
): StyledSegment {
  let colon = -1;
  for (let x = segment.end - 1; x > segment.start; x -= 1) {
    if (displayAt(buffer, x, y, resolved) === ":") {
      colon = x;
      break;
    }
  }

  if (colon < 0) {
    for (let x = segment.start; x < segment.end; x += 1) {
      paintCell(buffer, x, y, palette.foreground(palette.location), palette.location);
    }
    return { ...segment, kind: "location", background: palette.location };
  }

  const directory = Array.from(
    { length: colon - segment.start },
    (_, index) => codepointAt(buffer, segment.start + index, y),
  );
  const branch = Array.from(
    { length: segment.end - colon - 1 },
    (_, index) => codepointAt(buffer, colon + 1 + index, y),
  );
  const paddedEnd = segment.end + 4;
  const canPad = paddedEnd < location.x + location.width;

  if (canPad) {
    let cursor = segment.start;
    const write = (codepoint: number, background: Color) => {
      setCodepoint(buffer, cursor, y, codepoint);
      paintCell(buffer, cursor, y, palette.foreground(background), background);
      cursor += 1;
    };
    write(SPACE, palette.location);
    for (const codepoint of directory) write(codepoint, palette.location);
    write(SPACE, palette.location);
    setCodepoint(buffer, cursor, y, RIGHT_SEPARATOR);
    paintCell(buffer, cursor, y, palette.location, palette.branch);
    cursor += 1;
    write(SPACE, palette.branch);
    for (const codepoint of branch) write(codepoint, palette.branch);
    write(SPACE, palette.branch);
    return { ...segment, end: cursor, kind: "location", background: palette.branch };
  }

  for (let x = segment.start; x < colon; x += 1) {
    paintCell(buffer, x, y, palette.foreground(palette.location), palette.location);
  }
  setCodepoint(buffer, colon, y, RIGHT_SEPARATOR);
  paintCell(buffer, colon, y, palette.location, palette.branch);
  for (let x = colon + 1; x < segment.end; x += 1) {
    paintCell(buffer, x, y, palette.foreground(palette.branch), palette.branch);
  }
  return { ...segment, kind: "location", background: palette.branch };
}

function styleSegment(
  buffer: CellBuffer,
  y: number,
  segment: Segment,
  palette: PowerlinePalette,
  location: PowerlineRect | undefined,
  resolved?: ResolvedCells,
): StyledSegment {
  const text = segmentText(buffer, y, segment, resolved);
  const percentage = contextPercentage(text);
  if (overlaps(segment, location, y) && location) {
    return styleLocationSegment(buffer, y, segment, location, palette, resolved);
  }
  const value = (() => {
    if (/subagents?|shells?|interrupt|shell mode|worktree/i.test(text)) {
      return { kind: "activity" as const, background: palette.activity };
    }
    if (percentage !== undefined) {
      return { kind: "context" as const, background: palette.context(percentage) };
    }
    if (/[$€£¥]\s?\d/.test(text)) {
      return { kind: "cost" as const, background: palette.cost };
    }
    if (/\bcommands?\b/i.test(text)) {
      return { kind: "command" as const, background: palette.command };
    }
    return { kind: "neutral" as const, background: palette.neutral };
  })();
  const padded = value.kind === "command" ? addLeadingPadding(buffer, y, segment, resolved) : segment;

  for (let x = padded.start; x < padded.end; x += 1) {
    paintCell(buffer, x, y, palette.foreground(value.background), value.background);
  }
  return { ...padded, ...value };
}

function paintBoundary(
  buffer: CellBuffer,
  y: number,
  previous: StyledSegment,
  current: StyledSegment,
  palette: PowerlinePalette,
) {
  const boundary = current.before;
  if (!boundary) return;

  if (previous.kind === "location") {
    if (boundary.connected && boundary.end - boundary.start === 1) {
      setCodepoint(buffer, boundary.separator, y, RIGHT_SEPARATOR);
      paintCell(buffer, boundary.separator, y, previous.background, current.background);
      return;
    }
    const trailing = Math.min(boundary.end - 1, previous.end);
    setCodepoint(buffer, trailing, y, RIGHT_SEPARATOR);
    paintCell(buffer, trailing, y, previous.background, palette.transparent);

    const leading = boundary.separator === trailing ? boundary.end - 1 : boundary.separator;
    setCodepoint(buffer, leading, y, LEFT_SEPARATOR);
    paintCell(buffer, leading, y, current.background, palette.transparent);
    for (let x = leading + 1; x < boundary.end; x += 1) {
      paintCell(buffer, x, y, palette.foreground(current.background), current.background);
    }
    return;
  }

  if (boundary.connected) {
    for (let x = boundary.start; x < boundary.separator; x += 1) {
      paintCell(buffer, x, y, palette.foreground(previous.background), previous.background);
    }
    for (let x = boundary.separator + 1; x < boundary.end; x += 1) {
      paintCell(buffer, x, y, palette.foreground(current.background), current.background);
    }
  } else {
    if (boundary.separator > boundary.start) {
      paintCell(
        buffer,
        boundary.start,
        y,
        palette.foreground(previous.background),
        previous.background,
      );
    }
    for (let x = boundary.separator + 1; x < boundary.end; x += 1) {
      paintCell(buffer, x, y, palette.foreground(current.background), current.background);
    }
  }

  setCodepoint(buffer, boundary.separator, y, LEFT_SEPARATOR);
  paintCell(
    buffer,
    boundary.separator,
    y,
    current.background,
    boundary.connected ? previous.background : palette.transparent,
  );
}

export function stylePowerlineFooter(
  buffer: CellBuffer,
  rectValue: PowerlineRect,
  palette: PowerlinePalette,
  locationValue?: PowerlineRect,
  resolved?: ResolvedCells,
) {
  const rect = clampRect(buffer, rectValue);
  if (!rect) return 0;
  const location = locationValue ? clampRect(buffer, locationValue) : undefined;
  let count = 0;

  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    const segments = rowSegments(buffer, y, rect.x, rect.x + rect.width, resolved, location);
    if (segments.length === 0) continue;
    const styled = segments.map((segment) => styleSegment(buffer, y, segment, palette, location, resolved));

    for (let index = 1; index < styled.length; index += 1) {
      paintBoundary(buffer, y, styled[index - 1], styled[index], palette);
    }

    const first = styled[0];
    if (first.kind !== "location" && first.start > rect.x) {
      setCodepoint(buffer, first.start - 1, y, LEFT_SEPARATOR);
      paintCell(buffer, first.start - 1, y, first.background, palette.transparent);
    }

    const last = styled.at(-1)!;
    if (last.kind === "location" && last.end < rect.x + rect.width) {
      setCodepoint(buffer, last.end, y, RIGHT_SEPARATOR);
      paintCell(buffer, last.end, y, last.background, palette.transparent);
    } else if (
      last.kind !== "location" &&
      last.end < rect.x + rect.width &&
      blankAt(buffer, last.end, y, resolved)
    ) {
      paintCell(buffer, last.end, y, palette.foreground(last.background), last.background);
    }
    count += styled.length;
  }

  return count;
}

export function guardPowerlinePostProcess<T>(
  process: (value: T) => void,
  onFailure: (error: unknown) => void,
) {
  let enabled = true;
  return (value: T) => {
    if (!enabled) return;
    try {
      process(value);
    } catch (error) {
      enabled = false;
      onFailure(error);
    }
  };
}

export function resolvePowerlineCells(buffer: OptimizedBuffer): ResolvedCells {
  const continuationFlag = 0xc0000000 | 0;
  const flagMask = 0xc0000000 | 0;
  const text = new TextDecoder().decode(buffer.getRealCharBytes(true)).split("\n");
  return Array.from({ length: buffer.height }, (_, y) => {
    const characters = [...graphemeSegmenter.segment(text[y] ?? "")].map((item) => item.segment);
    let index = 0;
    return Array.from({ length: buffer.width }, (_, x) => {
      const codepoint = buffer.buffers.char[y * buffer.width + x];
      if ((codepoint & flagMask) === continuationFlag) return "\0";
      return characters[index++] ?? " ";
    });
  });
}

function rect(renderable: Renderable): PowerlineRect {
  return {
    x: renderable.screenX,
    y: renderable.screenY,
    width: renderable.width,
    height: renderable.height,
  };
}

export function promptFooterBeforeSidebar(sidebar: PowerlineRect): PowerlineRect | undefined {
  if (sidebar.x <= 0 || sidebar.height <= 0) return undefined;
  return { x: 0, y: sidebar.y, width: sidebar.x, height: sidebar.height };
}

export function runningPromptFooter(buffer: CellBuffer): PowerlineRect | undefined {
  const expected = "esc interrupt";
  for (let y = buffer.height - 1; y >= 0; y -= 1) {
    let matched = 0;
    for (let x = 0; x < buffer.width; x += 1) {
      const codepoint = codepointAt(buffer, x, y);
      const character = codepoint <= 0x7f ? String.fromCodePoint(codepoint).toLowerCase() : "";
      matched = character === expected[matched] ? matched + 1 : character === expected[0] ? 1 : 0;
      if (matched === expected.length) return { x: 0, y, width: buffer.width, height: 1 };
    }
  }
  return undefined;
}

function footerRow(renderable: Renderable) {
  let current = renderable;
  while (
    current.parent &&
    current.parent.visible &&
    current.parent.screenY === current.screenY &&
    current.parent.height === current.height
  ) {
    current = current.parent;
  }
  return current;
}

function palette(context: Context): PowerlinePalette {
  const categorical = context.theme.categorical;
  const preferredForeground = context.theme.background.base;
  const alternateForeground = context.theme.text.base;
  return {
    foreground: (background) =>
      readablePowerlineForeground(background, preferredForeground, alternateForeground),
    transparent: context.options.transparent === true
      ? RGBA.fromInts(0, 0, 0, 0)
      : context.theme.background.base,
    location: context.theme.text.feedback.info.base,
    branch: categorical[0]?.[200] ?? context.theme.hue.accent[200],
    activity: context.theme.hue.accent[200],
    context: (percentage) =>
      percentage >= 90
        ? context.theme.text.feedback.error.base
        : percentage >= 80
          ? context.theme.text.feedback.warning.base
          : context.theme.text.feedback.success.base,
    cost: categorical[0]?.[200] ?? context.theme.hue.accent[200],
    command: context.theme.hue.interactive[200],
    neutral: context.theme.hue.neutral[400],
  };
}

export function installPowerline(context: Context) {
  let promptLocation: Renderable | undefined;
  let promptFooter: Renderable | undefined;
  let sidebarLocation: Renderable | undefined;

  const processFrame = (buffer: OptimizedBuffer) => {
    if (context.keymap.mode.current() === "modal") return;
    const colors = palette(context);
    if (!promptLocation || promptLocation.isDestroyed) {
      promptLocation = context.renderer.root.findDescendantById("prompt.footer.location");
    }
    if (promptLocation?.visible && !promptLocation.isDestroyed) {
      promptFooter = footerRow(promptLocation);
    }
    if (promptFooter?.isDestroyed || !promptFooter?.visible) promptFooter = undefined;

    if (!sidebarLocation || sidebarLocation.isDestroyed) {
      sidebarLocation = context.renderer.root.findDescendantById("sidebar.footer.location");
    }
    const sidebarRect = sidebarLocation?.visible && !sidebarLocation.isDestroyed
      ? rect(sidebarLocation)
      : undefined;
    const promptRect = promptFooter
      ? rect(promptFooter)
      : sidebarRect
        ? promptFooterBeforeSidebar(sidebarRect)
        : runningPromptFooter(buffer);
    const resolved = promptRect || sidebarRect ? resolvePowerlineCells(buffer) : undefined;
    if (promptRect) {
      stylePowerlineFooter(
        buffer,
        promptRect,
        colors,
        promptLocation?.visible && !promptLocation.isDestroyed ? rect(promptLocation) : undefined,
        resolved,
      );
    }

    if (sidebarRect) {
      stylePowerlineFooter(buffer, sidebarRect, colors, sidebarRect, resolved);
    }
  };
  let postProcess: (buffer: OptimizedBuffer) => void;
  postProcess = guardPowerlinePostProcess(processFrame, (error) => {
    console.error("Powerline footer styling disabled after a render failure", error);
    queueMicrotask(() => {
      context.renderer.removePostProcessFn(postProcess);
      context.renderer.requestRender();
    });
  });

  context.renderer.addPostProcessFn(postProcess);
  return () => {
    context.renderer.removePostProcessFn(postProcess);
    promptLocation = undefined;
    promptFooter = undefined;
    sidebarLocation = undefined;
  };
}
