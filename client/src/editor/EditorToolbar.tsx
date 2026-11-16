import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { HEADING_LEVELS } from "@doc-editor/shared";

type HeadingLevel = (typeof HEADING_LEVELS)[number];

interface ToolbarButton {
  label: string;
  content: string;
  className?: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** Toolbar buttons in display order. To add one, add an entry (and enable its extension). */
const FORMAT_BUTTONS: ToolbarButton[] = [
  {
    label: "Bold",
    content: "B",
    className: "is-bold",
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    content: "I",
    className: "is-italic",
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: "Underline",
    content: "U",
    className: "is-underline",
    isActive: (editor) => editor.isActive("underline"),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
];

const LIST_BUTTONS: ToolbarButton[] = [
  {
    label: "Bulleted list",
    content: "• List",
    isActive: (editor) => editor.isActive("bulletList"),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    content: "1. List",
    isActive: (editor) => editor.isActive("orderedList"),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

const HISTORY_BUTTONS: ToolbarButton[] = [
  {
    label: "Undo",
    content: "↶",
    isActive: () => false,
    run: (editor) => editor.chain().focus().undo().run(),
  },
  {
    label: "Redo",
    content: "↷",
    isActive: () => false,
    run: (editor) => editor.chain().focus().redo().run(),
  },
];

const ALL_BUTTONS = [...FORMAT_BUTTONS, ...LIST_BUTTONS, ...HISTORY_BUTTONS];
const NORMAL_TEXT_VALUE = "paragraph";

function readBlockType(editor: Editor): string {
  const activeLevel = HEADING_LEVELS.find((level) =>
    editor.isActive("heading", { level }),
  );
  return activeLevel ? `heading-${activeLevel}` : NORMAL_TEXT_VALUE;
}

function applyBlockType(editor: Editor, value: string): void {
  const chain = editor.chain().focus();

  if (value === NORMAL_TEXT_VALUE) {
    chain.setParagraph().run();
    return;
  }

  const level = Number(value.replace("heading-", "")) as HeadingLevel;
  chain.setHeading({ level }).run();
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  // Re-render only when the formatting at the cursor changes.
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      blockType: readBlockType(current),
      activeLabels: ALL_BUTTONS.filter((button) =>
        button.isActive(current),
      ).map((button) => button.label),
    }),
  });

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <select
        className="block-type"
        aria-label="Text style"
        value={toolbarState.blockType}
        onChange={(event) => applyBlockType(editor, event.target.value)}
      >
        <option value={NORMAL_TEXT_VALUE}>Normal text</option>
        {HEADING_LEVELS.map((level) => (
          <option key={level} value={`heading-${level}`}>
            Heading {level}
          </option>
        ))}
      </select>
      <ToolbarGroup
        buttons={FORMAT_BUTTONS}
        editor={editor}
        activeLabels={toolbarState.activeLabels}
      />
      <ToolbarGroup
        buttons={LIST_BUTTONS}
        editor={editor}
        activeLabels={toolbarState.activeLabels}
      />
      <ToolbarGroup
        buttons={HISTORY_BUTTONS}
        editor={editor}
        activeLabels={toolbarState.activeLabels}
      />
    </div>
  );
}

interface ToolbarGroupProps {
  buttons: ToolbarButton[];
  editor: Editor;
  activeLabels: string[];
}

function ToolbarGroup({ buttons, editor, activeLabels }: ToolbarGroupProps) {
  return (
    <>
      <span className="toolbar-separator" aria-hidden="true" />
      {buttons.map((button) => {
        const isActive = activeLabels.includes(button.label);
        const classNames = [
          "tool",
          button.className,
          isActive ? "is-active" : "",
        ].filter(Boolean);

        return (
          <button
            key={button.label}
            type="button"
            className={classNames.join(" ")}
            aria-label={button.label}
            aria-pressed={isActive}
            title={button.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => button.run(editor)}
          >
            {button.content}
          </button>
        );
      })}
    </>
  );
}
