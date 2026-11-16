import { useState, type KeyboardEvent } from "react";
import { MAX_TITLE_LENGTH } from "@doc-editor/shared";

interface TitleInputProps {
  initialTitle: string;
  onCommit: (title: string) => void;
}

/** Inline-editable title. Saves on Enter or when focus leaves; an empty title reverts. */
export function TitleInput({ initialTitle, onCommit }: TitleInputProps) {
  const [draftTitle, setDraftTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);

  function commitTitle() {
    const trimmedTitle = draftTitle.trim();

    if (!trimmedTitle) {
      setDraftTitle(savedTitle);
      return;
    }

    setDraftTitle(trimmedTitle);
    if (trimmedTitle !== savedTitle) {
      setSavedTitle(trimmedTitle);
      onCommit(trimmedTitle);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraftTitle(savedTitle);
    }
  }

  return (
    <input
      className="title-input"
      aria-label="Document title"
      value={draftTitle}
      maxLength={MAX_TITLE_LENGTH}
      onChange={(event) => setDraftTitle(event.target.value)}
      onBlur={commitTitle}
      onKeyDown={handleKeyDown}
    />
  );
}
