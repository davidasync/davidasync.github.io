import type { ReactNode } from "react";
import { profile } from "@/content/site";
import Reveal from "./Reveal";

type SectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export default function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: SectionProps) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-5xl border-t border-dashed border-border/80 px-6 py-20 sm:py-24 ${className}`}
    >
      <Reveal>
        <p className="flex flex-wrap items-center gap-x-1 text-xs sm:text-sm">
          <span className="text-accent">
            {profile.name.toLowerCase()}@portfolio
          </span>
          <span className="text-terminal-cyan">:~/portfolio</span>
          <span>$</span>
          <span className="text-muted">{eyebrow}</span>
        </p>
        <div className="mt-5 flex items-start gap-3">
          <span className="pt-1 text-sm text-terminal-yellow">##</span>
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted">
            <span className="mr-2 text-accent">&gt;</span>
            {description}
          </p>
        ) : null}
      </Reveal>
      <div className="mt-10">{children}</div>
    </section>
  );
}
