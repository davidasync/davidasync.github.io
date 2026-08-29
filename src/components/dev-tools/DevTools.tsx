"use client";

import { useEffect, useRef, useState } from "react";
import TerminalWindow from "@/components/TerminalWindow";
import { decodeBase64, encodeBase64 } from "@/lib/dev-tools/base64";
import { decodeSharedDiffHash } from "@/lib/dev-tools/diff-share";
import {
  buildFormatterTree,
  formatJsonWithExpandedStrings,
  formatValue,
  type Formatter,
  type TreeNode,
} from "@/lib/dev-tools/formatters";
import DiffChecker from "./DiffChecker";
import TreeView from "./TreeView";

type ToolId = "base64" | "diff" | Formatter;
type OutputMode = "tree" | "text";

type ToolState = {
  input: string;
  output: string;
  error: string;
  tree: TreeNode | null;
};

const tools: Array<{
  id: ToolId;
  label: string;
  command: string;
  description: string;
  inputPlaceholder: string;
}> = [
  {
    id: "json",
    label: "JSON",
    command: "./beautify.sh --json",
    description: "Validate and format JSON with two-space indentation.",
    inputPlaceholder: '{"hello":"world"}',
  },
  {
    id: "diff",
    label: "Diff",
    command: "./diff.sh --side-by-side",
    description: "Compare two text values with line and word highlighting.",
    inputPlaceholder: "Paste text to compare...",
  },
  {
    id: "yaml",
    label: "YAML",
    command: "./beautify.sh --yaml",
    description: "Parse and format YAML with readable indentation.",
    inputPlaceholder: "hello: world",
  },
  {
    id: "xml",
    label: "XML",
    command: "./beautify.sh --xml",
    description: "Validate and indent XML documents.",
    inputPlaceholder: "<root><message>Hello</message></root>",
  },
  {
    id: "base64",
    label: "Base64",
    command: "./base64.sh",
    description: "Encode or decode UTF-8 text locally in your browser.",
    inputPlaceholder: "Enter plain text or Base64...",
  },
];

const toolGroups: Array<{ label: string; tools: ToolId[] }> = [
  { label: "Format", tools: ["json", "yaml", "xml"] },
  { label: "Compare", tools: ["diff"] },
  { label: "Encode", tools: ["base64"] },
];

const emptyState = (): Record<ToolId, ToolState> => ({
  base64: { input: "", output: "", error: "", tree: null },
  diff: { input: "", output: "", error: "", tree: null },
  json: { input: "", output: "", error: "", tree: null },
  yaml: { input: "", output: "", error: "", tree: null },
  xml: { input: "", output: "", error: "", tree: null },
});

const buttonClass =
  "inline-flex items-center justify-center rounded-sm border px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

