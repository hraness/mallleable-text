import { parseContentDescriptor } from "../model.js";
import {
  MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE,
  MALLLEABLE_TEXT_ID_ATTRIBUTE,
  MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE,
  MALLLEABLE_TEXT_REVISION_ATTRIBUTE,
  MALLLEABLE_TEXT_SPACE_ATTRIBUTE,
  MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
  type MalleableTextSelection,
  type MalleableTextSelectionAnchor,
} from "./contract.js";

export const MALLLEABLE_TEXT_MARKER_SELECTOR =
  `[${MALLLEABLE_TEXT_ID_ATTRIBUTE}][${MALLLEABLE_TEXT_REVISION_ATTRIBUTE}]`;

const FORBIDDEN_SELECTION_SELECTOR =
  "button, input, select, textarea, pre, code, [contenteditable]:not([contenteditable='false'])";
const DEFAULT_CONTEXT_LENGTH = 32;

interface Boundary {
  readonly node: Node;
  readonly offset: number;
}

function elementAt(node: Node): Element | null {
  if (node.nodeType === 1) return node as Element;
  return node.parentElement;
}

function nearestMarker(node: Node): HTMLElement | null {
  const element = elementAt(node);
  if (element === null) return null;
  const marker = element.closest(MALLLEABLE_TEXT_MARKER_SELECTOR);
  if (marker === null || marker.namespaceURI !== "http://www.w3.org/1999/xhtml") {
    return null;
  }
  return marker as HTMLElement;
}

function isWithinRoot(root: Document | HTMLElement, node: Node): boolean {
  if (root.nodeType === 9) {
    return node.ownerDocument === root && root.documentElement.contains(node);
  }
  return root.contains(node);
}

function textLength(node: Node): number {
  return node.textContent?.length ?? 0;
}

function textBeforeChild(parent: Node, childIndex: number): number | null {
  if (childIndex < 0 || childIndex > parent.childNodes.length) return null;
  let length = 0;
  for (let index = 0; index < childIndex; index += 1) {
    const child = parent.childNodes.item(index);
    if (child === null) return null;
    length += textLength(child);
  }
  return length;
}

export function utf16OffsetWithin(
  marker: HTMLElement,
  boundary: Boundary,
): number | null {
  if (!marker.contains(boundary.node) && boundary.node !== marker) return null;

  let offset: number;
  if (boundary.node.nodeType === 3) {
    const value = boundary.node.nodeValue ?? "";
    if (boundary.offset < 0 || boundary.offset > value.length) return null;
    offset = boundary.offset;
  } else {
    const before = textBeforeChild(boundary.node, boundary.offset);
    if (before === null) return null;
    offset = before;
  }

  let current = boundary.node;
  while (current !== marker) {
    const parent = current.parentNode;
    if (parent === null) return null;
    const siblings = parent.childNodes;
    let index = -1;
    for (let cursor = 0; cursor < siblings.length; cursor += 1) {
      if (siblings.item(cursor) === current) {
        index = cursor;
        break;
      }
    }
    if (index < 0) return null;
    const before = textBeforeChild(parent, index);
    if (before === null) return null;
    offset += before;
    current = parent;
  }
  return offset;
}

function parsedRevision(marker: HTMLElement): number | null {
  const raw = marker.getAttribute(MALLLEABLE_TEXT_REVISION_ATTRIBUTE);
  if (raw === null || !/^(?:0|[1-9][0-9]*)$/.test(raw)) return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : null;
}

function parsedDescriptor(marker: HTMLElement) {
  const legacyIdsValue = marker.getAttribute(
    MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE,
  );
  let legacyContentIds: unknown = [];
  if (legacyIdsValue !== null) {
    try {
      legacyContentIds = JSON.parse(legacyIdsValue) as unknown;
    } catch {
      return null;
    }
  }
  const parsed = parseContentDescriptor({
    contentId: marker.getAttribute(MALLLEABLE_TEXT_ID_ATTRIBUTE),
    defaultText: marker.getAttribute(MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE),
    legacyContentIds,
    sourceFingerprint: marker.getAttribute(
      MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
    ),
    space: marker.getAttribute(MALLLEABLE_TEXT_SPACE_ATTRIBUTE),
  });
  return parsed.status === "valid" ? parsed.value : null;
}

function hasNestedMarker(marker: HTMLElement): boolean {
  return marker.querySelector(MALLLEABLE_TEXT_MARKER_SELECTOR) !== null ||
    marker.parentElement?.closest(MALLLEABLE_TEXT_MARKER_SELECTOR) !== null;
}

function subtreeOffsets(
  marker: HTMLElement,
  element: Element,
): Readonly<{ end: number; start: number }> | null {
  const parent = element.parentNode;
  if (parent === null) return null;
  let index = -1;
  for (let cursor = 0; cursor < parent.childNodes.length; cursor += 1) {
    if (parent.childNodes.item(cursor) === element) {
      index = cursor;
      break;
    }
  }
  if (index < 0) return null;
  const start = utf16OffsetWithin(marker, { node: parent, offset: index });
  if (start === null) return null;
  return { end: start + textLength(element), start };
}

function selectionTouchesForbiddenContent(
  marker: HTMLElement,
  range: Range,
  start: number,
  end: number,
): boolean {
  if (marker.matches(FORBIDDEN_SELECTION_SELECTOR)) return true;
  for (const element of marker.querySelectorAll(FORBIDDEN_SELECTION_SELECTOR)) {
    try {
      if (range.intersectsNode(element)) return true;
      continue;
    } catch {
      // Use text offsets when the browser cannot compare the nodes.
    }
    const offsets = subtreeOffsets(marker, element);
    if (offsets === null) return true;
    if (offsets.start === offsets.end) {
      if (offsets.start >= start && offsets.start <= end) return true;
      continue;
    }
    if (offsets.start < end && offsets.end > start) return true;
  }
  return false;
}

