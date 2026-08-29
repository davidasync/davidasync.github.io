"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatTreeNodeValue,
  type TreeNode,
} from "@/lib/dev-tools/formatters";

type TreeViewProps = {
  root: TreeNode;
  fullscreen?: boolean;
};

type CopiedAction = "path" | "parsed";
type Expansion = "default" | "all" | "none";
type ContextMenuState = {
  x: number;
  y: number;
  path: string;
  node: TreeNode;
};

const copyButtonClass =
  "shrink-0 rounded-sm border border-border px-2 py-0.5 text-[9px] uppercase tracking-wide text-muted transition hover:border-accent/60 hover:text-accent";

export default function TreeView({
  root,
  fullscreen = false,
}: TreeViewProps) {
  const rootPath = root.type === "element" ? `/${root.label}` : "$";
  const [selection, setSelection] = useState<{
    root: TreeNode;
    path: string;
    node: TreeNode;
  } | null>(null);
  const [copied, setCopied] = useState<CopiedAction | null>(null);
  const [expansion, setExpansion] = useState<Expansion>("default");
  const [expansionVersion, setExpansionVersion] = useState(0);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected =
    selection?.root === root
      ? selection
      : { path: rootPath, node: root };
  const pathType = root.type === "element" ? "XPath" : "JSONPath";

  useEffect(() => {
    setExpansion("default");
    setExpansionVersion(0);
    setMenu(null);
  }, [root]);

  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const selectPath = (path: string, node: TreeNode) => {
    setSelection({ root, path, node });
    setCopied(null);
  };

  const openMenu = (
    event: React.MouseEvent,
    path: string,
    node: TreeNode,
  ) => {
    event.preventDefault();
    selectPath(path, node);

    const bounds = containerRef.current?.getBoundingClientRect();
    const width = 168;
    const height = 76;
    const left = bounds?.left ?? 0;
    const top = bounds?.top ?? 0;
    const maxX = (bounds?.width ?? window.innerWidth) - width - 8;
    const maxY = (bounds?.height ?? window.innerHeight) - height - 8;

    setMenu({
      x: Math.max(8, Math.min(event.clientX - left, maxX)),
      y: Math.max(8, Math.min(event.clientY - top, maxY)),
      path,
      node,
    });
  };

  const copy = async (
    action: CopiedAction,
    target: { path: string; node: TreeNode } = selected,
  ) => {
    const value =
      action === "path"
        ? target.path
        : formatTreeNodeValue(target.node);

    try {
      await navigator.clipboard.writeText(value);
      setCopied(action);
      setMenu(null);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}
    >
    <div
      className={`overflow-auto rounded-sm border border-border bg-surface-2/70 p-3 text-xs leading-6 sm:p-4 ${
        fullscreen ? "min-h-0 flex-1" : "min-h-72 max-h-[36rem]"
      }`}
      aria-label="Structured tree output"
    >
      <div className="sticky top-0 z-10 mb-3 flex min-w-0 flex-col gap-2 rounded-sm border border-border bg-surface/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted">
            {pathType}
          </span>
          <code
            className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] text-terminal-cyan"
            title={selected.path}
          >
            {selected.path}
          </code>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={expansion === "all"}
            onClick={() => {
              setExpansion((current) => (current === "all" ? "none" : "all"));
              setExpansionVersion((version) => version + 1);
            }}
            className={copyButtonClass}
          >
            {expansion === "all" ? "collapse all" : "expand all"}
          </button>
          <button
            type="button"
            onClick={() => void copy("path")}
            className={copyButtonClass}
          >
            {copied === "path" ? "copied" : "copy path"}
          </button>
          <button
            type="button"
            onClick={() => void copy("parsed")}
            className={copyButtonClass}
          >
            {copied === "parsed" ? "copied" : "copy value"}
          </button>
        </div>
      </div>

      <TreeBranch
        key={expansionVersion}
        node={root}
        depth={0}
        path={rootPath}
        selectedPath={selected.path}
        onSelect={selectPath}
        onMenu={openMenu}
        expansion={expansion}
      />

    </div>
      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Tree node actions"
          style={{ left: menu.x, top: menu.y }}
          className="absolute z-50 min-w-40 rounded-sm border border-border bg-surface py-1 shadow-[0_16px_40px_var(--terminal-shadow)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void copy("path", menu)}
            className="flex w-full px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-muted transition hover:bg-accent-soft hover:text-accent"
          >
            copy path
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void copy("parsed", menu)}
            className="flex w-full px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-muted transition hover:bg-accent-soft hover:text-accent"
          >
            copy value
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TreeBranch({
  node,
  depth,
  path,
  selectedPath,
  onSelect,
  onMenu,
  expansion,
}: {
  node: TreeNode;
  depth: number;
  path: string;
  selectedPath: string;
  onSelect: (path: string, node: TreeNode) => void;
  onMenu: (event: React.MouseEvent, path: string, node: TreeNode) => void;
  expansion: Expansion;
}) {
  const hasChildren = node.children !== undefined;
  const [expanded, setExpanded] = useState(initialExpanded(depth, expansion));
  const selected = selectedPath === path;

  if (!hasChildren) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(path, node)}
        onContextMenu={(event) => onMenu(event, path, node)}
        className={`flex w-full min-w-0 items-start gap-2 rounded-sm pr-2 pl-5 text-left transition ${
          selected ? "bg-accent-soft" : "hover:bg-accent-soft/60"
        }`}
      >
        <span className={`shrink-0 ${labelColor(node.type)}`}>
          {formatLabel(node)}
        </span>
        <span className="shrink-0 text-muted">:</span>
        <span
          className={`min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] ${valueColor(node.type)}`}
        >
          {formatValue(node)}
        </span>
      </button>
    );
  }

  const count = node.children?.length ?? 0;

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-pressed={selected}
        onClick={() => {
          onSelect(path, node);
          setExpanded((value) => !value);
        }}
        onContextMenu={(event) => onMenu(event, path, node)}
        className={`group flex max-w-full items-center gap-2 rounded-sm pr-2 text-left transition ${
          selected ? "bg-accent-soft" : "hover:bg-accent-soft/60"
        }`}
      >
        <span
          className={`inline-block w-3 text-[9px] text-muted transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        >
          ▶
        </span>
        <span className={labelColor(node.type)}>{formatLabel(node)}</span>
        <span className="text-muted">
          {node.type === "array" ? `[${count}]` : `{${count}}`}
        </span>
        {node.nestedJson ? (
          <span className="rounded-sm border border-terminal-yellow/40 bg-terminal-yellow/10 px-1.5 text-[9px] uppercase tracking-wide text-terminal-yellow">
            JSON string
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div className="ml-1.5 border-l border-border/80 pl-3">
          {count > 0 ? (
            node.children?.map((child, index) => (
              <TreeBranch
                key={`${child.label}-${child.type}-${index}`}
                node={child}
                depth={depth + 1}
                path={childPath(path, node, child, index)}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onMenu={onMenu}
                expansion={expansion}
              />
            ))
          ) : (
            <span className="pl-5 text-muted">empty</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function initialExpanded(depth: number, expansion: Expansion) {
  if (expansion === "all") return true;
  if (expansion === "none") return false;
  return depth < 2;
}

function childPath(
  parentPath: string,
  parent: TreeNode,
  child: TreeNode,
  childIndex: number,
) {
  if (parent.type === "array") {
    return `${parentPath}[${child.label}]`;
  }

  if (parent.type === "element") {
    if (child.type === "attribute") {
      return `${parentPath}/@${child.label.replace(/^@/, "")}`;
    }

    if (child.type === "text") {
      return `${parentPath}/text()`;
    }

    const matchingSiblings =
      parent.children?.filter(
        (sibling) =>
          sibling.type === "element" && sibling.label === child.label,
      ) ?? [];
    const position =
      parent.children
        ?.slice(0, childIndex + 1)
        .filter(
          (sibling) =>
            sibling.type === "element" && sibling.label === child.label,
        ).length ?? 1;
    const index = matchingSiblings.length > 1 ? `[${position}]` : "";

    return `${parentPath}/${child.label}${index}`;
  }

  if (/^[A-Za-z_$][\w$]*$/.test(child.label)) {
    return `${parentPath}.${child.label}`;
  }

  return `${parentPath}[${JSON.stringify(child.label)}]`;
}

function formatLabel(node: TreeNode) {
  if (node.type === "element") return `<${node.label}>`;
  return node.label;
}

function formatValue(node: TreeNode) {
  if (node.type === "string" || node.type === "attribute" || node.type === "text") {
    return JSON.stringify(node.value ?? "");
  }

  return node.value;
}

function labelColor(type: TreeNode["type"]) {
  if (type === "element") return "text-terminal-cyan";
  if (type === "attribute") return "text-terminal-yellow";
  return "text-foreground";
}

function valueColor(type: TreeNode["type"]) {
  switch (type) {
    case "string":
    case "attribute":
    case "text":
      return "text-accent";
    case "number":
      return "text-terminal-cyan";
    case "boolean":
      return "text-terminal-yellow";
    case "null":
      return "text-terminal-red";
    default:
      return "text-foreground";
  }
}
