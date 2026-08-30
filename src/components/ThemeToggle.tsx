"use client";

import { CatIcon, MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark" | "black-cat";

const nextTheme: Record<Theme, Theme> = {
  light: "dark",
  dark: "black-cat",
  "black-cat": "light",
};

function currentTheme(root: HTMLElement): Theme {
  if (root.classList.contains("black-cat")) return "black-cat";
  if (root.classList.contains("dark")) return "dark";
  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme !== "light");
  root.classList.toggle("black-cat", theme === "black-cat");
  localStorage.setItem("theme", theme);
}

export default function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  function cycle() {
    applyTheme(nextTheme[currentTheme(document.documentElement)]);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label="Cycle color theme"
      title="Cycle theme: light, dark, black cat"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface-2 text-muted transition hover:border-accent/50 hover:text-accent ${className}`}
    >
      <SunIcon className="h-4 w-4 dark:hidden" />
      <MoonIcon className="hidden h-4 w-4 dark:block black-cat:hidden" />
      <CatIcon className="hidden h-4 w-4 black-cat:block" />
    </button>
  );
}
