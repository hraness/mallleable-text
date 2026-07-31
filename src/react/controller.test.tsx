import { afterEach, describe, expect, test } from "bun:test";
import { parseHTML } from "linkedom";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { sourceFingerprint } from "../model.js";
import type {
  MalleableTextSaveRequest,
  MalleableTextSaveResult,
} from "./contract.js";
import { MalleableTextController } from "./controller.js";

const installedGlobals = [
  "document",
  "Document",
  "DocumentFragment",
  "Element",
  "Event",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLTextAreaElement",
  "Node",
  "navigator",
  "SVGElement",
  "window",
] as const;
const globalRecord = globalThis as unknown as Record<string, unknown>;
const originalDescriptors = new Map(
  installedGlobals.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
let mountedRoot: Root | null = null;

class TestRange {
  readonly endContainer: Node;
  readonly endOffset: number;
  readonly startContainer: Node;
  readonly startOffset: number;

  constructor(text: Node) {
    this.endContainer = text;
    this.endOffset = 8;
    this.startContainer = text;
    this.startOffset = 0;
  }

  cloneRange(): TestRange {
    return new TestRange(this.startContainer);
  }
  collapse(): void {}
  getBoundingClientRect() {
    return {
      bottom: 64,
      height: 20,
      left: 20,
      right: 100,
      top: 44,
      width: 80,
    };
  }
  getClientRects() {
    return [this.getBoundingClientRect()];
  }
  setStart(): void {}
  toString(): string {
    return "Editable";
  }
}

function testSelection(text: Node): Selection {
  const range = new TestRange(text);
  return {
    anchorNode: text,
    anchorOffset: 0,
    focusNode: text,
    focusOffset: 8,
    getRangeAt: () => range as unknown as Range,
    isCollapsed: false,
    rangeCount: 1,
  } as unknown as Selection;
}

interface InstalledDom {
  readonly container: HTMLElement;
  readonly listenerCounts: Readonly<{
    selectionAdded: () => number;
    selectionRemoved: () => number;
  }>;
  readonly marker: HTMLElement;
}

function installDom(): InstalledDom {
  const { document, window } = parseHTML(
    '<!doctype html><html><body><main id="surface"><p data-mallleable-text-id="home.intro" data-mallleable-text-revision="3" data-mallleable-text-source-fingerprint="source-1">Editable text</p></main><div id="root"></div></body></html>',
  );
  const windowRecord = window as unknown as Record<string, unknown>;
  for (const name of installedGlobals) {
    globalRecord[name] = name === "document"
      ? document
      : name === "window"
        ? window
        : windowRecord[name];
  }
  globalRecord.IS_REACT_ACT_ENVIRONMENT = true;

  const marker = document.querySelector("p");
  const container = document.getElementById("root");
  if (!(marker instanceof window.HTMLElement) || !(container instanceof window.HTMLElement)) {
    throw new Error("The controller test fixture is incomplete.");
  }
  const text = marker.firstChild;
  if (text === null) throw new Error("The controller test text is missing.");
  marker.setAttribute("data-mallleable-text-space", "site");
  marker.setAttribute("data-mallleable-text-default-text", "Editable text");
  marker.setAttribute(
    "data-mallleable-text-source-fingerprint",
    sourceFingerprint("Editable text"),
  );
  Object.defineProperty(window, "getSelection", {
    configurable: true,
    value: () => testSelection(text),
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 768,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value(this: HTMLElement) {
      Object.defineProperty(document, "activeElement", {
        configurable: true,
        value: this,
      });
      this.dispatchEvent(new window.Event("focusin", { bubbles: true }));
    },
  });
  Object.defineProperties(window.HTMLElement.prototype, {
    attachEvent: {
      configurable: true,
      value: () => undefined,
    },
    detachEvent: {
      configurable: true,
      value: () => undefined,
    },
  });

  let selectionAdded = 0;
  let selectionRemoved = 0;
  const addEventListener = document.addEventListener.bind(document);
  const removeEventListener = document.removeEventListener.bind(document);
  document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === "selectionchange") selectionAdded += 1;
    addEventListener(type, listener, options);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    if (type === "selectionchange") selectionRemoved += 1;
    removeEventListener(type, listener, options);
  }) as typeof document.removeEventListener;

  return {
    container,
    listenerCounts: {
      selectionAdded: () => selectionAdded,
      selectionRemoved: () => selectionRemoved,
    },
    marker,
  };
}

