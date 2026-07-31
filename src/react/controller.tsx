import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

import { parseWriteResult } from "../model.js";
import type {
  MalleableTextAccess,
  MalleableTextSaveAdapter,
  MalleableTextSaveRequest,
  MalleableTextSaveResult,
  MalleableTextSelection,
} from "./contract.js";
import {
  canSubmitMalleableTextEditor,
  initialMalleableTextEditorState,
  isMalleableTextEditorOpen,
  malleableTextEditorMessage,
  malleableTextEditorReducer,
} from "./reducer.js";
import { readMalleableTextSelection } from "./selection.js";

const POPUP_SIZE = 48;
const POPUP_GAP = 8;
let fallbackRequestSequence = 0;

const popupStyle: CSSProperties = {
  alignItems: "center",
  background: "Canvas",
  border: "2px solid ButtonText",
  borderRadius: 999,
  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.24)",
  color: "ButtonText",
  cursor: "pointer",
  display: "flex",
  forcedColorAdjust: "auto",
  height: POPUP_SIZE,
  justifyContent: "center",
  margin: 0,
  padding: 0,
  position: "fixed",
  width: POPUP_SIZE,
  zIndex: 2_147_483_646,
};

const backdropStyle: CSSProperties = {
  alignItems: "center",
  background: "rgba(0, 0, 0, 0.58)",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  padding: 16,
  position: "fixed",
  zIndex: 2_147_483_647,
};

const dialogStyle: CSSProperties = {
  background: "Canvas",
  border: "1px solid ButtonText",
  borderRadius: 12,
  boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
  boxSizing: "border-box",
  color: "CanvasText",
  display: "grid",
  gap: 16,
  maxHeight: "calc(100vh - 32px)",
  maxWidth: 640,
  overflow: "auto",
  padding: 24,
  width: "100%",
};

const textareaStyle: CSSProperties = {
  background: "Field",
  border: "1px solid ButtonText",
  borderRadius: 6,
  boxSizing: "border-box",
  color: "FieldText",
  font: "inherit",
  lineHeight: 1.5,
  minHeight: 160,
  padding: 12,
  resize: "vertical",
  width: "100%",
};

const actionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end",
};

const buttonStyle: CSSProperties = {
  background: "ButtonFace",
  border: "1px solid ButtonText",
  borderRadius: 6,
  color: "ButtonText",
  cursor: "pointer",
  font: "inherit",
  minHeight: 44,
  padding: "8px 16px",
};

function defaultRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackRequestSequence += 1;
  return `mallleable-text-${Date.now().toString(36)}-${fallbackRequestSequence.toString(36)}`;
}

function ownerDocumentFor(
  root: Document | HTMLElement | null | undefined,
): Document | null {
  if (root !== null && root !== undefined) {
    return root.nodeType === 9
      ? root as Document
      : root.ownerDocument;
  }
  return typeof document === "undefined" ? null : document;
}

function rootFor(
  root: Document | HTMLElement | null | undefined,
  ownerDocument: Document,
): Document | HTMLElement {
  return root ?? ownerDocument;
}

function popupPosition(
  selection: MalleableTextSelection,
  view: Window | null,
): Readonly<{ left: number; top: number }> {
  const viewportWidth = view?.innerWidth ?? 1024;
  const viewportHeight = view?.innerHeight ?? 768;
  const preferredTop = selection.anchor.top - POPUP_SIZE - POPUP_GAP;
  const top = preferredTop >= POPUP_GAP
    ? preferredTop
    : selection.anchor.bottom + POPUP_GAP;
  const left = selection.direction === "backward"
    ? selection.anchor.left - POPUP_SIZE / 2
    : selection.anchor.right - POPUP_SIZE / 2;
  return {
    left: Math.max(
      POPUP_GAP,
      Math.min(left, viewportWidth - POPUP_SIZE - POPUP_GAP),
    ),
    top: Math.max(
      POPUP_GAP,
      Math.min(top, viewportHeight - POPUP_SIZE - POPUP_GAP),
    ),
  };
}

function failureResult(
  requestId: string,
): MalleableTextSaveResult {
  return { code: "component_unavailable", requestId, status: "retryable" };
}

