import { skillGroups } from "@/content/site";
import Reveal from "./Reveal";
import Section from "./Section";

export default function Skills() {
  return (
    <Section
      id="skills"
      eyebrow="tree ./skills --depth=2"
      title="skills/"
      description="Technical leadership grounded in product delivery, backend systems, cloud infrastructure, and operational reliability."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skillGroups.map((group, index) => (
          <Reveal key={group.title} delay={index * 70}>
            <div className="terminal-card h-full p-5 transition hover:border-accent/60">
              <h3 className="text-xs text-accent">
                drwxr-xr-x ./
                {group.title.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}
                /
              </h3>
              <ul className="mt-4 space-y-2">
                {group.items.map((item, itemIndex) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs leading-5 text-muted"
                  >
                    <span className="shrink-0 text-border">
                      {itemIndex === group.items.length - 1 ? "└──" : "├──"}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
