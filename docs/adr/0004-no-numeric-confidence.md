# ADR-0004: Communicate uncertainty with plain-language review cues, not percentages

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-21 |
| **Deciders** | Charlie Chiu |

## Context

The feature brainstorm suggested showing "certainty values" on the confirmation page. The Phase 2 report argued against numeric confidence: LLM self-reported confidence is not a calibrated probability of correctness, and a precise-looking percentage may lead users to ignore a needed correction.

## Decision

Do **not** display numeric confidence percentages. Express uncertainty per attribute with:

1. **A status label:** `likely match` or `needs review` (identity); `estimated` or `needs review` (portion, preparation).
2. **A short reason**, e.g. *"scale is unclear from one photo"* or *"sauce is not visible."*
3. **An icon**, so status is understandable without color. Color only supplements the text and icon.

Where a meaningful spread exists, nutrition may be shown as an **estimate range** (e.g., 520–680 kcal). The range comes from the nutrition of the candidate answers, not from a model confidence score. The visual encoding is decided in the M4 design doc.

## Alternatives considered

| Option | Pros | Cons |
|---|---|---|
| Numeric percentage | Looks precise; compact | Implies calibration the model lacks; invites over-trust |
| High / medium / low | Easy to scan | Loses the *why*; still implies calibration |
| Status + reason + icon (chosen) | Explains what to check and why; accessible | Needs careful copywriting; takes more space |

## Consequences

- The LLM response schema must include a reason string for every uncertain attribute.
- Model-reported confidence, if requested at all, is used internally for ranking only and never shown.
- Usability testing should check whether users can identify which attribute needs attention and why.
