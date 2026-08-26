import { profile } from "@/content/site";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-between gap-3 px-6 py-7 text-[11px] text-muted sm:flex-row sm:items-center">
        <p>
          <span className="text-accent">
            {profile.name.toLowerCase()}@home
          </span>
          <span className="text-terminal-cyan">:~</span>
          <span className="text-foreground">$</span> echo &quot;©{" "}
          {new Date().getFullYear()} {profile.name}&quot;
        </p>
        <p>
          Next.js + Tailwind CSS <span className="text-accent">· exit 0</span>
        </p>
      </div>
    </footer>
  );
}
