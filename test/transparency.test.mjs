import assert from "node:assert/strict";
import test from "node:test";
import { RGBA, TextAttributes } from "@opentui/core";
import {
  clearModalDecorations,
  clearOutsideRect,
  clearPromptShadow,
  clearThemeBackgrounds,
  modalPanelRect,
  readableTransparentForeground,
  suppressModalBackdropFrame,
  syncModalImageOpacity,
  transparentSurface,
} from "../dist/transparency.js";
import { setupV2 } from "../dist/tui-v2.js";

const color = (red, green, blue, alpha = 255) => ({
  toInts: () => [red, green, blue, alpha],
});

function cellBuffer(width, height, input = {}) {
  const char = input.char ?? new Uint32Array(width * height);
  const fg = input.fg ?? new Uint16Array(width * height * 4);
  const bg = input.bg ?? new Uint16Array(width * height * 4);
  const attributes = input.attributes ?? new Uint32Array(width * height);
  return {
    width,
    height,
    buffers: { char, fg, bg, attributes },
  };
}

test("clears base and raised backgrounds without changing text", () => {
  const base = [40, 44, 52, 255];
  const raised = [33, 37, 43, 255];
  const accent = [86, 182, 194, 255];
  const foregrounds = [
    171, 178, 191, 255,
    33, 37, 43, 255,
    92, 99, 112, 255,
  ];
  const fg = new Uint16Array(foregrounds);
  const bg = new Uint16Array([...base, ...accent, ...raised]);

  const cleared = clearThemeBackgrounds(
    { buffers: { fg, bg } },
    [color(...base), color(...raised)],
  );

  assert.equal(cleared, 2);
  assert.deepEqual([...bg], [0, 0, 0, 0, ...accent, 0, 0, 0, 0]);
  assert.deepEqual([...fg], foregrounds);
});

test("raises light-theme text contrast only on backgrounds made transparent", () => {
  const white = [250, 250, 250, 255];
  const accent = [86, 182, 194, 255];
  const black = [20, 20, 20, 255];
  const fg = new Uint16Array([...black, ...black]);
  const bg = new Uint16Array([...white, ...accent]);

  clearThemeBackgrounds(
    { buffers: { fg, bg } },
    [color(...white)],
    { background: color(25, 27, 31), foreground: color(220, 220, 220) },
  );

  assert.deepEqual([...fg.slice(0, 4)], [220, 220, 220, 255]);
  assert.deepEqual([...fg.slice(4)], black);
  assert.deepEqual([...bg], [0, 0, 0, 0, ...accent]);
});

test("raises contrast for text whose background was already transparent", () => {
  const foreground = [56, 58, 66, 255];
  const fg = new Uint16Array(foreground);
  const bg = new Uint16Array([0, 0, 0, 0]);
  const cleared = clearThemeBackgrounds(
    { buffers: { fg, bg } },
    [],
    { background: color(25, 27, 31), foreground: color(235, 235, 235) },
  );
  assert.equal(cleared, 0);
  assert.deepEqual([...fg], [235, 235, 235, 255]);
});

test("keeps black light-theme text on a light transparent terminal surface", () => {
  const foreground = [20, 20, 20, 255];
  const readable = readableTransparentForeground(foreground, {
    background: color(250, 250, 250),
    foreground: color(20, 20, 20),
  });
  assert.equal(readable, foreground);
});

test("only adapts text when the theme mode opposes the terminal surface", () => {
  const dark = color(25, 27, 31);
  const light = color(235, 235, 235);
  assert.equal(transparentSurface(dark, light, "light").adapt, true);
  assert.equal(transparentSurface(dark, light, "dark").adapt, false);
  assert.equal(transparentSurface(light, dark, "light").adapt, false);
  assert.equal(transparentSurface(light, dark, "dark").adapt, true);

  const muted = [92, 99, 112, 255];
  assert.equal(readableTransparentForeground(muted, transparentSurface(dark, light, "dark")), muted);
});

test("clears a prompt shadow run without touching isolated block characters", () => {
  const width = 12;
  const shadow = color(28, 31, 36);
  const shadowChannels = shadow.toInts();
  const char = new Uint32Array(width * 2);
  const fg = new Uint16Array(width * 2 * 4);
  const bg = new Uint16Array(width * 2 * 4);
  const block = "▀".codePointAt(0);

  char[0] = block;
  fg.set(shadowChannels, 0);
  for (let x = 2; x < width; x += 1) {
    const cell = width + x;
    char[cell] = block;
    fg.set(shadowChannels, cell * 4);
  }

  const cleared = clearPromptShadow({ width, height: 2, buffers: { char, fg, bg } }, shadow);

  assert.equal(cleared, width - 2);
  assert.equal(char[0], block);
  assert.equal(fg[3], 255);
  for (let x = 2; x < width; x += 1) {
    const cell = width + x;
    assert.equal(char[cell], " ".codePointAt(0));
    assert.equal(fg[cell * 4 + 3], 0);
  }
});

