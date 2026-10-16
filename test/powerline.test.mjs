import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  guardPowerlinePostProcess,
  promptFooterBeforeSidebar,
  readablePowerlineForeground,
  resolvePowerlineCells,
  runningPromptFooter,
  stylePowerlineFooter,
} from "../dist/powerline.js";

const RIGHT_SEPARATOR = "";
const LEFT_SEPARATOR = "";

function color(id) {
  return { toInts: () => [id, 0, 0, 255] };
}

function fixture(text) {
  const width = [...text].length;
  const char = new Uint32Array(width);
  const fg = new Uint16Array(width * 4);
  [...text].forEach((value, index) => {
    char[index] = value.codePointAt(0);
    fg[index * 4] = 42;
    fg[index * 4 + 3] = 255;
  });
  return {
    width,
    height: 1,
    buffers: {
      char,
      fg,
      bg: new Uint16Array(width * 4),
    },
  };
}

function character(buffer, index) {
  return String.fromCodePoint(buffer.buffers.char[index]);
}

function background(buffer, index) {
  return buffer.buffers.bg[index * 4];
}

function foreground(buffer, index) {
  return buffer.buffers.fg[index * 4];
}

function palette() {
  return {
    foreground: () => color(1),
    transparent: color(0),
    location: color(2),
    branch: color(3),
    activity: color(4),
    context: (percentage) => color(percentage >= 90 ? 7 : percentage >= 80 ? 6 : 5),
    cost: color(8),
    command: color(9),
    neutral: color(10),
  };
}

test("styles the existing footer as theme-driven Powerline segments", () => {
  const location = "~/repo:main";
  const line = `${location}          ↓ 1 subagent · 217.5K (22%) · $280.34  ctrl+p commands`;
  const buffer = fixture(line);

  const count = stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    { x: 0, y: 0, width: location.length, height: 1 },
  );

  assert.equal(count, 5);
  const colon = line.indexOf(":");
  assert.equal(character(buffer, colon), RIGHT_SEPARATOR);
  assert.equal(background(buffer, 0), 2);
  assert.equal(background(buffer, colon + 1), 3);
  assert.equal(character(buffer, location.length), RIGHT_SEPARATOR);

  const activity = line.indexOf("↓");
  assert.equal(character(buffer, activity - 2), LEFT_SEPARATOR);
  assert.equal(background(buffer, activity - 1), 4);
  assert.equal(background(buffer, activity), 4);
  assert.equal(foreground(buffer, activity), 1);

  const context = line.indexOf("217.5K");
  const cost = line.indexOf("$280.34");
  const command = line.indexOf("ctrl+p");
  assert.equal(background(buffer, context), 5);
  assert.equal(background(buffer, cost), 8);
  assert.equal(background(buffer, command), 9);
  assert.equal(character(buffer, line.indexOf("·")), LEFT_SEPARATOR);
});

test("uses warning and error context colors at the documented thresholds", () => {
  for (const [percentage, expected] of [[80, 6], [89.9, 6], [90, 7]]) {
    const line = `${percentage}%`;
    const buffer = fixture(line);
    stylePowerlineFooter(buffer, { x: 0, y: 0, width: buffer.width, height: 1 }, palette());
    assert.equal(background(buffer, 0), expected);
  }
});

test("chooses a readable foreground while preferring the theme background", () => {
  const rgba = (red, green, blue, alpha = 255) => ({ toInts: () => [red, green, blue, alpha] });
  const oneDark = rgba(40, 44, 52);
  const oneDarkText = rgba(171, 178, 191);
  assert.equal(readablePowerlineForeground(rgba(198, 120, 221), oneDark, oneDarkText), oneDark);
  assert.deepEqual(
    readablePowerlineForeground(rgba(250, 250, 250), rgba(245, 245, 245), rgba(230, 230, 230)).toInts(),
    [0, 0, 0, 255],
  );
});

test("uses the theme surface outside separators unless transparency is enabled", async () => {
  const source = await readFile(new URL("../src/powerline.tsx", import.meta.url), "utf8");
  assert.match(source, /context\.options\.transparent === true[\s\S]*RGBA\.fromInts\(0, 0, 0, 0\)[\s\S]*context\.theme\.background\.base/);
});

test("ignores OpenTUI internal glyph encodings outside the Unicode range", () => {
  const buffer = fixture("A B");
  buffer.buffers.char[1] = 0x110000;
  assert.doesNotThrow(() =>
    stylePowerlineFooter(buffer, { x: 0, y: 0, width: buffer.width, height: 1 }, palette()),
  );
});

test("uses OpenTUI-resolved text to split internally encoded separators", () => {
  const line = "10% · $2.00";
  const buffer = fixture(line);
  const separator = line.indexOf("·");
  buffer.buffers.char[separator] = 0x110000;
  const count = stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    undefined,
    [[...line]],
  );
  assert.equal(count, 2);
  assert.equal(character(buffer, separator), LEFT_SEPARATOR);
  assert.equal(background(buffer, line.indexOf("10%")), 5);
  assert.equal(background(buffer, line.indexOf("$2.00")), 8);
});

test("decodes OpenTUI internal glyphs and wide-cell continuations", () => {
  const width = 5;
  const buffer = {
    width,
    height: 1,
    buffers: {
      char: new Uint32Array(["A".codePointAt(0), 0x110000, 0x110001, 0xc0000000, "B".codePointAt(0)]),
      fg: new Uint16Array(width * 4),
      bg: new Uint16Array(width * 4),
    },
    getRealCharBytes: () => new TextEncoder().encode("A·🙂B\n"),
  };
  assert.deepEqual(resolvePowerlineCells(buffer), [["A", "·", "🙂", "\0", "B"]]);
});

