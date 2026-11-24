# Provider-sponsored promotions and attribution models (W7 lane A2)

Mock providers only; nothing is pushed or deployed. The Clinic owns the promotion, the budget and the wallet; Kiorex reviews, quotes and mirrors.

## A. Sponsored promotion, end to end (Clinic web http://localhost:5174, Kiorex ops http://localhost:5181)
1. **Clinic owner** (admin@drahmedshall.com / demo) opens `/promotions`, "New promotion": name and patient text in Arabic and English (visit fee only, no treatment, test or medicine), visit types, window, discount and budget, funding. Saved as a **draft**. Screenshots: `sponsored-promotions-clinic-en-light-1440.png`, `...-ar-light-1440.png`.
2. **Content guard:** write "Free surgery" and press "Send for review": refused with the blocked terms, nothing reaches Kiorex.
3. **Review:** a valid version goes IN_REVIEW; Kiorex ops (Super Admin or `growth_admin`) opens Growth -> Sponsored promotions, reads the exact text in both languages, the rules and the guard result, and approves CONTENT and SCOPE (a large budget also needs a different second approver). The author cannot decide; a rejection needs a reason. Active when the window is open and the visit fee was not raised (`PF_PRICE_INFLATION`).
4. **Patient:** `GET /growth/v1/promotions/quote?bookingId=` shows "Discount sponsored by <clinic> until <date>" and the lines; confirming the booking reserves budget at the Clinic and sends the `sponsoredDiscount` block. Any refusal or outage: the booking goes on at the full price.
5. **Visit:** check-in, then COMPLETED. The Clinic wallet is debited exactly once (within a minute), the budget card shows reserved and debited, the ledger shows the line; cancel or no-show releases the hold; a refund after completion reverses the debit and returns the credit once. Kiorex ops `/growth/sponsored-promotions/:id/ledger` shows the distinct `PROVIDER_SPONSORED_DISCOUNT` line per booking.
6. **Statement:** a shortfall under "from my credit, then on my invoice" becomes the line "Promotion expense (sponsored discounts)" on the next Kiorly invoice.
7. **Automated evidence:** Clinic `node --import tsx --test src/promotions/*.test.ts src/billing-platform/promotion-expense.node.test.ts` (private DB), web `npx playwright test -c playwright.promotions.config.ts`; Kiorex `npx jest --selectProjects integration --runInBand test/growth-sponsored-promotions`; ops `npx vitest run src/__tests__/growth-sponsored-promotions.test.tsx`.

## B. Attribution models (Kiorex ops, Growth -> Attribution models)
1. Compare: every model shows the same total conversions and revenue (the page says so); POSITION_BASED is marked default; masked cells read `<10`.
2. Paths: ordered source kinds only, paths shared by 10 or more conversions.
3. Data-driven reads "insufficient volume" until 1,000 attended new patients in 90 days.
4. Lift: enter an experiment key that has a `holdout` variant.
5. Commission decisions never change (the integration test counts and compares the rows). Evidence: `npx jest --selectProjects integration --runInBand test/growth-attribution-models`, unit `src/growth/attribution-models`, ops `growth-attribution-models.test.tsx`.

Not covered: the Kiorex Pay side of a sponsored deposit (launch guide 11.78) and the patient checkout label.
