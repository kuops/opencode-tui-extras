import assert from "node:assert/strict";
import test from "node:test";
import {
  BAR_WIDTH,
  calculateUsage,
  latestV2UsageIndex,
  tokenTotal,
} from "../dist/usage.js";

test("calculates the token breakdown and rates", () => {
  const tokens = {
    input: 200,
    output: 150,
    reasoning: 50,
    cache: { read: 700, write: 100 },
  };
  const usage = calculateUsage(tokens, 2_000, 0.125);

  assert.equal(tokenTotal(tokens), 1_200);
  assert.equal(usage.input, 1_000);
  assert.equal(usage.output, 200);
  assert.equal(usage.total, 1_200);
  assert.equal(usage.hitRate, 70);
  assert.equal(usage.contextUsage, 60);
  assert.equal(usage.cost, 0.125);
  assert.equal(usage.hitWidth + usage.writeWidth + usage.missWidth, BAR_WIDTH);
});

test("handles missing usage without NaN values", () => {
  const usage = calculateUsage(undefined, undefined, undefined);

  assert.equal(usage.total, 0);
  assert.equal(usage.hitRate, 0);
  assert.equal(usage.contextUsage, 0);
  assert.equal(usage.contextWidth, 0);
  assert.equal(usage.emptyWidth, BAR_WIDTH);
});

test("caps an overflowing context bar", () => {
  const usage = calculateUsage(
    { input: 150, output: 100, reasoning: 0, cache: { read: 0, write: 0 } },
    100,
    0,
  );

  assert.equal(usage.contextUsage, 250);
  assert.equal(usage.contextWidth, BAR_WIDTH);
});

test("normalizes invalid and negative provider values", () => {
  const usage = calculateUsage(
    {
      input: -10,
      output: Number.NaN,
      reasoning: Number.POSITIVE_INFINITY,
      cache: { read: 5, write: -2 },
    },
    -100,
    -1,
  );

  assert.equal(usage.total, 5);
  assert.equal(usage.input, 5);
  assert.equal(usage.contextLimit, 0);
  assert.equal(usage.cost, 0);
});

test("selects v2 usage after compaction and before a revert boundary", () => {
  const tokens = (input) => ({ input, output: 0, reasoning: 0, cache: { read: 0, write: 0 } });
  const messages = [
    { id: "a", type: "assistant", tokens: tokens(10) },
    { id: "compact", type: "compaction", status: "completed" },
    { id: "b", type: "assistant", tokens: tokens(20) },
    { id: "c", type: "assistant", tokens: tokens(30) },
  ];

  assert.equal(latestV2UsageIndex(messages), 3);
  assert.equal(latestV2UsageIndex(messages, "c"), 2);
  assert.equal(latestV2UsageIndex(messages, "missing"), -1);
  assert.equal(latestV2UsageIndex(messages, "b"), -1);
});
