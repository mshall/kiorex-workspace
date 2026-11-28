import * as A from './groupA.mjs';
import * as B from './groupB.mjs';
import * as C from './groupC.mjs';
import * as D from './groupD.mjs';
import * as E from './groupE.mjs';
import * as FG from './groupFG.mjs';
import * as HIJ from './groupHIJ.mjs';
import * as KL from './groupKL.mjs';
import * as M from './groupM.mjs';
import { IMAGES } from './images.mjs';
import { flow } from '../diagrams.mjs';
import { H } from './common.mjs';

export { IMAGES };
export const GROUPS = [A.GROUP, B.GROUP, C.GROUP, D.GROUP, E.GROUP, FG.GROUP_F, FG.GROUP_G, HIJ.GROUP_H, HIJ.GROUP_I, HIJ.GROUP_J, KL.GROUP_K, KL.GROUP_L, M.GROUP_M];
export const SCENARIOS = [...A.S, ...B.S, ...C.S, ...D.S, ...E.S, ...FG.SF, ...FG.SG, ...HIJ.SH, ...HIJ.SI, ...HIJ.SJ, ...KL.SK, ...KL.SL, ...M.SM];

// consistency checks, fail the build loudly
const seen = new Set();
for (const s of SCENARIOS) {
  if (seen.has(s.id)) throw new Error('duplicate ' + s.id); seen.add(s.id);
  for (const k of s.shots || []) if (!IMAGES[k]) throw new Error(`${s.id}: unknown image ${k}`);
  for (const r of s.related || []) if (!SCENARIOS.some((x) => x.id === r)) throw new Error(`${s.id}: unknown related ${r}`);
  if (!GROUPS.some((g) => g.id === s.group)) throw new Error('bad group ' + s.id);
}

