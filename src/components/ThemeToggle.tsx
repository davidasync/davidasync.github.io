"use client";

import { MoonIcon, SunIcon } from "./icons";

export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  function toggle() {
    const root = document.documentElement;
    const isDark = root.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface-2 text-muted transition hover:border-accent/50 hover:text-accent ${className}`}
    >
      <SunIcon className="h-4 w-4 dark:hidden" />
      <MoonIcon className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
