# Corporate programme (GRW-P4-C): test flow

Built and tested on 25 Nov 2026 in the lane A4 worktrees; mock providers only; `growth.corporate` is launch-locked, so every flow below that moves a benefit needs the gate (tests use the `DEV-TEST-FIXTURE-NOT-A-REAL-GATE` evidence for the run only).

## Flows (what to do by hand on a stack that carries branch `w8a4-corporate`)
1. **Two people open a programme.** Ops console, Growth, Corporate programmes: super admin A opens "Nile Logistics" (a LEAD), saves the terms (contract reference, ceiling, per-member cap, cover share, end date). Activate as A: refused (the editor cannot activate). Activate as super admin B: Active. Edit terms while Active: frozen.
2. **A code.** Create a code with 50 redemptions: the code appears once, copy it, dismiss it; the list shows only label, counters and state.
3. **An employee joins.** Patient web `/corporate` or the app (More, Company benefit): enter the code (case, dashes and spaces do not matter): "You are in the Nile Logistics programme", allowance shown as usage (cap, used or held, left), no balance, no cash value text. Leave: confirmation, eligibility ends at once.
4. **The report.** With fewer than 10 members every figure reads `<10`; with 10 or more it shows enrolment, members who used the benefit and the sponsored value; no member, booking, provider or specialty appears anywhere.
5. **An HR list.** Upload phone numbers or e-mails: stored as hashes; A cannot approve own upload; B approves; a `LIST` code now works only for people on the list; after 30 days the rows are deleted.
6. **A provider refers a company.** Clinic web, Growth, "Refer a company" (or the staff app screen `growth-b2b`): company name, size, own reference; a phone number or e-mail in the reference is refused; the lead appears in the ops "Enterprise leads" tab and moves NEW, CONTACTED, QUALIFIED, PROPOSAL, WON.
7. **Flag OFF.** Turn `growth.corporate` off: patient routes answer "unavailable", codes and activation are refused, the lead pipeline and the reports keep working.

## Automated evidence
See the as-built record "W8 A4" in `_docs/growth/GROWTH_PHASE2_4_WORK_PACKAGES.md`. Not run: real-stack suite 39 and Playwright layout passes (launch guide 11.90). No screenshots exist for this package.
