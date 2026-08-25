import { about, profile } from "@/content/site";
import Reveal from "./Reveal";
import Section from "./Section";

export default function About() {
  return (
    <Section
      id="about"
      eyebrow="cat ./about.md"
      title={`README: ${profile.name.toLowerCase()}`}
    >
      <div className="grid gap-5 md:grid-cols-5">
        <Reveal className="md:col-span-3">
          <div className="terminal-card h-full p-5 sm:p-6">
            <p className="mb-5 text-xs text-terminal-yellow"># about.md</p>
            {about.paragraphs.map((paragraph, index) => (
              <div
                key={paragraph.slice(0, 24)}
                className="grid grid-cols-[1.75rem_1fr] gap-2 border-l border-border/60 pb-5 last:pb-0"
              >
                <span className="text-right text-xs text-muted/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm leading-7 text-muted">{paragraph}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="md:col-span-2" delay={120}>
          <dl className="terminal-card h-full p-5 sm:p-6">
            <p className="mb-5 text-xs">
              <span className="text-accent">$</span>{" "}
              <span className="text-muted">printenv</span> | sort
            </p>
            {about.facts.map((fact, index) => (
              <div
                key={fact.label}
                className={
                  index === 0
                    ? ""
                    : "mt-4 border-t border-dashed border-border pt-4"
                }
              >
                <dt className="text-[11px] uppercase text-accent">
                  {fact.label.replaceAll(" ", "_")}=
                </dt>
                <dd className="mt-1.5 text-xs leading-5 text-muted">
                  &quot;{fact.value}&quot;
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </Section>
  );
}
