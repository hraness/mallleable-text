import type {
  MalleableTextConflictResult,
  MalleableTextForbiddenResult,
  MalleableTextInvalidResult,
  MalleableTextRetryableResult,
  MalleableTextSavedResult,
  MalleableTextSaveResult,
  MalleableTextSelection,
} from "./contract.js";

interface EditorPayload {
  readonly draft: string;
  readonly requestId: string;
  readonly selection: MalleableTextSelection;
}

export type MalleableTextEditorState =
  | { readonly status: "closed" }
  | (EditorPayload & { readonly status: "editing" })
  | (EditorPayload & { readonly status: "saving" })
  | (EditorPayload & {
      readonly status: "saved";
      readonly result: MalleableTextSavedResult;
    })
  | (EditorPayload & {
      readonly status: "conflict";
      readonly result: MalleableTextConflictResult;
    })
  | (EditorPayload & {
      readonly status: "invalid";
      readonly result: MalleableTextInvalidResult;
    })
  | (EditorPayload & {
      readonly status: "forbidden";
      readonly result: MalleableTextForbiddenResult;
    })
  | (EditorPayload & {
      readonly status: "retryable";
      readonly result: MalleableTextRetryableResult;
    });

export type MalleableTextEditorAction =
  | {
      readonly type: "open";
      readonly requestId: string;
      readonly selection: MalleableTextSelection;
    }
  | {
      readonly type: "change";
      readonly draft: string;
      readonly requestId: string;
    }
  | { readonly type: "submit" }
  | {
      readonly type: "resolve";
      readonly requestId: string;
      readonly result: MalleableTextSaveResult;
    }
  | { readonly type: "close" };

export const initialMalleableTextEditorState: MalleableTextEditorState = {
  status: "closed",
};

function assertNever(value: never): never {
  throw new Error(`Unhandled editor value: ${JSON.stringify(value)}`);
}

function payloadFrom(
  state: Exclude<MalleableTextEditorState, { readonly status: "closed" }>,
): EditorPayload {
  return {
    draft: state.draft,
    requestId: state.requestId,
    selection: state.selection,
  };
}

function resolvedState(
  payload: EditorPayload,
  result: MalleableTextSaveResult,
): MalleableTextEditorState {
  switch (result.status) {
    case "saved":
      return { ...payload, result, status: "saved" };
    case "conflict":
      return { ...payload, result, status: "conflict" };
    case "invalid":
      return { ...payload, result, status: "invalid" };
    case "forbidden":
      return { ...payload, result, status: "forbidden" };
    case "retryable":
      return { ...payload, result, status: "retryable" };
    default:
      return assertNever(result);
  }
}

export function malleableTextEditorReducer(
  state: MalleableTextEditorState,
  action: MalleableTextEditorAction,
): MalleableTextEditorState {
  switch (action.type) {
    case "open":
      return {
        draft: action.selection.range.exact,
        requestId: action.requestId,
        selection: action.selection,
        status: "editing",
      };
    case "change": {
      if (state.status === "closed" || state.status === "saving") return state;
      if (state.status === "saved") return state;
      if (state.status === "conflict" || state.status === "forbidden") {
        return { ...state, draft: action.draft };
      }
      return {
        ...payloadFrom(state),
        draft: action.draft,
        requestId: action.requestId,
        status: "editing",
      };
    }
    case "submit": {
      if (state.status !== "editing" && state.status !== "retryable") {
        return state;
      }
      return { ...payloadFrom(state), status: "saving" };
    }
    case "resolve": {
      if (state.status !== "saving" || state.requestId !== action.requestId) {
        return state;
      }
      return resolvedState(payloadFrom(state), action.result);
    }
    case "close":
      return initialMalleableTextEditorState;
    default:
      return assertNever(action);
  }
}

export function isMalleableTextEditorOpen(
  state: MalleableTextEditorState,
): state is Exclude<MalleableTextEditorState, { readonly status: "closed" }> {
  return state.status !== "closed";
}

export function canSubmitMalleableTextEditor(
  state: MalleableTextEditorState,
): boolean {
  return state.status === "editing" || state.status === "retryable";
}

export function malleableTextEditorMessage(
  state: MalleableTextEditorState,
): string | null {
  switch (state.status) {
    case "closed":
    case "editing":
    case "saving":
      return null;
    case "saved":
      return "The text was saved.";
    case "conflict":
      return "The source text changed. Close this editor and select the text again.";
    case "invalid":
      return "The edit is not valid. Change the text and try again.";
    case "forbidden":
      return "Your account cannot edit this text.";
    case "retryable":
      return "The edit could not be saved. You can try again.";
    default:
      return assertNever(state);
  }
}
