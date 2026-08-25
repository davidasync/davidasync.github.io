"use client";

import { useEffect, useState } from "react";
import { navLinks, profile } from "@/content/site";
import ThemeToggle from "./ThemeToggle";
import { CloseIcon, MenuIcon } from "./icons";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = navLinks
      .map(({ href }) => document.querySelector(href))
      .filter((el): el is Element => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (inView) setActive(`#${inView.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-border bg-background/95 shadow-[0_8px_30px_var(--terminal-shadow)] backdrop-blur-md"
          : "border-b border-border/60 bg-background/75 backdrop-blur-sm"
      }`}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <a
          href="#top"
          className="text-xs font-medium tracking-tight sm:text-sm"
          onClick={() => setOpen(false)}
        >
          <span className="text-accent">{profile.name.toLowerCase()}@portfolio</span>
          <span className="text-terminal-cyan">:~</span>
          <span className="text-foreground">$</span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`rounded-sm border px-2.5 py-1.5 text-xs transition ${
                  active === link.href
                    ? "border-accent/30 bg-accent-soft text-accent"
                    : "border-transparent text-muted hover:border-border hover:text-foreground"
                }`}
              >
                ./{link.label.toLowerCase()}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-surface-2 text-muted transition hover:border-accent/50 hover:text-accent md:hidden"
          >
            {open ? (
              <CloseIcon className="h-4 w-4" />
            ) : (
              <MenuIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-border bg-background/98 shadow-[0_18px_40px_var(--terminal-shadow)] backdrop-blur-md md:hidden">
          <ul className="mx-auto flex w-full max-w-5xl flex-col px-6 py-3">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 border-b border-dashed border-border/70 py-3 text-sm text-muted last:border-0 hover:text-accent"
                >
                  <span className="text-accent">$</span>
                  cd ./{link.label.toLowerCase()}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
