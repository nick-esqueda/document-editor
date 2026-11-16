import { useRef, useState, type DragEvent } from "react";

/**
 * Drag-and-drop handlers for an area that accepts one file.
 * isDraggingFile is true while files are dragged over the area, to show a drop hint.
 * Spread `dropHandlers` on the area's element.
 */
export function useFileDrop(onFileDropped: (file: File) => void) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // dragenter/dragleave also fire for every child element, so count them.
  const dragDepth = useRef(0);

  function handleDragEnter(event: DragEvent) {
    if (!hasFiles(event)) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setIsDraggingFile(true);
  }

  function handleDragOver(event: DragEvent) {
    if (hasFiles(event)) {
      // Required, or the browser won't allow dropping here.
      event.preventDefault();
    }
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setIsDraggingFile(false);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFile(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      onFileDropped(file);
    }
  }

  const dropHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return { isDraggingFile, dropHandlers };
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}
