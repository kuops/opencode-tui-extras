import assert from "node:assert/strict";
import test from "node:test";
import { clearPromptShadow, clearThemeBackgrounds } from "../dist/transparency.js";
import { setupV2 } from "../dist/tui-v2.js";

const color = (red, green, blue, alpha = 255) => ({
  toInts: () => [red, green, blue, alpha],
});

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
      setBackgroundColor: (background) => backgrounds.push(background),
      addPostProcessFn: (callback) => registrations.push(callback),
      removePostProcessFn: (callback) => removals.push(callback),
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

test("leaves modal frames opaque", () => {
  const base = color(40, 44, 52);
  const bg = new Uint16Array(base.toInts());
  let postProcess;
  const context = {
    options: { transparent: true },
    theme: { background: { base, raised: { base: color(33, 37, 43) } } },
    themeMode: "dark",
    keymap: { mode: { current: () => "modal" } },
    renderer: {
      setBackgroundColor: () => {},
      addPostProcessFn: (callback) => {
        postProcess = callback;
      },
      removePostProcessFn: () => {},
    },
    ui: { slot: () => () => {} },
  };

  const dispose = setupV2(context);
  postProcess({ buffers: { fg: new Uint16Array(4), bg } });
  assert.deepEqual([...bg], base.toInts());
  dispose();
});
