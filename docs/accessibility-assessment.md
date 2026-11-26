# WCAG 2.2 self-assessment

This is the criterion-by-criterion check behind the [accessibility statement](accessibility.md).
It has a row for every level A and AA success criterion of [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
The app doesn't serve this page. It lives in the repository only.

## How to fill it in

Follow [WCAG-EM](https://www.w3.org/TR/WCAG-EM/): set the scope, pick a sample of pages and
states, judge each criterion on that sample, and report.

1. Fill in the date, who checked, and the browsers and widths used.
2. List the sample: every page, and the dialogs, menus and states a user meets on them.
3. Judge each row on the whole sample, from what you see in the browser, not from the code alone.
   Set Result to Pass (no failure found after a real check), Fail (at least one failure in the
   sample) or N/A (nothing in the app falls under the criterion).
4. In Evidence, say what you checked and how. Name the test that guards it, if there is one.
5. Count the results in the summary. Copy each Fail to "Known problems" in the statement.

The statement may say "partially conformant" only once every row has a result. Its status
sentence must then link this page. Check the rows again when a change adds a page or a control,
and at each yearly review of the statement.

- **Date:** TODO
- **Who:** TODO, such as "the developer. This is not an external audit."
- **Browsers:** TODO, with the screen widths and themes used.

## Sample

TODO: list the states checked by hand on each page: the picture viewer, the almanac, the quiz and its review, and the games list. The pages are today, yesterday, about and 404, the same four the axe-core test in `e2e/` scans.

## Results

### Perceivable

| Criterion | Level | Result | Evidence |
| --- | --- | --- | --- |
| 1.1.1 Non-text Content | A | Not assessed | |
| 1.2.1 Audio-only and Video-only (Prerecorded) | A | Not assessed | |
| 1.2.2 Captions (Prerecorded) | A | Not assessed | |
| 1.2.3 Audio Description or Media Alternative (Prerecorded) | A | Not assessed | |
| 1.2.4 Captions (Live) | AA | Not assessed | |
| 1.2.5 Audio Description (Prerecorded) | AA | Not assessed | |
| 1.3.1 Info and Relationships | A | Not assessed | |
| 1.3.2 Meaningful Sequence | A | Not assessed | |
| 1.3.3 Sensory Characteristics | A | Not assessed | |
| 1.3.4 Orientation | AA | Not assessed | |
| 1.3.5 Identify Input Purpose | AA | Not assessed | |
| 1.4.1 Use of Color | A | Not assessed | |
| 1.4.2 Audio Control | A | Not assessed | |
| 1.4.3 Contrast (Minimum) | AA | Not assessed | |
| 1.4.4 Resize Text | AA | Not assessed | |
| 1.4.5 Images of Text | AA | Not assessed | |
| 1.4.10 Reflow | AA | Not assessed | |
| 1.4.11 Non-text Contrast | AA | Not assessed | |
| 1.4.12 Text Spacing | AA | Not assessed | |
| 1.4.13 Content on Hover or Focus | AA | Not assessed | |

### Operable

| Criterion | Level | Result | Evidence |
| --- | --- | --- | --- |
| 2.1.1 Keyboard | A | Not assessed | |
| 2.1.2 No Keyboard Trap | A | Not assessed | |
| 2.1.4 Character Key Shortcuts | A | Not assessed | |
| 2.2.1 Timing Adjustable | A | Not assessed | |
| 2.2.2 Pause, Stop, Hide | A | Not assessed | |
| 2.3.1 Three Flashes or Below Threshold | A | Not assessed | |
| 2.4.1 Bypass Blocks | A | Not assessed | |
| 2.4.2 Page Titled | A | Not assessed | |
| 2.4.3 Focus Order | A | Not assessed | |
| 2.4.4 Link Purpose (In Context) | A | Not assessed | |
| 2.4.5 Multiple Ways | AA | Not assessed | |
| 2.4.6 Headings and Labels | AA | Not assessed | |
| 2.4.7 Focus Visible | AA | Not assessed | |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Not assessed | |
| 2.5.1 Pointer Gestures | A | Not assessed | |
| 2.5.2 Pointer Cancellation | A | Not assessed | |
| 2.5.3 Label in Name | A | Not assessed | |
| 2.5.4 Motion Actuation | A | Not assessed | |
| 2.5.7 Dragging Movements | AA | Not assessed | |
| 2.5.8 Target Size (Minimum) | AA | Not assessed | |

### Understandable

| Criterion | Level | Result | Evidence |
| --- | --- | --- | --- |
| 3.1.1 Language of Page | A | Not assessed | |
| 3.1.2 Language of Parts | AA | Not assessed | |
| 3.2.1 On Focus | A | Not assessed | |
| 3.2.2 On Input | A | Not assessed | |
| 3.2.3 Consistent Navigation | AA | Not assessed | |
| 3.2.4 Consistent Identification | AA | Not assessed | |
| 3.2.6 Consistent Help | A | Not assessed | |
| 3.3.1 Error Identification | A | Not assessed | |
| 3.3.2 Labels or Instructions | A | Not assessed | |
| 3.3.3 Error Suggestion | AA | Not assessed | |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Not assessed | |
| 3.3.7 Redundant Entry | A | Not assessed | |
| 3.3.8 Accessible Authentication (Minimum) | AA | Not assessed | |

### Robust

| Criterion | Level | Result | Evidence |
| --- | --- | --- | --- |
| 4.1.2 Name, Role, Value | A | Not assessed | |
| 4.1.3 Status Messages | AA | Not assessed | |

4.1.1 Parsing is not listed: WCAG 2.2 removed it.

## Summary

TODO: of the 55 level A and AA criteria, how many fail, pass and don't apply, and when the next check is.
