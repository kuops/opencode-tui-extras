export const BAR_WIDTH = 28;

export interface TokenUsage {
  input?: unknown;
  output?: unknown;
  reasoning?: unknown;
  cache?: {
    read?: unknown;
    write?: unknown;
  };
}

export interface UsageBreakdown {
  total: number;
  input: number;
  hit: number;
  miss: number;
  write: number;
  output: number;
  thinking: number;
  response: number;
  hitRate: number;
  contextLimit: number;
  contextUsage: number;
  contextWidth: number;
  hitWidth: number;
  writeWidth: number;
  missWidth: number;
  emptyWidth: number;
  cost: number;
}

interface V2MessageMarker {
  id: string;
  type: string;
  status?: string;
  tokens?: TokenUsage;
}

export function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function tokenTotal(tokens: TokenUsage | undefined): number {
  return (
    safeNumber(tokens?.input) +
    safeNumber(tokens?.output) +
    safeNumber(tokens?.reasoning) +
    safeNumber(tokens?.cache?.read) +
    safeNumber(tokens?.cache?.write)
  );
}

export function latestV2UsageIndex(
  messages: ReadonlyArray<V2MessageMarker>,
  boundary?: string,
): number {
  const boundaryIndex = boundary
    ? messages.findIndex((message) => message.id === boundary)
    : -1;
  if (boundary && boundaryIndex === -1) return -1;
  const end = boundaryIndex === -1 ? messages.length : boundaryIndex;
  let compactionIndex = -1;
  for (let index = end - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.type === "compaction" && message.status === "completed") {
      compactionIndex = index;
      break;
    }
  }
  for (let index = end - 1; index > compactionIndex; index--) {
    const message = messages[index];
    if (message.type === "assistant" && message.tokens && tokenTotal(message.tokens) > 0) {
      return index;
    }
  }
  return -1;
}

export function calculateUsage(
  tokens: TokenUsage | undefined,
  contextLimitValue: unknown,
  costValue: unknown,
): UsageBreakdown {
  const miss = safeNumber(tokens?.input);
  const hit = safeNumber(tokens?.cache?.read);
  const write = safeNumber(tokens?.cache?.write);
  const response = safeNumber(tokens?.output);
  const thinking = safeNumber(tokens?.reasoning);
  const input = miss + hit + write;
  const output = response + thinking;
  const total = input + output;
  const hitRate = input > 0 ? (hit / input) * 100 : 0;
  const contextLimit = safeNumber(contextLimitValue);
  const contextUsage = contextLimit > 0 ? (total / contextLimit) * 100 : 0;
  const contextWidth = Math.min(
    BAR_WIDTH,
    Math.round((Math.max(0, contextUsage) / 100) * BAR_WIDTH),
  );
  const hitWidth = Math.min(BAR_WIDTH, Math.round((hit / Math.max(input, 1)) * BAR_WIDTH));
  const writeWidth = Math.min(
    BAR_WIDTH - hitWidth,
    Math.round((write / Math.max(input, 1)) * BAR_WIDTH),
  );
  const missWidth = input > 0 ? BAR_WIDTH - hitWidth - writeWidth : 0;

  return {
    total,
    input,
    hit,
    miss,
    write,
    output,
    thinking,
    response,
    hitRate,
    contextLimit,
    contextUsage,
    contextWidth,
    hitWidth,
    writeWidth,
    missWidth,
    emptyWidth: input > 0 ? 0 : BAR_WIDTH,
    cost: safeNumber(costValue),
  };
}
