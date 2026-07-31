import { describe, expect, test } from "bun:test";

import {
  MALLLEABLE_TEXT_LIMITS,
  applyTextRange,
  parseContentDescriptor,
  parseContentId,
  parseResolveBatchRequest,
  parseResolveBatchResult,
  parseSourceFingerprint,
  parseText,
  parseTextRange,
  parseWriteResult,
  sourceFingerprint,
  textRangeFromSelection,
} from "./model.js";

describe("content descriptors", () => {
  test("accept bounded semantic identity and derive a source fingerprint", () => {
    const result = parseContentDescriptor({
      contentId: "home.hero/heading",
      defaultText: "A useful heading",
      legacyContentIds: ["home.old-heading"],
      space: "public-site",
    });

    expect(result).toEqual({
      status: "valid",
      value: {
        contentId: "home.hero/heading",
        defaultText: "A useful heading",
        legacyContentIds: ["home.old-heading"],
        sourceFingerprint: sourceFingerprint("A useful heading"),
        space: "public-site",
      },
    });
  });

  test("rejects identifier, alias, text, and batch bounds", () => {
    expect(parseContentId("x".repeat(MALLLEABLE_TEXT_LIMITS.contentIdLength + 1))).toEqual({
      code: "invalid_content_id",
      status: "invalid",
    });
    expect(
      parseContentDescriptor({
        contentId: "home.heading",
        defaultText: "text",
        legacyContentIds: Array.from(
          { length: MALLLEABLE_TEXT_LIMITS.aliasesPerDescriptor + 1 },
          (_, index) => `old.${index}`,
        ),
        space: "site",
      }),
    ).toEqual({ code: "too_many_aliases", status: "invalid" });
    expect(
      parseContentDescriptor({
        contentId: "home.heading",
        defaultText: "x".repeat(MALLLEABLE_TEXT_LIMITS.textLength + 1),
        space: "site",
      }),
    ).toEqual({ code: "text_too_long", status: "invalid" });
    expect(
      parseResolveBatchRequest(
        Array.from(
          { length: MALLLEABLE_TEXT_LIMITS.batchSize + 1 },
          () => ({}),
        ),
      ),
    ).toEqual({ code: "batch_too_large", status: "invalid" });
    expect(parseResolveBatchRequest(
      Array.from({ length: 4 }, (_, itemIndex) => ({
        contentId: `item.${itemIndex}`,
        legacyContentIds: Array.from(
          { length: MALLLEABLE_TEXT_LIMITS.aliasesPerDescriptor },
          (_, aliasIndex) => `item.${itemIndex}.legacy.${aliasIndex}`,
        ),
        sourceFingerprint: sourceFingerprint("x"),
        space: "site",
      })),
    )).toEqual({ code: "batch_too_large", status: "invalid" });
  });

  test("rejects a fingerprint which does not match its source prose", () => {
    expect(
      parseContentDescriptor({
        contentId: "home.heading",
        defaultText: "current",
        sourceFingerprint: sourceFingerprint("stale"),
        space: "site",
      }),
    ).toEqual({ code: "source_mismatch", status: "invalid" });

    expect(parseSourceFingerprint(
      `mt1:${"a".repeat(1_000_000)}:0123456789abcdef`,
    )).toEqual({ code: "invalid_source_fingerprint", status: "invalid" });
    expect(parseSourceFingerprint("mt1:0001:0123456789abcdef")).toEqual({
      code: "invalid_source_fingerprint",
      status: "invalid",
    });
    expect(parseSourceFingerprint("mt1:zzzz:0123456789abcdef")).toEqual({
      code: "invalid_source_fingerprint",
      status: "invalid",
    });
  });
});

