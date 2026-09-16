// Versioned Tiptap JSON keeps existing plain-text instructions intact and lets
// the reader render only supported formatting, without accepting arbitrary HTML.
const PREFIX = "scribo-instructions:v1:";
const MARKS = new Set(["bold", "italic", "underline"]);
export const INSTRUCTIONS_MAX_LENGTH = 5000;

function cleanInline(node) {
  if (node?.type === "hardBreak") return { type: "hardBreak" };
  if (node?.type !== "text" || typeof node.text !== "string") return null;
  return {
    type: "text",
    text: node.text,
    ...(Array.isArray(node.marks) ? {
      marks: node.marks.filter((mark) => MARKS.has(mark?.type)).map(({ type }) => ({ type })),
    } : {}),
  };
}

function cleanDocument(doc) {
  if (doc?.type !== "doc" || !Array.isArray(doc.content)) throw new Error("Instructions are invalid.");
  return {
    type: "doc",
    content: doc.content.map((node) => {
      if (!["paragraph", "heading"].includes(node?.type)) throw new Error("Instructions are invalid.");
      const heading = node.type === "heading";
      return {
        type: heading ? "heading" : "paragraph",
        ...(heading ? { attrs: { level: [1, 2, 3].includes(node.attrs?.level) ? node.attrs.level : 2 } } : {}),
        content: (Array.isArray(node.content) ? node.content : []).map(cleanInline).filter(Boolean),
      };
    }),
  };
}

export function parseInstructions(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return null;
  try { return cleanDocument(JSON.parse(value.slice(PREFIX.length))); } catch { return null; }
}

export function instructionsText(value) {
  const doc = parseInstructions(value);
  if (!doc) return value || "";
  return doc.content.map((block) => block.content.map((node) => node.type === "hardBreak" ? "\n" : node.text).join("")).join("\n\n");
}

export function serializeInstructions(doc) {
  const value = PREFIX + JSON.stringify(cleanDocument(doc));
  return instructionsText(value).trim() ? value : "";
}

export function normalizeInstructions(value) {
  const input = typeof value === "string" ? value.trim() : "";
  if (input.length > 200000) throw new Error("Instructions are too large.");
  const doc = parseInstructions(input);
  if (input.startsWith(PREFIX) && !doc) throw new Error("Instructions are invalid.");
  if (instructionsText(input).length > INSTRUCTIONS_MAX_LENGTH) {
    throw new Error(`Instructions must be ${INSTRUCTIONS_MAX_LENGTH.toLocaleString("en-US")} characters or fewer.`);
  }
  return (doc ? serializeInstructions(doc) : input) || null;
}
