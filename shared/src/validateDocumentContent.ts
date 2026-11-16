import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { editorSchema, HEADING_LEVELS } from "./editorSchema";

export type ContentValidationResult =
  { isValid: true } | { isValid: false; reason: string };

interface JsonNode {
  type?: unknown;
  attrs?: Record<string, unknown>;
  marks?: JsonNode[];
  content?: JsonNode[];
}

/**
 * Checks, run in order. Each returns a reason when the content is invalid, or null.
 * To add a rule, append a check to this list.
 */
const CONTENT_CHECKS: Array<(content: unknown) => string | null> = [
  findRootProblem,
  (content) => findShapeProblem(content as JsonNode),
  (content) => findAttributeProblem(content as JsonNode),
  (content) => findHeadingLevelProblem(content as JsonNode),
  findSchemaProblem,
];

/** Validates document JSON against the editor schema before it is stored. */
export function validateDocumentContent(
  content: unknown,
): ContentValidationResult {
  for (const check of CONTENT_CHECKS) {
    const reason = check(content);

    if (reason) {
      return { isValid: false, reason };
    }
  }

  return { isValid: true };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findRootProblem(content: unknown): string | null {
  const isDocument = isPlainObject(content) && content.type === "doc";
  return isDocument
    ? null
    : 'Content must be a document object with type "doc"';
}

/** Makes sure attrs, marks and content have the right JSON types, so later checks can walk them safely. */
function findShapeProblem(node: JsonNode): string | null {
  const hasValidAttrs = node.attrs === undefined || isPlainObject(node.attrs);
  const childLists = [node.marks, node.content];
  const hasValidChildLists = childLists.every(
    (children) => children === undefined || Array.isArray(children),
  );

  if (!hasValidAttrs || !hasValidChildLists) {
    return `Invalid attrs, marks or content on ${String(node.type)}`;
  }

  return findFirstProblem(
    [...(node.marks ?? []), ...(node.content ?? [])],
    findShapeProblem,
  );
}

/** ProseMirror silently drops unknown attributes; we reject them instead. */
function findAttributeProblem(node: JsonNode): string | null {
  const attributeNames = Object.keys(node.attrs ?? {});
  // Unknown node and mark types are reported by the schema check instead.
  const allowedNames = readAllowedAttributeNames(node) ?? attributeNames;
  const unknownName = attributeNames.find(
    (name) => !allowedNames.includes(name),
  );

  if (unknownName) {
    return `Unsupported attribute "${unknownName}" on ${String(node.type)}`;
  }

  return findFirstProblem(
    [...(node.marks ?? []), ...(node.content ?? [])],
    findAttributeProblem,
  );
}

/** Returns the attribute names a node or mark type allows, or null for an unknown type. */
function readAllowedAttributeNames(node: JsonNode): string[] | null {
  const typeName = String(node.type);
  const nodeOrMarkType =
    editorSchema.nodes[typeName] ?? editorSchema.marks[typeName];

  return nodeOrMarkType ? Object.keys(nodeOrMarkType.spec.attrs ?? {}) : null;
}

function findHeadingLevelProblem(node: JsonNode): string | null {
  const isHeading = node.type === "heading";
  const level = node.attrs?.level;
  const isAllowedLevel = (HEADING_LEVELS as readonly unknown[]).includes(level);

  if (isHeading && !isAllowedLevel) {
    return `Heading level ${String(level)} is not supported`;
  }

  return findFirstProblem(node.content ?? [], findHeadingLevelProblem);
}

/** Unknown node/mark types and invalid nesting are caught by ProseMirror itself. */
function findSchemaProblem(content: unknown): string | null {
  try {
    const document = ProseMirrorNode.fromJSON(editorSchema, content);
    document.check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid document";
  }
}

function findFirstProblem(
  children: JsonNode[],
  findProblem: (child: JsonNode) => string | null,
): string | null {
  for (const child of children) {
    const problem = isPlainObject(child) ? findProblem(child) : "Invalid node";

    if (problem) {
      return problem;
    }
  }

  return null;
}