describe("UTF-16 ranges", () => {
  test("accepts surrogate pairs and rejects lone surrogates", () => {
    expect(parseText("\ud800")).toEqual({
      code: "invalid_text",
      status: "invalid",
    });
    expect(parseText("\udc00")).toEqual({
      code: "invalid_text",
      status: "invalid",
    });
    expect(parseText("\ud83d\ude00")).toEqual({
      status: "valid",
      value: "😀",
    });
    expect(parseTextRange({
      end: 1,
      exact: "\ud800",
      prefix: "",
      start: 0,
      suffix: "",
    })).toEqual({ code: "invalid_range", status: "invalid" });
    expect(parseTextRange({
      end: 1,
      exact: "\udc00",
      prefix: "",
      start: 0,
      suffix: "",
    })).toEqual({ code: "invalid_range", status: "invalid" });
    expect(parseTextRange({
      end: 2,
      exact: "\ud83d\ude00",
      prefix: "",
      start: 0,
      suffix: "",
    })).toEqual({
      status: "valid",
      value: {
        end: 2,
        exact: "😀",
        prefix: "",
        start: 0,
        suffix: "",
      },
    });
  });

  test("replaces emoji and combining sequences at JavaScript string offsets", () => {
    const text = "A 👩🏽‍💻 and e\u0301 finish";
    const emojiStart = text.indexOf("👩");
    const emojiEnd = emojiStart + "👩🏽‍💻".length;
    const emojiRange = textRangeFromSelection(text, emojiStart, emojiEnd);
    expect(emojiRange.status).toBe("valid");
    if (emojiRange.status === "invalid") return;
    expect(applyTextRange(text, emojiRange.value, "developer")).toEqual({
      status: "valid",
      value: "A developer and e\u0301 finish",
    });

    const combiningStart = text.indexOf("e\u0301");
    const combiningRange = textRangeFromSelection(
      text,
      combiningStart,
      combiningStart + "e\u0301".length,
    );
    expect(combiningRange.status).toBe("valid");
    if (combiningRange.status === "invalid") return;
    expect(applyTextRange(text, combiningRange.value, "é")).toEqual({
      status: "valid",
      value: "A 👩🏽‍💻 and é finish",
    });
  });

  test("keeps bounded context on surrogate-pair boundaries", () => {
    const prefixText = `😀${"a".repeat(255)}B`;
    const prefixRange = textRangeFromSelection(
      prefixText,
      prefixText.length - 1,
      prefixText.length,
    );
    expect(prefixRange).toMatchObject({
      status: "valid",
      value: { exact: "B", prefix: "a".repeat(255) },
    });

    const suffixText = `B${"a".repeat(255)}😀`;
    const suffixRange = textRangeFromSelection(suffixText, 0, 1);
    expect(suffixRange).toMatchObject({
      status: "valid",
      value: { exact: "B", suffix: "a".repeat(255) },
    });
  });

  test("fails a tampered quote or context", () => {
    const range = textRangeFromSelection("before selected after", 7, 15);
    expect(range.status).toBe("valid");
    if (range.status === "invalid") return;
    const tampered = parseTextRange({ ...range.value, exact: "tampered" });
    expect(tampered.status).toBe("valid");
    if (tampered.status === "valid") {
      expect(
        applyTextRange("before selected after", tampered.value, "replacement"),
      ).toEqual({ code: "range_mismatch", status: "invalid" });
    }
    expect(
      applyTextRange(
        "changed selected after",
        range.value,
        "replacement",
      ),
    ).toEqual({ code: "range_mismatch", status: "invalid" });
  });
});

test("bounds a maximum escaped resolution batch below the proxy payload cap", () => {
  const maximumEscapedText = "\u0001".repeat(
    MALLLEABLE_TEXT_LIMITS.textLength,
  );
  const item = {
    canonicalContentId: "c".repeat(MALLLEABLE_TEXT_LIMITS.contentIdLength),
    contentId: "i".repeat(MALLLEABLE_TEXT_LIMITS.contentIdLength),
    origin: "authored",
    revision: Number.MAX_SAFE_INTEGER,
    sourceDrift: true,
    sourceFingerprint: sourceFingerprint(maximumEscapedText),
    space: "s".repeat(MALLLEABLE_TEXT_LIMITS.spaceLength),
    status: "resolved",
    text: maximumEscapedText,
    viaLegacy: true,
  } as const;
  const maximumBatch = {
    items: Array.from(
      { length: MALLLEABLE_TEXT_LIMITS.batchSize },
      () => item,
    ),
    status: "resolved",
  } as const;
  expect(parseResolveBatchResult(maximumBatch).status).toBe("valid");
  expect(new TextEncoder().encode(JSON.stringify(maximumBatch)).byteLength)
    .toBeLessThan(4_000_000);
  expect(parseResolveBatchResult({
    ...maximumBatch,
    items: [...maximumBatch.items, item],
  })).toEqual({ code: "invalid_batch", status: "invalid" });
});

test("write result parsing rejects a mismatched response request ID", () => {
  expect(
    parseWriteResult(
      { requestId: "other-request", status: "forbidden" },
      "expected-request",
    ),
  ).toEqual({ code: "request_mismatch", status: "invalid" });
});
