import assert from "node:assert/strict";
import test from "node:test";
import { RGBA } from "@opentui/core";
import {
  clearLucentOrngAutocompleteBackground,
  findLucentOrngAutocompleteSurface,
  fixLucentOrngBadgeContrast,
  installLucentOrngTransparencyFix,
  isLucentOrngTheme,
} from "../dist/lucent-orng.js";

const color = (red, green, blue, alpha = 255) => RGBA.fromInts(red, green, blue, alpha);

function theme(border = color(236, 91, 43)) {
  return {
    background: {
      base: color(0, 0, 0, 0),
      raised: { base: color(0, 0, 0, 0) },
    },
    border: { base: border },
    hue: { accent: { 200: color(238, 238, 238), 300: color(201, 77, 36) } },
  };
}

function node(input = {}) {
  return {
    visible: true,
    isDestroyed: false,
    zIndex: 0,
    width: 0,
    height: 0,
    screenX: 0,
    screenY: 0,
    children: [],
    getChildren() {
      return this.children;
    },
    ...input,
  };
}

function context(input = {}) {
  const root = input.root ?? node();
  return {
    theme: theme(),
    themeMode: "dark",
    renderer: { root },
    keymap: { mode: { current: () => input.mode ?? "normal" } },
  };
}

test("recognizes only the migrated lucent-orng color signature", () => {
  assert.equal(isLucentOrngTheme(theme()), true);
  assert.equal(isLucentOrngTheme(theme(color(198, 120, 221))), false);
});

test("repairs lucent-orng file badge contrast without changing unrelated cells", () => {
  const fg = new Uint16Array([
    238, 238, 238, 255,
    128, 128, 128, 255,
  ]);
  const bg = new Uint16Array([
    238, 238, 238, 255,
    0, 0, 0, 0,
  ]);
  const fixed = fixLucentOrngBadgeContrast({ buffers: { fg, bg } }, theme(), "dark");
  assert.equal(fixed, 1);
  assert.deepEqual([...fg], [0, 0, 0, 255, 128, 128, 128, 255]);
});

test("temporarily makes only lucent-orng dialog panels opaque", () => {
  const plugin = context();
  const original = color(0, 0, 0, 0);
  const panel = {
    backgroundColor: original,
    isDestroyed: false,
  };
  const fix = installLucentOrngTransparencyFix(plugin);
  const buffer = { buffers: { fg: new Uint16Array(0), bg: new Uint16Array(0) } };

  fix.process(buffer, panel);
  assert.deepEqual(panel.backgroundColor.toInts(), [42, 26, 21, 255]);

  fix.process(buffer);
  assert.equal(panel.backgroundColor, original);
  fix.dispose();
});

test("does not overwrite a dialog color already changed by another theme", () => {
  const plugin = context();
  const panel = {
    backgroundColor: color(0, 0, 0, 0),
    isDestroyed: false,
  };
  const fix = installLucentOrngTransparencyFix(plugin);
  const buffer = { buffers: { fg: new Uint16Array(0), bg: new Uint16Array(0) } };
  fix.process(buffer, panel);

  const oneDark = color(33, 37, 43);
  panel.backgroundColor = oneDark;
  plugin.theme = theme(color(97, 175, 239));
  fix.process(buffer);

  assert.equal(panel.backgroundColor, oneDark);
  fix.dispose();
});

test("finds the prompt autocomplete scroll surface under its z-index anchor", () => {
  const surface = node({
    width: 120,
    height: 10,
    backgroundColor: color(42, 26, 21, 153),
    verticalScrollBar: {},
    content: {},
  });
  const anchor = node({ zIndex: 100, width: 120, height: 10, children: [surface] });
  const root = node({ children: [node({ width: 120, height: 20 }), anchor] });
  assert.equal(findLucentOrngAutocompleteSurface(root), surface);
});

test("temporarily makes only lucent-orng slash autocomplete opaque", () => {
  const original = color(42, 26, 21, 153);
  const surface = node({
    width: 120,
    height: 10,
    backgroundColor: original,
    verticalScrollBar: {},
    content: {},
  });
  const root = node({ children: [node({ zIndex: 100, children: [surface] })] });
  let mode = "autocomplete";
  const plugin = context({ root });
  plugin.keymap.mode.current = () => mode;
  const fix = installLucentOrngTransparencyFix(plugin);
  const buffer = {
    width: 120,
    height: 10,
    buffers: { fg: new Uint16Array(120 * 10 * 4), bg: new Uint16Array(120 * 10 * 4) },
  };

  fix.process(buffer);
  assert.deepEqual(surface.backgroundColor.toInts(), [42, 26, 21, 255]);

  mode = "normal";
  fix.process(buffer);
  assert.equal(surface.backgroundColor, original);
  fix.dispose();
});

test("clears only the opaque masking layer after slash autocomplete is composed", () => {
  const width = 6;
  const height = 3;
  const opaque = color(42, 26, 21);
  const bg = new Uint16Array(width * height * 4);
  for (let cell = 0; cell < width * height; cell += 1) bg.set(opaque.toInts(), cell * 4);
  bg.set([236, 91, 43, 255], (width + 2) * 4);
  const surface = node({ screenX: 1, screenY: 1, width: 4, height: 2 });

  const cleared = clearLucentOrngAutocompleteBackground(
    { width, height, buffers: { bg, fg: new Uint16Array(bg.length) } },
    surface,
    opaque,
  );

  assert.equal(cleared, 7);
  assert.deepEqual([...bg.slice(0, 4)], opaque.toInts());
  assert.deepEqual([...bg.slice((width + 1) * 4, (width + 2) * 4)], [0, 0, 0, 0]);
  assert.deepEqual([...bg.slice((width + 2) * 4, (width + 3) * 4)], [236, 91, 43, 255]);
});
