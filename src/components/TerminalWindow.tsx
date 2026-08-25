import type { ReactNode } from "react";

type TerminalWindowProps = {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function TerminalWindow({
  title,
  children,
  className = "",
  contentClassName = "",
}: TerminalWindowProps) {
  return (
    <div className={`terminal-window ${className}`}>
      <div className="terminal-titlebar relative px-4">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-red" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal-yellow" />
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        </div>
        <p className="pointer-events-none absolute inset-x-20 truncate text-center text-[11px] text-muted">
          {title}
        </p>
        <span
          className="ml-auto hidden text-[10px] text-muted/70 sm:block"
          aria-hidden="true"
        >
          zsh
        </span>
      </div>
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