function rectangleValue(rectangle: DOMRect | DOMRectReadOnly): MalleableTextSelectionAnchor {
  return {
    bottom: rectangle.bottom,
    height: rectangle.height,
    left: rectangle.left,
    right: rectangle.right,
    top: rectangle.top,
    width: rectangle.width,
  };
}

function usableRectangle(
  rectangle: DOMRect | DOMRectReadOnly | undefined,
): rectangle is DOMRect | DOMRectReadOnly {
  return rectangle !== undefined &&
    [rectangle.bottom, rectangle.left, rectangle.right, rectangle.top].every(
      Number.isFinite,
    );
}

function focusRectangle(
  range: Range,
  selection: Selection,
  marker: HTMLElement,
  direction: "backward" | "forward",
): MalleableTextSelectionAnchor {
  try {
    const focusRange = range.cloneRange();
    if (selection.focusNode !== null) {
      focusRange.setStart(selection.focusNode, selection.focusOffset);
      focusRange.collapse(true);
      const focusRect = focusRange.getBoundingClientRect();
      if (usableRectangle(focusRect) && (focusRect.width > 0 || focusRect.height > 0)) {
        return rectangleValue(focusRect);
      }
    }
    const rectangles = [...range.getClientRects()];
    const selected = direction === "backward"
      ? rectangles.at(0)
      : rectangles.at(-1);
    if (usableRectangle(selected)) return rectangleValue(selected);
    const rangeRect = range.getBoundingClientRect();
    if (usableRectangle(rangeRect)) return rectangleValue(rangeRect);
  } catch {
    // A detached or browser-generated range can reject geometry operations.
  }
  return rectangleValue(marker.getBoundingClientRect());
}

function sameBoundary(
  node: Node | null,
  offset: number,
  boundaryNode: Node,
  boundaryOffset: number,
): boolean {
  return node === boundaryNode && offset === boundaryOffset;
}

function selectionDirection(
  selection: Selection,
  range: Range,
): "backward" | "forward" {
  const focusAtStart = sameBoundary(
    selection.focusNode,
    selection.focusOffset,
    range.startContainer,
    range.startOffset,
  );
  const focusAtEnd = sameBoundary(
    selection.focusNode,
    selection.focusOffset,
    range.endContainer,
    range.endOffset,
  );
  return focusAtStart && !focusAtEnd ? "backward" : "forward";
}

function isInsideSurrogatePair(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return before >= 0xd800 && before <= 0xdbff &&
    after >= 0xdc00 && after <= 0xdfff;
}

export function readMalleableTextSelection(
  selection: Selection | null,
  root: Document | HTMLElement,
  contextLength = DEFAULT_CONTEXT_LENGTH,
): MalleableTextSelection | null {
  if (
    selection === null ||
    selection.rangeCount !== 1 ||
    selection.isCollapsed ||
    !Number.isSafeInteger(contextLength) ||
    contextLength < 0
  ) {
    return null;
  }
  if (selection.anchorNode === null || selection.focusNode === null) return null;
  const anchorMarker = nearestMarker(selection.anchorNode);
  const focusMarker = nearestMarker(selection.focusNode);
  if (
    anchorMarker === null ||
    anchorMarker !== focusMarker ||
    !isWithinRoot(root, anchorMarker) ||
    hasNestedMarker(anchorMarker)
  ) {
    return null;
  }

  const endpointElements = [
    elementAt(selection.anchorNode),
    elementAt(selection.focusNode),
  ];
  if (endpointElements.some((element) =>
    element?.closest(FORBIDDEN_SELECTION_SELECTOR) !== null
  )) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const start = utf16OffsetWithin(anchorMarker, {
    node: range.startContainer,
    offset: range.startOffset,
  });
  const end = utf16OffsetWithin(anchorMarker, {
    node: range.endContainer,
    offset: range.endOffset,
  });
  if (start === null || end === null || start >= end) return null;
  if (selectionTouchesForbiddenContent(anchorMarker, range, start, end)) {
    return null;
  }

  const text = anchorMarker.textContent ?? "";
  const exact = text.slice(start, end);
  if (exact.trim().length === 0 || range.toString() !== exact) return null;

  const descriptor = parsedDescriptor(anchorMarker);
  const expectedRevision = parsedRevision(anchorMarker);
  if (descriptor === null || expectedRevision === null) {
    return null;
  }

  const direction = selectionDirection(selection, range);
  const rawPrefixStart = Math.max(0, start - contextLength);
  const prefixStart = isInsideSurrogatePair(text, rawPrefixStart)
    ? rawPrefixStart + 1
    : rawPrefixStart;
  const rawSuffixEnd = Math.min(text.length, end + contextLength);
  const suffixEnd = isInsideSurrogatePair(text, rawSuffixEnd)
    ? rawSuffixEnd - 1
    : rawSuffixEnd;
  return {
    anchor: focusRectangle(range, selection, anchorMarker, direction),
    descriptor,
    direction,
    expectedRevision,
    range: {
      end,
      exact,
      prefix: text.slice(prefixStart, start),
      start,
      suffix: text.slice(end, suffixEnd),
    },
  } satisfies MalleableTextSelection;
}
