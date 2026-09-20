"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ctrl+Enter — Cmd+Enter on a Mac — runs the panel's primary action: beautify,
 * encode, find differences, upload, whichever button is the accented one.
 *
 * Bound to the window rather than to each field, so it fires from the TTL
 * select and the filename input too, not only from the textarea. Exactly one
 * panel is mounted at a time, so exactly one listener is ever live.
 *
 * Pass `null` when there is nothing to run — a panel that has no primary
 * button, like the JWT debugger while it is decoding, which updates as you
 * type and has nothing left to trigger.
 */
export function usePrimaryAction(run: (() => void) | null) {
  const runRef = useRef(run);

  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      // Either modifier: Ctrl+Enter is the habit everywhere, Cmd+Enter is the
      // habit on a Mac, and neither means anything else in a text field.
      if (!event.ctrlKey && !event.metaKey) return;
      // A chord with more modifiers is someone else's shortcut.
      if (event.altKey || event.shiftKey) return;

      const action = runRef.current;
      if (!action) return;

      // Stops a Ctrl+Enter inside a form from also submitting it.
      event.preventDefault();
      action();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * Brings a panel's output into view once the primary action has produced it.
 *
 * Takes a getter rather than an element because the node usually does not
 * exist at the moment it is called: the diff output, the newest link and the
 * newest object are all rendered by the state update that just happened. It is
 * re-read a frame later, and once more after that, rather than captured now.
 */
export function scrollToOutput(getNode: () => HTMLElement | null) {
  let attempts = 2;

  const tick = () => {
    const node = getNode();
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    attempts -= 1;
    if (attempts > 0) window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

/**
 * How to spell the shortcut for whoever is reading. Resolved after mount
 * because the static export has no platform to render against, and guessing
 * wrong during hydration would swap the label out from under them anyway.
 */
export function usePrimaryActionLabel() {
  const [label, setLabel] = useState("Ctrl+Enter");

  // Deferred a tick, the same way the panels defer reading localStorage: the
  // value is not knowable while the static HTML is being rendered.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
        setLabel("⌘+Enter");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return label;
}