function click(element: Element): void {
  element.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
}

afterEach(() => {
  if (mountedRoot !== null) {
    act(() => mountedRoot?.unmount());
    mountedRoot = null;
  }
  for (const name of installedGlobals) {
    const descriptor = originalDescriptors.get(name);
    if (descriptor === undefined) delete globalRecord[name];
    else Object.defineProperty(globalThis, name, descriptor);
  }
  delete globalRecord.IS_REACT_ACT_ENVIRONMENT;
});

describe("MalleableTextController", () => {
  test("keeps the selected prose React-owned through retry and save", async () => {
    const { container, listenerCounts, marker } = installDom();
    const requests: MalleableTextSaveRequest[] = [];
    const results: MalleableTextSaveResult[] = [];
    let attempt = 0;
    let requestSequence = 0;
    mountedRoot = createRoot(container);
    const reactListenerBaseline = listenerCounts.selectionAdded();

    act(() => {
      mountedRoot?.render(
        <StrictMode>
          <MalleableTextController
            access={{ status: "authorized" }}
            createRequestId={() => {
              requestSequence += 1;
              return `request-${requestSequence}`;
            }}
            onResult={(result) => results.push(result)}
            root={document.body}
            save={(request) => {
              requests.push(request);
              attempt += 1;
              const result: unknown = attempt === 1
                ? {
                    canonicalContentId: "home.intro",
                    contentId: "home.intro",
                    origin: "authored",
                    replayed: false,
                    requestId: "a-different-request",
                    revision: 4,
                    sourceDrift: false,
                    sourceFingerprint: sourceFingerprint("Editable text"),
                    space: "site",
                    status: "saved",
                    text: "Editable text",
                  }
                : {
                    canonicalContentId: "home.intro",
                    contentId: "home.intro",
                    origin: "authored",
                    replayed: false,
                    requestId: request.requestId,
                    revision: 4,
                    sourceDrift: false,
                    sourceFingerprint: sourceFingerprint("Editable text"),
                    space: "site",
                    status: "saved",
                    text: "Editable text",
                  };
              return Promise.resolve(result);
            }}
          />
        </StrictMode>,
      );
    });

    const edit = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit selected text"]',
    );
    expect(edit).not.toBeNull();
    expect(edit?.style.width).toBe("48px");

    act(() => {
      if (edit !== null) click(edit);
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(textarea).not.toBeNull();
    const save = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Save");
    await act(async () => {
      if (save !== undefined) click(save);
      await Promise.resolve();
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "try again",
    );
    expect(marker.textContent).toBe("Editable text");

    const retry = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Try again");
    await act(async () => {
      if (retry !== undefined) click(retry);
      await Promise.resolve();
    });
    expect(results.map((result) => result.status)).toEqual([
      "retryable",
      "saved",
    ]);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.requestId).toBe(requests[0]?.requestId);
    expect(requests[0]?.range).toMatchObject({
      end: 8,
      exact: "Editable",
      start: 0,
      suffix: " text",
    });
    expect(requests[0]?.replacement).toBe("Editable");
    expect(requests[0]?.descriptor).toEqual({
      contentId: "home.intro",
      defaultText: "Editable text",
      legacyContentIds: [],
      sourceFingerprint: sourceFingerprint("Editable text"),
      space: "site",
    });
    expect(marker.textContent).toBe("Editable text");
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "saved",
    );

    act(() => mountedRoot?.unmount());
    mountedRoot = null;
    expect(listenerCounts.selectionAdded()).toBeGreaterThan(0);
    expect(listenerCounts.selectionRemoved()).toBe(
      listenerCounts.selectionAdded() - reactListenerBaseline,
    );
  });
});
