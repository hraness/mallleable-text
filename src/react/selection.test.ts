import { afterEach, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";

import { sourceFingerprint } from "../model.js";
import {
  MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE,
  MALLLEABLE_TEXT_ID_ATTRIBUTE,
  MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE,
  MALLLEABLE_TEXT_REVISION_ATTRIBUTE,
  MALLLEABLE_TEXT_SPACE_ATTRIBUTE,
  MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
} from "./contract.js";
import { readMalleableTextSelection, utf16OffsetWithin } from "./selection.js";

const globalRecord = globalThis as unknown as Record<string, unknown>;
const globalNames = ["HTMLElement", "Node"] as const;
const originalDescriptors = new Map(
  globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);

interface TestRangeOptions {
  readonly endContainer: Node;
  readonly endOffset: number;
  readonly rectangle?: Readonly<{
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
  }>;
  readonly startContainer: Node;
  readonly startOffset: number;
  readonly text: string;
}

class TestRange {
  readonly endContainer: Node;
  readonly endOffset: number;
  readonly startContainer: Node;
  readonly startOffset: number;
  private readonly rectangle: NonNullable<TestRangeOptions["rectangle"]>;
  private readonly text: string;

  constructor(options: TestRangeOptions) {
    this.endContainer = options.endContainer;
    this.endOffset = options.endOffset;
    this.startContainer = options.startContainer;
    this.startOffset = options.startOffset;
    this.text = options.text;
    this.rectangle = options.rectangle ?? {
      bottom: 40,
      height: 20,
      left: 20,
      right: 120,
      top: 20,
      width: 100,
    };
  }

  cloneRange(): TestRange {
    return new TestRange({
      endContainer: this.endContainer,
      endOffset: this.endOffset,
      rectangle: this.rectangle,
      startContainer: this.startContainer,
      startOffset: this.startOffset,
      text: this.text,
    });
  }

  collapse(): void {}
  getBoundingClientRect(): NonNullable<TestRangeOptions["rectangle"]> {
    return this.rectangle;
  }
  getClientRects(): readonly NonNullable<TestRangeOptions["rectangle"]>[] {
    return [this.rectangle];
  }
  setStart(): void {}
  toString(): string {
    return this.text;
  }
}

function installDocument(body: string): Document {
  const { document, window } = parseHTML(
    `<!doctype html><html><body>${body}</body></html>`,
  );
  const windowRecord = window as unknown as Record<string, unknown>;
  globalRecord.HTMLElement = windowRecord.HTMLElement;
  globalRecord.Node = windowRecord.Node;
  return document;
}

function testSelection(options: {
  readonly anchorNode: Node;
  readonly anchorOffset: number;
  readonly focusNode: Node;
  readonly focusOffset: number;
  readonly range: TestRange;
}): Selection {
  return {
    anchorNode: options.anchorNode,
    anchorOffset: options.anchorOffset,
    focusNode: options.focusNode,
    focusOffset: options.focusOffset,
    getRangeAt: () => options.range as unknown as Range,
    isCollapsed: false,
    rangeCount: 1,
  } as unknown as Selection;
}

function marker(document: Document, selector = "p"): HTMLElement {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) throw new Error("Test marker missing.");
  element.setAttribute(MALLLEABLE_TEXT_ID_ATTRIBUTE, "guide.summary");
  element.setAttribute(MALLLEABLE_TEXT_REVISION_ATTRIBUTE, "7");
  element.setAttribute(MALLLEABLE_TEXT_SPACE_ATTRIBUTE, "documentation");
  element.setAttribute(
    MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE,
    element.textContent ?? "",
  );
  element.setAttribute(
    MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
    sourceFingerprint(element.textContent ?? ""),
  );
  return element;
}

afterEach(() => {
  for (const name of globalNames) {
    const descriptor = originalDescriptors.get(name);
    if (descriptor === undefined) delete globalRecord[name];
    else Object.defineProperty(globalThis, name, descriptor);
  }
});

