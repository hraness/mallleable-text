import {
  parseContentDescriptor,
  parseText,
  parseWriteResult
} from "../index-18tekesf.js";
import"../index-6j5pq722.js";

// src/react/account-control.tsx
import { useState } from "react";
import { jsxDEV } from "react/jsx-dev-runtime";
function MalleableTextAccountControl({
  access,
  className,
  signInLabel = "Sign in to edit",
  signOutLabel = "Sign out"
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  if (access.status === "read-only")
    return null;
  const action = access.status === "no-session" ? access.signIn : access.signOut;
  const label = access.status === "no-session" ? signInLabel : signOutLabel;
  const runAction = () => {
    if (action === undefined || pending)
      return;
    setPending(true);
    setError(null);
    Promise.resolve().then(action).catch(() => {
      setError("The account action did not complete. Try again.");
    }).finally(() => {
      setPending(false);
    });
  };
  return /* @__PURE__ */ jsxDEV("div", {
    className,
    children: [
      access.status === "authorized" && access.accountLabel !== undefined ? /* @__PURE__ */ jsxDEV("span", {
        children: access.accountLabel
      }, undefined, false, undefined, this) : null,
      action === undefined ? null : /* @__PURE__ */ jsxDEV("button", {
        disabled: pending,
        onClick: runAction,
        type: "button",
        children: pending ? "Please wait" : label
      }, undefined, false, undefined, this),
      error === null ? null : /* @__PURE__ */ jsxDEV("p", {
        role: "alert",
        children: error
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/react/controller.tsx
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState as useState2
} from "react";
import { createPortal } from "react-dom";

// src/react/reducer.ts
var initialMalleableTextEditorState = {
  status: "closed"
};
function assertNever(value) {
  throw new Error(`Unhandled editor value: ${JSON.stringify(value)}`);
}
function payloadFrom(state) {
  return {
    draft: state.draft,
    requestId: state.requestId,
    selection: state.selection
  };
}
function resolvedState(payload, result) {
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
function malleableTextEditorReducer(state, action) {
  switch (action.type) {
    case "open":
      return {
        draft: action.selection.range.exact,
        requestId: action.requestId,
        selection: action.selection,
        status: "editing"
      };
    case "change": {
      if (state.status === "closed" || state.status === "saving")
        return state;
      if (state.status === "saved")
        return state;
      if (state.status === "conflict" || state.status === "forbidden") {
        return { ...state, draft: action.draft };
      }
      return {
        ...payloadFrom(state),
        draft: action.draft,
        requestId: action.requestId,
        status: "editing"
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
function isMalleableTextEditorOpen(state) {
  return state.status !== "closed";
}
function canSubmitMalleableTextEditor(state) {
  return state.status === "editing" || state.status === "retryable";
}
function malleableTextEditorMessage(state) {
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

// src/react/contract.ts
var MALLLEABLE_TEXT_ID_ATTRIBUTE = "data-mallleable-text-id";
var MALLLEABLE_TEXT_SPACE_ATTRIBUTE = "data-mallleable-text-space";
var MALLLEABLE_TEXT_REVISION_ATTRIBUTE = "data-mallleable-text-revision";
var MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE = "data-mallleable-text-source-fingerprint";
var MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE = "data-mallleable-text-default-text";
var MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE = "data-mallleable-text-legacy-content-ids";

// src/react/selection.ts
var MALLLEABLE_TEXT_MARKER_SELECTOR = `[${MALLLEABLE_TEXT_ID_ATTRIBUTE}][${MALLLEABLE_TEXT_REVISION_ATTRIBUTE}]`;
var FORBIDDEN_SELECTION_SELECTOR = "button, input, select, textarea, pre, code, [contenteditable]:not([contenteditable='false'])";
var DEFAULT_CONTEXT_LENGTH = 32;
function elementAt(node) {
  if (node.nodeType === 1)
    return node;
  return node.parentElement;
}
function nearestMarker(node) {
  const element = elementAt(node);
  if (element === null)
    return null;
  const marker = element.closest(MALLLEABLE_TEXT_MARKER_SELECTOR);
  if (marker === null || marker.namespaceURI !== "http://www.w3.org/1999/xhtml") {
    return null;
  }
  return marker;
}
function isWithinRoot(root, node) {
  if (root.nodeType === 9) {
    return node.ownerDocument === root && root.documentElement.contains(node);
  }
  return root.contains(node);
}
function textLength(node) {
  return node.textContent?.length ?? 0;
}
function textBeforeChild(parent, childIndex) {
  if (childIndex < 0 || childIndex > parent.childNodes.length)
    return null;
  let length = 0;
  for (let index = 0;index < childIndex; index += 1) {
    const child = parent.childNodes.item(index);
    if (child === null)
      return null;
    length += textLength(child);
  }
  return length;
}
function utf16OffsetWithin(marker, boundary) {
  if (!marker.contains(boundary.node) && boundary.node !== marker)
    return null;
  let offset;
  if (boundary.node.nodeType === 3) {
    const value = boundary.node.nodeValue ?? "";
    if (boundary.offset < 0 || boundary.offset > value.length)
      return null;
    offset = boundary.offset;
  } else {
    const before = textBeforeChild(boundary.node, boundary.offset);
    if (before === null)
      return null;
    offset = before;
  }
  let current = boundary.node;
  while (current !== marker) {
    const parent = current.parentNode;
    if (parent === null)
      return null;
    const siblings = parent.childNodes;
    let index = -1;
    for (let cursor = 0;cursor < siblings.length; cursor += 1) {
      if (siblings.item(cursor) === current) {
        index = cursor;
        break;
      }
    }
    if (index < 0)
      return null;
    const before = textBeforeChild(parent, index);
    if (before === null)
      return null;
    offset += before;
    current = parent;
  }
  return offset;
}
function parsedRevision(marker) {
  const raw = marker.getAttribute(MALLLEABLE_TEXT_REVISION_ATTRIBUTE);
  if (raw === null || !/^(?:0|[1-9][0-9]*)$/.test(raw))
    return null;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : null;
}
function parsedDescriptor(marker) {
  const legacyIdsValue = marker.getAttribute(MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE);
  let legacyContentIds = [];
  if (legacyIdsValue !== null) {
    try {
      legacyContentIds = JSON.parse(legacyIdsValue);
    } catch {
      return null;
    }
  }
  const parsed = parseContentDescriptor({
    contentId: marker.getAttribute(MALLLEABLE_TEXT_ID_ATTRIBUTE),
    defaultText: marker.getAttribute(MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE),
    legacyContentIds,
    sourceFingerprint: marker.getAttribute(MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE),
    space: marker.getAttribute(MALLLEABLE_TEXT_SPACE_ATTRIBUTE)
  });
  return parsed.status === "valid" ? parsed.value : null;
}
function hasNestedMarker(marker) {
  return marker.querySelector(MALLLEABLE_TEXT_MARKER_SELECTOR) !== null || marker.parentElement?.closest(MALLLEABLE_TEXT_MARKER_SELECTOR) !== null;
}
function subtreeOffsets(marker, element) {
  const parent = element.parentNode;
  if (parent === null)
    return null;
  let index = -1;
  for (let cursor = 0;cursor < parent.childNodes.length; cursor += 1) {
    if (parent.childNodes.item(cursor) === element) {
      index = cursor;
      break;
    }
  }
  if (index < 0)
    return null;
  const start = utf16OffsetWithin(marker, { node: parent, offset: index });
  if (start === null)
    return null;
  return { end: start + textLength(element), start };
}
function selectionTouchesForbiddenContent(marker, range, start, end) {
  if (marker.matches(FORBIDDEN_SELECTION_SELECTOR))
    return true;
  for (const element of marker.querySelectorAll(FORBIDDEN_SELECTION_SELECTOR)) {
    try {
      if (range.intersectsNode(element))
        return true;
      continue;
    } catch {}
    const offsets = subtreeOffsets(marker, element);
    if (offsets === null)
      return true;
    if (offsets.start === offsets.end) {
      if (offsets.start >= start && offsets.start <= end)
        return true;
      continue;
    }
    if (offsets.start < end && offsets.end > start)
      return true;
  }
  return false;
}
function rectangleValue(rectangle) {
  return {
    bottom: rectangle.bottom,
    height: rectangle.height,
    left: rectangle.left,
    right: rectangle.right,
    top: rectangle.top,
    width: rectangle.width
  };
}
function usableRectangle(rectangle) {
  return rectangle !== undefined && [rectangle.bottom, rectangle.left, rectangle.right, rectangle.top].every(Number.isFinite);
}
function focusRectangle(range, selection, marker, direction) {
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
    const selected = direction === "backward" ? rectangles.at(0) : rectangles.at(-1);
    if (usableRectangle(selected))
      return rectangleValue(selected);
    const rangeRect = range.getBoundingClientRect();
    if (usableRectangle(rangeRect))
      return rectangleValue(rangeRect);
  } catch {}
  return rectangleValue(marker.getBoundingClientRect());
}
function sameBoundary(node, offset, boundaryNode, boundaryOffset) {
  return node === boundaryNode && offset === boundaryOffset;
}
function selectionDirection(selection, range) {
  const focusAtStart = sameBoundary(selection.focusNode, selection.focusOffset, range.startContainer, range.startOffset);
  const focusAtEnd = sameBoundary(selection.focusNode, selection.focusOffset, range.endContainer, range.endOffset);
  return focusAtStart && !focusAtEnd ? "backward" : "forward";
}
function isInsideSurrogatePair(text, offset) {
  if (offset <= 0 || offset >= text.length)
    return false;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return before >= 55296 && before <= 56319 && after >= 56320 && after <= 57343;
}
function readMalleableTextSelection(selection, root, contextLength = DEFAULT_CONTEXT_LENGTH) {
  if (selection === null || selection.rangeCount !== 1 || selection.isCollapsed || !Number.isSafeInteger(contextLength) || contextLength < 0) {
    return null;
  }
  if (selection.anchorNode === null || selection.focusNode === null)
    return null;
  const anchorMarker = nearestMarker(selection.anchorNode);
  const focusMarker = nearestMarker(selection.focusNode);
  if (anchorMarker === null || anchorMarker !== focusMarker || !isWithinRoot(root, anchorMarker) || hasNestedMarker(anchorMarker)) {
    return null;
  }
  const endpointElements = [
    elementAt(selection.anchorNode),
    elementAt(selection.focusNode)
  ];
  if (endpointElements.some((element) => element?.closest(FORBIDDEN_SELECTION_SELECTOR) !== null)) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const start = utf16OffsetWithin(anchorMarker, {
    node: range.startContainer,
    offset: range.startOffset
  });
  const end = utf16OffsetWithin(anchorMarker, {
    node: range.endContainer,
    offset: range.endOffset
  });
  if (start === null || end === null || start >= end)
    return null;
  if (selectionTouchesForbiddenContent(anchorMarker, range, start, end)) {
    return null;
  }
  const text = anchorMarker.textContent ?? "";
  const exact = text.slice(start, end);
  if (exact.trim().length === 0 || range.toString() !== exact)
    return null;
  const descriptor = parsedDescriptor(anchorMarker);
  const expectedRevision = parsedRevision(anchorMarker);
  if (descriptor === null || expectedRevision === null) {
    return null;
  }
  const direction = selectionDirection(selection, range);
  const rawPrefixStart = Math.max(0, start - contextLength);
  const prefixStart = isInsideSurrogatePair(text, rawPrefixStart) ? rawPrefixStart + 1 : rawPrefixStart;
  const rawSuffixEnd = Math.min(text.length, end + contextLength);
  const suffixEnd = isInsideSurrogatePair(text, rawSuffixEnd) ? rawSuffixEnd - 1 : rawSuffixEnd;
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
      suffix: text.slice(end, suffixEnd)
    }
  };
}

// src/react/controller.tsx
import { jsxDEV as jsxDEV2, Fragment } from "react/jsx-dev-runtime";
var POPUP_SIZE = 48;
var POPUP_GAP = 8;
var fallbackRequestSequence = 0;
var popupStyle = {
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
  zIndex: 2147483646
};
var backdropStyle = {
  alignItems: "center",
  background: "rgba(0, 0, 0, 0.58)",
  display: "flex",
  inset: 0,
  justifyContent: "center",
  padding: 16,
  position: "fixed",
  zIndex: 2147483647
};
var dialogStyle = {
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
  width: "100%"
};
var textareaStyle = {
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
  width: "100%"
};
var actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "flex-end"
};
var buttonStyle = {
  background: "ButtonFace",
  border: "1px solid ButtonText",
  borderRadius: 6,
  color: "ButtonText",
  cursor: "pointer",
  font: "inherit",
  minHeight: 44,
  padding: "8px 16px"
};
function defaultRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackRequestSequence += 1;
  return `mallleable-text-${Date.now().toString(36)}-${fallbackRequestSequence.toString(36)}`;
}
function ownerDocumentFor(root) {
  if (root !== null && root !== undefined) {
    return root.nodeType === 9 ? root : root.ownerDocument;
  }
  return typeof document === "undefined" ? null : document;
}
function rootFor(root, ownerDocument) {
  return root ?? ownerDocument;
}
function popupPosition(selection, view) {
  const viewportWidth = view?.innerWidth ?? 1024;
  const viewportHeight = view?.innerHeight ?? 768;
  const preferredTop = selection.anchor.top - POPUP_SIZE - POPUP_GAP;
  const top = preferredTop >= POPUP_GAP ? preferredTop : selection.anchor.bottom + POPUP_GAP;
  const left = selection.direction === "backward" ? selection.anchor.left - POPUP_SIZE / 2 : selection.anchor.right - POPUP_SIZE / 2;
  return {
    left: Math.max(POPUP_GAP, Math.min(left, viewportWidth - POPUP_SIZE - POPUP_GAP)),
    top: Math.max(POPUP_GAP, Math.min(top, viewportHeight - POPUP_SIZE - POPUP_GAP))
  };
}
function failureResult(requestId) {
  return { code: "component_unavailable", requestId, status: "retryable" };
}
function saveRequest(selection, requestId, replacement) {
  return {
    descriptor: selection.descriptor,
    expectedRevision: selection.expectedRevision,
    range: selection.range,
    replacement,
    requestId
  };
}
function EditIcon() {
  return /* @__PURE__ */ jsxDEV2("svg", {
    "aria-hidden": "true",
    fill: "none",
    height: "24",
    viewBox: "0 0 24 24",
    width: "24",
    children: [
      /* @__PURE__ */ jsxDEV2("path", {
        d: "M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2("path", {
        d: "m13 7 4 4",
        stroke: "currentColor",
        strokeWidth: "2"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function MalleableTextController({
  access,
  createRequestId = defaultRequestId,
  editLabel = "Edit selected text",
  heading = "Edit selected text",
  onResult,
  portalTarget,
  root,
  save
}) {
  const [candidate, setCandidate] = useState2(null);
  const [editor, dispatch] = useReducer(malleableTextEditorReducer, initialMalleableTextEditorState);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const textareaRef = useRef(null);
  const doneRef = useRef(null);
  const activeAbort = useRef(null);
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
    if (access.status === "authorized")
      return;
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
    if (access.status !== "authorized" || ownerDocument === null)
      return;
    const view = ownerDocument.defaultView;
    const selectionRoot = rootFor(root, ownerDocument);
    let frame = null;
    let stopped = false;
    const refresh = () => {
      frame = null;
      if (stopped || editorOpenRef.current)
        return;
      const selection = view?.getSelection() ?? null;
      setCandidate(readMalleableTextSelection(selection, selectionRoot));
    };
    const schedule = () => {
      if (frame !== null || stopped)
        return;
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
      if (frame !== null)
        view?.cancelAnimationFrame(frame);
    };
  }, [access.status, ownerDocument, root]);
  useEffect(() => {
    if (!editorOpen)
      return;
    let active = true;
    queueMicrotask(() => {
      if (!active)
        return;
      if (editor.status === "saved")
        doneRef.current?.focus();
      else
        textareaRef.current?.focus();
    });
    return () => {
      active = false;
    };
  }, [editor.status, editorOpen]);
  useEffect(() => {
    if (wasOpenRef.current && !editorOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      queueMicrotask(() => triggerRef.current?.focus());
    }
    wasOpenRef.current = editorOpen;
  }, [editorOpen]);
  const position = useMemo(() => candidate === null ? null : popupPosition(candidate, ownerDocument?.defaultView ?? null), [candidate, ownerDocument]);
  const openEditor = useCallback(() => {
    if (candidate === null || access.status !== "authorized")
      return;
    dispatch({
      requestId: createRequestId(),
      selection: candidate,
      type: "open"
    });
  }, [access.status, candidate, createRequestId]);
  const closeEditor = useCallback((discardCandidate = false) => {
    if (editor.status === "saving")
      return;
    restoreFocusRef.current = true;
    if (discardCandidate)
      setCandidate(null);
    dispatch({ type: "close" });
  }, [editor.status]);
  const submit = useCallback(async () => {
    if (access.status !== "authorized" || editor.status !== "editing" && editor.status !== "retryable") {
      return;
    }
    activeAbort.current?.abort();
    const abort = new AbortController;
    activeAbort.current = abort;
    const request = saveRequest(editor.selection, editor.requestId, editor.draft);
    dispatch({ type: "submit" });
    let result;
    try {
      const value = await save(request, { signal: abort.signal });
      if (abort.signal.aborted)
        return;
      const parsed = parseWriteResult(value, request.requestId);
      result = parsed.status === "valid" ? parsed.value : failureResult(request.requestId);
    } catch {
      if (abort.signal.aborted)
        return;
      result = failureResult(request.requestId);
    } finally {
      if (activeAbort.current === abort)
        activeAbort.current = null;
    }
    dispatch({ requestId: request.requestId, result, type: "resolve" });
    onResult?.(result, request);
  }, [access.status, editor, onResult, save]);
  const handlePopupPointerDown = (event) => {
    event.preventDefault();
  };
  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape" && editor.status !== "saving") {
      event.preventDefault();
      closeEditor();
      return;
    }
    if (event.key !== "Tab")
      return;
    const dialog = dialogRef.current;
    if (dialog === null)
      return;
    const focusable = [...dialog.querySelectorAll("button:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")].filter((element) => !element.hidden);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (first === undefined || last === undefined)
      return;
    const active = ownerDocument?.activeElement ?? null;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };
  if (access.status !== "authorized" || portal === null)
    return null;
  const message = malleableTextEditorMessage(editor);
  const popup = candidate === null || position === null ? null : /* @__PURE__ */ jsxDEV2("button", {
    "aria-expanded": editorOpen,
    "aria-haspopup": "dialog",
    "aria-label": editLabel,
    onClick: openEditor,
    onPointerDown: handlePopupPointerDown,
    ref: triggerRef,
    style: {
      ...popupStyle,
      left: position.left,
      top: position.top,
      visibility: editorOpen ? "hidden" : "visible"
    },
    title: editLabel,
    type: "button",
    children: /* @__PURE__ */ jsxDEV2(EditIcon, {}, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
  const modal = !editorOpen ? null : /* @__PURE__ */ jsxDEV2("div", {
    style: backdropStyle,
    children: /* @__PURE__ */ jsxDEV2("div", {
      "aria-busy": editor.status === "saving",
      "aria-describedby": message === null ? undefined : messageId,
      "aria-labelledby": headingId,
      "aria-modal": "true",
      onKeyDown: handleDialogKeyDown,
      ref: dialogRef,
      role: "dialog",
      style: dialogStyle,
      children: [
        /* @__PURE__ */ jsxDEV2("h2", {
          id: headingId,
          style: { margin: 0 },
          children: heading
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("label", {
          htmlFor: textareaId,
          children: "Replacement text"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("textarea", {
          disabled: editor.status === "saving" || editor.status === "saved",
          id: textareaId,
          onChange: (event) => {
            dispatch({
              draft: event.currentTarget.value,
              requestId: createRequestId(),
              type: "change"
            });
          },
          ref: textareaRef,
          spellCheck: "true",
          style: textareaStyle,
          value: editor.draft
        }, undefined, false, undefined, this),
        message === null ? null : /* @__PURE__ */ jsxDEV2("p", {
          id: messageId,
          role: editor.status === "saved" ? "status" : "alert",
          children: message
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("div", {
          style: actionsStyle,
          children: editor.status === "saved" ? /* @__PURE__ */ jsxDEV2("button", {
            onClick: () => closeEditor(true),
            ref: doneRef,
            style: buttonStyle,
            type: "button",
            children: "Done"
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV2(Fragment, {
            children: [
              /* @__PURE__ */ jsxDEV2("button", {
                disabled: editor.status === "saving",
                onClick: () => closeEditor(),
                style: buttonStyle,
                type: "button",
                children: "Cancel"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV2("button", {
                disabled: !canSubmitMalleableTextEditor(editor),
                onClick: () => void submit(),
                style: buttonStyle,
                type: "button",
                children: editor.status === "saving" ? "Saving" : editor.status === "retryable" ? "Try again" : "Save"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
  return createPortal(/* @__PURE__ */ jsxDEV2(Fragment, {
    children: [
      popup,
      modal
    ]
  }, undefined, true, undefined, this), portal);
}

// src/react/marker.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
function validateMarkerDescriptor(marker) {
  const descriptor = parseContentDescriptor(marker.descriptor);
  if (descriptor.status === "invalid") {
    throw new TypeError(`The content descriptor is invalid: ${descriptor.code}.`);
  }
  if (!Number.isSafeInteger(marker.revision) || marker.revision < 0) {
    throw new TypeError("revision must be a nonnegative safe integer.");
  }
  return { descriptor: descriptor.value, revision: marker.revision };
}
function malleableTextMarkerAttributes(descriptor) {
  const validated = validateMarkerDescriptor(descriptor);
  const attributes = {
    [MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE]: validated.descriptor.defaultText,
    [MALLLEABLE_TEXT_ID_ATTRIBUTE]: validated.descriptor.contentId,
    [MALLLEABLE_TEXT_REVISION_ATTRIBUTE]: String(validated.revision),
    [MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE]: validated.descriptor.sourceFingerprint,
    [MALLLEABLE_TEXT_SPACE_ATTRIBUTE]: validated.descriptor.space
  };
  if (validated.descriptor.legacyContentIds.length === 0)
    return attributes;
  return {
    ...attributes,
    [MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE]: JSON.stringify(validated.descriptor.legacyContentIds)
  };
}
function MalleableTextMarker({
  children,
  descriptor,
  revision,
  ...attributes
}) {
  const parsedChildren = parseText(children);
  if (parsedChildren.status === "invalid") {
    throw new TypeError(`The marker text is invalid: ${parsedChildren.code}.`);
  }
  return /* @__PURE__ */ jsxDEV3("span", {
    ...attributes,
    ...malleableTextMarkerAttributes({ descriptor, revision }),
    children: parsedChildren.value
  }, undefined, false, undefined, this);
}

// src/react/index.ts
"use client";
var MalleableTextAccountControl2 = MalleableTextAccountControl;
var MalleableTextController2 = MalleableTextController;
var MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE2 = MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE;
var MALLLEABLE_TEXT_ID_ATTRIBUTE2 = MALLLEABLE_TEXT_ID_ATTRIBUTE;
var MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE2 = MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE;
var MALLLEABLE_TEXT_REVISION_ATTRIBUTE2 = MALLLEABLE_TEXT_REVISION_ATTRIBUTE;
var MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE2 = MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE;
var MALLLEABLE_TEXT_SPACE_ATTRIBUTE2 = MALLLEABLE_TEXT_SPACE_ATTRIBUTE;
var MalleableTextMarker2 = MalleableTextMarker;
var malleableTextMarkerAttributes2 = malleableTextMarkerAttributes;
var canSubmitMalleableTextEditor2 = canSubmitMalleableTextEditor;
var initialMalleableTextEditorState2 = initialMalleableTextEditorState;
var isMalleableTextEditorOpen2 = isMalleableTextEditorOpen;
var malleableTextEditorMessage2 = malleableTextEditorMessage;
var malleableTextEditorReducer2 = malleableTextEditorReducer;
var MALLLEABLE_TEXT_MARKER_SELECTOR2 = MALLLEABLE_TEXT_MARKER_SELECTOR;
var readMalleableTextSelection2 = readMalleableTextSelection;
var utf16OffsetWithin2 = utf16OffsetWithin;
export {
  utf16OffsetWithin2 as utf16OffsetWithin,
  readMalleableTextSelection2 as readMalleableTextSelection,
  malleableTextMarkerAttributes2 as malleableTextMarkerAttributes,
  malleableTextEditorReducer2 as malleableTextEditorReducer,
  malleableTextEditorMessage2 as malleableTextEditorMessage,
  isMalleableTextEditorOpen2 as isMalleableTextEditorOpen,
  initialMalleableTextEditorState2 as initialMalleableTextEditorState,
  canSubmitMalleableTextEditor2 as canSubmitMalleableTextEditor,
  MalleableTextMarker2 as MalleableTextMarker,
  MalleableTextController2 as MalleableTextController,
  MalleableTextAccountControl2 as MalleableTextAccountControl,
  MALLLEABLE_TEXT_SPACE_ATTRIBUTE2 as MALLLEABLE_TEXT_SPACE_ATTRIBUTE,
  MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE2 as MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
  MALLLEABLE_TEXT_REVISION_ATTRIBUTE2 as MALLLEABLE_TEXT_REVISION_ATTRIBUTE,
  MALLLEABLE_TEXT_MARKER_SELECTOR2 as MALLLEABLE_TEXT_MARKER_SELECTOR,
  MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE2 as MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE,
  MALLLEABLE_TEXT_ID_ATTRIBUTE2 as MALLLEABLE_TEXT_ID_ATTRIBUTE,
  MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE2 as MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE
};
