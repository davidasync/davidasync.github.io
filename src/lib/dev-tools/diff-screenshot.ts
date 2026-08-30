import { toBlob } from "html-to-image";

export async function openNodePng(node: HTMLElement, tab: Window) {
  const scroll = node.querySelector("[data-diff-scroll]");
  const previous =
    scroll instanceof HTMLElement
      ? {
          maxHeight: scroll.style.maxHeight,
          overflow: scroll.style.overflow,
        }
      : null;

  if (scroll instanceof HTMLElement) {
    scroll.style.maxHeight = "none";
    scroll.style.overflow = "visible";
  }

  try {
    const backgroundColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim() || "#0c0a0d";

    const blob = await toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor,
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
    if (scroll instanceof HTMLElement && previous) {
      scroll.style.maxHeight = previous.maxHeight;
      scroll.style.overflow = previous.overflow;
    }
  }
}