function saveRequest(
  selection: MalleableTextSelection,
  requestId: string,
  replacement: string,
): MalleableTextSaveRequest {
  return {
    descriptor: selection.descriptor,
    expectedRevision: selection.expectedRevision,
    range: selection.range,
    replacement,
    requestId,
  };
}

function EditIcon(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
    >
      <path
        d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="m13 7 4 4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export interface MalleableTextControllerProps {
  readonly access: MalleableTextAccess;
  readonly createRequestId?: () => string;
  readonly editLabel?: string;
  readonly heading?: string;
  readonly onResult?: (
    result: MalleableTextSaveResult,
    request: MalleableTextSaveRequest,
  ) => void;
  readonly portalTarget?: HTMLElement | null;
  readonly root?: Document | HTMLElement | null;
  readonly save: MalleableTextSaveAdapter;
}

export function MalleableTextController({
  access,
  createRequestId = defaultRequestId,
  editLabel = "Edit selected text",
  heading = "Edit selected text",
  onResult,
  portalTarget,
  root,
  save,
}: MalleableTextControllerProps): ReactElement | null {
  const [candidate, setCandidate] = useState<MalleableTextSelection | null>(null);
  const [editor, dispatch] = useReducer(
    malleableTextEditorReducer,
    initialMalleableTextEditorState,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const activeAbort = useRef<AbortController | null>(null);
  const editorOpenRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const wasOpenRef = useRef(false);
  const generatedId = useId();
  const headingId = `${generatedId}-heading`;
  const messageId = `${generatedId}-message`;
  const textareaId = `${generatedId}-value`;
  const editorOpen = isMalleableTextEditorOpen(editor);
  editorOpenRef.current = editorOpen;

  const ownerDocument = ownerDocumentFor(root);
  const portal = portalTarget ?? ownerDocument?.body ?? null;

  useEffect(() => {
    if (access.status === "authorized") return;
    activeAbort.current?.abort();
    activeAbort.current = null;
    setCandidate(null);
    dispatch({ type: "close" });
  }, [access.status]);

  useEffect(() => () => {
    activeAbort.current?.abort();
    activeAbort.current = null;
  }, []);

  useEffect(() => {
    if (access.status !== "authorized" || ownerDocument === null) return;
    const view = ownerDocument.defaultView;
    const selectionRoot = rootFor(root, ownerDocument);
    let frame: number | null = null;
    let stopped = false;

    const refresh = (): void => {
      frame = null;
      if (stopped || editorOpenRef.current) return;
      const selection = view?.getSelection() ?? null;
      setCandidate(readMalleableTextSelection(selection, selectionRoot));
    };
    const schedule = (): void => {
      if (frame !== null || stopped) return;
      if (view?.requestAnimationFrame !== undefined) {
        frame = view.requestAnimationFrame(refresh);
      } else {
        refresh();
      }
    };

    ownerDocument.addEventListener("selectionchange", schedule);
    ownerDocument.addEventListener("scroll", schedule, true);
    view?.addEventListener("resize", schedule);
    view?.visualViewport?.addEventListener("resize", schedule);
    view?.visualViewport?.addEventListener("scroll", schedule);
    refresh();

    return () => {
      stopped = true;
      ownerDocument.removeEventListener("selectionchange", schedule);
      ownerDocument.removeEventListener("scroll", schedule, true);
      view?.removeEventListener("resize", schedule);
      view?.visualViewport?.removeEventListener("resize", schedule);
      view?.visualViewport?.removeEventListener("scroll", schedule);
      if (frame !== null) view?.cancelAnimationFrame(frame);
    };
  }, [access.status, ownerDocument, root]);

  useEffect(() => {
    if (!editorOpen) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (editor.status === "saved") doneRef.current?.focus();
      else textareaRef.current?.focus();
    });
    return () => {
      active = false;
    };
  }, [editor.status, editorOpen]);

  useEffect(() => {
    if (
      wasOpenRef.current &&
      !editorOpen &&
      restoreFocusRef.current
    ) {
      restoreFocusRef.current = false;
      queueMicrotask(() => triggerRef.current?.focus());
    }
    wasOpenRef.current = editorOpen;
  }, [editorOpen]);

  const position = useMemo(
    () => candidate === null
      ? null
      : popupPosition(candidate, ownerDocument?.defaultView ?? null),
    [candidate, ownerDocument],
  );

  const openEditor = useCallback((): void => {
    if (candidate === null || access.status !== "authorized") return;
    dispatch({
      requestId: createRequestId(),
      selection: candidate,
      type: "open",
    });
  }, [access.status, candidate, createRequestId]);

  const closeEditor = useCallback((discardCandidate = false): void => {
    if (editor.status === "saving") return;
    restoreFocusRef.current = true;
    if (discardCandidate) setCandidate(null);
    dispatch({ type: "close" });
  }, [editor.status]);

  const submit = useCallback(async (): Promise<void> => {
    if (
      access.status !== "authorized" ||
      (editor.status !== "editing" && editor.status !== "retryable")
    ) {
      return;
    }
    activeAbort.current?.abort();
    const abort = new AbortController();
    activeAbort.current = abort;
    const request = saveRequest(
      editor.selection,
      editor.requestId,
      editor.draft,
    );
    dispatch({ type: "submit" });

    let result: MalleableTextSaveResult;
    try {
      const value = await save(request, { signal: abort.signal });
      if (abort.signal.aborted) return;
      const parsed = parseWriteResult(value, request.requestId);
      result = parsed.status === "valid"
        ? parsed.value
        : failureResult(request.requestId);
    } catch {
      if (abort.signal.aborted) return;
      result = failureResult(request.requestId);
    } finally {
      if (activeAbort.current === abort) activeAbort.current = null;
    }
    dispatch({ requestId: request.requestId, result, type: "resolve" });
    onResult?.(result, request);
  }, [access.status, editor, onResult, save]);

  const handlePopupPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    event.preventDefault();
  };

  const handleDialogKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ): void => {
    if (event.key === "Escape" && editor.status !== "saving") {
      event.preventDefault();
      closeEditor();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
    )].filter((element) => !element.hidden);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    const active = ownerDocument?.activeElement ?? null;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  if (access.status !== "authorized" || portal === null) return null;

  const message = malleableTextEditorMessage(editor);
  const popup = candidate === null || position === null ? null : (
    <button
      aria-expanded={editorOpen}
      aria-haspopup="dialog"
      aria-label={editLabel}
      onClick={openEditor}
      onPointerDown={handlePopupPointerDown}
      ref={triggerRef}
      style={{
        ...popupStyle,
        left: position.left,
        top: position.top,
        visibility: editorOpen ? "hidden" : "visible",
      }}
      title={editLabel}
      type="button"
    >
      <EditIcon />
    </button>
  );

  const modal = !editorOpen ? null : (
    <div style={backdropStyle}>
      <div
        aria-busy={editor.status === "saving"}
        aria-describedby={message === null ? undefined : messageId}
        aria-labelledby={headingId}
        aria-modal="true"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        style={dialogStyle}
      >
        <h2 id={headingId} style={{ margin: 0 }}>
          {heading}
        </h2>
        <label htmlFor={textareaId}>Replacement text</label>
        <textarea
          disabled={editor.status === "saving" || editor.status === "saved"}
          id={textareaId}
          onChange={(event) => {
            dispatch({
              draft: event.currentTarget.value,
              requestId: createRequestId(),
              type: "change",
            });
          }}
          ref={textareaRef}
          spellCheck="true"
          style={textareaStyle}
          value={editor.draft}
        />
        {message === null ? null : (
          <p
            id={messageId}
            role={editor.status === "saved" ? "status" : "alert"}
          >
            {message}
          </p>
        )}
        <div style={actionsStyle}>
          {editor.status === "saved" ? (
            <button
              onClick={() => closeEditor(true)}
              ref={doneRef}
              style={buttonStyle}
              type="button"
            >
              Done
            </button>
          ) : (
            <>
              <button
                disabled={editor.status === "saving"}
                onClick={() => closeEditor()}
                style={buttonStyle}
                type="button"
              >
                Cancel
              </button>
              <button
                disabled={!canSubmitMalleableTextEditor(editor)}
                onClick={() => void submit()}
                style={buttonStyle}
                type="button"
              >
                {editor.status === "saving"
                  ? "Saving"
                  : editor.status === "retryable"
                    ? "Try again"
                    : "Save"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      {popup}
      {modal}
    </>,
    portal,
  );
}
