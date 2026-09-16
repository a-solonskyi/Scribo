import assert from "node:assert/strict";
import test from "node:test";
import { instructionsText, normalizeInstructions, parseInstructions, serializeInstructions } from "./assignmentInstructions.js";

test("existing multiline instructions and literal markup remain plain text", () => {
  const text = "Read <chapter> & reflect.\nKeep your own voice.";
  assert.equal(normalizeInstructions(text), text);
  assert.equal(instructionsText(text), text);
  assert.equal(parseInstructions(text), null);
});

test("headings and all requested marks survive saving, with safe text-only export", () => {
  const doc = { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Рефлексія" }] },
    { type: "paragraph", content: [
      { type: "text", text: "Your argument", marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }] },
      { type: "hardBreak" }, { type: "text", text: "Use evidence." },
    ] },
  ] };
  const saved = normalizeInstructions(serializeInstructions(doc));
  assert.deepEqual(parseInstructions(saved), doc);
  assert.equal(instructionsText(saved), "Рефлексія\n\nYour argument\nUse evidence.");
});

test("formatting overhead is not silently truncated and oversized text is rejected", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", content: Array.from({ length: 150 }, () => ({ type: "text", text: "a", marks: [{ type: "bold" }] })) }] };
  const value = serializeInstructions(doc);
  assert.ok(value.length > 5000);
  assert.equal(instructionsText(normalizeInstructions(value)), "a".repeat(150));
  assert.throws(() => normalizeInstructions("a".repeat(5001)), /characters or fewer/);
  assert.equal(normalizeInstructions(serializeInstructions({ type: "doc", content: [{ type: "paragraph", content: [] }] })), null);
});

test("unapproved marks and attributes cannot become executable markup", () => {
  const doc = { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" }, content: [{ type: "text", text: "<script>alert(1)</script>", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }] }] }] };
  const saved = normalizeInstructions(serializeInstructions(doc));
  assert.deepEqual(parseInstructions(saved).content[0].content[0].marks, [{ type: "bold" }]);
  assert.equal(parseInstructions(saved).content[0].attrs, undefined);
  assert.equal(instructionsText(saved), "<script>alert(1)</script>");
});
