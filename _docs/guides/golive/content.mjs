// Content of the "How to take a market live (Egypt)" guide. English only. No secrets: sample values are labelled as samples.
let figN = 0;
const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export const fig = (file, caption, { pins = [], masks = [], crop = 1, narrow = false } = {}) => {
  figN += 1;
  const p = pins.map(([x, y, n]) => `<span class="pin" style="left:${x}%;top:${(y / crop).toFixed(1)}%">${n}</span>`).join('');
  const m = masks.map(([x, y, w, h]) => `<span class="mask" style="left:${x}%;top:${(y / crop).toFixed(1)}%;width:${w}%;height:${(h / crop).toFixed(1)}%"></span>`).join('');
  const ar = `${1366}/${(820 * crop).toFixed(0)}`;
  return `<figure class="${narrow ? 'narrow' : ''}"><div class="shot" style="aspect-ratio:${ar}"><img src="../shots/${file}.png" alt="">${m}${p}</div><figcaption><b>Figure ${figN}.</b> ${caption}</figcaption></figure>`;
};
export const pair = (a, b) => `<div class="pair">${a}${b}</div>`;
export const callout = (kind, title, body) => `<div class="callout ${kind}"><div class="ct">${title}</div><div>${body}</div></div>`;
export const steps = (items) => `<ol class="steps">${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;
export const table = (head, rows, cls = '') => `<table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
export const pill = (t, k = 'ind') => `<span class="pill ${k}">${t}</span>`;
export const code = (t) => `<pre>${e(t)}</pre>`;