test("adds balanced trailing padding without moving native footer text", () => {
  const content = "10% · $2.00";
  const buffer = fixture(`${content}  `);
  stylePowerlineFooter(buffer, { x: 0, y: 0, width: buffer.width, height: 1 }, palette());
  assert.equal(background(buffer, content.length), 8);
  assert.equal(character(buffer, content.length), " ");
  assert.equal(background(buffer, content.length + 1), 0);
});

test("keeps one colored trailing space after cost and command text", () => {
  const location = "~/repo:main";
  const line = `$390.16  ctrl+p commands    ${location}`;
  const buffer = fixture(line);
  stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    { x: line.indexOf(location), y: 0, width: location.length, height: 1 },
  );

  const costEnd = line.indexOf("  ");
  const commandEnd = line.indexOf("    ", costEnd + 2);
  assert.equal(character(buffer, costEnd), " ");
  assert.equal(background(buffer, costEnd), 8);
  assert.equal(character(buffer, costEnd + 1), LEFT_SEPARATOR);
  assert.equal(character(buffer, costEnd + 2), " ");
  assert.equal(character(buffer, costEnd + 3), "c");
  assert.equal(background(buffer, commandEnd + 1), 9);
});

test("keeps one colored trailing space after the interrupt status", () => {
  const line = "esc interrupt      10%";
  const buffer = fixture(line);
  stylePowerlineFooter(buffer, { x: 0, y: 0, width: buffer.width, height: 1 }, palette());

  const statusEnd = line.indexOf("      ");
  assert.equal(character(buffer, statusEnd), " ");
  assert.equal(background(buffer, statusEnd), 4);
  assert.equal(background(buffer, statusEnd + 1), 0);
});

test("preserves separators and repeated spaces inside the native location", () => {
  const location = "~/two  spaces·dot:main";
  const line = `${location}  10%`;
  const buffer = fixture(line);
  const count = stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    { x: 0, y: 0, width: location.length, height: 1 },
  );
  assert.equal(count, 2);
  assert.equal(character(buffer, location.indexOf("·")), "·");
  assert.equal(character(buffer, location.indexOf("  ")), " ");
  assert.equal(character(buffer, location.indexOf("  ") + 1), " ");
});

test("separates directory and branch with balanced padding when location space allows", () => {
  const value = "~/repo:main";
  const buffer = fixture(`${value}      `);
  stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    { x: 0, y: 0, width: buffer.width, height: 1 },
  );

  assert.equal(character(buffer, 0), " ");
  assert.equal(background(buffer, 0), 2);
  assert.equal(character(buffer, 7), " ");
  assert.equal(character(buffer, 8), RIGHT_SEPARATOR);
  assert.equal(character(buffer, 9), " ");
  assert.equal(background(buffer, 9), 3);
  assert.equal(character(buffer, 14), " ");
  assert.equal(background(buffer, 14), 3);
  assert.equal(character(buffer, 15), RIGHT_SEPARATOR);
});

test("keeps location and status distinct across a one-cell responsive gap", () => {
  const location = "~/repo:main";
  const line = `${location} 10%`;
  const buffer = fixture(line);
  const count = stylePowerlineFooter(
    buffer,
    { x: 0, y: 0, width: buffer.width, height: 1 },
    palette(),
    { x: 0, y: 0, width: location.length, height: 1 },
  );
  assert.equal(count, 2);
  assert.equal(character(buffer, location.length), RIGHT_SEPARATOR);
  assert.equal(background(buffer, line.indexOf("10%")), 5);
});

test("disables Powerline processing after the first render failure", () => {
  let attempts = 0;
  const failures = [];
  const process = guardPowerlinePostProcess(
    () => {
      attempts += 1;
      throw new Error("broken frame");
    },
    (error) => failures.push(error),
  );

  process({});
  process({});
  assert.equal(attempts, 1);
  assert.equal(failures.length, 1);
  assert.match(failures[0].message, /broken frame/);
});

test("infers the main footer row when a continued session starts with the sidebar open", () => {
  assert.deepEqual(promptFooterBeforeSidebar({ x: 120, y: 38, width: 40, height: 1 }), {
    x: 0,
    y: 38,
    width: 120,
    height: 1,
  });
  assert.equal(promptFooterBeforeSidebar({ x: 0, y: 38, width: 40, height: 1 }), undefined);
});

test("finds the native running footer after the sidebar closes", () => {
  const buffer = fixture("◼ esc interrupt          47.3K (5%) · $385.87");
  assert.deepEqual(runningPromptFooter(buffer), {
    x: 0,
    y: 0,
    width: buffer.width,
    height: 1,
  });
  assert.equal(runningPromptFooter(fixture("esc to interrupt this example")), undefined);
});

test("registers Powerline only when the v2 option is enabled", async () => {
  const source = await readFile(new URL("../src/tui-v2.tsx", import.meta.url), "utf8");
  assert.match(source, /context\.options\.powerline === true/);
  assert.match(source, /installPowerline\(context\)/);
  assert.match(source, /disposePowerline\?\.\(\)/);
});

test("styles native footer frames without registering layout claims", async () => {
  const source = await readFile(new URL("../src/powerline.tsx", import.meta.url), "utf8");
  assert.match(source, /root\.findDescendantById\("prompt\.footer\.location"\)/);
  assert.match(source, /root\.findDescendantById\("sidebar\.footer\.location"\)/);
  assert.match(source, /addPostProcessFn\(postProcess\)/);
  assert.doesNotMatch(source, /context\.ui\.slot|<Marker|width=\{0\}|height=\{0\}/);
});
