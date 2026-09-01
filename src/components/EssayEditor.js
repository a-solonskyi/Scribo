import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useMemo } from "react";

const WRITING_PHRASES = [
  "Verba volant, scripta manent",
  "Nulla dies sine linea",
  "Litera scripta manet",
  "Scribere est cogitare",
  "Nescit vox missa reverti",
  "Qui scribit, bis legit",
  "Calamus gladio fortior",
  "Scripta publica probant",
  "Nota bene",
  "Gesta non verba",
  "Quantum sufficit",
  "Verbatim et literatim",
];

const FormattingShortcuts = Extension.create({
  name: "formattingShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.chain().focus().toggleBold().run(),
      "Mod-i": () => this.editor.chain().focus().toggleItalic().run(),
      "Mod-u": () => this.editor.chain().focus().toggleUnderline().run(),
    };
  },
});

function ToolbarButton({ active, label, title, onClick }) {
  return (
    <button
      className={active ? "toolbar-button active" : "toolbar-button"}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function getCurrentTextStyle(editor) {
  if (!editor) return "paragraph";
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "paragraph";
}

function setTextStyle(editor, value) {
  if (!editor) return;

  if (value === "paragraph") {
    editor.chain().focus().setParagraph().run();
    return;
  }

  editor
    .chain()
    .focus()
    .setHeading({ level: Number(value.replace("h", "")) })
    .run();
}

function getActiveParagraphIndex(editor) {
  const selectionPosition = editor.state.selection.from;
  let paragraphIndex = 0;
  let activeIndex = null;

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "paragraph") return true;

    if (
      activeIndex === null &&
      selectionPosition >= position &&
      selectionPosition <= position + node.nodeSize
    ) {
      activeIndex = paragraphIndex;
    }

    paragraphIndex += 1;
    return false;
  });

  return activeIndex ?? Math.max(0, paragraphIndex - 1);
}

function getPlainTextOffset(editor, documentPosition) {
  const textBefore = editor.state.doc.textBetween(0, documentPosition, "\n\n", "\n");
  return textBefore.length;
}

export default function EssayEditor({
  essayHtml,
  onEssayChange,
  onPaste,
}) {
  const writingPhrase = useMemo(
    () => WRITING_PHRASES[Math.floor(Math.random() * WRITING_PHRASES.length)],
    []
  );
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          blockquote: false,
          bulletList: false,
          orderedList: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Underline,
        FormattingShortcuts,
        Placeholder.configure({
          placeholder:
            "Start writing your essay here. Paragraph breaks will be preserved in the exported report.",
        }),
      ],
      content: essayHtml || "",
      editorProps: {
        attributes: {
          class: "essay-editor-content",
          "aria-label": "Essay body",
        },
      },
      onUpdate({ editor: currentEditor, transaction }) {
        const cursorPosition = getPlainTextOffset(
          currentEditor,
          currentEditor.state.selection.from
        );
        onEssayChange({
          html: currentEditor.getHTML(),
          text: currentEditor.getText({ blockSeparator: "\n\n" }),
          paragraphIndex: getActiveParagraphIndex(currentEditor),
          cursorPosition,
          isPasteTransaction:
            transaction?.getMeta("uiEvent") === "paste" ||
            transaction?.getMeta("paste") === true,
        });
      },
    },
    [onEssayChange, onPaste]
  );

  useEffect(() => {
    if (!editor) return;
    const nextHtml = essayHtml || "";
    if (editor.getHTML() !== nextHtml) {
      editor.commands.setContent(nextHtml, false);
    }
  }, [editor, essayHtml]);

  return (
    <section className="editor-panel" aria-label="Essay editor">
      <label className="field-label essay-label writing-phrase" htmlFor="essay-body">
        "{writingPhrase}"
      </label>
      <div className="essay-main">
        <div className="format-toolbar" aria-label="Essay formatting tools">
          <label className="heading-control">
            <span aria-hidden="true">H</span>
            <select
              className="heading-select"
              value={getCurrentTextStyle(editor)}
              onChange={(event) => setTextStyle(editor, event.target.value)}
              aria-label="Text heading style"
            >
              <option value="paragraph">Normal</option>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
          <ToolbarButton
            active={editor?.isActive("bold") || false}
            label="B"
            title="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={editor?.isActive("italic") || false}
            label="I"
            title="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={editor?.isActive("underline") || false}
            label="U"
            title="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
        </div>
        <div
          id="essay-body"
          className="essay-editor-shell"
          onPasteCapture={(event) => {
            const pastedText =
              event.clipboardData?.getData("text/plain") ||
              event.clipboardData?.getData("text") ||
              "";
            const position = editor
              ? getPlainTextOffset(editor, editor.state.selection.from)
              : 0;

            onPaste({
              pastedText,
              characterCount: pastedText.length,
              position,
              detectionMethod: "clipboard_event",
            });
          }}
          onBeforeInputCapture={(event) => {
            const nativeEvent = event.nativeEvent;
            if (nativeEvent.inputType !== "insertFromPaste") return;

            const pastedText =
              nativeEvent.dataTransfer?.getData("text/plain") ||
              nativeEvent.data ||
              "";
            const position = editor
              ? getPlainTextOffset(editor, editor.state.selection.from)
              : 0;

            onPaste({
              pastedText,
              characterCount: pastedText.length,
              position,
              detectionMethod: "beforeinput_paste",
            });
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </section>
  );
}
