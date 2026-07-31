"use client";

import * as accountControl from "./account-control.js";
import * as controller from "./controller.js";
import * as contract from "./contract.js";
import * as marker from "./marker.js";
import * as reducer from "./reducer.js";
import * as selection from "./selection.js";

export const MalleableTextAccountControl =
  accountControl.MalleableTextAccountControl;
export const MalleableTextController = controller.MalleableTextController;
export const MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE;
export const MALLLEABLE_TEXT_ID_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_ID_ATTRIBUTE;
export const MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE;
export const MALLLEABLE_TEXT_REVISION_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_REVISION_ATTRIBUTE;
export const MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE;
export const MALLLEABLE_TEXT_SPACE_ATTRIBUTE =
  contract.MALLLEABLE_TEXT_SPACE_ATTRIBUTE;
export const MalleableTextMarker = marker.MalleableTextMarker;
export const malleableTextMarkerAttributes =
  marker.malleableTextMarkerAttributes;
export const canSubmitMalleableTextEditor =
  reducer.canSubmitMalleableTextEditor;
export const initialMalleableTextEditorState =
  reducer.initialMalleableTextEditorState;
export const isMalleableTextEditorOpen = reducer.isMalleableTextEditorOpen;
export const malleableTextEditorMessage = reducer.malleableTextEditorMessage;
export const malleableTextEditorReducer = reducer.malleableTextEditorReducer;
export const MALLLEABLE_TEXT_MARKER_SELECTOR =
  selection.MALLLEABLE_TEXT_MARKER_SELECTOR;
export const readMalleableTextSelection =
  selection.readMalleableTextSelection;
export const utf16OffsetWithin = selection.utf16OffsetWithin;

export type { MalleableTextAccountControlProps } from "./account-control.js";
export type { MalleableTextControllerProps } from "./controller.js";
export type {
  ContentDescriptor,
  MalleableTextAccess,
  MalleableTextConflictResult,
  MalleableTextForbiddenResult,
  MalleableTextInvalidResult,
  MalleableTextMarkerDescriptor,
  MalleableTextRange,
  MalleableTextRetryableResult,
  MalleableTextSaveAdapter,
  MalleableTextSaveRequest,
  MalleableTextSaveResult,
  MalleableTextSavedResult,
  MalleableTextSelection,
  MalleableTextSelectionAnchor,
} from "./contract.js";
export type {
  MalleableTextMarkerAttributes,
  MalleableTextMarkerProps,
} from "./marker.js";
export type {
  MalleableTextEditorAction,
  MalleableTextEditorState,
} from "./reducer.js";