test("registers transparency only when the option is enabled", () => {
  const registrations = [];
  const removals = [];
  const backgrounds = [];
  const lifecyclePasses = new Set();
  let slotDisposals = 0;
  const theme = {
    background: {
      base: color(40, 44, 52),
      raised: { base: color(33, 37, 43) },
    },
  };
  const context = (enabled) => ({
    options: { transparent: enabled },
    theme,
    themeMode: "dark",
    keymap: { mode: { current: () => "normal" } },
    renderer: {
      root: { getChildren: () => [], onLifecyclePass: null },
      getLifecyclePasses: () => lifecyclePasses,
      registerLifecyclePass: (renderable) => lifecyclePasses.add(renderable),
      unregisterLifecyclePass: (renderable) => lifecyclePasses.delete(renderable),
      setBackgroundColor: (background) => backgrounds.push(background),
      addPostProcessFn: (callback) => registrations.push(callback),
      removePostProcessFn: (callback) => removals.push(callback),
      getPalette: async () => ({ palette: [], defaultForeground: "#ffffff", defaultBackground: "#000000" }),
      requestRender: () => {},
    },
    ui: {
      slot: () => () => {
        slotDisposals += 1;
      },
    },
  });

  const disposeDisabled = setupV2(context(false));
  assert.equal(registrations.length, 0);
  disposeDisabled();

  const disposeEnabled = setupV2(context(true));
  assert.equal(registrations.length, 1);
  assert.equal(backgrounds.length, 1);
  disposeEnabled();

  assert.deepEqual(removals, registrations);
  assert.equal(backgrounds.at(-1), theme.background.base);
  assert.equal(slotDisposals, 2);
});

test("keeps only the active modal panel opaque", () => {
  const width = 5;
  const height = 3;
  const opaque = [40, 44, 52, 255];
  const bg = new Uint16Array(width * height * 4);
  const fg = new Uint16Array(width * height * 4);
  for (let cell = 0; cell < width * height; cell += 1) {
    bg.set(opaque, cell * 4);
    fg.set([230, 230, 230, 255], cell * 4);
  }
  const cleared = clearOutsideRect(
    { width, height, buffers: { fg, bg } },
    { x: 1, y: 1, width: 3, height: 1 },
    transparentSurface(color(0, 0, 0), color(255, 255, 255), "dark"),
  );
  assert.equal(cleared, 12);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = bg[(y * width + x) * 4 + 3];
      assert.equal(alpha, y === 1 && x >= 1 && x < 4 ? 255 : 0);
    }
  }
});

test("finds the panel inside OpenCode's modal overlay", () => {
  const node = (input) => ({
    visible: true,
    isDestroyed: false,
    zIndex: 0,
    screenX: 0,
    screenY: 0,
    width: 0,
    height: 0,
    children: [],
    getChildren() {
      return this.children;
    },
    ...input,
  });
  const panel = node({ screenX: 40, screenY: 9, width: 60, height: 19 });
  const backdrop = node({ zIndex: 3000, width: 140, height: 36, children: [panel] });
  const wrapper = node({ zIndex: 3000, width: 1, height: 1, children: [backdrop] });
  const root = node({ width: 140, height: 36, children: [node({ width: 140, height: 36 }), wrapper] });
  assert.deepEqual(modalPanelRect(root, 140, 36), { x: 40, y: 9, width: 60, height: 19 });
});

test("suppresses the native modal backdrop before render without requesting another frame", () => {
  const makeNode = (input = {}) => ({
    visible: true,
    isDestroyed: false,
    zIndex: 0,
    children: [],
    getChildren() {
      return this.children;
    },
    getChildrenCount() {
      return this.children.length;
    },
    ...input,
  });
  const original = RGBA.fromInts(0, 0, 0, 150);
  const transparent = RGBA.fromInts(0, 0, 0, 0);
  const panel = makeNode({ width: 60, height: 20 });
  const backdrop = makeNode({
    zIndex: 3000,
    width: 140,
    height: 36,
    children: [panel],
    _backgroundColor: original,
  });
  const root = makeNode({ children: [backdrop] });
  const patched = new Map();

  assert.equal(suppressModalBackdropFrame(root, transparent, patched), 1);
  assert.equal(backdrop._backgroundColor, transparent);
  assert.equal(patched.get(backdrop), original);

  root.children = [];
  suppressModalBackdropFrame(root, transparent, patched);
  assert.equal(backdrop._backgroundColor, original);
  assert.equal(patched.size, 0);
});

