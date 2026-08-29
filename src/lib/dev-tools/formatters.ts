import { parseDocument } from "yaml";

export type Formatter = "json" | "yaml" | "xml";

export type TreeNode = {
  label: string;
  type:
    | "object"
    | "array"
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "element"
    | "attribute"
    | "text";
  value?: string;
  children?: TreeNode[];
  nestedJson?: boolean;
  rawValue?: string;
};

export function formatJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Invalid JSON: ${message}`);
  }
}

export function formatJsonWithExpandedStrings(value: string) {
  try {
    return JSON.stringify(expandJsonStrings(JSON.parse(value)), null, 2);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Invalid JSON: ${message}`);
  }
}

function expandJsonStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(expandJsonStrings);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        expandJsonStrings(item),
      ]),
    );
  }

  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  const mightBeStructuredJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (!mightBeStructuredJson) return value;

  try {
    const parsed = JSON.parse(trimmed);

    if (parsed !== null && typeof parsed === "object") {
      return expandJsonStrings(parsed);
    }
  } catch {
    // Preserve malformed and ordinary strings.
  }

  return value;
}

export function formatYaml(value: string) {
  const document = parseDocument(value, {
    prettyErrors: true,
    strict: true,
  });

  if (document.errors.length > 0) {
    throw new Error(`Invalid YAML: ${document.errors[0].message}`);
  }

  return document.toString({
    indent: 2,
    lineWidth: 0,
  });
}

export function formatXml(value: string) {
  const document = new DOMParser().parseFromString(value, "application/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    const detail =
      parserError.textContent?.replace(/\s+/g, " ").trim() ?? "Invalid XML.";
    throw new Error(`Invalid XML: ${detail}`);
  }

  indentXmlElement(document.documentElement, 0, document);
  return new XMLSerializer().serializeToString(document);
}

function indentXmlElement(
  element: Element,
  depth: number,
  document: XMLDocument,
) {
  const children = Array.from(element.childNodes);
  const hasNestedNodes = children.some((node) =>
    (
      [
        Node.ELEMENT_NODE,
        Node.PROCESSING_INSTRUCTION_NODE,
        Node.COMMENT_NODE,
      ] as number[]
    ).includes(node.nodeType),
  );
  const hasSignificantText = children.some(
    (node) =>
      ([Node.TEXT_NODE, Node.CDATA_SECTION_NODE] as number[]).includes(
        node.nodeType,
      ) &&
      Boolean(node.textContent?.trim()),
  );

  if (hasNestedNodes && !hasSignificantText) {
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
        element.removeChild(node);
      }
    }

    const nestedChildren = Array.from(element.childNodes);

    for (const node of nestedChildren) {
      element.insertBefore(
        document.createTextNode(`\n${"  ".repeat(depth + 1)}`),
        node,
      );

      if (node.nodeType === Node.ELEMENT_NODE) {
        indentXmlElement(node as Element, depth + 1, document);
      }
    }

    element.appendChild(document.createTextNode(`\n${"  ".repeat(depth)}`));
    return;
  }

  for (const node of children) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      indentXmlElement(node as Element, depth + 1, document);
    }
  }
}

