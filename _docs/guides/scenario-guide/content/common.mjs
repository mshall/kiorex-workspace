// Shared constants for the scenario content. Hosts come from _docs/registry/service-url-registry.yaml (kx-test = env label "test"). No credential appears anywhere.
export const H = {
  patient: ['Kiorex patient web', '`https://test.kiorex.com` (kx-test) · local dev `http://localhost:5180`'],
  api: ['Kiorex API', '`https://api.test.kiorex.com/api/v1` · local `http://localhost:4000/api/v1`'],
  passport: ['Kiorex Passport', '`https://passport.test.kiorex.com` · local `http://localhost:4400/account`'],
  ops: ['Ops console (Kiorex admin)', '`https://admin.test.kiorex.com` · local `http://localhost:5181`'],
  kadmin: ['Kiorly admin (same console, Kiorly edition)', '`https://admin.test.kiorly.com` · same build, host selects the edition'],
  clinic: ['Kiorly Clinic web', '`https://clinics.test.kiorly.com` (also the legacy host `https://d92iz83i79c05.cloudfront.net`) · local `http://localhost:5174`'],
  pharmacy: ['Kiorly Pharmacy web', '`https://pharmacies.test.kiorly.com` · local `http://localhost:5192`'],
  lab: ['Kiorly Lab web', '`https://labs.test.kiorly.com` · local `http://localhost:5193`'],
  site: ['Kiorly site and Join form', '`https://test.kiorly.com/en/` and `/ar/` · built site, local preview of `kiorex-account/apps/kiorly-site`'],
  home: ['Kiorly Home (staff sign-in)', '`https://app.test.kiorly.com/signin` (live on kx-test since 28 Nov 2026) · local `http://localhost:5194/signin`'],
  staff: ['Kiorly staff app (Expo)', 'phone build `com.kiorly.app`, scheme `kiorly://` · local Expo web `http://localhost:8082`'],
  mobile: ['Kiorex patient app (Expo)', 'phone build `com.kiorex.app`, scheme `kiorex://` · local Expo web `http://localhost:8081`'],
  widget: ['Booking widget', '`https://book.test.kiorex.com` (registry host) · local served by the API on `:4000`'],
  webhooks: ['Kiorex webhooks (signed partner calls)', '`https://webhooks.test.kiorex.com/api/v1/webhooks/*`'],
};
export const REG = {
  plat: 'private register `_private/DEMO_ACCOUNTS.md`, section "Kiorex platform"',
  pass: 'private register `_private/DEMO_ACCOUNTS.md`, section "Passport and Kiorly Home"',
  clinic: 'private register `_private/DEMO_ACCOUNTS.md`, section "Clinic"',
  ph: 'private register `_private/DEMO_ACCOUNTS.md`, section "Pharmacy"',
  lab: 'private register `_private/DEMO_ACCOUNTS.md`, section "Laboratory"',
  app: 'private register `_private/DEMO_ACCOUNTS.md`, section "Kiorly staff app logins"',
};
export const OTP = 'On kx-test the code sender is a mock: read the six digits with `scripts/kx-test-otp.sh <phone>` (needs your AWS CLI credentials). On a local or private stack the mock code is in the Passport dev inbox (`/dev/inbox`) and is given in the register.';
