import { useRef, type ChangeEvent } from "react";
import { UPLOAD_ACCEPT } from "./checkUploadFile";

/** A button that opens the file picker, limited to the supported types. */
export function UploadButton({
  onFileChosen,
}: {
  onFileChosen: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = "";

    if (file) {
      onFileChosen(file);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button"
        onClick={() => inputRef.current?.click()}
      >
        ⬆ Upload
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="visually-hidden"
        aria-label="Upload a file"
        tabIndex={-1}
        onChange={handleChange}
      />
    </>
  );
}