export function formatTreeNodeValue(
  node: TreeNode,
  mode: "raw" | "parsed",
) {
  const value = treeToCopiedValue(node, mode === "parsed");

  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function treeToCopiedValue(node: TreeNode, expand: boolean): unknown {
  if (!expand && node.nestedJson && node.rawValue !== undefined) {
    return node.rawValue;
  }

  switch (node.type) {
    case "object":
      return Object.fromEntries(
        (node.children ?? []).map((child) => [
          child.label,
          treeToCopiedValue(child, expand),
        ]),
      );
    case "array":
      return (node.children ?? []).map((child) =>
        treeToCopiedValue(child, expand),
      );
    case "number": {
      const parsed = Number(node.value);
      return node.value !== undefined && Number.isFinite(parsed)
        ? parsed
        : node.value;
    }
    case "boolean":
      return node.value === "true";
    case "null":
      return null;
    case "element":
      return serializeXmlElement(node);
    default:
      return node.value ?? "";
  }
}

function serializeXmlElement(node: TreeNode): string {
  const attributes = (node.children ?? [])
    .filter((child) => child.type === "attribute")
    .map(
      (child) =>
        `${child.label.replace(/^@/, "")}="${escapeXmlAttribute(child.value ?? "")}"`,
    )
    .join(" ");
  const inner = (node.children ?? [])
    .filter((child) => child.type !== "attribute")
    .map((child) =>
      child.type === "element"
        ? serializeXmlElement(child)
        : escapeXmlText(child.value ?? ""),
    )
    .join("");
  const attributePart = attributes ? ` ${attributes}` : "";

  if (!inner) return `<${node.label}${attributePart}/>`;
  return `<${node.label}${attributePart}>${inner}</${node.label}>`;
}

function escapeXmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value).replaceAll('"', "&quot;");
}

export function formatValue(formatter: Formatter, value: string) {
  switch (formatter) {
    case "json":
      return formatJson(value);
    case "yaml":
      return formatYaml(value);
    case "xml":
      return formatXml(value);
  }
}

export function buildFormatterTree(
  formatter: Formatter,
  value: string,
): TreeNode {
  switch (formatter) {
    case "json":
      return valueToTree("$", JSON.parse(value), new WeakSet(), true);
    case "yaml": {
      const document = parseDocument(value, { strict: true });

      if (document.errors.length > 0) {
        throw new Error(`Invalid YAML: ${document.errors[0].message}`);
      }

      return valueToTree("$", document.toJS(), new WeakSet(), false);
    }
    case "xml": {
      const document = new DOMParser().parseFromString(value, "application/xml");
      return xmlElementToTree(document.documentElement);
    }
  }
}

function valueToTree(
  label: string,
  value: unknown,
  visited: WeakSet<object>,
  parseJsonStrings: boolean,
): TreeNode {
  if (value === null) return { label, type: "null", value: "null" };

  if (typeof value === "object") {
    if (visited.has(value)) {
      return { label, type: "string", value: "[circular reference]" };
    }

    visited.add(value);

    if (Array.isArray(value)) {
      return {
        label,
        type: "array",
        children: value.map((item, index) =>
          valueToTree(String(index), item, visited, parseJsonStrings),
        ),
      };
    }

    return {
      label,
      type: "object",
      children: Object.entries(value).map(([key, item]) =>
        valueToTree(key, item, visited, parseJsonStrings),
      ),
    };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      parseJsonStrings &&
      ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]")))
    ) {
      try {
        const parsed = JSON.parse(trimmed);

        if (parsed !== null && typeof parsed === "object") {
          return {
            ...valueToTree(label, parsed, visited, true),
            nestedJson: true,
            rawValue: value,
          };
        }
      } catch {
        // Keep malformed or ordinary strings as scalar values.
      }
    }

    return { label, type: "string", value };
  }
  if (typeof value === "number") {
    return { label, type: "number", value: String(value) };
  }
  if (typeof value === "boolean") {
    return { label, type: "boolean", value: String(value) };
  }

  return { label, type: "string", value: String(value) };
}

function xmlElementToTree(element: Element): TreeNode {
  const children: TreeNode[] = [
    ...Array.from(element.attributes).map((attribute) => ({
      label: `@${attribute.name}`,
      type: "attribute" as const,
      value: attribute.value,
    })),
  ];

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      children.push(xmlElementToTree(node as Element));
    } else if (
      ([Node.TEXT_NODE, Node.CDATA_SECTION_NODE] as number[]).includes(
        node.nodeType,
      ) &&
      node.textContent?.trim()
    ) {
      children.push({
        label: node.nodeType === Node.CDATA_SECTION_NODE ? "#cdata" : "#text",
        type: "text",
        value: node.textContent.trim(),
      });
    }
  }

  return {
    label: element.tagName,
    type: "element",
    children,
  };
}
