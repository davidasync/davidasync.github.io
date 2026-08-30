import { profile, socials } from "@/content/site";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ExternalIcon,
  socialIcons,
} from "./icons";
import TerminalWindow from "./TerminalWindow";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-svh items-center overflow-hidden px-6 pt-24 pb-20"
    >
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="terminal-grid absolute inset-0 opacity-80" />
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <TerminalWindow
          title={`${profile.name.toLowerCase()}@home: ~`}
          contentClassName="p-5 sm:p-8 lg:p-10"
        >
          <p className="text-xs sm:text-sm">
            <span className="text-accent">
              {profile.name.toLowerCase()}@home
            </span>
            <span className="text-terminal-cyan">:~</span>
            <span className="text-foreground">$</span>{" "}
            <span className="text-foreground">whoami</span>
          </p>

          <div className="mt-6 border-l-2 border-accent/50 pl-4 sm:pl-6">
            <p className="text-xs text-terminal-yellow">
              {"// software engineer · platform builder"}
            </p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight text-foreground sm:text-6xl">
              {profile.name}
              <span className="terminal-cursor" aria-hidden="true" />
            </h1>
            <p className="mt-3 text-sm text-terminal-cyan sm:text-base">
              {profile.role} <span className="text-muted">·</span>{" "}
              {profile.location}
            </p>
          </div>

          <p className="mt-8 text-xs sm:text-sm">
            <span className="text-accent">$</span>{" "}
            <span className="text-muted">cat</span> ./profile.txt
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted sm:text-base">
            <span className="mr-2 text-accent">&gt;</span>
            {profile.tagline}
          </p>

          <p className="mt-5 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="text-accent">●</span>
            <span className="text-muted">[current]</span>
            <span>{profile.status}</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#work"
              className="group inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-4 py-2.5 text-xs font-medium text-accent-contrast transition hover:brightness-110 sm:text-sm"
            >
              <span>./view-work.sh</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={profile.contactUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-4 py-2.5 text-xs text-muted transition hover:border-accent/60 hover:text-accent sm:text-sm"
            >
              <ExternalIcon className="h-4 w-4" />
              open linkedin
            </a>
          </div>

          <div className="mt-8 border-t border-dashed border-border pt-5">
            <p className="text-[11px] text-muted">drwxr-xr-x ./links</p>
            <ul className="mt-3 flex flex-wrap items-center gap-2">
              {socials.map((social) => {
                const Icon = socialIcons[social.icon];
                return (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-[11px] text-muted transition hover:border-accent/60 hover:bg-accent-soft hover:text-accent"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {social.label.toLowerCase()}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </TerminalWindow>
      </div>

      <a
        href="#about"
        aria-label="Scroll to about"
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 text-muted transition hover:text-accent sm:block"
      >
        <ArrowDownIcon className="h-5 w-5" />
      </a>
    </section>
  );
}
