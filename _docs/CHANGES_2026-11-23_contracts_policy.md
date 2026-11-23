# Change note, 23 Nov 2026: contracts 1.8.0 and founder-delegated policy defaults

Decisions delegated by the founder on 23 Nov 2026 ("you decide"). Every policy value below is a **`PROPOSED_DEFAULT delegated by founder 23 Nov 2026`**: it ships so the flows work end to end, it is not a ratified commercial or legal decision (CFO / counsel review still open: Docs/NEEDS_HUMAN #1 and #22), and none of it is hard-coded.

## 1. Arabic names (additive, `@kiorex/contracts` 1.8.0)
- Pharmacy `CatalogueItem` and quote items: optional `nameAr`, `formAr` (Arabic dosage form), `activeIngredient` (catalogue). Lab `GET /tests`: optional `nameAr`, `preparationAr`, `sampleTypeAr`; `POST /tests/quote`: optional `nameAr`. Absent => clients fall back to the English field, never a blank.
- Populated by kiorly-pharmacy (`Drug.brandNameAr`; `formAr` from a display dictionary of standard dosage forms, unknown forms get none) and kiorly-lab (`TestDefinition.nameAr`, `prepInstructionsAr`; Arabic specimen type from a small dictionary).
- kiorex-platform keeps them in the order / booking snapshots (`items`, `tests` JSON) and returns them on search, cart, orders and bookings. Patient web and patient mobile render Arabic with English fallback. Search is bilingual (both partners match Arabic and English text).

## 2. OUT_FOR_DELIVERY (additive)
- New event `OrderOutForDelivery` (pharmacy -> Kiorex), between `OrderReady` and `DispenseCompleted`, DELIVERY orders only, no address or courier contact. Old Kiorex versions acknowledge and ignore unknown events; `DispenseCompleted` still completes the order.
- Pharmacy: `POST /api/v1/kiorex-orders/:id/out-for-delivery` (READY + DELIVERY only, idempotent, `NOT_A_DELIVERY_ORDER` otherwise), button "Out for delivery" in the pharmacy web orders page and in the staff mobile app (the app formerly named Kiorly Team, now Kiorly); WhatsApp notice to the customer.
- Kiorex: status `OUT_FOR_DELIVERY` (patient web, patient mobile, ops monitor), notification `PHARMACY_ORDER_OUT_FOR_DELIVERY` (AR/EN, mock channels). The patient can no longer cancel at that point.

## 3. Policy defaults (all in `PolicyService`, ops console "Market policy", per market / organisation, audited)
- **`pharmacy.partial_fulfilment`**: `DispenseCompleted` now carries optional per-line `lines[{sku, quantityRequested, quantityDispensed}]` and `deliveryMade`. Default `PRO_RATA_REFUND`: refund price x undispensed quantity per line, plus the delivery fee when the delivery is not made (`deliveryMade=false` or nothing dispensed); funds of the fulfilled lines are released to the pharmacy (marketplace take only on those); the patient sees an itemised refund (new order status `PARTIALLY_FULFILLED`, field `refund`). Same money pattern as every refund: one transaction with the status change, Refund row keyed `refund-partial:<payment>`, ledger postings, PSP settlement through the outbox, covered by the daily reconciliation (new check `ORDER_HELD_AFTER_RELEASE`). Without `lines` (old pharmacy) or with `MANUAL_REVIEW`, the order parks in `PARTIAL_REVIEW` and ops settles it with `POST /admin/pharmacy/orders/:id/resolve-partial` (button in the ops order monitor). Nothing dispensed degrades to the ordinary full refund.
- **`pay.deposit_default`**: `DEPOSIT_DEFAULT_MINOR` stays 0. New market default: 10% of the consultation fee, capped at 200 (major units, converted with the currency's minor-unit exponent: EGP 20,000 piastres), applied only to providers that enabled deposits (`acceptsDeposit` / `depositRequired`) and set no amount. Precedence: explicit provider amount > `DEPOSIT_DEFAULT_MINOR` > market policy. The cancel-window forfeiture rule is unchanged. The booking's INTENT event records `depositPolicy: MARKET_DEFAULT_PERCENT`.
- Resolution: ORG override > MARKET override > GLOBAL override > in-code PROPOSED_DEFAULT. Reads: ops; writes: super admin only. `DEFAULT_MARKET` (EG) selects the market for vertical orders; `POLICY_CACHE_SECONDS` bounds multi-instance staleness.

## 4. Lab secure link port
The report secure link now derives from the Lab `PUBLIC_BASE_URL` (default `http://localhost:5193`, was `:5191`, the Clinic docs server): `kiorly-lab` env examples and docs, `e2e/scripts/up.sh` (`LAB_PUBLIC_BASE_URL` override), unit test and e2e 05.

## Versions, migrations, verification
- `@kiorex/contracts` 1.8.0 (minor, backward compatible); pharmacy vendors 1.8.0, platform vendors 1.8.0, lab still on 1.6.0 (it only needs the OpenAPI text).
- Migrations: pharmacy `0019_out_for_delivery`; platform `policy_partial_out_for_delivery` (`PharmacyOrder.outForDeliveryAt`, `settlement`, table `PolicySetting`).
- Tests: contracts (183), pharmacy marketplace e2e (17) and outbox contract test, lab integration e2e, platform unit (182) and integration (pharmacy, lab, deposit-default, pay), web 152, ops 42, mobile 170, staff app jest, e2e 04 and 05 against the live stack. OpenAPI and typed clients regenerated (api, web, ops, mobile).
- Known pre-existing, not from this change: `openapi-contract` "every operation documents a 2xx response body" lists the onboarding-import, messaging-webhook and health/providers routes of other work.
