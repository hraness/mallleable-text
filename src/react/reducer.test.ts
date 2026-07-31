import { describe, expect, test } from "bun:test";

import { sourceFingerprint } from "../model.js";
import type {
  MalleableTextSaveResult,
  MalleableTextSelection,
} from "./contract.js";
import {
  canSubmitMalleableTextEditor,
  initialMalleableTextEditorState,
  malleableTextEditorMessage,
  malleableTextEditorReducer,
  type MalleableTextEditorState,
} from "./reducer.js";

const selection: MalleableTextSelection = {
  anchor: {
    bottom: 24,
    height: 16,
    left: 10,
    right: 80,
    top: 8,
    width: 70,
  },
  descriptor: {
    contentId: "article.introduction",
    defaultText: "Use clear text here.",
    legacyContentIds: [],
    sourceFingerprint: sourceFingerprint("Use clear text here."),
    space: "documentation",
  },
  direction: "forward",
  expectedRevision: 4,
  range: {
    end: 10,
    exact: "clear text",
    prefix: "Use ",
    start: 0,
    suffix: " here.",
  },
};

function openEditor(): MalleableTextEditorState {
  return malleableTextEditorReducer(initialMalleableTextEditorState, {
    requestId: "request-1",
    selection,
    type: "open",
  });
}

function resolve(
  result: MalleableTextSaveResult,
): MalleableTextEditorState {
  const saving = malleableTextEditorReducer(openEditor(), { type: "submit" });
  return malleableTextEditorReducer(saving, {
    requestId: "request-1",
    result,
    type: "resolve",
  });
}

describe("malleableTextEditorReducer", () => {
  test("freezes the selected quote and revision when the editor opens", () => {
    expect(openEditor()).toEqual({
      draft: "clear text",
      requestId: "request-1",
      selection,
      status: "editing",
    });
  });

  test("maps every write result to an explicit editor state", () => {
    const results: readonly MalleableTextSaveResult[] = [
      {
        canonicalContentId: "article.introduction",
        contentId: "article.introduction",
        origin: "authored",
        replayed: false,
        requestId: "request-1",
        revision: 5,
        sourceDrift: false,
        sourceFingerprint: sourceFingerprint("Use clear text here."),
        space: "documentation",
        status: "saved",
        text: "direct text",
      },
      {
        code: "revision_conflict",
        currentRevision: 5,
        requestId: "request-1",
        status: "conflict",
      },
      { code: "invalid_text", requestId: "request-1", status: "invalid" },
      { requestId: "request-1", status: "forbidden" },
      {
        code: "component_unavailable",
        requestId: "request-1",
        status: "retryable",
      },
    ];
    expect(results.map((result) => resolve(result).status)).toEqual([
      "saved",
      "conflict",
      "invalid",
      "forbidden",
      "retryable",
    ]);
  });

  test("keeps the request ID for an exact retry after a lost response", () => {
    const retryable = resolve({
      code: "component_unavailable",
      requestId: "request-1",
      status: "retryable",
    });
    const retried = malleableTextEditorReducer(retryable, { type: "submit" });
    expect(retried.status).toBe("saving");
    expect(retried.status === "saving" ? retried.requestId : null).toBe(
      "request-1",
    );
  });

  test("creates a new write identity after the author changes a failed draft", () => {
    const invalid = resolve({
      code: "invalid_text",
      requestId: "request-1",
      status: "invalid",
    });
    const changed = malleableTextEditorReducer(invalid, {
      draft: "revised text",
      requestId: "request-2",
      type: "change",
    });
    expect(changed.status).toBe("editing");
    expect(changed.status === "editing" ? changed.draft : null).toBe(
      "revised text",
    );
    expect(changed.status === "editing" ? changed.requestId : null).toBe(
      "request-2",
    );
  });

  test("does not submit a stale conflict or a forbidden edit", () => {
    for (const state of [
      resolve({
        code: "revision_conflict",
        currentRevision: 5,
        requestId: "request-1",
        status: "conflict",
      }),
      resolve({ requestId: "request-1", status: "forbidden" }),
    ]) {
      expect(canSubmitMalleableTextEditor(state)).toBe(false);
      expect(malleableTextEditorReducer(state, { type: "submit" })).toBe(state);
      expect(malleableTextEditorMessage(state)).not.toBeNull();
    }
  });

  test("ignores a response for a different request", () => {
    const saving = malleableTextEditorReducer(openEditor(), { type: "submit" });
    const after = malleableTextEditorReducer(saving, {
      requestId: "request-other",
      result: { requestId: "request-other", status: "forbidden" },
      type: "resolve",
    });
    expect(after).toBe(saving);
  });
});
