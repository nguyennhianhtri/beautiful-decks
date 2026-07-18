# Changelog

## 1.0.2 — 2026-07-18

### Fixed

- Require `wribbon.perRow` to be a positive integer, preventing builder hangs and attribute injection.
- Namespace IDs and `href` references in both single- and double-quoted inline SVG.
- Preserve documented bare and root-relative source links while continuing to reject unsafe schemes.
- Validate only documented safe CSS color forms instead of accepting invalid names/hex lengths.
- Require exactly two `wforces`, each with a non-empty `items` array.
- Resolve `wshots` image slugs through the per-build asset base so galleries work from any output directory.
- Constrain persona initials without suppressing real overlap diagnostics.

### Added

- Warning-fatal `--strict` QA mode for standard and ultrawide decks; canonical CI uses it.
- Temporary-output QA inside the template-matrix regression.
- Regression coverage increased to 24 tests, plus CLI smoke.

## 1.0.1 — 2026-07-18

### Fixed

- Reject unsafe icon/customer-logo slugs instead of allowing asset-directory traversal.
- Preserve explicit image extensions and scope asset bases to one build.
- Stop mutating imported deck specs with generated page/footer fields.
- Namespace journey SVG gradients per slide.
- Validate ultrawide brand colors before CSS interpolation.
- Neutralize unsafe source-link protocols while preserving trusted standard-slide rich text.
- Use encoded `file:` URLs in QA, render, and PDF tools so spaces, `#`, `%`, and Unicode paths work.
- Reject the incomplete ultrawide light theme instead of producing unreadable components.
- Remove a stale `p_agent` lookup that emitted warnings without rendering anything.
- Add narrow QA annotations for verified typographic/containment false positives.

### Added

- Field-specific required-array validation for standard templates.
- Cardinality, finite-number, sentiment-range, zipper-length, and swimlane-bound validation for ultrawide templates.
- Synthetic public fixture matrices for all 22 standard and 35 ultrawide templates.
- CI geometry/runtime QA across all 57 exported templates.
- Regression coverage increased from 14 to 22 tests, plus CLI smoke.