export function chapters() {
  figN = 0;
  const C = [];

  // ───────────────────────── 1. At a glance
  C.push({
    id: 'glance', num: '01', title: 'At a glance', sub: [],
    html: `
<p class="lead">Taking Egypt live means one human action in the Kiorex super admin: recording <b>launch gate evidence</b> for the flag <code>market.eg.live</code>. Nothing in the code ever does this for you. Until you do it, the patient site and app say Kiorex is not live in Egypt and show no doctors; the day you do it, Egypt opens within seconds, and you can close it again with one click.</p>

<div class="kpis">
  <div class="kpi"><b>1</b><span>screen: Feature flags, tab Flags, button Gate</span></div>
  <div class="kpi"><b>4</b><span>evidence fields: gate id, approver, date, document link</span></div>
  <div class="kpi"><b>1</b><span>role that can record it: <code>super_admin</code></span></div>
  <div class="kpi"><b>0</b><span>second approvers: none exists for this gate</span></div>
</div>

<h2>The honest summary</h2>
${table(['Question', 'Answer'], [
  ['Which product owns the switch?', 'Kiorex (ops console, which is the Kiorex super admin). The flag is <code>market.eg.live</code>, class LAUNCH_LOCKED, product "all".'],
  ['Who can see it?', '<code>ops_admin</code> and <code>super_admin</code> (read-only for ops_admin).'],
  ['Who can record the gate, switch it OFF, or revoke it?', '<b>Only <code>super_admin</code></b>. The buttons are disabled for an ops-only account and the API answers 403.'],
  ['Is a second person required?', '<b>No.</b> A second approver exists in the console only for money-path flags switched OFF at global or market scope. <code>market.eg.live</code> is not a money-path flag, so one super admin acts alone and the change applies immediately. Section 3.6 explains the two-person habit we recommend.'],
  ['What evidence is required?', 'Gate id, approver name, approval date and a link (http or https) to the approval document. The console never checks the document; it only records who said what and when.'],
  ['Does Kiorly need the same?', '<b>Yes, as a separate switch.</b> Kiorly markets are launched from the Kiorly admin (Market launch) or the Clinic platform screen. It creates markets, records who did what (audit), and shows the Kiorex state read-only. It is deliberately not linked to the Kiorex gate. Part B (updated after ADR-060).'],
])}

${callout('warn', 'You do this yourself', 'By founder rule the gate is never recorded by code, by an agent or by a seed. This guide was produced against a private test stack and a sample approval; <b>nothing was recorded on kx-test or anywhere shared</b>. The real Egypt gate is yours to record, with the real approval document, when counsel and the market pack are ready (NEEDS_HUMAN rows 10 and 16).')}

<h2>How this guide is organised</h2>
<ul>
<li><b>Before you start</b>: the checklist and exactly which account is used in which step.</li>
<li><b>Part A, Kiorex</b>: sign in as ops, look, then as super admin record the gate, verify on the patient side, and roll back.</li>
<li><b>Part B, Kiorly</b>: how a Kiorly market goes live (updated for ADR-060): the Kiorly admin and Clinic screens, the audit trail, and the rule that a provider belongs to its country for life.</li>
<li><b>Troubleshooting</b> and a <b>reference</b> of addresses, roles and API calls.</li>
</ul>
${callout('note', 'About the screenshots', 'Screenshots are real, taken with Playwright from a <b>private local test stack</b> (private ports and databases, Passport mock code, nothing shared). The screens are the same as on kx-test (<code>https://admin.test.kiorex.com</code>). Differences you will notice on kx-test: your own accounts instead of the local seed accounts, the "Development identity provider" footer is absent on hosted Passport, and the Launch gates table does not show local DEV seed rows. Sample approver names and links in the screenshots are placeholders.')}
`,
  });

  // ───────────────────────── 2. Before you start
  C.push({
    id: 'before', num: '02', title: 'Before you start', sub: ['Checklist', 'Accounts and roles for each step', 'Where the credentials are'],
    html: `
<h2>Checklist</h2>
<ul class="check">
<li>I have the <b>approval evidence</b> for Egypt: the market-pack certification and local counsel position (the flag's own hint says "Market pack certification + local counsel"), saved in a private location with a link that begins with https.</li>
<li>I know the <b>name of the approver</b> and the <b>approval date</b> that will be written into the record (the person who gave the approval, not necessarily me).</li>
<li>I decided <b>which environment</b>: kx-test first (<code>admin.test.kiorex.com</code>), later kx-pro. Pilot follows the promotion rule: ask carry-over or separate before promoting.</li>
<li>For kx-test, the Passport accounts for an <b>ops</b> role and a <b>super admin</b> role exist and I can sign in (see the register below). If not, create them first; this guide cannot do that for you.</li>
<li>I have my <b>phone</b> (for the sign-in code) and my <b>authenticator app</b> (for the second code that ops roles always need).</li>
<li>I have a <b>ticket or note</b> reference for the change (the Toggle dialog asks for one when I need the kill switch).</li>
<li>I know how to <b>undo it</b> (section 3.7) and who to tell if I do.</li>
</ul>

<h2>Accounts and roles for each step</h2>
${table(['Step', 'Account role', 'Why'], [
  ['Sign in, look at flag state, gate board, audit, propagation', '<b>Ops</b> account: Passport role <code>ops_admin</code>', 'Read-only. This is the safe account for checking before and after.'],
  ['Record gate evidence, switch the flag OFF/ON, revoke the gate', '<b>Super admin</b> account: Passport role <code>super_admin</code> (the account also carries <code>ops_admin</code>)', 'Only <code>super_admin</code> may write. Everything else answers 403.'],
  ['Check the patient view before and after', 'No account (public site or the Kiorex patient app signed out)', 'The market answer is public: <code>GET /api/v1/markets</code>.'],
  ['Kiorly Clinic market status (Part B)', 'Clinic <b>platform super admin</b> (Clinic role <code>PLATFORM_SUPER_ADMIN</code>, no organisation)', 'A different product and a different account system from Passport ops.'],
])}
${callout('note', 'Same person, two sign-ins', 'You are both people, so sign in twice: first as the ops account to prepare and verify, then as the super admin only for the one write. Use two browser profiles or sign out between them. The console shows the signed-in name and role at the bottom of the left menu: look at it before you click anything.')}

<h2>Where the credentials are</h2>
<p>This guide contains <b>no passwords, no authenticator secrets and no tokens</b>. Your private register is <code>_private/DEMO_ACCOUNTS.md</code> in the workspace (git-ignored, never published). It lists, per product, the account, role and phone, and says how the authenticator was set up. Remember its own warning: demo passwords and local test secrets must not be used on kx-test with real data; use accounts with generated secrets there.</p>
<p>Sign-in is always <b>Kiorex Passport</b>: mobile number, then the six-digit code sent by text message, then (for ops roles) the six-digit code from your authenticator app. The first time an ops account signs in it may ask to set up the authenticator; scan the QR with your own app and keep the secret out of chat, e-mail and git.</p>
`,
  });

  // ───────────────────────── 3. Part A Kiorex
  C.push({
    id: 'partA', num: '03', title: 'Part A: Kiorex, taking Egypt live', sub: ['3.1 What the gate is', '3.2 Sign in as ops', '3.3 Look before you leap', '3.4 Sign in as super admin and record the gate', '3.5 Verify on the patient side', '3.6 One person or two', '3.7 Roll back', '3.8 What this does not do'],
    html: `
<h2>3.1 What the gate is</h2>
<p><code>market.eg.live</code> is a <b>launch-locked</b> flag (Kiorex control plane, ADR-024). A launch-locked flag is effective only when two things are true: it is not switched OFF, <b>and</b> a human has recorded gate evidence for it. Until then its state reads <b>ON, awaiting gate</b> and the market is treated as not live. When the market is not live: Egypt is hidden from the sign-up country list and search, the patient site shows a banner, and profile, slots and booking answer <code>403 FEATURE_DISABLED</code>. Existing organisations and data are never touched.</p>
${table(['Layer', 'Where', 'Detail'], [
  ['Flag definition', '<code>flag-catalogue.ts</code>', 'key <code>market.eg.live</code>, class LAUNCH_LOCKED, scope GLOBAL, hint "Market pack certification + local counsel"'],
  ['Record / revoke', '<code>PUT /admin/flags/market.eg.live/gate</code>, <code>POST /admin/flags/market.eg.live/gate/revoke</code>', 'super_admin only; one audited evidence row'],
  ['Read', '<code>GET /admin/flags</code>, <code>/admin/gates</code>, <code>/admin/flags/audit</code>, <code>/admin/flags/propagation</code>', 'ops_admin or super_admin'],
  ['Effect', '<code>market.service.ts</code>', '<code>GET /markets</code> lists live markets; <code>?all=true</code> also shows gated ones with their state'],
])}

<h2>3.2 Sign in as ops</h2>
<p>Open the Ops console (kx-test: <code>https://admin.test.kiorex.com</code>). It sends you to Kiorex Passport. Use the <b>ops</b> account.</p>
${steps([
  'On the Passport page enter your mobile number in international format and press <b>Send code</b>.',
  'Enter the six-digit code from the text message and press <b>Verify</b>.',
  'Ops roles always see <b>Two-step verification</b>: enter the six-digit code from your authenticator app (it changes every 30 seconds) and press <b>Verify</b>.',
  'If Passport offers to add a passkey, you may choose <b>Not now</b>. You land on <b>Feature flags</b>.',
])}
${fig('ops-00-passport-landing', 'The Passport sign-in page the console redirects to. The extra "Fake Hospital SSO" button exists only on the local development identity provider, not on kx-test.', {pins:[[50,41,1]], narrow:true, crop:.93})}
${pair(fig('ops-2-code', 'Step 2: the six-digit text message code (mock provider here; on kx-test it arrives on your phone).', {crop:.8}), fig('ops-3-totp', 'Step 3: the authenticator code for ops roles. The value shown is a one-time code, useless now.', {crop:.8}))}
${fig('ops-05-flags-landing', 'You land on Feature flags. The name and role at the bottom left tell you which account you are in: here <code>ops_admin</code>.', {pins:[[3,95,1]]})}

<h2>3.3 Look before you leap</h2>
<p>Still as ops, search the flag. In the <b>Flags</b> tab type <code>market.eg.live</code> in <b>Search</b>.</p>
${fig('ops-06-flag-row', 'Before the gate: <b>Market EG</b> reads "ON · awaiting gate". The buttons are greyed and the note says "Read-only: only super admins can change flags". This is the ops account working as designed.', {pins:[[57,49,1],[93,49,2]], crop:.62})}
<p>The <b>Launch gates</b> tab lists gates that have ids (for example GHV1 for home visits). <code>market.eg.live</code> does not appear there because it names no required gate id; it is recorded from the Flags tab, button Gate. Do not worry that it is missing.</p>
${fig('ops-07-gates-tab', 'The Launch gates board (ops view, Record buttons disabled). The "DEV SEED" rows are local test data; on kx-test the deployed seed records no gates at all.', {})}
<p>Now look at the patient side while the gate is open. Open the patient site (kx-test: <code>https://test.kiorex.com</code>; the address in the registry is <code>kiorex.marketplace</code>).</p>
${fig('pat-before-1-home', 'BEFORE: patient home. A yellow bar says "Kiorex is not live in Egypt yet. You can browse, but booking is paused until it launches."', {pins:[[50,2,1]]})}
${fig('pat-before-2-search', 'BEFORE: Find a doctor. "Kiorex is not live in any market yet." and "No doctors". The sign-up country list is empty too (<code>GET /api/v1/markets</code> returns an empty list).', {pins:[[50,66,1],[12,75,2]]})}

<h2>3.4 Sign in as super admin and record the gate</h2>
<p>Sign out of the ops account (top right, Sign out) and repeat section 3.2 with the <b>super admin</b> account. Check the bottom-left label now shows both roles.</p>
${fig('sa-05-flag-row-before', 'Super admin account: the Toggle and Gate buttons are now enabled. The bottom-left label (cropped here) now reads <code>ops_admin, super_admin</code>.', {pins:[[93,49,1],[3,95,2]], crop:.62})}
${steps([
  'Search <code>market.eg.live</code> in the Flags tab and press <b>Gate</b> on that row.',
  'The dialog <b>Launch gate evidence market.eg.live</b> opens. Its hint repeats what the flag needs: market pack certification and local counsel.',
  'Fill the four fields (table below). All four are required; the Record evidence button stays disabled until the link starts with http:// or https://.',
  'Read the four values once more, then press <b>Record evidence</b>. The toast "Gate evidence recorded" appears.',
])}
${fig('sa-06-gate-dialog-empty', 'The empty gate dialog. Nothing is recorded until you press Record evidence.', {})}
${table(['Field', 'What to enter', 'Notes'], [
  ['Gate ID', 'A reference you can find again, for example your own approval reference', 'Free text for this flag (no fixed id is required). Never start it with <code>DEV-ONLY</code>: production refuses those. The screenshot uses a sample id.'],
  ['Approver', 'Name of the person or body that gave the approval', 'Free text, kept in the audit record.'],
  ['Approved on', 'Date of that approval', 'Date picker.'],
  ['Document link', 'Link to the approval document, https only', 'Keep the document in private storage; the console stores only the link and shows it to ops staff.'],
])}
${fig('sa-07-gate-dialog-filled', 'The dialog filled with SAMPLE values (a test stack and an example.com link). Use your real approval details on kx-test or kx-pro.', {pins:[[62,38,1],[62,48,2],[40,58,3],[62,69,4],[61,80,5]]})}
${fig('sa-08-recorded-toast', 'Right after pressing Record evidence: the toast "Gate evidence recorded" and the row now reads ON in both Global and Market EG. The Last change cell shows the signed-in actor.', {pins:[[50,6,1],[48,52,2]], crop:.62})}
${callout('warn', 'Do not record it twice or "for testing"', 'The record is live the moment you press the button, and it is audited with your account. If you only want to rehearse, use the private test stack, never kx-test or kx-pro. Recording again with the same gate id replaces the earlier row, which is also audited.')}

<h2>3.5 Verify on the patient side</h2>
<p>Verification has four checks. Do them in this order.</p>
${steps([
  '<b>Audit trail</b> (Audit trail tab): a new row <code>market.eg.live</code>, event GATE, change AWAITING_GATE to GATE_SATISFIED, with the actor.',
  '<b>Propagation</b> tab: the registry version rose and the products catch up. Clinic, Pharmacy and Lab poll every 30 seconds (some are also pushed by webhook). STALE or NEVER_FETCHED simply means a product has not fetched yet or is not running; give it a minute.',
  '<b>Public answer</b>: <code>GET /api/v1/markets</code> now returns Egypt with <code>live: true</code>; <code>?all=true</code> shows its state LIVE. On kx-test: <code>https://api.test.kiorex.com/api/v1/markets</code> (the CDN header gate may block visitors that are not on the allow-list).',
  '<b>Patient site and app</b>: the yellow bar is gone and doctors appear.',
])}
${fig('sa-10-audit-after', 'Audit trail: the first row is the gate recording. (Rows below it are older flag changes of the test database.)', {pins:[[40,50,1]]})}
${fig('sa-11-propagation', 'Propagation: the Clinic is IN_SYNC at the new version. Pharmacy and Lab show STALE here only because they are not running on this private stack.', {pins:[[70,54,1]]})}
${fig('pat-after-2-search', 'AFTER: Find a doctor lists doctors; the "not live" notices are gone. The number of doctors depends on the synced providers: on kx-test the demo data has 8 live providers. A completely empty list after the gate means no provider is LIVE yet, which is a separate matter (see Troubleshooting).', {})}

<h2>3.6 One person or two</h2>
<p>The platform enforces a second approver (maker-checker) only for money-path flags switched OFF at global or market scope, and for the commission policy. For <code>market.eg.live</code> a single <code>super_admin</code> records and revokes alone. Because you are the only super admin today, the control is you. Recommended habit, which is a practice and not a system rule:</p>
<ul>
<li>Do the preparation as <b>ops</b> (collect approver, date and link, check the flag state), then the single write as <b>super admin</b>.</li>
<li>Write the <b>approver</b> as the person or body that actually approved (for example the counsel or the market-pack certifier), so the record does not read as "founder approved founder".</li>
<li>Ask a trusted person to look at the audit trail the same day. Anyone with the ops role can read it.</li>
</ul>

<h2>3.7 Roll back</h2>
<p>There are two ways to close Egypt again. Both act within seconds, both are audited, and neither deletes organisations, patients, bookings or any data ("OFF stops new actions only, never hides data").</p>
${table(['', 'A. Revoke the gate', 'B. Switch the flag OFF (kill switch)'], [
  ['Where', 'Flags tab, row, <b>Gate</b>, button <b>Revoke</b>', 'Flags tab, row, <b>Toggle</b>, Value <b>OFF</b>, Scope GLOBAL (the only scope this flag offers)'],
  ['Needs', 'Nothing more. There is no confirmation and the reason is fixed as "revoked from console".', 'A reason and a ticket reference (both required). Optional expiry and start time.'],
  ['What it does', 'Deletes <b>all</b> gate evidence rows of the flag. The state returns to "awaiting gate". To reopen you must record the evidence again.', 'Keeps the evidence and overrides the flag to OFF. To reopen: Toggle, Value ON (clears the override).'],
  ['Watch out', 'Because it removes every evidence row, note down what was recorded before you press it.', 'An OFF with an <b>expiry</b> turns back ON automatically when it expires, and Egypt reopens if the gate is still recorded. Leave the expiry empty for a real stop.'],
])}
${fig('sa-13-revoke-dialog', 'Revoke: the gate dialog of a recorded flag shows who approved it and offers <b>Revoke</b> next to Record evidence.', {pins:[[53,31,1],[52,79,2]]})}
${fig('sa-12-toggle-dialog', 'Kill switch: Toggle, Value OFF, Scope GLOBAL, reason and ticket. This flag is not a money-path flag, so there is no second-approver note and the change applies immediately.', {pins:[[41,36,1],[58,36,2],[50,46,3],[50,56,4]]})}
${fig('sa-14-flag-row-revoked', 'After Revoke: back to "ON · awaiting gate" in Market EG.', {pins:[[57,49,1]], crop:.62})}
${fig('pat-revoked-1-home', 'After Revoke the patient site returns to the "not live in Egypt yet" state within seconds.', {pins:[[50,2,1]]})}

<h2>3.8 What this does not do</h2>
<ul>
<li>It does <b>not create doctors</b>. Providers appear from the Clinic sync; a market with no LIVE provider shows an empty list even when live.</li>
<li>It does <b>not open other gates</b>. Pharmacy orders (<code>kiorex.pharmacy_orders</code>), lab bookings (<code>kiorex.lab_bookings</code>) and telemedicine (<code>kiorex.telemedicine</code>) have their own evidence (NEEDS_HUMAN row 10).</li>
<li>It does <b>not change commissions or money modes</b>. Counsel sign-off on the commission policy is separate and still recorded only by a human.</li>
<li>It does <b>not switch on Kiorly's own Egypt market</b>. That is a different switch in a different product (Part B).</li>
<li>The screenshots show the Kiorex <b>patient web</b>. The patient app reads the same <code>/markets</code> answer and shows the same states.</li>
</ul>
`,
  });

  // ───────────────────────── 4. Part B Kiorly
  C.push({
    id: 'partB', num: '04', title: 'Part B: Kiorly, taking a market live', sub: ['4.1 The answer', '4.2 What exists', '4.3 Steps for Egypt', '4.4 What changed'],
    html: `
<h2>4.1 The answer to "Kiorly should be allowed to go live in a market as well, right?"</h2>
<div class="verdict"><span class="pill green">YES</span> Kiorly launches its own markets with a switch that is separate from the Kiorex one (ADR-060). It is built, audited and available in the Kiorly admin and in the Clinic platform screen.</div>
<p>The Clinic owns the market table: launch status (DRAFT, LIVE, SUNSET) and operational status (ACTIVE, PAUSED, DISABLED). New organisations can only be created in a market that is LIVE and ACTIVE. Egypt is already LIVE because the real Clinic serves Egyptian clinics.</p>

<h2>4.2 What exists</h2>
${table(['Product', 'Country switch', 'Who sets it, where'], [
  ['<b>Kiorly Clinic</b> (and Nurse)', 'Yes: Go live, Pause, Disable, Enable, tax pack, cross-border approval. Every change needs a reason and writes an append-only audit row. Optional second approver per market.', 'Clinic platform super admin (Clinic web, Platform, Market launch) <b>or</b> the Kiorly admin, Market launch view.'],
  ['<b>Kiorly Pharmacy and Lab</b>', 'No switch, by design. A pharmacy or lab belongs to the country it was created in, for life.', 'Nothing to set. Their Kiorex link is gated by the Kiorex flags of their own market.'],
  ['<b>Kiorly admin</b>', 'Market launch view with full capabilities. Only <b>super admin</b> changes; Kiorly ops reads.', 'Console edition on the Kiorly admin host. It calls the Clinic through a signed, audited route; the Clinic stays the single source of truth.'],
])}
<p><b>Country is for life.</b> No organisation (clinic, pharmacy, lab) can change market. A clinic operating in Egypt stays in Egypt, and if it is connected to Kiorex it appears only in the Kiorex Egypt market. A wrong country is a documented super-admin data fix, not a feature. The Kiorly screen shows the Kiorex state of the same country read-only, with no control.</p>
<p>For Egypt there is an extra legal guard: a market with data path A cannot go LIVE until the cross-border transfer approval is recorded (reference and expiry) or a legal pilot exception is active, and every market needs its tax pack before LIVE.</p>

<h2>4.3 Steps for Egypt</h2>
<p>You normally do <b>nothing</b> for Egypt here: the Egypt market is expected to be LIVE already, because the Clinic is in use. The steps are to check it, and to pause it if ever needed. Sign in to the Clinic web as the <b>platform super admin</b> (kx-test: <code>https://clinics.test.kiorly.com</code>; the legacy Clinic address <code>d92iz83i79c05.cloudfront.net</code> reaches the same Clinic). The account and how it signs in are in the register (section Clinic, platform super admin). Remember the register's rule: the base-seed password must not exist on a deployment with real data.</p>
${fig('kl-1-login', 'Clinic sign-in, Password tab. (Passport is the other tab; the platform super admin account is tenant-less and signs in the way the register describes.) The password is masked.', {})}
${steps([
  'After sign-in open <b>Platform</b> in the left menu and the <b>Market launch</b> tab.',
  'Find the row <b>EG, Egypt</b>. Check <b>Status = LIVE</b>, the green <b>active</b> badge, and that <b>Transfer approval</b> shows an approval reference (not "Missing approval").',
  'Open <b>Legal</b> to read or update the cross-border approval: reference, issued date, expiry, destination, approved sub-processors, and the closed-pilot exception. The dialog shows how many days remain before the approval expires.',
  'To stop <b>new</b> organisations in Egypt: <b>Pause</b> (asks for a number of days) or <b>Disable</b>. To reopen: <b>Enable</b>. Existing clinics are not affected.',
  'For a market in DRAFT the row shows <b>Go live</b>. Go live asks for a reason and checks the tax pack and the legal approval; if a check fails the screen now shows the reason in plain words (English and Arabic). Every change is recorded in the market history with who, when and why.',
])}
${fig('kl-3-market-launch-eg', 'Platform, Market launch: the Egypt row is LIVE and active with a transfer approval reference (a local test value here). Actions: Flags, Commercial, Legal, Pause, Disable.', {masks:[[29.8,71.8,2.6,2.8]], pins:[[60,69,1],[59.5,78,2],[88,70,3]]})}
${fig('kl-4-eg-legal-dialog', 'Legal: the cross-border approval (reference, dates, destination, approved sub-processors) and the legal pilot exception. These are the values the Go live check reads.', {})}
${callout('note', 'Country feature flags in the Clinic are not set here', 'The Clinic screen "Country feature flags" says <b>Managed in Kiorex super admin</b>. Feature switches per country are controlled from the Kiorex ops console and only mirrored in the Clinic. The Market launch status is the one switch that lives in the Clinic itself.')}

<h2>4.4 What changed since the first version of this guide</h2>
${table(['Earlier gap', 'Now'], [
  ['"Initiate country launch" failed (missing fields).', 'Fixed: locale, phone region, weekend days, languages and currency come from a per-country table and are validated; a duplicate country returns a clear conflict.'],
  ['No audit and no reason for Go live, Pause, Disable, Enable.', 'Fixed: reason required, append-only audit with actor, source, approval reference and link.'],
  ['No second approver.', 'Optional per market (off by default); a different person approves.'],
  ['Go live failed silently.', 'Fixed: the reason is shown, translated.'],
  ['Pharmacy and Lab had no market rules.', 'They have no switch by design; their country is fixed for life and enforced by the database.'],
  ['Kiorly admin had no market view.', 'Built: Market launch view, read for ops, change for super admin.'],
  ['Not linked to the Kiorex gate.', 'Still two independent switches by decision; the Kiorly screen shows the Kiorex state read-only.'],
])}
<p>Still open: a Kiorly-only role split (so Kiorly ops cannot reach Kiorex-only data) and, for a new Kiorly market outside Egypt, the cross-border approval and data-cell update. The <code>kx-test</code> live suite (spec 11) checks this screen against the live Clinic without changing anything.</p>
`,
  });

  // ───────────────────────── 5. Troubleshooting
  C.push({
    id: 'trouble', num: '05', title: 'Troubleshooting', sub: [],
    html: `
${callout('note', 'If something looks wrong in production', 'Close first, investigate second. Toggle <code>market.eg.live</code> OFF at GLOBAL scope with a clear reason (no expiry), then read the audit trail. Opening again is a single Toggle ON.')}
${table(['What you see', 'Likely cause', 'What to do'], [
  ['Toggle and Gate buttons are greyed; note "Read-only: only super admins can change flags".', 'You are signed in with the ops-only account.', 'Check the bottom-left label. Sign out and sign in with the super admin account.'],
  ['Save fails with 403 or "forbidden".', 'The token has no <code>super_admin</code> role (role changes need a new sign-in).', 'Sign out and in again. If the role is missing, fix it in Passport, not in the console.'],
  ['"Send code" works but no code arrives, or "too many codes".', 'The sign-in code limit is five per phone per hour.', 'Wait an hour, or ask for the code to be sent once and use it. Do not keep pressing Send.'],
  ['The authenticator code is rejected.', 'Wrong account in the app, phone clock off, or the code changed while typing.', 'Enter the next code. Set the phone clock to automatic. After repeated failures the account may lock for a while.'],
  ['<code>GATE_EVIDENCE_INCOMPLETE</code> or <code>GATE_DOCUMENT_URL_INVALID</code>.', 'A field is empty or the link does not begin with http:// or https://.', 'Complete all four fields; use a full link.'],
  ['<code>DEV_GATE_IN_PRODUCTION</code>.', 'The gate id starts with <code>DEV-ONLY</code>.', 'Use a normal reference. DEV-ONLY evidence is for local test stacks only.'],
  ['Recorded, but the patient site still shows the "not live" bar.', 'Browser or CDN cache, a product not yet synced, or an OFF override.', 'Hard refresh. Open Propagation. Open <code>/api/v1/markets?all=true</code>: state LIVE is done; <code>OFF_GLOBAL</code> means a Toggle OFF exists (Toggle, ON to clear it); <code>AWAITING_GATE</code> means no evidence is recorded.'],
  ['Egypt is live but the doctor list is empty.', 'No provider is LIVE, or provider sync has not run.', 'Open Providers in the console and check status. This is not a gate problem.'],
  ['Clinic: "Market is not accepting new organizations".', 'The market is DRAFT, paused, disabled or sunset.', 'Platform, Market launch, Enable (or wait for the pause to end). Existing clinics keep working.'],
  ['Clinic: Initiate country launch shows a red error, or Go live does nothing.', 'The tax pack or cross-border approval is missing; the screen shows the reason.', 'Read the message, then check Legal and Commercial of that market.'],
])}
`,
  });

  // ───────────────────────── 6. Reference
  C.push({
    id: 'ref', num: '06', title: 'Reference', sub: [],
    html: `
<h2>Addresses (service URL registry)</h2>
<p>Source: <code>_docs/registry/service-url-registry.yaml</code> (validated 27 Nov 2026; names are derived as service label, environment label, domain). The registry marks several hosts "planned" because they are not yet all deployed; the kx-test hosts below resolve since the 27 Nov 2026 infrastructure apply, and Clinic on kx-test is live.</p>
${table(['Service', 'kx-test', 'kx-pilot', 'kx-pro (production)'], [
  ['Kiorex patient site (marketplace)', 'https://test.kiorex.com', 'https://pilot.kiorex.com', 'https://kiorex.com'],
  ['Kiorex ops console = super admin', 'https://admin.test.kiorex.com', 'https://admin.pilot.kiorex.com', 'https://admin.kiorex.com'],
  ['Kiorex API', 'https://api.test.kiorex.com', 'https://api.pilot.kiorex.com', 'https://api.kiorex.com'],
  ['Passport (sign-in)', 'https://passport.test.kiorex.com', 'issuer is the production one', 'https://passport.kiorex.com'],
  ['Kiorly Clinic', 'https://clinics.test.kiorly.com', 'https://clinics.pilot.kiorly.com', 'https://clinics.kiorly.com'],
  ['Kiorly admin (same ops build, Kiorly edition)', 'https://admin.test.kiorly.com (planned)', 'https://admin.pilot.kiorly.com', 'https://admin.kiorly.com'],
])}
<p>The pilot environment uses the production Passport issuer (no account migration); ask the founder question "carry over or keep separate" before promoting test to pilot to production.</p>

<h2>Roles in one table</h2>
${table(['Action', 'ops_admin', 'super_admin', 'Clinic platform super admin'], [
  ['Read flags, gate board, audit, propagation', 'yes', 'yes', 'n/a'],
  ['Record gate evidence for <code>market.eg.live</code>', 'no', 'yes', 'n/a'],
  ['Toggle <code>market.eg.live</code> OFF/ON', 'no', 'yes, alone', 'n/a'],
  ['Revoke the gate', 'no', 'yes, alone', 'n/a'],
  ['Approve a money-path flag OFF request', 'no', 'yes (second person)', 'n/a'],
  ['Clinic: launch, pause, disable, enable a market', 'n/a', 'n/a', 'yes, alone'],
])}

<h2>API calls (for reference; use the console)</h2>
${table(['Call', 'Role', 'Purpose'], [
  ['<code>GET /api/v1/markets</code> and <code>?all=true</code>', 'public', 'Live markets; with all, every market and its state (LIVE, AWAITING_GATE, OFF_GLOBAL ...)'],
  ['<code>GET /api/v1/admin/flags</code>, <code>/admin/gates</code>', 'ops_admin+', 'Flag state, gate board'],
  ['<code>PUT /api/v1/admin/flags/market.eg.live/gate</code>', 'super_admin', 'Record evidence {gateId, approver, approvedOn, documentUrl}'],
  ['<code>POST /api/v1/admin/flags/market.eg.live/gate/revoke</code>', 'super_admin', 'Revoke {reason}'],
  ['<code>PUT /api/v1/admin/flags/market.eg.live/values</code>', 'super_admin', 'Toggle {scope GLOBAL, value, reason, ticket}'],
  ['<code>POST /api/v1/admin/platform/markets/:id/launch</code> (Clinic API)', 'Clinic platform super admin', 'Clinic market Go live; also pause, disable, enable'],
])}

<h2>Where this comes from</h2>
<ul>
<li>Kiorex: <code>kiorex-platform/apps/api/src/control-plane</code> (controller, flags service, catalogue), <code>apps/api/src/market</code>, <code>apps/ops/src/pages/FlagsPage.tsx</code>, <code>Docs/NEEDS_HUMAN.md</code> rows 10 and 16, <code>Docs/RUNBOOK.md</code>.</li>
<li>Kiorly: <code>clinics-management/apps/api/src/markets</code>, <code>apps/web/src/features/platform/platform-markets-tab.tsx</code>, <code>platform/data-cells.json</code>, <code>_docs/environments/INTERNATIONAL_DOMAIN_ROUTING.md</code> (ADR-059: a country is launched by configuration, and Kiorly takes the country from the organisation, not the host).</li>
<li>Source of this guide and the capture scripts: <code>_docs/guides/golive/</code> (no secrets). Private stack script: <code>e2e/scripts/golive-stack.sh</code>.</li>
</ul>

<h2>Glossary</h2>
${table(['Term', 'Meaning'], [
  ['Gate evidence', 'A human record (id, approver, date, link) that a launch-locked flag may be effective.'],
  ['Launch-locked flag', 'A flag that stays "awaiting gate" until evidence exists.'],
  ['Kill switch', 'Toggle OFF at global scope: stops new actions, hides nothing, deletes nothing.'],
  ['Maker-checker', 'Two different people: one proposes, another approves.'],
  ['Passport', 'Kiorex sign-in: phone, code, and authenticator code for ops roles.'],
  ['kx-test, kx-pilot, kx-pro', 'Test, pilot and production environments.'],
])}
`,
  });
  return C;
}
