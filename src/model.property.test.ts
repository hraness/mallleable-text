import { expect, test } from "bun:test";
import fc from "fast-check";

import {
  MALLLEABLE_TEXT_LIMITS,
  applyTextRange,
  sourceFingerprint,
  textRangeFromSelection,
} from "./model.js";

test("fingerprints are deterministic and length-sensitive", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 2_000 }),
      fc.string({ maxLength: 200 }),
      (text, suffix) => {
        expect(sourceFingerprint(text)).toBe(sourceFingerprint(text));
        if (suffix.length > 0) {
          expect(sourceFingerprint(text + suffix)).not.toBe(
            sourceFingerprint(text),
          );
        }
      },
    ),
  );
});

test("range replacement agrees with UTF-16 slicing", () => {
  fc.assert(
    fc.property(
      fc.string({ maxLength: 200 }).filter((text) => text.length > 0),
      fc.string({ maxLength: 100 }),
      fc.nat(),
      fc.nat(),
      (text, replacement, first, second) => {
        const left = Math.min(first % text.length, second % text.length);
        const right = Math.max(first % text.length, second % text.length) + 1;
        const range = textRangeFromSelection(text, left, right);
        expect(range.status).toBe("valid");
        if (range.status === "invalid") return;
        const result = applyTextRange(text, range.value, replacement);
        expect(result).toEqual({
          status: "valid",
          value: `${text.slice(0, left)}${replacement}${text.slice(right)}`,
        });
      },
    ),
    { numRuns: MALLLEABLE_TEXT_LIMITS.batchSize * 2 },
  );
});
