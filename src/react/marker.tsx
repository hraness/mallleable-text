import type { HTMLAttributes, ReactElement } from "react";

import { parseContentDescriptor, parseText } from "../model.js";
import {
  MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE,
  MALLLEABLE_TEXT_ID_ATTRIBUTE,
  MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE,
  MALLLEABLE_TEXT_REVISION_ATTRIBUTE,
  MALLLEABLE_TEXT_SPACE_ATTRIBUTE,
  MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE,
  type MalleableTextMarkerDescriptor,
} from "./contract.js";

export interface MalleableTextMarkerAttributes {
  readonly "data-mallleable-text-id": string;
  readonly "data-mallleable-text-default-text": string;
  readonly "data-mallleable-text-legacy-content-ids"?: string;
  readonly "data-mallleable-text-revision": string;
  readonly "data-mallleable-text-source-fingerprint": string;
  readonly "data-mallleable-text-space": string;
}

export interface MalleableTextMarkerProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children">,
    MalleableTextMarkerDescriptor {
  readonly children: string;
}

function validateMarkerDescriptor(
  marker: MalleableTextMarkerDescriptor,
): MalleableTextMarkerDescriptor {
  const descriptor = parseContentDescriptor(marker.descriptor);
  if (descriptor.status === "invalid") {
    throw new TypeError(`The content descriptor is invalid: ${descriptor.code}.`);
  }
  if (
    !Number.isSafeInteger(marker.revision) ||
    marker.revision < 0
  ) {
    throw new TypeError("revision must be a nonnegative safe integer.");
  }
  return { descriptor: descriptor.value, revision: marker.revision };
}

export function malleableTextMarkerAttributes(
  descriptor: MalleableTextMarkerDescriptor,
): MalleableTextMarkerAttributes {
  const validated = validateMarkerDescriptor(descriptor);
  const attributes: MalleableTextMarkerAttributes = {
    [MALLLEABLE_TEXT_DEFAULT_TEXT_ATTRIBUTE]: validated.descriptor.defaultText,
    [MALLLEABLE_TEXT_ID_ATTRIBUTE]: validated.descriptor.contentId,
    [MALLLEABLE_TEXT_REVISION_ATTRIBUTE]: String(validated.revision),
    [MALLLEABLE_TEXT_SOURCE_FINGERPRINT_ATTRIBUTE]:
      validated.descriptor.sourceFingerprint,
    [MALLLEABLE_TEXT_SPACE_ATTRIBUTE]: validated.descriptor.space,
  };
  if (validated.descriptor.legacyContentIds.length === 0) return attributes;
  return {
    ...attributes,
    [MALLLEABLE_TEXT_LEGACY_IDS_ATTRIBUTE]: JSON.stringify(
      validated.descriptor.legacyContentIds,
    ),
  };
}

export function MalleableTextMarker({
  children,
  descriptor,
  revision,
  ...attributes
}: MalleableTextMarkerProps): ReactElement {
  const parsedChildren = parseText(children);
  if (parsedChildren.status === "invalid") {
    throw new TypeError(`The marker text is invalid: ${parsedChildren.code}.`);
  }
  return (
    <span
      {...attributes}
      {...malleableTextMarkerAttributes({ descriptor, revision })}
    >
      {parsedChildren.value}
    </span>
  );
}
