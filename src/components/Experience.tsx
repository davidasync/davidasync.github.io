import { experience } from "@/content/site";
import Reveal from "./Reveal";
import Section from "./Section";
import { ExternalIcon } from "./icons";

export default function Experience() {
  return (
    <Section
      id="experience"
      eyebrow="history | grep career"
      title="career.log"
    >
      <ol className="space-y-5">
        {experience.map((job, index) => (
          <li key={`${job.company}-${job.period}`}>
            <Reveal delay={index * 80}>
              <article className="terminal-card p-5 sm:p-6">
                <p className="text-xs">
                  <span className="mr-3 text-muted/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-accent">$</span>{" "}
                  <span className="text-muted">cat</span>{" "}
                  ./experience/job-{String(index + 1).padStart(2, "0")}.log
                </p>

                <div className="mt-5 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
                  <h3 className="text-base font-medium sm:text-lg">
                    {job.role}
                    <span className="text-muted"> @ </span>
                    {job.companyUrl ? (
                      <a
                        href={job.companyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-terminal-cyan transition hover:text-accent"
                      >
                        {job.company}
                        <ExternalIcon className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <span className="text-terminal-cyan">{job.company}</span>
                    )}
                  </h3>
                  <p className="text-[11px] leading-5 text-terminal-yellow">
                    {job.period} <span className="text-muted">·</span>{" "}
                    {job.location}
                  </p>
                </div>

                <ul className="mt-5 space-y-2.5">
                  {job.points.map((point) => (
                    <li
                      key={point.slice(0, 24)}
                      className="grid grid-cols-[1rem_1fr] gap-2 text-xs leading-6 text-muted sm:text-sm"
                    >
                      <span className="text-accent">+</span>
                      {point}
                    </li>
                  ))}
                </ul>

                <ul className="mt-5 flex flex-wrap gap-x-3 gap-y-2 border-t border-dashed border-border pt-4">
                  {job.stack.map((tech) => (
                    <li key={tech} className="text-[11px] text-muted">
                      <span className="text-accent">[</span>
                      {tech}
                      <span className="text-accent">]</span>
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