const table = (head, rows) => `<div class="tablewrap" tabindex="0" role="group" aria-label="Table, scrollable"><table><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const counts = (v) => SCENARIOS.filter((s) => s.ver === v).length;

export const FRONT = [
{ id: 'start', title: 'Start here', html: (i) => `
<p class="lead hero">A manual test guide for the whole Kiorex and Kiorly ecosystem: <b>${SCENARIOS.length} scenarios</b> in ${GROUPS.length} groups. Each one gives the purpose, the actors, the app and URL (kx-test and local), preconditions, the test data to use, numbered steps with progress ticks, expected results, edge cases, what to check in the consoles, links to related scenarios, and real screenshots or diagrams.</p>
<div class="kpis"><div class="kpi"><b>${SCENARIOS.length}</b>scenarios</div><div class="kpi"><b>${SCENARIOS.reduce((a, s) => a + s.steps.length, 0)}</b>steps to tick</div><div class="kpi"><b>${counts('ran')}</b>ran on a private stack</div><div class="kpi"><b>${counts('auto')}</b>covered by automated tests</div><div class="kpi"><b>${counts('docs')}</b>from code and docs only</div><div class="kpi"><b>${counts('blocked')}</b>blocked or human-only</div></div>
<div class="callout bad"><b>Hard rules.</b> This document is public: it contains <b>no password, token, authenticator secret or real personal data</b>. Credentials of the synthetic personas are only in the private register <code>_private/DEMO_ACCOUNTS.md</code> on the founder's machine (git-ignored). Never type a real person's data into a test environment. Never touch ports 3000, 5173, 5175 or the founder's own Clinic checkout. Never record the Egypt market gate on a shared environment from this guide. Never mark counsel sign-off APPROVED. Mock providers only.</div>
<h3>How to use it</h3>
<ol><li>Pick the environment: <b>kx-test</b> (deployed, mock providers, includes the real organisation Dr Ahmed Shall on the Clinic: read only) or a <b>local or private stack</b> (full demo seed, see "Environments and URLs").</li><li>Open a scenario, read preconditions and test data, then follow the numbered steps and tick each one. Ticks are saved in this browser only.</li><li>Compare with "Expected results". Try the "Edge cases". Check the named console pages.</li><li>Report any difference: a scenario marked "From code and docs" has not been executed by the author, so a mismatch is a finding, not your mistake.</li></ol>
<h3>The ecosystem in one picture</h3>
<figure class="dia" tabindex="0" role="group" aria-label="Ecosystem diagram">${flow({ cap: 'Products and how they connect: signed requests and outbox webhooks only, never a shared database.', perRow: 4, nodes: [{ t: 'Kiorex patient web/app', sub: 'search, book, pay deposit' }, { t: 'Kiorex platform + Ops', sub: 'marketplace, Pay, growth' }, { t: 'Kiorex Passport', sub: 'identity (OIDC)', kind: 'warn' }, { t: 'Kiorly Clinic + Nurse', sub: 'works standalone' }, { t: 'Kiorly Pharmacy', sub: 'standalone or connected' }, { t: 'Kiorly Lab', sub: 'standalone or connected' }, { t: 'Kiorly staff app', sub: 'Clinic, Nurse, Pharmacy, Lab' }, { t: 'Kiorly site + admin', sub: 'Join form, Market launch', kind: 'end' }] })}<figcaption><b>Diagram.</b> Boxes are in reading order; every product integrates only through versioned contracts, HMAC-signed requests and outbox webhooks. Kiorex never holds funds.</figcaption></figure>
<h3>Status labels</h3>
${table(['Label', 'Meaning'], [['<span class="pill ver-ran">Ran on private stack</span>', 'the author ran the steps (or the key calls) on a private local stack on 27-28 Nov 2026'], ['<span class="pill ver-auto">Covered by automated test</span>', 'an automated suite named in the scenario asserts the behaviour; steps come from it and the docs'], ['<span class="pill ver-docs">From code and docs</span>', 'derived from code, seeds and docs; not executed by the author'], ['<span class="pill ver-blocked">Blocked or human-only</span>', 'needs a human action, an account or a real provider (see Known gaps)']])}
<div class="callout note"><b>Honesty note.</b> Screenshots marked "real capture from a private local stack" were produced from the stack and test-flow runs listed in the scenario; commission screens show zeros because the cloned private database holds no claims. Everything external is mock.</div>` },

{ id: 'env', title: 'Environments and URLs', html: (i) => `
<p>Hosts come from the registry <code>_docs/registry/service-url-registry.yaml</code> (environment <b>kx-test</b> has the DNS label <code>test</code>; production has no label). Local ports are the dev-stack defaults in <code>TEST_GUIDE.md</code>; a private stack uses ports of its own (never 3000, 5173, 5175, 3020, 5190, 5191).</p>
${table(['Product', 'kx-test host', 'Local dev', 'Deployed on kx-test?'], [
['Kiorex patient web', '<code>https://test.kiorex.com</code>', '<code>:5180</code>', 'yes'],
['Kiorex API / webhooks', '<code>https://api.test.kiorex.com</code> · <code>https://webhooks.test.kiorex.com</code>', '<code>:4000</code>', 'yes'],
['Ops console (Kiorex admin)', '<code>https://admin.test.kiorex.com</code>', '<code>:5181</code>', 'yes'],
['Kiorex Passport', '<code>https://passport.test.kiorex.com</code>', '<code>:4400/account</code> (dev inbox <code>/dev/inbox</code>)', 'yes'],
['Kiorly Clinic', '<code>https://clinics.test.kiorly.com</code> and legacy <code>https://d92iz83i79c05.cloudfront.net</code>', '<code>:5174</code> (API <code>:3010</code>)', 'yes (real organisation inside: read only)'],
['Kiorly Pharmacy', '<code>https://pharmacies.test.kiorly.com</code>', '<code>:5192</code> (API <code>:3100</code>)', 'yes'],
['Kiorly Lab', '<code>https://labs.test.kiorly.com</code>', '<code>:5193</code> (API <code>:3200</code>)', 'yes'],
['Kiorly site and Join form', '<code>https://test.kiorly.com/en/</code>, <code>/ar/</code>', 'local build of <code>apps/kiorly-site</code>', 'yes'],
['Kiorly admin (Ops, Kiorly edition)', '<code>https://admin.test.kiorly.com</code>', 'same build, Kiorly host name', 'yes'],
['Kiorly Home', '<code>https://app.test.kiorly.com</code>', '<code>:5194/signin</code>', 'yes (since 28 Nov 2026)'],
['Booking widget', '<code>https://book.test.kiorex.com</code>', 'served by the API', 'registry only'],
['Patient Expo app / staff app', 'phone builds, hosts from <code>config/env/test.env</code>', 'Expo web <code>:8081</code> / <code>:8082</code>', 'builds in <code>_private/builds</code>'],
])}
<h3>Rules for the shared kx-test environment</h3>
<ul><li>Invitation-only accounts, <code>noindex</code>, no public sign-up, CDN header gate for visitors not on the allow-list. Everything external (SMS, WhatsApp, e-mail, push, payments, video) is mock.</li><li>The real organisation <b>Dr Ahmed Shall</b> lives on the kx-test Clinic: never create, edit or delete there. The founder checks it after every deploy.</li><li>Phone codes are mock: read them with <code>scripts/kx-test-otp.sh &lt;phone&gt;</code> (needs your AWS CLI credentials for the account in the registry). Do not reset rate limits.</li><li>TOTP secrets for privileged demo accounts live in AWS Secrets Manager <code>/kx/test/e2e</code>, never in git.</li><li>The patient booking path is blocked until a human records the market gate ({S81}). To test it, use a private stack.</li></ul>
<h3>Starting a private stack (no shared service is touched)</h3>
<pre tabindex="0"><code>e2e/scripts/reg-stack.sh up        # full private stack, ports 4810-4815 (clones of the dev databases, Clinic read only)
e2e/scripts/golive-stack.sh up     # lean stack: Passport, Clinic, Kiorex (ports 4950-4953) used for the screenshots
npx playwright test -c e2e/kx-test # automated suite against the DEPLOYED kx-test hosts (needs AWS credentials)
node _docs/registry/validate-registry.mjs --print --env test</code></pre>` },

{ id: 'people', title: 'Test data matrix (synthetic personas only)', html: (i) => `
<p>All names and phone numbers below belong to the synthetic demo seed and are already public in the repository (<code>e2e/kx-test/README.md</code>, <code>TEST_DATA.md</code>). <b>Passwords, one-time codes, invitation tokens and TOTP secrets are never printed here</b>: look them up in <code>_private/DEMO_ACCOUNTS.md</code> in the section named in the last column. Which personas exist on kx-test is limited to the trimmed deployed seed (4 demo clinic organisations, 8 live providers, patients, 15 bookings, 12 commission claims, 8 pharmacy orders, 8 lab bookings, all tagged <code>DemoMarker</code>); the full demo seed is local.</p>
<h3>Patients and Passport identities</h3>
${table(['Persona', 'Role', 'Phone (synthetic)', 'Used in', 'Register section'], [
['Hoda Mahmoud', 'patient, guardian of Yassin (8) and Laila (4)', '+201000001001', '{S01} {S11} {S14} {S15} {S16} {S20}', 'Kiorex platform'],
['Samir', 'patient, co-guardian', '+201000001002', '{S13} {S16}', 'Kiorex platform'],
['Karim Mostafa', 'guardian of Salma (15)', '+201000001003', '{S07}', 'Kiorex platform'],
['Nourhan', 'patient (pharmacy orders)', '+201000001004', '{S17}', 'Kiorex platform'],
['Mahmoud El-Sayed', 'cardiology patient, guardian of Adam (2)', '+201000001005', '{S20}', 'Kiorex platform'],
['Mariam', 'patient (reschedule, video)', '+201000001006', '{S12} {S16}', 'Kiorex platform'],
['Omar', 'patient (lab)', '+201000001007', '{S18}', 'Kiorex platform'],
['Dalia, Tarek, Heba, Youssef, Rana', 'patients with no-show, check-in, cancelled, revoked-consent states', '+201000001008 ... +201000001012', '{S13} {S55}', 'Kiorex platform'],
['Nabila Hamdy', 'home-care patient, care plan', '+201000001013', '{S19} {S54}', 'Kiorex platform'],
])}
<h3>Ops and staff</h3>
${table(['Persona', 'Role', 'Phone (synthetic)', 'Used in', 'Register section'], [
['Super admin', 'Passport roles ops_admin, super_admin (phone code + authenticator)', '+201000000099', '{S36} {S46} {S80} {S81} {S82}', 'Kiorex platform + Passport'],
['Ops admin', 'ops_admin (phone code + authenticator)', '+201000009001', '{S02} {S85} {S90}', 'Kiorex platform'],
['Ops finance', 'role finance', '+201000009002', '{S31} {S34} {S35}', 'Kiorex platform'],
['Ops support', 'enrols on first sign-in', '+201000009003', '{S02}', 'Kiorex platform'],
['Ahmed Fawzy', 'Clinic owner (Nile Care), group admin', '+201000002001', '{S08} {S50}', 'Clinic, Passport'],
['Front desk, Dr Nadia', 'receptionist, physician (Nile Care)', '+201000002002, +201000002006', '{S50} {S51}', 'Clinic'],
['Pharmacist / owner / cashier', 'PHARMACIST, OWNER, CASHIER (privileged vs not)', '+201000002004 / +201000002007 / +201000002008', '{S04} {S05} {S60} {S61}', 'Pharmacy'],
['Lab technologist / owner', 'technologist, OWNER (privileged)', '+201000002005 / +201000002010', '{S05} {S71}', 'Laboratory'],
['Mona, agency team', 'solo nurse; agency owner, dispatcher, nurses, aide', '+201000003001 ... +201000003009', '{S53} {S54}', 'Clinic (Nurse), Passport'],
['Kiorly Home persona', 'multi-workspace owner / newcomer', '+201000002031 / +201000002032', '{S97}', 'Passport and Kiorly Home'],
])}
<h3>Organisations and what is in them</h3>
${table(['Organisation (demo)', 'Module', 'Key', 'What it is for'], [
['Nile Care Medical Center', 'Clinic', '<code>demo_t_na</code>', 'main clinic: 70 patients, all appointment states, 8 doctors, Kiorex listings, PRO plan'],
['Delta Family Clinics', 'Clinic', '<code>demo_t_df</code>', 'paused listing, waitlist autofill OFF by flag, commission on invoice'],
['Smile & Skin Studio', 'Clinic', '<code>demo_t_ss</code>', '14-day trial, pending verification doctor'],
['Kiorex Specialties Network', 'Clinic', '<code>demo_t_sp</code>', '72 doctors, all 36 specialties bookable'],
['Basic (Lite) clinic', 'Clinic', '<code>demo_t_bs</code>', 'plan gate and upgrade screens'],
['Demo Home Nursing (Mona) / Demo Care Agency', 'Nurse edition', '<code>demo_t_nsolo</code> / agency', 'home visits, dispatch, care plans, MAR'],
['Kiorly Demo Pharmacy; Solo; Corner (Lite)', 'Pharmacy', '<code>org_demo_kiorly</code>, <code>org_demo_solo</code>, <code>org_demo_basic</code>', 'chain, standalone, Lite'],
['Demo Diagnostics; Delta Diagnostics Group; Starter Lab', 'Lab', '<code>demo-lab</code>, <code>chain-lab</code>, <code>basic-lab</code>', 'PRO, chain, Basic'],
['Dr Ahmed Shall Group', 'Clinic (REAL on kx-test)', 'n/a', '<b>read only. Never edit.</b>'],
])}
<h3>Which scenario uses which kind of data</h3>
<p>Booking and money scenarios ({S11} to {S38}) need a stack where the gate is recorded and providers are synced. Admin scenarios ({S80} to {S90}) need the ops accounts. Throwaway organisations (to be created for {S57} and {S100}) must be new and on a private stack.</p>` },
];

const gapRows = [
['<code>market.eg.live</code> gate not recorded', 'A human super admin must record the launch-gate evidence in Ops (guide <code>_docs/guides/golive</code>). Until then patient search is empty and booking, pharmacy and lab ordering are blocked on kx-test. {S10} {S81}', 'founder'],
['Counsel sign-off per market', 'Stays NOT_REVIEWED; real-money collection modes and payout routes stay blocked. Never mark approved on anyone\'s behalf. {S36}', 'counsel + founder'],
['Commission numbers and disclosure wording', 'Recommended defaults are shipped as editable rows; final numbers and AR/EN disclosure text need the founder, finance and counsel. {S36}', 'founder, finance, counsel'],
['WhatsApp, SMS, e-mail and push', 'All mock. Needs Meta business verification, template approval, number; SES domain verification; aggregator; Firebase and APNs credentials. {S45} {S87}', 'founder, vendors'],
['Payments (Paymob, Fawry, InstaPay, card gateway, bank IPN)', 'All mock. Sandbox credentials by reference, the real bank IPN file layout, settlement import, `INTEGRATION_MODES` approval. Saved-method charging is not built. {S30} {S35}', 'founder, vendors'],
['Store accounts and app links', 'Apple Developer (individual to start) and Expo/EAS accounts; Apple Team ID and Android signing SHA-256 for universal and app links; Play app-signing and Firebase files. Debug-key APKs are for testing only. {S110} {S111} {S112}', 'founder'],
['Passport production identity provider', 'The dev IdP refuses production; production IdP choice (Cognito is the default candidate), production OIDC clients, a decision on carrying identities over. {S102}', 'founder'],
['Clinic Switch product link', 'Kiorly Home is live on kx-test, but the Clinic web build has no `VITE_KIORLY_HOME_URL`, so the Clinic login shows no Switch product link. {S97} {S131}', 'operator'],
['Pharmacy and Lab price connection', 'Dormant until the founder adds one credential pair to three secret bags; five live price tests skip. {S132}', 'founder'],
['Real-organisation exception', 'The real Clinic organisation lives in kx-test (a declared exception to "no real patient data outside production" pending counsel). Read only. {S58}', 'counsel'],
['Public consent and privacy wording, plan names, response-time promise', 'Marked drafts (`draft-2`, TODO_NEEDS_HUMAN) on the Kiorly site; counsel and copy review. {S95} {S96}', 'counsel'],
['Native Arabic review', 'Strings need a native-speaker review. {S122}', 'reviewer'],
['Kiorly-only roles: later phases', 'Closed on 28 Nov 2026 (ADR-062, {S134}). Still open: a Cognito equivalent of the grant screen for production, and row filters if Kiorly ops must ever see finance or orders.', 'engineering'],
['Content Security Policy enforcement', 'Report-only is deployed; switching to enforced is a founder decision. {S137}', 'founder'],
['Provider statement gaps', 'No statement PDF; Pharmacy and Lab views drop the cash vs cash-transfer split; Clinic reads tender from check-in, not payments. {S33} {S34}', 'engineering'],
['Throwaway organisation and booking on kx-test', 'Public sign-up needs a real WhatsApp OTP and the platform tab a credential, so those two kx-test tests stay `fixme`. {S57} {S58}', 'founder'],
['TURN failure, physical device and push', 'Not testable on the live stack or without devices and keys. {S16} {S110}', 'founder'],
];
FRONT.push({ id: 'gaps', title: 'Known gaps and what is blocked until a human acts', html: (i) => `<p>Everything here is honest as of 28 Nov 2026 (after the end-to-end pass). Items in these rows are not defects of the guide; they are the reason some scenarios are labelled blocked or partial.</p>${table(['Gap', 'What is missing and which scenarios it touches', 'Who acts'], gapRows.map((r) => [r[0], i(r[1]), r[2]]))}` });

const unv = SCENARIOS.filter((s) => s.ver === 'docs' || s.ver === 'blocked');
FRONT.push({ id: 'verify', title: 'What was verified, and what was not', html: (i) => `
<p>Verification model: scenarios were derived from the code, seeds, docs and test suites. The author then ran a limited set on a <b>private local stack</b> (Passport, Kiorex API and Ops, patient web, ten ops pages, patient pages, the Kiorly site build, and API checks for bootstrap, security headers, CORS preflight and Join validation) and captured screenshots. Nothing was run on kx-test with a real session and no gate was recorded on any shared environment.</p>
${table(['Status', 'Count', 'Scenarios'], [
  ['Ran on private stack', counts('ran'), SCENARIOS.filter((s) => s.ver === 'ran').map((s) => `{${s.id}}`).join(' ')],
  ['Covered by automated test', counts('auto'), SCENARIOS.filter((s) => s.ver === 'auto').map((s) => `{${s.id}}`).join(' ')],
  ['From code and docs (not executed)', counts('docs'), SCENARIOS.filter((s) => s.ver === 'docs').map((s) => `{${s.id}}`).join(' ')],
  ['Blocked or human-only', counts('blocked'), SCENARIOS.filter((s) => s.ver === 'blocked').map((s) => `{${s.id}}`).join(' ')],
].map((r) => [r[0], String(r[1]), i(r[2])]))}
<p>Latest recorded automated results (28 Nov 2026, <code>E2E_FULL_PASS_2026-11-28.md</code>): the live kx-test suite has 328 tests in 29 specs, final state <b>311 passed, 0 failed, 11 skipped, 6 not run</b> (the 6 are the MFA policy spec, which would change the live policy). Cross-product regression on a private stack: 595 tests, green after fixing 8 stale expectations; Passport 516 unit, platform 2023 unit and 1486 integration, Pharmacy and Lab API e2e 253 and 237, staff app 460, patient app 344. Group M was added on 28 Nov 2026.</p>
<p><b>Unverified by hand (${unv.length} scenarios):</b> every scenario labelled "From code and docs" or "Blocked", plus the payment click-through of {S11}, any real device run, real providers, and every screenshot taken from earlier sessions (marked as such).</p>` });
