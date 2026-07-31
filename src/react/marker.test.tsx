import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { sourceFingerprint, type ContentDescriptor } from "../model.js";
import {
  MalleableTextMarker,
  malleableTextMarkerAttributes,
} from "./marker.js";

function descriptor(
  defaultText = "A source <phrase> & its meaning.",
): ContentDescriptor {
  return {
    contentId: "guide.introduction",
    defaultText,
    legacyContentIds: ["guide.opening"],
    sourceFingerprint: sourceFingerprint(defaultText),
    space: "documentation",
  };
}

describe("MalleableTextMarker", () => {
  test("emits a complete stable descriptor for a server-rendered segment", () => {
    expect(malleableTextMarkerAttributes({
      descriptor: descriptor(),
      revision: 3,
    })).toEqual({
      "data-mallleable-text-default-text": "A source <phrase> & its meaning.",
      "data-mallleable-text-id": "guide.introduction",
      "data-mallleable-text-legacy-content-ids": '["guide.opening"]',
      "data-mallleable-text-revision": "3",
      "data-mallleable-text-source-fingerprint": sourceFingerprint(
        "A source <phrase> & its meaning.",
      ),
      "data-mallleable-text-space": "documentation",
    });
  });

  test("renders authored text as text instead of HTML", () => {
    const html = renderToStaticMarkup(
      <MalleableTextMarker descriptor={descriptor()} revision={3}>
        {'Read <script>alert("unsafe")</script> literally.'}
      </MalleableTextMarker>,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      "Read &lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt; literally.",
    );
    expect(html).toContain("data-mallleable-text-id=\"guide.introduction\"");
  });

  test("rejects a descriptor whose fingerprint does not match its source", () => {
    expect(() => malleableTextMarkerAttributes({
      descriptor: {
        ...descriptor(),
        sourceFingerprint: sourceFingerprint("Different source"),
      },
      revision: 0,
    })).toThrow("source_mismatch");
  });

  test("normalizes legacy identities before it puts them in markup", () => {
    expect(malleableTextMarkerAttributes({
      descriptor: {
        ...descriptor(),
        legacyContentIds: ["guide.previous", "guide.opening"],
      },
      revision: 0,
    })["data-mallleable-text-legacy-content-ids"]).toBe(
      '["guide.opening","guide.previous"]',
    );
  });
});
