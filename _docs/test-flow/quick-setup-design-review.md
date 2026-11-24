# Quick setup checklist: design review (24 Nov 2026)

Screenshots: `_docs/test-flow/quick-setup/<product>-<lang>-<theme>-<width>.png` for Clinic, Nurse, Nurse home card, Pharmacy and Lab, English and Arabic, light and dark, 390 and 1440 px (40 files). Captured by `quick-setup-shots.spec.ts` (Clinic and Nurse) and the "checklist screenshots" test in each of the Pharmacy and Lab `quick-setup.spec.ts` (set `QS_SHOTS_DIR`). Fresh organisations, a few steps already done so the three states (done, next, waiting) show together.

## What works (keep)

* **Hierarchy.** One highlighted row (outline plus tint plus a filled primary button) against quiet outline buttons; done rows turn green and lose their description, so the eye lands on "what next" in under a second. The same pattern in all four products reads as one system.
* **Progress.** A single bar with "2 of 9 done · 22%" at the end. In RTL the fill grows from the right and the label moves to the left, as it should.
* **States.** Done (green tick, tinted row, "Done"), next (outline, filled button), waiting (number, outline button), optional (pill plus ghost Skip), restricted ("Ask the owner", disabled button), upgrade (pill). No state relies on colour alone.
* **Motion.** Row tint 1.8 s ease-out, tick drawn in 0.5 s, progress eased 0.7 s, the next row scrolled into view after 1.3 s and its button focused and pulsed twice. All of it is switched off under reduced motion.

## Findings and what was changed

| # | Finding (senior product designer view) | Action |
|---|---|---|
| 1 | Arabic rows mixed a Latin "Kiorex" into a right-to-left sentence ("تحقق من بيانات الطبيب لـ Kiorex" rendered as "Kiorex J", the lam glued to the Latin word). Reads as a bug. | **Fixed.** Clinic, Pharmacy and Lab Arabic strings now use كيوريكس (as the bottom nav already did); doctor verification reworded to "لعرضها على كيوريكس". |
| 2 | "13 خطوات" is grammatically wrong for 11 and above, and "خطوات" in "2 من 12 خطوات" the same. | **Fixed.** Clinic autoDetect uses the six Arabic plural forms; progress counters on the Nurse pages and card avoid the noun ("تم إنجاز 2 من 12"). |
| 3 | The Nurse home had no entry to the checklist at all; the full list lives one tap away on a page nobody opens by default. | **Fixed.** New Nurse setup card on Today and Dispatch: title, "Next: <step>", easing progress bar with "2 of 12 steps done", one full-width button on phones. Hidden when everything is done. Asserted in Playwright (card, next key, progress rises after two steps). |
| 4 | On 390 px, optional rows carry title, "optional" pill, description, Skip and Open, which wraps to three lines and pushes the buttons to the far side. Skip and Open have the same visual weight in a row of rows. | Left as is: the wrap is clean; buttons are 32 px high (36 px on phones). Candidate for the next pass: collapse Skip into an overflow menu on phones, or show Skip only on the highlighted row. |
| 5 | Every pending row has an outline "Open" button, so 8 to 12 identical buttons compete once the first step is done. | Left: the filled button already marks the one action that matters. Candidate: hide Open on rows that are not next until hover/focus on desktop. |
| 6 | The Clinic list is 13 rows tall on a dashboard, longer than the dashboard content below it. | Left: Collapse is one tap (it is not remembered across reloads); completed rows fold away by themselves. Candidate: default to "next 3 steps" with "Show all". |
| 7 | Clinic and Pharmacy/Lab headlines differ in tone ("Welcome, quick setup" in all, but different sub-lines). Pharmacy and Lab titles are shorter than Clinic. | Left (copy needs the founder). Listed in the Arabic review doc for consistent wording. |
| 8 | Dark theme: the highlighted row and the tick badge hold contrast (checked with axe in the existing specs); the Nurse rose primary on dark is bright but readable. | No change. |

## Honest limits

* Static screenshots cannot show the animation feel; that is asserted through the `data-just-done`, `data-success` and `data-next` states and the reduced-motion rule, not judged visually frame by frame.
* Arabic was reviewed for layout, direction, plurals and brand spelling by the engineer, not by a native copy editor: see `quick-setup-arabic-review.md`.
* Percent placement ("٪") next to digits in RTL was left as the existing convention; flagged for the reviewer.
