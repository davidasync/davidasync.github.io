import type { Metadata } from "next";
import DevTools from "@/components/dev-tools/DevTools";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Dev Tools — davidasync",
  description:
    "Browser-based text diff checker, Base64 encoder and decoder, and JSON, YAML, and XML beautifiers.",
};

export default function DevToolsPage() {
  return (
    <>
      <Nav />
      <main id="top" className="relative flex-1 overflow-hidden px-6 pt-24 pb-20">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="terminal-grid absolute inset-0 opacity-80" />
        </div>

        <div className="mx-auto w-full max-w-7xl">
          <header className="mb-8 max-w-3xl">
            <p className="text-xs text-terminal-yellow">
              davidasync@home:~/dev-tools$ ls
            </p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-foreground sm:text-5xl">
              Developer Tools
              <span className="terminal-cursor" aria-hidden="true" />
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
              Small browser utilities for formatting, comparing, and encoding
              data. All processing stays on your device.
            </p>
          </header>

          <DevTools />
        </div>
      </main>
      <Footer />
    </>
  );
}
