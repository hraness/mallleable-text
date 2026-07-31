import type {
  ContentDescriptor,
  ReplaceTextRequest,
  SavedWriteResult,
  TextRange,
  WriteConflictResult,
  WriteForbiddenResult,
  WriteInvalidResult,
  WriteResult,
  WriteRetryableResult,
} from "../model.js";

export const MALLLEABLE_TEXT_ID_ATTRIBUTE = "data-mallleable-text-id";
export const MALLLEABLE_TEXT_SPACE_ATTRIBUTE = "data-mallleable-text-space";
export const MALLLEABLE_TEXT_REVISION_ATTRIBUTE =
  "data-mallleable-text-revision";
export const MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE =
  "data-mallleable-text-source-fingerprint";
export const MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE =
  "data-mallleable-text-default-text";
export const MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE =
  "data-mallleable-text-legacy-content-ids";

export type MalleableTextAccess =
  | { readonly status: "read-only" }
  | {
      readonly status: "no-session";
      readonly signIn: () => Promise<void> | void;
    }
  | {
      readonly status: "authorized";
      readonly accountLabel?: string;
      readonly signOut?: () => Promise<void> | void;
    };

export type MalleableTextRange = TextRange;
export type MalleableTextSaveRequest = ReplaceTextRequest;
export type MalleableTextSavedResult = SavedWriteResult;
export type MalleableTextConflictResult = WriteConflictResult;
export type MalleableTextInvalidResult = WriteInvalidResult;
export type MalleableTextForbiddenResult = WriteForbiddenResult;
export type MalleableTextRetryableResult = WriteRetryableResult;
export type MalleableTextSaveResult = WriteResult;

export type MalleableTextSaveAdapter = (
  request: MalleableTextSaveRequest,
  options: Readonly<{ signal: AbortSignal }>,
) => Promise<unknown>;

export interface MalleableTextSelectionAnchor {
  readonly bottom: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly width: number;
}

export interface MalleableTextSelection {
  readonly anchor: MalleableTextSelectionAnchor;
  readonly descriptor: ContentDescriptor;
  readonly direction: "backward" | "forward";
  readonly expectedRevision: number;
  readonly range: MalleableTextRange;
}

export interface MalleableTextMarkerDescriptor {
  readonly descriptor: ContentDescriptor;
  readonly revision: number;
}

export type { ContentDescriptor } from "../model.js";
