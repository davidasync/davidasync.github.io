import { getFontEmbedCSS, toBlob } from "html-to-image";

const CONTEXT_LINES = 2;

/**
 * html-to-image copies every property of `getComputedStyle(documentElement)`
 * onto every cloned node. Under Tailwind v4 that list carries hundreds of
 * `--tw-*` custom properties, so a large diff pays millions of style writes.
 * The diff output is monospaced text in a grid, so this covers what it renders.
 *
 * Note: html-to-image memoises this list on its first call for the lifetime of
 * the page, so every capture must pass it or the whitelist is lost.
 */
const STYLE_PROPERTIES = [
  "align-items",
  "background-clip",
  "background-color",
  "background-image",
  "border-bottom-color",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "border-bottom-style",
  "border-bottom-width",
  "border-left-color",
  "border-left-style",
  "border-left-width",
  "border-right-color",
  "border-right-style",
  "border-right-width",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-top-style",
  "border-top-width",
  "bottom",
  "box-sizing",
  "color",
  "column-gap",
  "content",
  "display",
  "flex-basis",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "font-family",
  "font-feature-settings",
  "font-size",
  "font-style",
  "font-variant-ligatures",
  "font-variant-numeric",
  "font-weight",
  "grid-auto-flow",
  "grid-column",
  "grid-row",
  "grid-template-columns",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "opacity",
  "overflow-wrap",
  "overflow-x",
  "overflow-y",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "right",
  "row-gap",
  "tab-size",
  "text-align",
  "text-decoration-color",
  "text-decoration-line",
  "text-decoration-style",
  "text-indent",
  "text-overflow",
  "text-transform",
  "top",
  "vertical-align",
  "visibility",
  "white-space",
  "width",
  "word-break",
  "-webkit-text-fill-color",
];

/**
 * Inlining the web fonts means fetching and base64-encoding every `@font-face`
 * source. It is identical for every capture, so it is resolved once and, where
 * possible, before the first click.
 */
let fontEmbedCSS: Promise<string> | null = null;

function loadFontEmbedCSS() {
  fontEmbedCSS ??= getFontEmbedCSS(document.body, {
    includeStyleProperties: STYLE_PROPERTIES,
  }).catch(() => "");
  return fontEmbedCSS;
}

/** Warm the font cache while the user is still reading the diff. */
export function prewarmPngCapture() {
  const idle = window.requestIdleCallback;
  if (typeof idle === "function") idle(() => void loadFontEmbedCSS());
  else window.setTimeout(() => void loadFontEmbedCSS(), 0);
}

/**
 * Chromium and Safari cap a canvas at 16384 device pixels per side. A tall diff
 * that crosses that at 2x is silently rescaled or cropped, so the whole bottom
 * of the comparison goes missing. Scale to the largest ratio that still fits.
 */
const MAX_CANVAS_PIXELS = 16384;

/** Below 1x the monospaced text stops being readable, so refuse rather than
 * hand back an image nobody can use. */
const MIN_PIXEL_RATIO = 1;

export class DiffTooLargeError extends Error {
  constructor() {
    super("The comparison is too tall to fit in a single image.");
    this.name = "DiffTooLargeError";
  }
}

function pixelRatioFor(width: number, height: number) {
  const longest = Math.max(width, height, 1);
  const ratio = Math.min(2, MAX_CANVAS_PIXELS / longest);
  if (ratio < MIN_PIXEL_RATIO) throw new DiffTooLargeError();
  return ratio;
}

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
      pixelRatio: pixelRatioFor(captureWidth, captureHeight),
      fontEmbedCSS: await loadFontEmbedCSS(),
      includeStyleProperties: STYLE_PROPERTIES,
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
