import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom has no layout engine. ProseMirror (inside Tiptap) asks for element and
// selection positions, so give it empty answers instead of crashing.
const EMPTY_RECT = new DOMRect(0, 0, 0, 0);
const emptyRectList = () =>
  Object.assign([] as DOMRect[], {
    item: () => null,
  }) as unknown as DOMRectList;

document.elementFromPoint = () => null;
Element.prototype.getClientRects = emptyRectList;
Range.prototype.getClientRects = emptyRectList;
Range.prototype.getBoundingClientRect = () => EMPTY_RECT;