function OutputModeToggle({
  value,
  onChange,
}: {
  value: OutputMode;
  onChange: (value: OutputMode) => void;
}) {
  return (
    <div
      className="flex rounded-sm border border-border bg-background/60 p-0.5"
      aria-label="Output view"
    >
      {(["tree", "text"] as const).map((view) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className={`rounded-sm px-2 py-1 text-[10px] uppercase tracking-wide transition ${
            value === view
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {view}
        </button>
      ))}
    </div>
  );
}

function OutputViewer({
  activeTool,
  current,
  outputView,
  fullscreen = false,
}: {
  activeTool: ToolId;
  current: ToolState;
  outputView: OutputMode;
  fullscreen?: boolean;
}) {
  if (activeTool !== "base64" && outputView === "tree") {
    if (current.tree) {
      return <TreeView root={current.tree} fullscreen={fullscreen} />;
    }

    return (
      <div
        className={`flex items-center justify-center rounded-sm border border-border bg-surface-2/70 p-4 text-center text-xs text-muted ${
          fullscreen ? "min-h-0 flex-1" : "min-h-72"
        }`}
      >
        Beautify valid {activeTool.toUpperCase()} to build its tree.
      </div>
    );
  }

  return (
    <textarea
      value={current.output}
      readOnly
      aria-label="Processed output"
      placeholder="Processed output appears here..."
      spellCheck={false}
      className={`w-full rounded-sm border border-border bg-surface-2/70 p-4 text-sm leading-6 text-foreground placeholder:text-muted/55 focus:border-accent focus:outline-none ${
        fullscreen ? "min-h-0 flex-1 resize-none" : "min-h-72 resize-y"
      }`}
    />
  );
}

export default function DevTools() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTool, setActiveTool] = useState<ToolId>("json");
  const [toolStates, setToolStates] = useState(emptyState);
  const [outputView, setOutputView] = useState<OutputMode>("tree");
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState("");
  const tool = tools.find(({ id }) => id === activeTool) ?? tools[0];
  const current = toolStates[activeTool];

  useEffect(() => {
    const openSharedDiff = () => {
      if (decodeSharedDiffHash(window.location.hash)) {
        setActiveTool("diff");
      }
    };

    const timer = window.setTimeout(openSharedDiff, 0);
    window.addEventListener("hashchange", openSharedDiff);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openSharedDiff);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (fullscreen && !dialog.open) {
      dialog.showModal();
    } else if (!fullscreen && dialog.open) {
      dialog.close();
    }
  }, [fullscreen]);

  const updateCurrent = (update: Partial<ToolState>) => {
    setToolStates((states) => ({
      ...states,
      [activeTool]: { ...states[activeTool], ...update },
    }));
  };

  const run = (action: "encode" | "decode" | "format") => {
    setStatus("");

    try {
      let output: string;
      let tree: TreeNode | null = null;

      if (action === "encode") {
        output = encodeBase64(current.input);
      } else if (action === "decode") {
        output = decodeBase64(current.input);
      } else {
        const formatter = activeTool as Formatter;
        output = formatValue(formatter, current.input);
        tree = buildFormatterTree(formatter, output);
      }

      updateCurrent({ output, tree, error: "" });
    } catch (error) {
      updateCurrent({
        error: error instanceof Error ? error.message : "Unable to process input.",
      });
    }
  };

  const copyOutput = async () => {
    if (!current.output) return;

    try {
      const value =
        activeTool === "json"
          ? formatJsonWithExpandedStrings(current.output)
          : current.output;

      await navigator.clipboard.writeText(value);
      setStatus(
        activeTool === "json"
          ? "Parsed JSON copied to clipboard."
          : "Output copied to clipboard.",
      );
    } catch {
      setStatus("Clipboard access was denied.");
    }
  };

  const selectTool = (id: ToolId) => {
    setFullscreen(false);

    if (id !== "diff" && window.location.hash.startsWith("#diff=")) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }

    setActiveTool(id);
    setStatus("");
  };

  return (
    <TerminalWindow
      title={`${tool.command} — dev-tools`}
      contentClassName="p-4 sm:p-6"
    >
      <div
        className="flex items-end gap-4 overflow-x-auto border-b border-dashed border-border pb-4"
        role="tablist"
        aria-label="Developer tools"
      >
        {toolGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            role="presentation"
            className={`shrink-0 ${
              groupIndex > 0 ? "border-l border-border/70 pl-4" : ""
            }`}
          >
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-muted">
              {group.label}
            </p>
            <div className="flex gap-2" role="presentation">
              {group.tools.map((toolId) => {
                const item = tools.find(({ id }) => id === toolId);
                if (!item) return null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTool === item.id}
                    aria-controls="tool-panel"
                    onClick={() => selectTool(item.id)}
                    className={`${buttonClass} shrink-0 ${
                      activeTool === item.id
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div id="tool-panel" role="tabpanel" className="pt-5">
        <div className="mb-5">
          <p className="text-xs">
            <span className="text-accent">$</span>{" "}
            <span className="text-foreground">{tool.command}</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            <span className="mr-2 text-terminal-cyan">&gt;</span>
            {tool.description}
          </p>
        </div>

        {activeTool === "diff" ? (
          <DiffChecker />
        ) : (
          <>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeTool === "base64" ? (
            <>
              <button
                type="button"
                onClick={() => run("encode")}
                className={`${buttonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
              >
                encode
              </button>
              <button
                type="button"
                onClick={() => run("decode")}
                className={`${buttonClass} border-accent/60 bg-accent-soft text-accent hover:border-accent`}
              >
                decode
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => run("format")}
              className={`${buttonClass} border-accent bg-accent text-accent-contrast hover:brightness-110`}
            >
              beautify
            </button>
          )}

          <button
            type="button"
            onClick={() => void copyOutput()}
            disabled={!current.output}
            title={
              activeTool === "json"
                ? "Parse nested JSON strings into objects and arrays before copying"
                : undefined
            }
            className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
          >
            copy
          </button>
          <button
            type="button"
            onClick={() => {
              updateCurrent({ input: "", output: "", error: "", tree: null });
              setStatus("");
            }}
            disabled={!current.input && !current.output}
            className={`${buttonClass} border-transparent text-muted hover:border-border hover:text-foreground`}
          >
            clear
          </button>
        </div>

        <div className="mb-4 min-h-6 text-xs" aria-live="polite">
          {current.error ? (
            <p className="text-terminal-red">
              <span className="mr-2">[error]</span>
              {current.error}
            </p>
          ) : status ? (
            <p className="text-accent">
              <span className="mr-2">[ok]</span>
              {status}
            </p>
          ) : (
            <p className="text-muted">
              <span className="mr-2 text-accent">[ready]</span>
              Processing happens locally. Nothing is uploaded.
            </p>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.65fr)]">
          <label className="block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.16em] text-muted">
              stdin
            </span>
            <textarea
              value={current.input}
              onChange={(event) => {
                updateCurrent({ input: event.target.value, error: "" });
                setStatus("");
              }}
              placeholder={tool.inputPlaceholder}
              spellCheck={false}
              className="min-h-72 w-full resize-y rounded-sm border border-border bg-background/70 p-4 text-sm leading-6 text-foreground transition placeholder:text-muted/55 hover:border-accent/40 focus:border-accent focus:outline-none"
            />
          </label>

          <div className="block">
            <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
                stdout
              </span>
              <div className="flex items-center gap-2">
                {activeTool !== "base64" ? (
                  <OutputModeToggle
                    value={outputView}
                    onChange={setOutputView}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  disabled={!current.output}
                  className="rounded-sm border border-border bg-background/60 px-2 py-1 text-[10px] uppercase tracking-wide text-muted transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  fullscreen
                </button>
              </div>
            </div>

            <OutputViewer
              activeTool={activeTool}
              current={current}
              outputView={outputView}
            />
          </div>
        </div>
          </>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-label={`${tool.label} output`}
        onClose={() => setFullscreen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setFullscreen(false);
        }}
        className="m-auto h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-7xl overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_30px_100px_var(--terminal-shadow)] backdrop:bg-background/85 backdrop:backdrop-blur-sm"
      >
        <div className="flex h-full min-h-0 flex-col p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-border pb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                fullscreen output
              </p>
              <p className="mt-1 text-xs text-foreground">
                <span className="mr-2 text-accent">$</span>
                {tool.command}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTool !== "base64" ? (
                <OutputModeToggle
                  value={outputView}
                  onChange={setOutputView}
                />
              ) : null}
              <button
                type="button"
                onClick={() => void copyOutput()}
                disabled={!current.output}
                title={
                  activeTool === "json"
                    ? "Parse nested JSON strings into objects and arrays before copying"
                    : undefined
                }
                className={`${buttonClass} border-border bg-surface-2 text-muted hover:border-accent/60 hover:text-accent`}
              >
                copy value
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className={`${buttonClass} border-accent/60 bg-accent-soft text-accent hover:border-accent`}
              >
                close
              </button>
            </div>
          </div>

          <OutputViewer
            activeTool={activeTool}
            current={current}
            outputView={outputView}
            fullscreen
          />
        </div>
      </dialog>
    </TerminalWindow>
  );
}
