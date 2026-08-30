import { projects } from "@/content/site";
import Reveal from "./Reveal";
import Section from "./Section";
import { ExternalIcon, GitHubIcon } from "./icons";

export default function Projects() {
  return (
    <Section
      id="work"
      eyebrow="git log --work --stat"
      title="engineering-work.git"
      description="A few areas where I’ve led or contributed to product delivery, infrastructure, reliability, and developer workflows."
    >
      <div className="space-y-4">
        {projects.map((project, index) => (
          <Reveal key={project.title} delay={index * 80}>
            <article className="terminal-card group p-5 transition hover:border-accent/60 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs">
                  <span className="text-terminal-yellow">commit</span>{" "}
                  <span className="text-accent">
                    work/{String(index + 1).padStart(2, "0")}
                  </span>
                  {index === 0 ? (
                    <span className="text-muted"> (HEAD)</span>
                  ) : null}
                </p>
                <time className="shrink-0 text-[11px] text-muted">
                  {project.year}
                </time>
              </div>

              <h3 className="mt-4 text-lg font-medium tracking-tight">
                {project.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-terminal-cyan">
                feat(work): {project.blurb}
              </p>

              <p className="mt-4 border-l border-border pl-4 text-sm leading-7 text-muted">
                {project.description}
              </p>

              <ul className="mt-5 flex flex-wrap gap-x-3 gap-y-2">
                {project.tech.map((tech) => (
                  <li
                    key={tech}
                    className="text-[11px] text-muted"
                  >
                    <span className="text-accent">[</span>
                    {tech}
                    <span className="text-accent">]</span>
                  </li>
                ))}
              </ul>

              {project.demo || project.code ? (
                <div className="mt-5 flex items-center gap-4 border-t border-dashed border-border pt-4">
                  {project.demo ? (
                    <a
                      href={project.demo}
                      {...(isExternalHref(project.demo)
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-accent"
                    >
                      <ExternalIcon className="h-3.5 w-3.5" />
                      {isExternalHref(project.demo)
                        ? "open demo"
                        : "open ./dev-tools"}
                    </a>
                  ) : null}
                  {project.code ? (
                    <a
                      href={project.code}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-accent"
                    >
                      <GitHubIcon className="h-3.5 w-3.5" />
                      open github
                    </a>
                  ) : null}
                </div>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}
