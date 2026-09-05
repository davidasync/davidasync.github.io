import { toBlob } from "html-to-image";

const CONTEXT_LINES = 2;

export async function openNodePng(node: HTMLElement, tab: Window) {
  const source =
    node.querySelector<HTMLElement>("[data-diff-capture]") ?? node;
  const backgroundColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim() || "#0c0a0d";

  const host = document.createElement("div");
  const clone = source.cloneNode(true) as HTMLElement;
  const width = Math.max(source.scrollWidth, source.clientWidth, source.offsetWidth);

  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "z-index:-1",
    `width:${width}px`,
  ].join(";");

  clone.style.cssText += [
    "margin:0",
    `width:${width}px`,
    `max-width:${width}px`,
    "max-height:none",
    "height:auto",
    "overflow:visible",
  ]
    .map((rule) => `${rule};`)
    .join("");

  const scroll = clone.matches("[data-diff-scroll]")
    ? clone
    : clone.querySelector("[data-diff-scroll]");
  if (scroll instanceof HTMLElement) {
    scroll.style.maxHeight = "none";
    scroll.style.height = "auto";
    scroll.style.overflow = "visible";
  }

  keepChangedRows(clone);
  host.append(clone);
  document.body.append(host);

  try {
    const bounds = clone.getBoundingClientRect();
    const captureWidth = Math.max(
      Math.ceil(bounds.width),
      clone.scrollWidth,
      clone.offsetWidth,
      1,
    );
    const captureHeight = Math.max(
      Math.ceil(bounds.height),
      clone.scrollHeight,
      clone.offsetHeight,
      1,
    );

    const blob = await toBlob(clone, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor,
      width: captureWidth,
      height: captureHeight,
      style: {
        margin: "0",
        width: `${captureWidth}px`,
        height: `${captureHeight}px`,
      },
    });

    if (!blob) {
      throw new Error("Unable to render the comparison image.");
    }

    const url = URL.createObjectURL(blob);
    tab.location.replace(url);
  } catch (error) {
    tab.close();
    throw error;
  } finally {
    host.remove();
  }
}

function keepChangedRows(root: HTMLElement) {
  const rows = [...root.querySelectorAll<HTMLElement>("[data-diff-row]")];
  if (rows.length === 0) return;

  const changed = rows.map((row) => row.dataset.diffRow === "changed");
  if (changed.every((value) => !value)) return;

  const keep = changed.map(() => false);

  for (let index = 0; index < changed.length; index += 1) {
    if (!changed[index]) continue;

    const from = Math.max(0, index - CONTEXT_LINES);
    const to = Math.min(changed.length - 1, index + CONTEXT_LINES);
    for (let cursor = from; cursor <= to; cursor += 1) {
      keep[cursor] = true;
    }
  }

  rows.forEach((row, index) => {
    if (!keep[index]) row.remove();
  });
}
