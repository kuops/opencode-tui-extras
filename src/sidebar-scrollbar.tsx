/** @jsxImportSource @opentui/solid */
import type { BoxRenderable, Renderable } from "@opentui/core";
import type { Context } from "@opencode/plugin/tui/plugin";
import { onCleanup, onMount } from "solid-js";

type VerticalScrollBar = Renderable & {
  orientation: "vertical";
  resetVisibilityControl: () => void;
};

type ScrollBox = Renderable & {
  content: Renderable;
  verticalScrollBar: VerticalScrollBar;
};

const hiddenBars = new WeakMap<VerticalScrollBar, number>();

function isVerticalScrollBar(value: unknown): value is VerticalScrollBar {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VerticalScrollBar>;
  return candidate.orientation === "vertical" &&
    typeof candidate.resetVisibilityControl === "function";
}

function isScrollBox(value: Renderable): value is ScrollBox {
  return "content" in value &&
    "verticalScrollBar" in value &&
    (value as Partial<ScrollBox>).content !== undefined &&
    isVerticalScrollBar((value as Partial<ScrollBox>).verticalScrollBar);
}

function descendsFrom(renderable: Renderable, ancestor: Renderable) {
  let current: Renderable | null = renderable;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

export function findSidebarScrollBox(marker: Renderable): ScrollBox | undefined {
  let current = marker.parent;
  while (current) {
    if (isScrollBox(current) && descendsFrom(marker, current.content)) return current;
    current = current.parent;
  }
  return undefined;
}

export function hideSidebarScrollbar(marker: Renderable) {
  const scrollBox = findSidebarScrollBox(marker);
  if (!scrollBox) return () => {};

  const bar = scrollBox.verticalScrollBar;
  const count = hiddenBars.get(bar) ?? 0;
  hiddenBars.set(bar, count + 1);
  if (count === 0) bar.visible = false;

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const remaining = (hiddenBars.get(bar) ?? 1) - 1;
    if (remaining > 0) {
      hiddenBars.set(bar, remaining);
      return;
    }
    hiddenBars.delete(bar);
    if (!bar.isDestroyed) bar.resetVisibilityControl();
  };
}

function SidebarScrollbarMarker() {
  let marker: BoxRenderable | undefined;
  onMount(() => {
    if (!marker) return;
    onCleanup(hideSidebarScrollbar(marker));
  });
  return <box ref={marker} position="absolute" width={0} height={0} />;
}

export function installSidebarScrollbar(context: Context) {
  return context.ui.slot({
    append: "sidebar.content",
    render: () => <SidebarScrollbarMarker />,
  });
}