describe("readMalleableTextSelection", () => {
  test("keeps UTF-16 offsets for emoji and combining marks in nested prose", () => {
    const document = installDocument("<p>A <strong>😀é</strong> omega</p>");
    const root = marker(document);
    const strongText = root.querySelector("strong")?.firstChild;
    if (strongText === null || strongText === undefined) {
      throw new Error("Nested text missing.");
    }
    const range = new TestRange({
      endContainer: strongText,
      endOffset: 4,
      startContainer: strongText,
      startOffset: 0,
      text: "😀é",
    });
    const selection = testSelection({
      anchorNode: strongText,
      anchorOffset: 4,
      focusNode: strongText,
      focusOffset: 0,
      range,
    });

    expect(utf16OffsetWithin(root, { node: strongText, offset: 4 })).toBe(6);
    expect(readMalleableTextSelection(selection, document)).toMatchObject({
      descriptor: {
        contentId: "guide.summary",
        defaultText: "A 😀é omega",
        legacyContentIds: [],
        sourceFingerprint: sourceFingerprint("A 😀é omega"),
        space: "documentation",
      },
      direction: "backward",
      expectedRevision: 7,
      range: {
        end: 6,
        exact: "😀é",
        prefix: "A ",
        start: 2,
        suffix: " omega",
      },
    });
  });

  test("accepts element boundary points without flattening the DOM", () => {
    const document = installDocument("<p><span>First</span> and last</p>");
    const root = marker(document);
    const range = new TestRange({
      endContainer: root,
      endOffset: 2,
      startContainer: root,
      startOffset: 1,
      text: " and last",
    });
    const selection = testSelection({
      anchorNode: root,
      anchorOffset: 1,
      focusNode: root,
      focusOffset: 2,
      range,
    });
    expect(readMalleableTextSelection(selection, document)?.range).toEqual({
      end: 14,
      exact: " and last",
      prefix: "First",
      start: 5,
      suffix: "",
    });
  });

  test("rejects a selection that crosses content identities", () => {
    const document = installDocument("<p>First</p><p>Second</p>");
    const first = marker(document, "p:first-child");
    const second = marker(document, "p:last-child");
    second.setAttribute(MALLLEABLE_TEXT_ID_ATTRIBUTE, "guide.details");
    const firstText = first.firstChild;
    const secondText = second.firstChild;
    if (firstText === null || secondText === null) throw new Error("Text missing.");
    const range = new TestRange({
      endContainer: secondText,
      endOffset: 3,
      startContainer: firstText,
      startOffset: 0,
      text: "FirstSec",
    });
    expect(readMalleableTextSelection(testSelection({
      anchorNode: firstText,
      anchorOffset: 0,
      focusNode: secondText,
      focusOffset: 3,
      range,
    }), document)).toBeNull();
  });

  test("rejects nested markers and selections that include code", () => {
    const nestedDocument = installDocument(
      `<p ${MALLLEABLE_TEXT_ID_ATTRIBUTE}="outer" ${MALLLEABLE_TEXT_REVISION_ATTRIBUTE}="0">Before <span ${MALLLEABLE_TEXT_ID_ATTRIBUTE}="inner" ${MALLLEABLE_TEXT_REVISION_ATTRIBUTE}="0">inside</span></p>`,
    );
    const outer = nestedDocument.querySelector("p");
    const outerText = outer?.firstChild;
    if (!(outer instanceof HTMLElement) || outerText === null || outerText === undefined) {
      throw new Error("Nested fixture missing.");
    }
    const nestedRange = new TestRange({
      endContainer: outerText,
      endOffset: 6,
      startContainer: outerText,
      startOffset: 0,
      text: "Before",
    });
    expect(readMalleableTextSelection(testSelection({
      anchorNode: outerText,
      anchorOffset: 0,
      focusNode: outerText,
      focusOffset: 6,
      range: nestedRange,
    }), nestedDocument)).toBeNull();

    const codeDocument = installDocument("<p>Safe <code>command</code> tail</p>");
    const codeMarker = marker(codeDocument);
    const before = codeMarker.firstChild;
    const after = codeMarker.lastChild;
    if (before === null || after === null) throw new Error("Code fixture missing.");
    const codeRange = new TestRange({
      endContainer: after,
      endOffset: 5,
      startContainer: before,
      startOffset: 0,
      text: "Safe command tail",
    });
    expect(readMalleableTextSelection(testSelection({
      anchorNode: before,
      anchorOffset: 0,
      focusNode: after,
      focusOffset: 5,
      range: codeRange,
    }), codeDocument)).toBeNull();
  });

  test("rejects collapsed, whitespace-only, and malformed marker selections", () => {
    const document = installDocument("<p>   </p>");
    const root = marker(document);
    const text = root.firstChild;
    if (text === null) throw new Error("Whitespace fixture missing.");
    const range = new TestRange({
      endContainer: text,
      endOffset: 3,
      startContainer: text,
      startOffset: 0,
      text: "   ",
    });
    const selection = testSelection({
      anchorNode: text,
      anchorOffset: 0,
      focusNode: text,
      focusOffset: 3,
      range,
    });
    expect(readMalleableTextSelection(selection, document)).toBeNull();

    root.textContent = "Valid";
    root.setAttribute(MALLLEABLE_TEXT_REVISION_ATTRIBUTE, "01");
    const validText = root.firstChild;
    if (validText === null) throw new Error("Valid fixture missing.");
    const validRange = new TestRange({
      endContainer: validText,
      endOffset: 5,
      startContainer: validText,
      startOffset: 0,
      text: "Valid",
    });
    expect(readMalleableTextSelection(testSelection({
      anchorNode: validText,
      anchorOffset: 0,
      focusNode: validText,
      focusOffset: 5,
      range: validRange,
    }), document)).toBeNull();

    root.setAttribute(MALLLEABLE_TEXT_REVISION_ATTRIBUTE, "0");
    root.setAttribute(MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE, "not-json");
    expect(readMalleableTextSelection(testSelection({
      anchorNode: validText,
      anchorOffset: 0,
      focusNode: validText,
      focusOffset: 5,
      range: validRange,
    }), document)).toBeNull();
  });
});