test("dims the transparent area around the modal without changing its panel", () => {
  const width = 3;
  const buffers = {
    char: new Uint32Array(width),
    fg: new Uint16Array(width * 4),
    bg: new Uint16Array(width * 4),
    attributes: new Uint32Array(width),
  };
  clearOutsideRect(
    { width, height: 1, buffers },
    { x: 1, y: 0, width: 1, height: 1 },
    transparentSurface(color(0, 0, 0), color(255, 255, 255), "dark"),
    true,
  );
  assert.equal(buffers.attributes[0] & TextAttributes.DIM, TextAttributes.DIM);
  assert.equal(buffers.attributes[1] & TextAttributes.DIM, 0);
  assert.equal(buffers.attributes[2] & TextAttributes.DIM, TextAttributes.DIM);
});

test("removes underlying borders and prompt shadows outside the modal panel", () => {
  const line = "┃ text ──  ▀ panel ┃";
  const char = new Uint32Array([...line].map((value) => value.codePointAt(0)));
  const fg = new Uint16Array(char.length * 4);
  for (let cell = 0; cell < char.length; cell += 1) fg[cell * 4 + 3] = 255;
  const cleared = clearModalDecorations(
    cellBuffer(char.length, 1, { char, fg }),
    { x: 12, y: 0, width: 8, height: 1 },
  );
  assert.equal(cleared, 4);
  assert.equal(String.fromCodePoint(...char), "  text       panel ┃");
  assert.equal(fg[0 * 4 + 3], 0);
  assert.equal(fg[19 * 4 + 3], 255);
});

test("preserves all tagged OpenTUI cells while removing direct decorations", () => {
  const char = new Uint32Array([
    "┃".codePointAt(0),
    0x800100b7,
    0x900100ff,
    0xc40100ff,
    0x40000001,
    "─".codePointAt(0),
  ]);
  const fg = new Uint16Array(char.length * 4);
  const cleared = clearModalDecorations(
    cellBuffer(char.length, 1, { char, fg }),
    { x: char.length, y: 0, width: 0, height: 0 },
  );
  assert.equal(cleared, 2);
  assert.equal(char[0], " ".codePointAt(0));
  assert.equal(char[1], 0x800100b7);
  assert.equal(char[2], 0x900100ff);
  assert.equal(char[3], 0xc40100ff);
  assert.equal(char[4], 0x40000001);
  assert.equal(char[5], " ".codePointAt(0));
});

test("keeps a CJK grapheme ending at the last column across repeated modal frames", () => {
  const char = new Uint32Array([65, 65, 0x900100ff, 0xc40100ff, 66, 66, 66, 66]);
  const fg = new Uint16Array(char.length * 4);
  const buffer = cellBuffer(4, 2, { char, fg });
  clearModalDecorations(buffer, { x: 4, y: 0, width: 0, height: 0 });
  clearModalDecorations(buffer, { x: 4, y: 0, width: 0, height: 0 });
  assert.deepEqual([...char], [65, 65, 0x900100ff, 0xc40100ff, 66, 66, 66, 66]);
});

test("hides underlying terminal images while preserving images inside the modal", () => {
  const node = (input = {}) => ({
    visible: true,
    isDestroyed: false,
    opacity: 1,
    children: [],
    getChildren() {
      return this.children;
    },
    ...input,
  });
  const underlying = node({ image: true, opacity: 0.8 });
  const dialogImage = node({ image: true, opacity: 0.6 });
  const panel = node({ children: [dialogImage] });
  const root = node({ children: [underlying, panel] });
  const hidden = new Map();
  const isImage = (renderable) => renderable.image === true;

  syncModalImageOpacity(root, panel, hidden, isImage);
  assert.equal(underlying.opacity, 0);
  assert.equal(dialogImage.opacity, 0.6);
  assert.equal(hidden.get(underlying), 0.8);

  syncModalImageOpacity(root, undefined, hidden, isImage);
  assert.equal(underlying.opacity, 0.8);
  assert.equal(hidden.size, 0);
});
