import { profile, socials } from "@/content/site";
import Reveal from "./Reveal";
import { ArrowRightIcon, socialIcons } from "./icons";
import TerminalWindow from "./TerminalWindow";

export default function Contact() {
  return (
    <section
      id="contact"
      className="mx-auto w-full max-w-5xl border-t border-dashed border-border/80 px-6 py-20 sm:py-24"
    >
      <Reveal>
        <TerminalWindow
          title={`contact.sh — ${profile.name.toLowerCase()}@home`}
          contentClassName="p-6 sm:p-10"
        >
          <p className="text-xs sm:text-sm">
            <span className="text-accent">
              {profile.name.toLowerCase()}@home
            </span>
            <span className="text-terminal-cyan">:~/contact</span>
            <span>$</span>{" "}
            <span className="text-muted">./contact.sh --connect</span>
          </p>

          <div className="mt-6 space-y-2 text-xs">
            <p>
              <span className="text-accent">[ OK ]</span>{" "}
              <span className="text-muted">connection module loaded</span>
            </p>
            <p>
              <span className="text-accent">[ OK ]</span>{" "}
              <span className="text-muted">
                preferred channel: LinkedIn
              </span>
            </p>
          </div>

          <h2 className="mt-8 text-2xl font-medium tracking-tight sm:text-3xl">
            Let&apos;s connect
            <span className="terminal-cursor" aria-hidden="true" />
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Want to talk about backend architecture, platform reliability, or
            engineering leadership? LinkedIn is the best place to reach me.
          </p>

          <a
            href={profile.contactUrl}
            target="_blank"
            rel="noreferrer"
            className="group mt-7 inline-flex items-center gap-2 rounded-sm border border-accent bg-accent px-4 py-2.5 text-xs font-medium text-accent-contrast transition hover:brightness-110 sm:text-sm"
          >
            ./open-linkedin.sh
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-dashed border-border pt-5">
            {socials.map((social) => {
              const Icon = socialIcons[social.icon];
              return (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="inline-flex items-center gap-2 text-xs text-muted transition hover:text-accent"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    ./{social.label.toLowerCase()}
                  </a>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 text-[10px] text-muted/60">
            Process finished with exit code 0.
          </p>
        </TerminalWindow>
      </Reveal>
    </section>
  );
}
