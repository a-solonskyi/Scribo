import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { serializeInstructions } from "../utils/assignmentInstructions";

export default function InstructionsEditor({ onChange, disabled }) {
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false, bulletList: false, orderedList: false,
        code: false, codeBlock: false, horizontalRule: false,
        link: false, strike: false,
      }),
      Placeholder.configure({ placeholder: "Optional instructions" }),
    ],
    editorProps: {
      attributes: { class: "instructions-editor-content", role: "textbox", "aria-label": "Instructions", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(serializeInstructions(currentEditor.getJSON())),
  });

  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  const heading = [1, 2, 3].find((level) => editor?.isActive("heading", { level })) || 0;

  return <div className="instructions-editor">
    <div className="instructions-toolbar" role="group" aria-label="Instructions formatting tools">
      <select aria-label="Instructions heading style" value={heading} disabled={disabled || !editor} onChange={(event) => {
        const level = Number(event.target.value);
        if (level) editor.chain().focus().setHeading({ level }).run();
        else editor.chain().focus().setParagraph().run();
      }}>
        <option value={0}>Normal text</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      {[
        ["bold", "Bold", "toggleBold", <strong key="bold">B</strong>],
        ["italic", "Italic", "toggleItalic", <em key="italic">I</em>],
        ["underline", "Underline", "toggleUnderline", <u key="underline">U</u>],
      ].map(([mark, label, command, content]) => <button
        key={mark} type="button" aria-label={label} title={label}
        aria-pressed={editor?.isActive(mark) || false}
        disabled={disabled || !editor}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor?.chain().focus()[command]().run()}
      >{content}</button>)}
    </div>
    <EditorContent editor={editor} />
  </div>;
}
